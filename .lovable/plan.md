
## AWS Lambda(서울 리전) 기반 lotto 데이터 동기화

### 아키텍처

```text
[EventBridge cron: 토 20:50 KST]
        ↓
[AWS Lambda (ap-northeast-2, Node.js 20)]
        ↓ fetch
[dhlottery.co.kr API] → JSON
        ↓ upsert (service_role)
[Supabase lotto_draws]
        ↑ SELECT (anon)
[브라우저 / 클라이언트]
```

dhlottery는 한국 IP만 허용 → Seoul 리전 Lambda는 한국 IP라 정상 응답을 받음.

---

### 1) Lovable 프로젝트 코드 변경

#### `src/lib/lotto.ts`
- 제거: `fetchDrawFromAPI()`, `syncMissingDrawsViaClient()`
- 제거: `fetchLottoData()` 내 "Step 4: 클라이언트 API fetch" 블록
- 결과: 클라이언트는 **localStorage 캐시 → DB delta**만 수행 (단순화)

#### `supabase/functions/lotto-sync/index.ts`
- 제거: POST 모드 전체 (클라이언트가 더 이상 draw를 전송하지 않음)
- 함수 자체를 삭제 (`supabase--delete_edge_functions` 사용) — DB 조회는 클라이언트가 직접 함

#### `supabase/functions/lotto-fetch/index.ts`
- 삭제 (Lambda가 대체) — `supabase--delete_edge_functions` 호출

---

### 2) AWS Lambda 함수 (사용자가 AWS 콘솔에 생성)

**런타임:** Node.js 20.x
**리전:** `ap-northeast-2` (Seoul)
**타임아웃:** 60초
**환경변수:**
- `SUPABASE_URL` = `https://wtpplbyvhhmuqklyynce.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (Lovable Cloud의 service_role key)

**코드(`index.mjs`):**

```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchDraw(drwNo) {
  const res = await fetch(
    `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`
  );
  const data = await res.json();
  if (data.returnValue !== 'success') return null;
  return {
    drw_no: data.drwNo,
    drw_no_date: data.drwNoDate,
    nums: [data.drwtNo1, data.drwtNo2, data.drwtNo3,
           data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a,b)=>a-b),
    bonus_no: data.bnusNo,
  };
}

async function getLatestInDb() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/lotto_draws?select=drw_no&order=drw_no.desc&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const rows = await r.json();
  return rows[0]?.drw_no || 0;
}

function expectedLatest() {
  const firstUtc = Date.UTC(2002, 11, 7, 11, 40, 0);
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const day = kst.getUTCDay(), h = kst.getUTCHours(), m = kst.getUTCMinutes();
  const done = day !== 6 || h > 20 || (h === 20 && m >= 50);
  const weeks = Math.floor((kst.getTime() - firstUtc) / (7*24*3600*1000));
  return done ? weeks + 1 : weeks;
}

export const handler = async () => {
  const latest = await getLatestInDb();
  const target = expectedLatest();
  const rows = [];
  for (let n = latest + 1; n <= target; n++) {
    const d = await fetchDraw(n);
    if (d) rows.push(d);
    else break;
  }
  if (rows.length === 0) return { ok: true, added: 0 };

  const up = await fetch(`${SUPABASE_URL}/rest/v1/lotto_draws`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  return { ok: up.ok, added: rows.length, drwNos: rows.map(r => r.drw_no) };
};
```

**EventBridge 스케줄:** `cron(50 11 ? * SAT *)` (UTC 토 11:50 = KST 토 20:50)

---

### 3) AWS 콘솔 설정 가이드 (사용자용)

1. AWS Console → 우상단 리전을 **아시아 태평양 (서울) ap-northeast-2** 로 변경
2. **Lambda → 함수 생성**
   - 이름: `lotto-sync-seoul`
   - 런타임: Node.js 20.x
   - 아키텍처: arm64
3. **코드 탭** → `index.mjs`에 위 코드 붙여넣기 → **Deploy**
4. **구성 → 일반 구성** → 타임아웃 1분으로 변경
5. **구성 → 환경 변수** → `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 추가
   - service_role key는 Lovable에서 제공 (메시지로 안내)
6. **테스트** 탭 → 빈 이벤트 `{}` 로 실행 → `{ ok: true, added: N }` 확인
7. **트리거 추가 → EventBridge (CloudWatch Events) → 새 규칙 생성**
   - 규칙 유형: 스케줄 표현식
   - 표현식: `cron(50 11 ? * SAT *)`

---

### 변경 파일 목록

| 파일 | 작업 |
|------|------|
| `src/lib/lotto.ts` | `fetchDrawFromAPI`, `syncMissingDrawsViaClient`, Step 4 제거 |
| `supabase/functions/lotto-sync/` | 삭제 (`delete_edge_functions`) |
| `supabase/functions/lotto-fetch/` | 삭제 (`delete_edge_functions`) |
| AWS Lambda | 사용자가 콘솔에서 생성 (코드/가이드 제공) |

### 검증
- Lambda 수동 테스트로 1회 upsert 성공 확인
- 브라우저에서 확률분석 탭 진입 → DB에서 최신 회차 표시되는지 확인
