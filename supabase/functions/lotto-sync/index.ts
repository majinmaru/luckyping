import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DrawInput {
  drwNo: number
  drwNoDate: string
  nums: number[]
  bonusNo: number
}

function validateDraw(d: unknown): d is DrawInput {
  if (!d || typeof d !== 'object') return false
  const obj = d as Record<string, unknown>
  if (typeof obj.drwNo !== 'number' || obj.drwNo < 1 || obj.drwNo > 9999) return false
  if (typeof obj.drwNoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.drwNoDate)) return false
  if (!Array.isArray(obj.nums) || obj.nums.length !== 6) return false
  if (!obj.nums.every((n: unknown) => typeof n === 'number' && n >= 1 && n <= 45)) return false
  if (typeof obj.bonusNo !== 'number' || obj.bonusNo < 1 || obj.bonusNo > 45) return false
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // POST: client sends draw data to upsert
    if (req.method === 'POST') {
      // Verify JWT - must be authenticated
      const authHeader = req.headers.get('authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const draws: unknown[] = Array.isArray(body.draws) ? body.draws : [body]

      const validDraws: DrawInput[] = []
      for (const d of draws) {
        if (!validateDraw(d)) {
          return new Response(JSON.stringify({ error: 'Invalid draw data', received: d }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        validDraws.push(d)
      }

      if (validDraws.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid draws' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const rows = validDraws.map(d => ({
        drw_no: d.drwNo,
        drw_no_date: d.drwNoDate,
        nums: d.nums.sort((a, b) => a - b),
        bonus_no: d.bonusNo,
      }))

      const { error } = await supabase
        .from('lotto_draws')
        .upsert(rows, { onConflict: 'drw_no' })

      if (error) {
        console.error('Upsert error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({ message: `Upserted ${validDraws.length} draws`, drwNos: validDraws.map(d => d.drwNo) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET: legacy server-side fetch (may fail due to API blocking)
    const { data: latestRow } = await supabase
      .from('lotto_draws')
      .select('drw_no')
      .order('drw_no', { ascending: false })
      .limit(1)
      .single()

    return new Response(
      JSON.stringify({ latestInDb: latestRow?.drw_no || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Sync error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
