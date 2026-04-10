import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DrawResult {
  drwNo: number
  drwNoDate: string
  nums: number[]
  bonusNo: number
}

async function fetchDraw(drwNo: number): Promise<DrawResult | null> {
  try {
    const res = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.dhlottery.co.kr/',
        },
      }
    )
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { return null }
    if (data.returnValue !== 'success') return null
    return {
      drwNo: data.drwNo,
      drwNoDate: data.drwNoDate,
      nums: [
        data.drwtNo1, data.drwtNo2, data.drwtNo3,
        data.drwtNo4, data.drwtNo5, data.drwtNo6,
      ].sort((a: number, b: number) => a - b),
      bonusNo: data.bnusNo,
    }
  } catch (err) {
    console.error(`Draw ${drwNo} fetch error:`, err)
    return null
  }
}

function getExpectedLatestDraw(): number {
  const firstDrawUtc = Date.UTC(2002, 11, 7, 11, 40, 0)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay()
  const hour = kst.getUTCHours()
  const minute = kst.getUTCMinutes()
  const drawDone = day !== 6 || hour > 20 || (hour === 20 && minute >= 50)
  const weeks = Math.floor((kst.getTime() - firstDrawUtc) / (7 * 24 * 60 * 60 * 1000))
  return drawDone ? weeks + 1 : weeks
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find the latest draw in DB
    const { data: latestRow } = await supabase
      .from('lotto_draws')
      .select('drw_no')
      .order('drw_no', { ascending: false })
      .limit(1)
      .single()

    const latestInDb = latestRow?.drw_no || 0
    const expected = getExpectedLatestDraw()

    if (latestInDb >= expected) {
      return new Response(
        JSON.stringify({ message: 'Already up to date', latestInDb, expected }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newDraws: DrawResult[] = []
    for (let i = latestInDb + 1; i <= expected; i += 5) {
      const batch: Promise<DrawResult | null>[] = []
      for (let j = i; j < Math.min(i + 5, expected + 1); j++) {
        batch.push(fetchDraw(j))
      }
      const results = await Promise.all(batch)
      for (const r of results) {
        if (r) newDraws.push(r)
      }
    }

    if (newDraws.length > 0) {
      const rows = newDraws.map(d => ({
        drw_no: d.drwNo,
        drw_no_date: d.drwNoDate,
        nums: d.nums,
        bonus_no: d.bonusNo,
      }))
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase
          .from('lotto_draws')
          .upsert(rows.slice(i, i + 50), { onConflict: 'drw_no' })
        if (error) console.error('Upsert error:', error)
      }
    }

    return new Response(
      JSON.stringify({
        message: `Synced ${newDraws.length} new draws`,
        latestInDb,
        expected,
        newDraws: newDraws.map(d => d.drwNo),
      }),
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
