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

// Fetch and normalize data
export async function fetchLottoData(force = false) {
  const base = './data';
  const suffix = force ? `?v=${Date.now()}` : '';
  const [latestRaw, statsRaw, historyRaw] = await Promise.all([
    fetch(`${base}/latest.json${suffix}`, { cache: force ? 'no-store' : 'default' }).then(r => r.json()),
    fetch(`${base}/stats.json${suffix}`, { cache: force ? 'no-store' : 'default' }).then(r => r.json()),
    fetch(`${base}/history.json${suffix}`, { cache: force ? 'no-store' : 'default' }).then(r => r.json()),
  ]);

  const draws: DrawData[] = (historyRaw?.draws || [])
    .map((d: any) => ({
      drwNo: Number(d.drwNo),
      drwNoDate: d.drwNoDate,
      nums: (d.nums || []).map(Number).sort((a: number, b: number) => a - b),
      bonusNo: Number(d.bonusNo || 0),
    }))
    .filter((d: DrawData) => d.drwNo && d.nums.length === 6);

  const freq: Record<string, number> = {};
  for (let i = 1; i <= 45; i++) freq[i] = 0;
  draws.forEach(d => d.nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; }));

  const stats: StatsCache = {
    freq: statsRaw?.freq || freq,
    totalDraws: Number(statsRaw?.totalDraws || draws.length),
    latestDrwNo: Number(latestRaw?.latestDrwNo || statsRaw?.latestDrwNo || 0),
    updatedAt: latestRaw?.updatedAt || statsRaw?.updatedAt || null,
  };

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
