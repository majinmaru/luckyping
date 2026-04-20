import { supabase } from '@/integrations/supabase/client';

// Lotto ball color class
export function colorClass(n: number): string {
  if (n <= 10) return 'ball-color-1';
  if (n <= 20) return 'ball-color-2';
  if (n <= 30) return 'ball-color-3';
  if (n <= 40) return 'ball-color-4';
  return 'ball-color-5';
}

export interface Ticket {
  id: string;
  nums: number[];
  purchases: { date: string; memo: string }[];
  wins: { date: string; rank: number }[];
  createdAt: number;
  updatedAt: number;
}

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

// ─── localStorage cache ───

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
  return { freq, totalDraws: draws.length, latestDrwNo: latest, updatedAt: new Date().toISOString() };
}

// ─── DB loaders ───

async function fetchAllDrawsFromDB(): Promise<DrawData[]> {
  try {
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
  } catch { return []; }
}

async function fetchDeltaDrawsFromDB(fromDrwNo: number): Promise<DrawData[]> {
  try {
    const { data, error } = await supabase
      .from('lotto_draws')
      .select('drw_no, drw_no_date, nums, bonus_no')
      .gt('drw_no', fromDrwNo)
      .order('drw_no', { ascending: true });
    if (error || !data) return [];
    return data.map(row => ({
      drwNo: row.drw_no,
      drwNoDate: row.drw_no_date,
      nums: (row.nums as number[]).sort((a, b) => a - b),
      bonusNo: row.bonus_no,
    }));
  } catch { return []; }
}

function mergeDraws(existing: DrawData[], newDraws: DrawData[]): DrawData[] {
  const map = new Map(existing.map(d => [d.drwNo, d]));
  newDraws.forEach(d => map.set(d.drwNo, d));
  return Array.from(map.values()).sort((a, b) => a.drwNo - b.drwNo);
}

// ─── Client-side API fetch (bypasses server blocking) ───

// CORS proxies (fallback chain). dhlottery API blocks browser direct calls,
// so we route through public CORS proxies to obtain JSON.
const CORS_PROXIES = [
  (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
  (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
];

function isValidDrawPayload(data: any, drwNo: number): boolean {
  if (!data || data.returnValue !== 'success') return false;
  if (data.drwNo !== drwNo) return false;
  const nums = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
  if (!nums.every((n) => typeof n === 'number' && n >= 1 && n <= 45)) return false;
  if (typeof data.bnusNo !== 'number' || data.bnusNo < 1 || data.bnusNo > 45) return false;
  if (typeof data.drwNoDate !== 'string') return false;
  return true;
}

async function fetchDrawFromAPI(drwNo: number): Promise<DrawData | null> {
  const target = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
  for (const buildUrl of CORS_PROXIES) {
    try {
      const res = await fetch(buildUrl(target));
      if (!res.ok) continue;
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }
      if (!isValidDrawPayload(data, drwNo)) continue;
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
      continue;
    }
  }
  console.warn(`[lotto] Failed to fetch draw ${drwNo} from all CORS proxies`);
  return null;
}

async function syncMissingDrawsViaClient(latestInDb: number, expected: number): Promise<DrawData[]> {
  const missing: DrawData[] = [];
  for (let i = latestInDb + 1; i <= expected; i++) {
    const draw = await fetchDrawFromAPI(i);
    if (draw) missing.push(draw);
  }
  if (missing.length === 0) return [];

  // Send to Edge Function for DB persistence
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.functions.invoke('lotto-sync', {
        method: 'POST',
        body: { draws: missing },
      });
    }
  } catch (err) {
    console.warn('Failed to sync draws to DB:', err);
  }

  return missing;
}

/**
 * Main data loading flow (DB-first):
 * 
 * 1. localStorage cache → instant display
 * 2. DB delta → picks up new draws since cache
 * 3. If cache was empty, full DB load
 * 4. If DB is still behind expected, client-side API fetch + Edge Function sync
 */
export async function fetchLottoData(forceUpdate = false) {
  // Step 1: localStorage cache (instant)
  let draws = loadHistoryCache();
  let stats = loadStatsCache();
  const expected = getExpectedLatestDrawKST();

  if (!forceUpdate && stats.latestDrwNo >= expected && draws.length > 0) {
    return { stats, draws };
  }

  // Step 2: If we have cached data, do a delta load
  if (draws.length > 0 && stats.latestDrwNo > 0) {
    const deltaDraws = await fetchDeltaDrawsFromDB(stats.latestDrwNo);
    if (deltaDraws.length > 0) {
      draws = mergeDraws(draws, deltaDraws);
      stats = buildStats(draws);
      saveHistoryCache(draws);
      saveStatsCache(stats);
    }
  } else {
    // Step 3: No cache — full DB load
    const allDraws = await fetchAllDrawsFromDB();
    if (allDraws.length > 0) {
      draws = allDraws;
      stats = buildStats(draws);
      saveHistoryCache(draws);
      saveStatsCache(stats);
    }
  }

  // Step 4: If DB is behind, fetch from client and sync
  if (stats.latestDrwNo < expected) {
    const clientDraws = await syncMissingDrawsViaClient(stats.latestDrwNo, expected);
    if (clientDraws.length > 0) {
      draws = mergeDraws(draws, clientDraws);
      stats = buildStats(draws);
      saveHistoryCache(draws);
      saveStatsCache(stats);
    }
  }

  return { stats, draws };
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
