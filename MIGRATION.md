# LuckyPing 외부 운영 마이그레이션 가이드

기존: 구 Supabase 프로젝트 + 외부 호스팅
신규: **GitHub Pages** (프론트) + **AWS Lambda** (API) + **본인 Supabase `ugdsgueyidscjfluymhg`** (DB/Auth)

---

## 0. export된 기존 데이터

`/mnt/documents/luckyping-export/` 에 백업되어 있습니다.

- `lotto_draws.csv` / `lotto_draws.jsonl` — 1218 회차
- `lotto_draws_insert.sql` — 새 Supabase SQL Editor에 바로 붙여넣기 가능
- `tickets.csv` / `tickets.jsonl` — 60 티켓
- `old_user_ids.txt` — 기존 사용자 UUID (2명)

> `auth.users`는 Supabase 간 직접 이전이 불가능합니다 (해시된 비밀번호 + 내부 키 때문). 기존 회원은 신규 가입 또는 비밀번호 재설정이 필요합니다.

---

## 1. 본인 Supabase 세팅 (`ugdsgueyidscjfluymhg`)

### 1-1. 스키마 생성
`migration.sql` 전체를 새 Supabase 프로젝트의 **SQL Editor**에서 실행하세요.

### 1-2. lotto_draws 데이터 import
`/mnt/documents/luckyping-export/lotto_draws_insert.sql` 내용을 SQL Editor에 붙여넣고 실행.

### 1-3. Auth Provider 설정
Authentication → Providers
- **Email**: 활성화 (Confirm email 권장)
- **Google**: Client ID/Secret 입력 (Google Cloud Console에서 OAuth 2.0 클라이언트 발급)
- **Apple**: Service ID, Team ID, Key ID, Private Key 입력

### 1-4. Redirect URLs
Authentication → URL Configuration
- Site URL: `https://<github-username>.github.io/<repo>/` (또는 커스텀 도메인)
- Redirect URLs에 동일 URL + `https://<...>/reset-password` 추가

### 1-5. tickets 데이터 이전 (기존 UUID 유지 방식)

1. **새 Supabase에서 service role key 복사**: Dashboard → Project Settings → API → `service_role` key
2. **로컬에 환경 파일 생성** (gitignore됨):
   ```bash
   cat > scripts/.env.migrate <<EOF
   SUPABASE_URL=https://ugdsgueyidscjfluymhg.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<위에서 복사한 service role key>
   EOF
   ```
3. **(선택) 이메일 매핑 수정**: `scripts/migrate-users.mjs` 상단의 `USERS` 배열에서 본인 UUID의 email을 실제 이메일로 변경. 모르면 그대로 두면 `legacy-user-N@luckyping.local` placeholder로 생성됨.
4. **레거시 사용자 재생성**:
   ```bash
   node scripts/migrate-users.mjs
   ```
5. **티켓 INSERT SQL 실행**: `/mnt/documents/luckyping-export/tickets_insert.sql` (또는 repo의 `scripts/tickets_insert.sql`) 내용을 새 Supabase SQL Editor에 붙여넣고 Run. 60건이 들어갑니다.
6. **검증**:
   ```sql
   select count(*) from public.tickets;   -- 60
   select count(*) from auth.users;       -- 2 이상
   ```
7. **본인 계정 비밀번호 설정**: 앱에서 본인 이메일로 "비밀번호 재설정" 메일 받아 새 비밀번호 설정 → 로그인 → 기존 티켓 확인.

### tickets.csv를 다시 생성하고 싶다면
```bash
node scripts/generate-tickets-sql.mjs <path/to/tickets.csv> <output.sql>
```

---

## 2. AWS Lambda 배포

`lambda/README.md` 참고. 핵심 요약:

```bash
cd lambda
sam build
sam deploy --guided \
  --parameter-overrides \
    SupabaseUrl=https://ugdsgueyidscjfluymhg.supabase.co \
    SupabaseServiceRoleKey=<service-role-key> \
    SupabaseAnonKey=<anon-key> \
    CorsOrigin=https://<github-username>.github.io
```

배포 후 출력된 `ApiBaseUrl`을 기록해두세요.

---

## 3. GitHub Pages 배포

### 3-1. Repository Secrets 등록
Repo → Settings → Secrets and variables → Actions → New repository secret

| Name | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://ugdsgueyidscjfluymhg.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 본인 Supabase anon key |
| `VITE_LAMBDA_API_BASE` | SAM 배포 후 받은 ApiBaseUrl |
| `VITE_BASE_PATH` | repo 이름 형태: `/luckyping/` (커스텀 도메인이면 `/`) |

### 3-2. Pages 활성화
Repo → Settings → Pages → Source: **GitHub Actions**

### 3-3. 푸시
`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 자동 실행되어 배포됩니다.

---

## 4. 로컬 개발

```bash
cp .env.example .env
# .env 값을 채운 뒤
bun install
bun run dev
```

---

## 5. 기존 사용자 안내 템플릿

> LuckyPing이 새 서버로 이전되었습니다. 기존 회원분들께서는 죄송하지만 **재가입**이 필요합니다 (보안상 비밀번호 이전이 불가능합니다). 이전에 저장하신 티켓 기록이 필요하신 경우 gotch0411@gmail.com 으로 문의 주세요.
