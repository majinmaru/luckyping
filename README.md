# LuckyPing 🍀

행운은 내 손으로 — 로또 티켓 기록 / 번호 생성 / 분석 웹 앱.

## Stack

- **Frontend**: React 18 + Vite + Tailwind + shadcn/ui → **GitHub Pages**
- **Backend**: AWS Lambda (Node.js 20, ARM) + API Gateway HTTP API, SAM 배포
- **DB / Auth**: Supabase (셀프 운영, 본인 프로젝트)

```
[Browser] → GitHub Pages
              │
              ├── supabase-js → Supabase (Auth, tickets/lotto_draws SELECT)
              └── fetch       → AWS Lambda (ticket-update, service_role로 갱신)

[EventBridge 매주 토요일] → Lambda(lotto-sync) → Supabase (lotto_draws upsert)
```

## 로컬 개발

```bash
cp .env.example .env
# .env 값 입력
bun install
bun run dev
```

## 배포

자세한 절차는 [`MIGRATION.md`](./MIGRATION.md) 참고.

1. Supabase: `migration.sql` + `scripts/lotto_draws_insert.sql` 실행, OAuth provider 설정
2. AWS Lambda: `cd lambda && sam build && sam deploy --guided`
3. GitHub Pages: Repository Secrets 등록 후 `main` 브랜치에 푸시 → 자동 배포

## 환경 변수

| 이름 | 용도 |
|---|---|
| `VITE_SUPABASE_URL` | 본인 Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_LAMBDA_API_BASE` | API Gateway base URL |
| `VITE_BASE_PATH` | GH Pages 서브패스. 커스텀 도메인이면 `/` |

## 문의

gotch0411@gmail.com
