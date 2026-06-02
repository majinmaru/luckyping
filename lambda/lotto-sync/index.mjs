// Scheduled Lambda: fetches latest 동행복권 lotto draws and upserts into Supabase.
// Run weekly (Sat 22:00 KST). Backfills any missing draws since the latest in DB.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';

async function fetchDraw(drwNo) {
  const res = await fetch(`${API}${drwNo}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.returnValue !== 'success') return null;
  return {
    drw_no: data.drwNo,
    drw_no_date: data.drwNoDate,
    nums: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
    bonus_no: data.bnusNo,
  };
}

export const handler = async () => {
  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: latest } = await svc
    .from('lotto_draws')
    .select('drw_no')
    .order('drw_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = (latest?.drw_no ?? 0) + 1;
  const inserted = [];
  // Safety cap: try up to 5 new draws per run
  for (let i = 0; i < 5; i++) {
    const draw = await fetchDraw(next).catch(() => null);
    if (!draw) break;
    const { error } = await svc.from('lotto_draws').upsert(draw, { onConflict: 'drw_no' });
    if (error) {
      console.error('upsert err', error);
      break;
    }
    inserted.push(draw.drw_no);
    next++;
  }
  return { ok: true, inserted };
};
