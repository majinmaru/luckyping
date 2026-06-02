# LuckyPing 외부 운영 이전 계획

목표: Lovable 호스팅을 떠나 **GitHub Pages(프론트) + AWS Lambda(백엔드 로직) + 본인 Supabase `dlybhuneuwukkvyfrmmh`(DB/Auth)** 조합으로 자체 운영.

---

## 1단계: 본인 Supabase에 스키마/데이터 구축

기존 Lovable Cloud(`wtpplbyvhhmuqklyynce`)에 있는 모든 자산을 새 프로젝트로 이전.

**스키마 마이그레이션** (본인 Supabase SQL Editor에서 실행할 SQL을 `migration.sql` 파일로 제공)
- `lotto_draws` 테이블 (drw_no, drw_no_date, nums, bonus_no) + RLS(Anyone read)
- `tickets` 테이블 (user_id, nums, purchases jsonb, wins jsonb) + 사용자별 RLS 4종
- `update_updated_at_column()` 함수 + tickets용 트리거
- `protect_ticket_sensitive_columns()` 트리거 (wins/purchases 클라이언트 변경 차단)
- 모든 테이블에 anon/authenticated/service_role GRANT

**데이터 이관 방법**
- `lotto_draws`: Lambda 동기화 함수가 채워주므로 비워둬도 됨 (또는 CSV export → import)
- `tickets`: Lovable Cloud에 접근 가능한 동안 본인이 CSV/JSON export 받아 새 프로젝트에 import. 자체 export 스크립트(`scripts/export-from-old.ts`) 제공
- `auth.users`: Supabase는 프로젝트 간 직접 이전이 불가능. 사용자에게 비밀번호 재설정 메일 발송 안내 필요 (소셜 로그인 사용자는 재로그인만 하면 됨, 단 user_id가 달라지므로 tickets 매칭 처리 필요)

**Auth 설정**
- 본인 Supabase 대시보드에서 Email/Password, Google, Apple 활성화
- Site URL: `https://<github-username>.github.io/<repo>/` 추가
- Google/Apple OAuth 콜백 URL 재등록

## 2단계: 프론트엔드 Lovable 의존성 제거

- `package.json`에서 `lovable-tagger`, `@lovable.dev/cloud-auth-js`, Capacitor 관련 제거
- `vite.config.ts`에서 `componentTagger` 플러그인 제거, `base: '/<repo>/'` 추가 (GitHub Pages 서브패스 대응)
- `src/integrations/supabase/client.ts`를 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) 기반으로 재작성
- `.env.example` 제공, `.env`는 gitignore
- `supabase.functions.invoke('ticket-update', ...)` 호출부 → Lambda 엔드포인트 fetch 호출로 변경 (`src/lib/api.ts` 신설)
- Lovable Cloud 전용 코드/주석 정리

## 3단계: AWS Lambda 백엔드

기존 Edge Function 2종을 Lambda로 이식 (`lambda/` 디렉터리에 소스 포함, 별도 GitHub repo 또는 SAM/Serverless로 배포).

- **`ticket-update`**: 현재 `supabase/functions/ticket-update/index.ts` 로직 Node.js 변환. JWT 검증 후 `service_role` 키로 tickets의 wins/purchases 갱신
- **`lotto-sync`**: 동행복권 데이터를 주기적으로 가져와 `lotto_draws` upsert (EventBridge 스케줄 트리거)
- 공통: API Gateway(HTTP API) + CORS 설정, 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOTTO_SYNC_TOKEN`

배포 가이드(`lambda/README.md`)에 AWS CLI/SAM 명령어 포함.

## 4단계: GitHub Pages 배포

- `.github/workflows/deploy.yml` 작성: push to main → `npm ci && npm run build` → `dist/` GitHub Pages에 배포
- GitHub repo Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LAMBDA_API_BASE`
- `public/404.html` SPA fallback 추가 (React Router 라우트 대응)
- 커스텀 도메인 쓰면 `CNAME` 추가

## 5단계: 운영/문서

- `README.md`: 로컬 개발, 환경변수, 배포 절차
- `MIGRATION.md`: 기존 사용자 안내 (재로그인/비밀번호 재설정 안내문 템플릿)
- AdSense 게시자 ID 등 기존 설정 유지 확인

---

## 기술 세부사항

```text
[Browser]
   │  GitHub Pages 정적 파일 (Vite build)
   ▼
[ React App ]
   ├─► supabase-js → dlybhuneuwukkvyfrmmh.supabase.co  (Auth, SELECT tickets/lotto_draws)
   └─► fetch → AWS API Gateway → Lambda(ticket-update)
                                  └─ service_role → Supabase (UPDATE tickets)
                                  
[EventBridge cron] ─► Lambda(lotto-sync) ─► Supabase (UPSERT lotto_draws)
```

**중요 주의사항**
1. 본 작업 완료 후 Lovable 프리뷰는 동작하지 않게 됨 (Lovable Cloud 끊김). 작업 중에는 로컬 `npm run dev`로 테스트
2. `src/integrations/supabase/client.ts`는 평소 Lovable이 자동 관리하지만, 외부 운영 전환 시 수동 관리로 전환됨
3. `auth.users`는 이전 불가 → 기존 회원은 신규 가입 필요. tickets의 `user_id`를 이메일 기반으로 매핑하는 일회성 스크립트 제공
4. Lovable Cloud의 `wtpplbyvhhmuqklyynce`에서 데이터를 export하려면 지금 가능한 동안(Lovable에서 접근 가능할 때) 미리 받아둬야 함 — **이 export를 이번 작업 시작 전에 먼저 수행 권장**

## 결정 필요 사항
- AWS Lambda 배포 도구: **SAM** vs **Serverless Framework** vs **수동 zip 업로드** 중 선호?
- GitHub repo는 이미 존재? (Lovable이 자동 연결한 repo 사용 / 신규 생성)
- 기존 회원 데이터 export 권한 확보 가능 여부 확인됨?
