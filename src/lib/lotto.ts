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

// Load tickets from localStorage
export function loadTickets(): Ticket[] {
  try {
    const raw = JSON.parse(localStorage.getItem('lotto_tickets') || '[]');
    return raw.map((t: any, i: number) => ({
      ...t,
      createdAt: t.createdAt || (Date.now() - (raw.length - i) * 60000),
      updatedAt: t.updatedAt || (Date.now() - (raw.length - i) * 60000),
    }));
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[]) {
  localStorage.setItem('lotto_tickets', JSON.stringify(tickets));
}

// Stats & history from localStorage cache
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

// Edge function URL
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lotto-fetch`;

// Fetch latest draw info only
export async function fetchLatestDraw() {
  const res = await fetch(`${EDGE_FN_URL}?mode=latest`);
  if (!res.ok) throw new Error('최신 회차 조회 실패');
  return res.json();
}

// Fetch full lotto data (all draws from `from` to latest)
export async function fetchLottoData(force = false) {
  const cached = loadHistoryCache();
  const cachedStats = loadStatsCache();
  const from = force ? 1 : (cachedStats.latestDrwNo > 0 ? cachedStats.latestDrwNo + 1 : 1);

  // First check latest available draw
  const latestInfo = await fetchLatestDraw();
  const latestAvailable = latestInfo.latestDrwNo || 0;

  // If we already have the latest, no need to fetch
  if (!force && cachedStats.latestDrwNo >= latestAvailable && cached.length > 0) {
    return { stats: cachedStats, draws: cached };
  }

  // Fetch missing draws
  const res = await fetch(`${EDGE_FN_URL}?from=${from}`);
  if (!res.ok) throw new Error('데이터 조회 실패');
  const data = await res.json();

  const newDraws: DrawData[] = (data.draws || []).map((d: any) => ({
    drwNo: Number(d.drwNo),
    drwNoDate: d.drwNoDate,
    nums: (d.nums || []).map(Number).sort((a: number, b: number) => a - b),
    bonusNo: Number(d.bonusNo || 0),
  })).filter((d: DrawData) => d.drwNo && d.nums.length === 6);

  // Merge with cached draws (avoid duplicates)
  let allDraws: DrawData[];
  if (force) {
    allDraws = newDraws;
  } else {
    const existingMap = new Map(cached.map(d => [d.drwNo, d]));
    newDraws.forEach(d => existingMap.set(d.drwNo, d));
    allDraws = Array.from(existingMap.values()).sort((a, b) => a.drwNo - b.drwNo);
  }

  // Build frequency
  const freq: Record<string, number> = {};
  for (let i = 1; i <= 45; i++) freq[i] = 0;
  allDraws.forEach(d => d.nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; }));

  const stats: StatsCache = {
    freq,
    totalDraws: allDraws.length,
    latestDrwNo: data.stats?.latestDrwNo || (allDraws.length > 0 ? allDraws[allDraws.length - 1].drwNo : 0),
    updatedAt: new Date().toISOString(),
  };

  return { stats, draws: allDraws };
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
