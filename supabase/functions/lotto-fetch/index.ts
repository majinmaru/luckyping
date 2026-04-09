const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.dhlottery.co.kr/',
        },
        redirect: 'follow',
      }
    );
    
    const text = await res.text();
    
    // Try parsing as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log(`Draw ${drwNo}: non-JSON response (status ${res.status})`);
      return null;
    }
    
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
  } catch (err) {
    console.log(`Draw ${drwNo} fetch error: ${err.message}`);
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const from = fromParam ? parseInt(fromParam, 10) : 1;
    const expected = getExpectedLatestDraw();
    const maxToFetch = Math.min(expected, from + 50);

    const draws: DrawResult[] = [];

    // Batch fetch in groups of 5
    for (let i = from; i <= maxToFetch; i += 5) {
      const batch: Promise<DrawResult | null>[] = [];
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
