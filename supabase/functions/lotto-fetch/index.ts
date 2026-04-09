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

    // Only fetch draws from `from` to `expected` — should be a small delta
    const draws: DrawResult[] = [];
    const maxToFetch = Math.min(expected, from + 50); // Safety cap: max 50 draws per call

    // Batch fetch in parallel groups of 5
    for (let i = from; i <= maxToFetch; i += 5) {
      const batch = [];
      for (let j = i; j < Math.min(i + 5, maxToFetch + 1); j++) {
        batch.push(fetchDraw(j));
      }
      const results = await Promise.all(batch);
      for (const r of results) {
        if (r) draws.push(r);
      }
    }

    return new Response(
      JSON.stringify({
        draws: draws.sort((a, b) => a.drwNo - b.drwNo),
        expectedDrwNo: expected,
        fetchedFrom: from,
        fetchedTo: maxToFetch,
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
