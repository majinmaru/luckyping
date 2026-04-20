

## 확률분석 탭 최신회차 동기화 수정

### 문제
Edge Function에서 dhlottery.co.kr API 호출 시 서버 차단(HTML 리다이렉트)으로 데이터 수집 실패

### 해결: 클라이언트 하이브리드 동기화

브라우저는 차단되지 않으므로, 클라이언트에서 직접 API 호출 후 Edge Function을 통해 DB에 저장

### 변경 사항

**1. `src/lib/lotto.ts`**
- `fetchDrawFromAPI(drwNo)` 함수 추가 — 브라우저에서 dhlottery API 직접 호출
- `fetchLottoData()` 내에서 DB가 expected보다 뒤처져 있으면:
  - 누락된 회차를 클라이언트에서 fetch
  - `lotto-sync` Edge Function에 POST로 전달
  - 로컬 캐시 업데이트

**2. `supabase/functions/lotto-sync/index.ts`**
- POST 요청 시 body에서 draw 데이터를 받아 DB에 upsert하는 모드 추가
- JWT 인증으로 authenticated 사용자만 허용
- 입력값 검증 (drwNo 범위, nums 배열 길이/범위 등)

### 성능
- 평소: DB delta 조회만 (수십 ms)
- 새 회차 누락 시: 첫 접속 사용자만 ~1초, 이후 즉시

### 파일 목록

| 파일 | 작업 |
|------|------|
| `src/lib/lotto.ts` | 클라이언트 직접 API 호출 + Edge Function 전달 로직 추가 |
| `supabase/functions/lotto-sync/index.ts` | POST body 수신 → DB upsert 모드 추가, JWT 인증 |

