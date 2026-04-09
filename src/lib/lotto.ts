import { supabase } from '@/integrations/supabase/client';

// Lotto ball color class
export function colorClass(n: number): string {
  if (n <= 10) return 'ball-color-1';
  if (n <= 20) return 'ball-color-2';
  if (n <= 30) return 'ball-color-3';
  if (n <= 40) return 'ball-color-4';
  return 'ball-color-5';
}

// Ticket type
export interface Ticket {
  id: string;
  nums: number[];
  purchases: { date: string; memo: string }[];
  wins: { date: string; rank: number }[];
  createdAt: number;
  updatedAt: number;
}

// Stats cache type
export interface StatsCache {
  freq: Record<string, number> | null;
  totalDraws: number;
  latestDrwNo: number;
  updatedAt: string | null;
}

export interface DrawData {
  drwNo: number;
  drwNoDate: string;
  nums: number[];
  bonusNo: number;
}

// Load/save from localStorage (cache only)
export function loadStatsCache(): StatsCache {
  try {
    const s = localStorage.getItem('lotto_stats');
    if (s) return JSON.parse(s);
  } catch {}
  return { freq: null, totalDraws: 0, latestDrwNo: 0, updatedAt: null };
}

export function saveStatsCache(stats: StatsCache) {
  localStorage.setItem('lotto_stats', JSON.stringify(stats));
}

export function loadHistoryCache(): DrawData[] {
  try {
    const h = localStorage.getItem('lotto_history');
    if (h) return JSON.parse(h);
  } catch {}
  return [];
}

export function saveHistoryCache(history: DrawData[]) {
  localStorage.setItem('lotto_history', JSON.stringify(history));
}

function buildStats(draws: DrawData[]): StatsCache {
  const freq: Record<string, number> = {};
  for (let i = 1; i <= 45; i++) freq[i] = 0;
  draws.forEach(d => d.nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; }));
  const latest = draws.length > 0 ? Math.max(...draws.map(d => d.drwNo)) : 0;
  return {
    freq,
    totalDraws: draws.length,
    latestDrwNo: latest,
    updatedAt: new Date().toISOString(),
  };
}

/** Fetch all draws from DB */
async function fetchDrawsFromDB(): Promise<DrawData[]> {
  const allDraws: DrawData[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('lotto_draws')
      .select('drw_no, drw_no_date, nums, bonus_no')
      .order('drw_no', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      allDraws.push({
        drwNo: row.drw_no,
        drwNoDate: row.drw_no_date,
        nums: (row.nums as number[]).sort((a, b) => a - b),
        bonusNo: row.bonus_no,
      });
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allDraws;
}

/** Try fetching a single draw from the official API (works for Korean users only) */
async function fetchDrawDirect(drwNo: number): Promise<DrawData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    if (data.returnValue !== 'success') return null;
    return {
      drwNo: data.drwNo,
      drwNoDate: data.drwNoDate,
      nums: [
        data.drwtNo1, data.drwtNo2, data.drwtNo3,
        data.drwtNo4, data.drwtNo5, data.drwtNo6,
      ].sort((a: number, b: number) => a - b),
      bonusNo: data.bnusNo,
    };
  } catch {
    return null;
  }
}

/** Save new draws to DB so other users benefit */
async function saveDrawsToDB(draws: DrawData[]) {
  if (draws.length === 0) return;
  const rows = draws.map(d => ({
    drw_no: d.drwNo,
    drw_no_date: d.drwNoDate,
    nums: d.nums,
    bonus_no: d.bonusNo,
  }));
  // upsert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from('lotto_draws').upsert(rows.slice(i, i + 50), { onConflict: 'drw_no' });
  }
}

/**
 * Main data loading function.
 * 1. Load from localStorage cache (instant)
 * 2. Load from DB (fast, always up-to-date if any Korean user has synced)
 * 3. If still missing draws, try client-side fetch (Korean users only)
 * 4. Save new draws to DB for all users
 */
export async function fetchLottoData(forceUpdate = false) {
  // Step 1: Use cache for instant display
  let cached = loadHistoryCache();
  let cachedStats = loadStatsCache();
  const latestCached = cachedStats.latestDrwNo || 0;
  const expected = getExpectedLatestDrawKST();

  // If cache is fresh and not forcing, return immediately
  if (!forceUpdate && latestCached >= expected && cached.length > 0) {
    return { stats: cachedStats, draws: cached };
  }

  // Step 2: Fetch from DB
  try {
    const dbDraws = await fetchDrawsFromDB();
    if (dbDraws.length > 0) {
      cached = dbDraws;
      cachedStats = buildStats(dbDraws);
      saveHistoryCache(cached);
      saveStatsCache(cachedStats);

      if (cachedStats.latestDrwNo >= expected) {
        return { stats: cachedStats, draws: cached };
      }
    }
  } catch {
    // DB fetch failed, continue with cache
  }

  // Step 3: Try client-side direct fetch for missing draws (Korean users)
  const from = cachedStats.latestDrwNo + 1;
  if (from <= expected) {
    const newDraws: DrawData[] = [];
    for (let i = from; i <= expected; i += 5) {
      const batch: Promise<DrawData | null>[] = [];
      for (let j = i; j < Math.min(i + 5, expected + 1); j++) {
        batch.push(fetchDrawDirect(j));
      }
      const results = await Promise.all(batch);
      for (const r of results) {
        if (r) newDraws.push(r);
      }
    }

    if (newDraws.length > 0) {
      // Merge
      const map = new Map(cached.map(d => [d.drwNo, d]));
      newDraws.forEach(d => map.set(d.drwNo, d));
      cached = Array.from(map.values()).sort((a, b) => a.drwNo - b.drwNo);
      cachedStats = buildStats(cached);
      saveHistoryCache(cached);
      saveStatsCache(cachedStats);

      // Save to DB for other users
      saveDrawsToDB(newDraws).catch(() => {});
    }
  }

  return { stats: cachedStats, draws: cached };
}

export function getExpectedLatestDrawKST(): number {
  const firstDrawUtc = Date.UTC(2002, 11, 7, 11, 40, 0);
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  const drawDone = day !== 6 || hour > 20 || (hour === 20 && minute >= 50);
  const weeks = Math.floor((kst.getTime() - firstDrawUtc) / (7 * 24 * 60 * 60 * 1000));
  return drawDone ? weeks + 1 : weeks;
}

export function getCurrentKstLabel(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getUpdateStatusText(latestDrwNo: number): string {
  const expected = getExpectedLatestDrawKST();
  const status = latestDrwNo >= expected ? '최신' : '업데이트 필요';
  return `${latestDrwNo}회차 기준 · ${getCurrentKstLabel()} · ${status}`;
}
