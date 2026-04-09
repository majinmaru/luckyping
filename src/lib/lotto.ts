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

// Load/save from localStorage
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

// Load seed data from static JSON (bundled with app, ~1216 draws)
async function loadSeedData(): Promise<DrawData[]> {
  try {
    const res = await fetch('/data/history.json');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.draws || []).map((d: any) => ({
      drwNo: Number(d.drwNo),
      drwNoDate: d.drwNoDate,
      nums: (d.nums || []).map(Number).sort((a: number, b: number) => a - b),
      bonusNo: Number(d.bonusNo || 0),
    })).filter((d: DrawData) => d.drwNo && d.nums.length === 6);
  } catch {
    return [];
  }
}

// Fetch a single draw directly from the official API (client-side, works for Korean users)
async function fetchDrawDirect(drwNo: number): Promise<DrawData | null> {
  try {
    const res = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`
    );
    const data = await res.json();
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

// Fetch missing draws directly from official API (client-side)
async function fetchDelta(from: number, to: number): Promise<DrawData[]> {
  const draws: DrawData[] = [];
  // Batch in groups of 5
  for (let i = from; i <= to; i += 5) {
    const batch: Promise<DrawData | null>[] = [];
    for (let j = i; j < Math.min(i + 5, to + 1); j++) {
      batch.push(fetchDrawDirect(j));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r) draws.push(r);
    }
  }
  return draws;
}

function buildStats(draws: DrawData[]): StatsCache {
  const freq: Record<string, number> = {};
  for (let i = 1; i <= 45; i++) freq[i] = 0;
  draws.forEach(d => d.nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; }));
  const latest = draws.length > 0 ? draws[draws.length - 1].drwNo : 0;
  return {
    freq,
    totalDraws: draws.length,
    latestDrwNo: latest,
    updatedAt: new Date().toISOString(),
  };
}

function mergeDraws(existing: DrawData[], newDraws: DrawData[]): DrawData[] {
  const map = new Map(existing.map(d => [d.drwNo, d]));
  newDraws.forEach(d => map.set(d.drwNo, d));
  return Array.from(map.values()).sort((a, b) => a.drwNo - b.drwNo);
}

/**
 * Main data loading function.
 * 1. First load: use localStorage cache, if empty → load seed JSON (instant)
 * 2. Then fetch delta directly from official API (client-side, only missing draws)
 * 3. Merge and save
 */
export async function fetchLottoData(forceUpdate = false) {
  let cached = loadHistoryCache();
  let cachedStats = loadStatsCache();

  // Step 1: If no cache, load seed data (instant, from static file)
  if (cached.length === 0) {
    cached = await loadSeedData();
    if (cached.length > 0) {
      cachedStats = buildStats(cached);
      saveHistoryCache(cached);
      saveStatsCache(cachedStats);
    }
  }

  const latestCached = cachedStats.latestDrwNo || 0;
  const expected = getExpectedLatestDrawKST();

  // Step 2: If already up to date and not forcing, return cache
  if (!forceUpdate && latestCached >= expected && cached.length > 0) {
    return { stats: cachedStats, draws: cached };
  }

  // Step 3: Fetch only missing draws (delta) directly from official API
  const from = latestCached + 1;
  if (from > expected) {
    return { stats: cachedStats, draws: cached };
  }

  const newDraws = await fetchDelta(from, expected);
  
  if (newDraws.length === 0 && cached.length > 0) {
    return { stats: cachedStats, draws: cached };
  }

  // Merge
  const allDraws = mergeDraws(cached, newDraws);
  const stats = buildStats(allDraws);

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
