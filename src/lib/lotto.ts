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

/**
 * Main data loading flow (DB-first):
 * 
 * 1. localStorage cache → instant display
 * 2. DB delta → picks up new draws since cache
 * 3. If cache was empty, full DB load
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
    return { stats, draws };
  }

  // Step 3: No cache — full DB load
  const allDraws = await fetchAllDrawsFromDB();
  if (allDraws.length > 0) {
    draws = allDraws;
    stats = buildStats(draws);
    saveHistoryCache(draws);
    saveStatsCache(stats);
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
