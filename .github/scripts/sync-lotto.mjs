// GitHub Actions weekly sync script
// 1) Read latest drwNo currently in DB (via lotto-sync GET, public)
// 2) Compute expected latest drwNo (KST Sat 20:50 cutoff)
// 3) Fetch missing draws directly from dhlottery
// 4) POST validated draws to lotto-sync with x-sync-token header

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const LOTTO_SYNC_TOKEN = process.env.LOTTO_SYNC_TOKEN;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !LOTTO_SYNC_TOKEN) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, LOTTO_SYNC_TOKEN');
  process.exit(1);
}

const SYNC_FN_URL = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/lotto-sync`;
const DHLOTTERY_URL = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';

function getExpectedLatestDrawKST() {
  const firstDrawUtc = Date.UTC(2002, 11, 7, 11, 40, 0);
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const drawDone = day !== 6 || hour > 20 || (hour === 20 && minute >= 50);
  const weeks = Math.floor((kst.getTime() - firstDrawUtc) / (7 * 24 * 60 * 60 * 1000));
  return drawDone ? weeks + 1 : weeks;
}

function isValidDrawPayload(data, drwNo) {
  if (!data || data.returnValue !== 'success') return false;
  if (data.drwNo !== drwNo) return false;
  const nums = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
  if (!nums.every((n) => typeof n === 'number' && n >= 1 && n <= 45)) return false;
  if (typeof data.bnusNo !== 'number' || data.bnusNo < 1 || data.bnusNo > 45) return false;
  if (typeof data.drwNoDate !== 'string') return false;
  return true;
}

async function fetchLatestInDb() {
  const res = await fetch(SYNC_FN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error(`GET lotto-sync failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.latestInDb || 0;
}

async function fetchDraw(drwNo) {
  const res = await fetch(`${DHLOTTERY_URL}${drwNo}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuckyPing-Sync/1.0)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!isValidDrawPayload(data, drwNo)) return null;
  return {
    drwNo: data.drwNo,
    drwNoDate: data.drwNoDate,
    nums: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a, b) => a - b),
    bonusNo: data.bnusNo,
  };
}

async function postDraws(draws) {
  const res = await fetch(SYNC_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sync-token': LOTTO_SYNC_TOKEN,
    },
    body: JSON.stringify({ draws }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST lotto-sync failed: ${res.status} ${text}`);
  console.log('Sync response:', text);
}

async function main() {
  const latestInDb = await fetchLatestInDb();
  const expected = getExpectedLatestDrawKST();
  console.log(`latestInDb=${latestInDb}, expected=${expected}`);

  if (latestInDb >= expected) {
    console.log('Already up to date. Nothing to do.');
    return;
  }

  const draws = [];
  for (let n = latestInDb + 1; n <= expected; n++) {
    console.log(`Fetching draw ${n}...`);
    const d = await fetchDraw(n);
    if (!d) {
      console.warn(`Draw ${n} unavailable (skipping).`);
      continue;
    }
    draws.push(d);
    // be polite
    await new Promise((r) => setTimeout(r, 300));
  }

  if (draws.length === 0) {
    throw new Error('No draws fetched; failing so retry can happen.');
  }

  console.log(`Posting ${draws.length} draws to lotto-sync...`);
  await postDraws(draws);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
