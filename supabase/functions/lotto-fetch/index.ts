import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DrawResult {
  drwNo: number;
  drwNoDate: string;
  nums: number[];
  bonusNo: number;
}

async function fetchDraw(drwNo: number): Promise<DrawResult | null> {
  try {
    const res = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`
    );
    const data = await res.json();
    if (data.returnValue !== "success") return null;
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

function getExpectedLatestDraw(): number {
  const firstDrawUtc = Date.UTC(2002, 11, 7, 11, 40, 0);
  const now = Date.now();
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  // Draw happens Saturday ~20:45 KST, results available ~20:50
  const drawDone = day !== 6 || hour > 20 || (hour === 20 && minute >= 50);
  const weeks = Math.floor((kst.getTime() - firstDrawUtc) / (7 * 24 * 60 * 60 * 1000));
  return drawDone ? weeks + 1 : weeks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const from = fromParam ? parseInt(fromParam, 10) : 1;
    const expected = getExpectedLatestDraw();

    // If "latest" mode — just fetch the latest few draws
    const mode = url.searchParams.get("mode");

    if (mode === "latest") {
      // Try to find the actual latest available draw
      let latestDrwNo = expected;
      let latestDraw: DrawResult | null = null;
      
      // Try expected, then go back up to 2 weeks
      for (let i = 0; i < 3; i++) {
        latestDraw = await fetchDraw(latestDrwNo - i);
        if (latestDraw) {
          latestDrwNo = latestDraw.drwNo;
          break;
        }
      }

      return new Response(
        JSON.stringify({
          latestDrwNo: latestDraw?.drwNo || 0,
          expectedDrwNo: expected,
          latestDraw,
          updatedAt: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // "range" mode — fetch draws from `from` to latest
    const draws: DrawResult[] = [];
    const batchSize = 5;

    for (let i = from; i <= expected; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, expected + 1); j++) {
        batch.push(fetchDraw(j));
      }
      const results = await Promise.all(batch);
      for (const r of results) {
        if (r) draws.push(r);
      }
    }

    // Build frequency map
    const freq: Record<number, number> = {};
    for (let n = 1; n <= 45; n++) freq[n] = 0;
    draws.forEach((d) => d.nums.forEach((n) => { freq[n]++; }));

    const latestDraw = draws.length > 0 ? draws[draws.length - 1] : null;

    return new Response(
      JSON.stringify({
        stats: {
          freq,
          totalDraws: draws.length,
          latestDrwNo: latestDraw?.drwNo || 0,
          updatedAt: new Date().toISOString(),
        },
        draws: draws.sort((a, b) => a.drwNo - b.drwNo),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
