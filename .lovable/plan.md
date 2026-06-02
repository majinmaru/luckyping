## 목표
기존 Supabase에서 export한 사용자 2명(76a0601a..., 38fcea6c...)과 티켓 60건을 새 Supabase(ugdsgueyidscjfluymhg)에 **기존 UUID를 그대로 유지하면서** 마이그레이션.

## 전제: 이메일 정보 필요
Admin API로 같은 UUID 사용자를 만들려면 **이메일이 반드시 필요**합니다. 현재 "unknown"으로 답변하셨는데, 두 가지 방법 중 하나로 진행 가능:

**옵션 A (권장):** 본인이 기억하는 이메일 1개(아마 `gotch0411@gmail.com`)는 본인 UUID에 매핑, 나머지 1명은 플레이스홀더 이메일(`legacy-user-1@luckyping.local`)로 생성. 그 사용자는 사실상 로그인 불가 상태로 데이터만 보존.

**옵션 B:** 두 명 모두 플레이스홀더 이메일로 생성. 나중에 본인 계정은 Supabase Dashboard에서 이메일 변경 → 비밀번호 재설정.

→ Plan 실행 시작 전 어떤 UUID가 본인 계정인지 알려주시면 옵션 A로 진행.

## 단계

### 1. Admin 스크립트 작성 (`scripts/migrate-users.mjs`)
- `@supabase/supabase-js`의 `auth.admin.createUser()` 사용
- `SUPABASE_SERVICE_ROLE_KEY`로 인증
- 각 UUID에 대해 `{ id, email, email_confirm: true, password: <임시랜덤> }` 로 생성
- 이미 존재하면 skip

### 2. 새 Supabase 환경 변수 준비 (로컬 `.env.migrate`)
```
SUPABASE_URL=https://ugdsgueyidscjfluymhg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<새 프로젝트 service role key>
```
service role key는 Supabase Dashboard → Project Settings → API에서 복사.

### 3. 사용자 생성 실행
```
node scripts/migrate-users.mjs
```
→ auth.users에 2개 row 생성 확인.

### 4. 티켓 데이터 import용 SQL 생성 (`scripts/tickets_insert.sql`)
- `tickets.csv` → `INSERT INTO public.tickets (id, user_id, nums, purchases, wins, created_at, updated_at) VALUES (...)` 형태로 변환하는 1회용 Node 스크립트로 생성
- `ON CONFLICT (id) DO NOTHING` 추가하여 재실행 안전
- 결과 파일은 `/mnt/documents/luckyping-export/tickets_insert.sql`에도 출력

### 5. 새 Supabase SQL Editor에서 실행
1. `migration_schema.sql` (이미 실행했으면 skip)
2. `lotto_draws_insert.sql` (이미 실행했으면 skip)
3. `tickets_insert.sql` ← 이번에 새로 생성

### 6. 검증
- SQL Editor에서 `select count(*) from public.tickets;` → 60
- 새 프로젝트에 본인 이메일로 로그인 시도 → 비밀번호 재설정 메일 받고 새 비밀번호 설정 → 기존 티켓들이 모두 보이는지 확인

## 결과물
- `scripts/migrate-users.mjs` (사용자 재생성 스크립트)
- `scripts/tickets_insert.sql` (티켓 import SQL)
- `MIGRATION.md`에 위 절차 추가

## 사용자가 직접 해야 하는 것
1. 어떤 UUID가 본인인지 + 이메일 알려주기 (또는 옵션 B 선택)
2. 새 Supabase의 **service role key** 알려주기 (스크립트 실행용)
3. 마이그레이션 후 본인 이메일로 비밀번호 재설정
