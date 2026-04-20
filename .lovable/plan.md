
## 최신회차 자동 동기화 — GitHub Actions 방식

### 목표
매주 토요일 KST 21:00에 GitHub Actions가 dhlottery에서 최신 회차를 fetch → Edge Function `lotto-sync`에 POST → DB upsert.
GitHub runner는 Azure IP라 dhlottery 차단 사례가 거의 없어 안정적.

### 아키텍처

```text
GitHub Actions (cron: 매주 토 UTC 12:00)
  └─ Node 스크립트
       ├─ DB 최신 drwNo 조회 (Supabase REST, anon)
       ├─ expected까지 dhlottery API 직접 fetch
       ├─ 응답 검증
       └─ POST → lotto-sync (Bearer LOTTO_SYNC_TOKEN)
             └─ Edge Function: 토큰 검증 → lotto_draws upsert
```

### 변경 사항

**1. 시크릿 (Lovable Cloud)**
- `LOTTO_SYNC_TOKEN` — Edge Function ↔ GitHub Action 공유 비밀

**2. GitHub 시크릿 (사용자 직접 설정)**
- `LOTTO_SYNC_TOKEN` — 위와 동일 값
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — DB 최신 회차 조회용 (공개키 OK)

**3. `supabase/functions/lotto-sync/index.ts` 수정**
- POST 인증 방식 변경: JWT → `x-sync-token` 헤더로 `LOTTO_SYNC_TOKEN` 검증
- 기존 검증/upsert 로직 유지

**4. `supabase/config.toml`**
- `[functions.lotto-sync] verify_jwt = false` 추가

**5. `.github/workflows/lotto-sync.yml` 신규**
- cron: `0 12 * * 6` (UTC 토 12:00 = KST 21:00)
- 수동 트리거(workflow_dispatch)도 허용
- Node 18, fetch 사용
- 실패 시 자동 재시도 1회

**6. `.github/scripts/sync-lotto.mjs` 신규**
- DB 최신 회차 조회
- expected 계산 (KST 토 20:50 기준)
- 누락 회차 dhlottery에서 fetch + 검증
- lotto-sync로 일괄 POST

**7. 클라이언트 (`src/lib/lotto.ts`)**
- 기존 Worker 폴백 로직 유지 (사용자 답변대로)
- 단, JWT 헤더 대신 sync 토큰을 클라이언트에서 사용할 수는 없으므로
  → 클라이언트 폴백은 lotto-sync 호출 부분 제거하고 로컬 캐시만 갱신
  → DB 영구 저장은 cron만 담당

### 진행 순서
1. `LOTTO_SYNC_TOKEN` 시크릿 추가 (Lovable Cloud)
2. Edge Function 토큰 인증으로 변경 + config.toml
3. 워크플로/스크립트 파일 생성
4. 클라이언트 폴백 정리
5. 사용자에게 GitHub Secrets 3개 등록 + 수동 1회 실행 안내
