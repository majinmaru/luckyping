# 2026-07-11 저장소 정리 내역

Lovable 초기 생성 시 딸려온 미사용 파일/의존성을 제거했습니다.
정리 후 `bun run build`(프로덕션 빌드)와 `bun run test` 모두 통과 확인 완료.

## 삭제된 파일

| 항목 | 이유 |
|---|---|
| `.env` | **커밋된 환경변수 파일** — .gitignore에는 있었지만 이미 추적 중이었음. anon key는 원래 공개용이라 위험도는 낮지만 저장소에 두면 안 됨 |
| `.lovable/plan.md` | Lovable 작업 플랜 잔재 (이미 반영 완료된 내용) |
| `bun.lockb` | 구버전 바이너리 락파일. 텍스트 `bun.lock`만 사용 |
| `supabase/config.toml` | Lovable의 Supabase CLI 연결 파일. 현재는 대시보드 + `migration.sql`로 관리하므로 불필요 |
| `public/data/*.json` (history/latest/stats) | 코드 어디에서도 참조 안 함. 현재 데이터는 Supabase `lotto_draws`에서 조회 |
| `public/placeholder.svg` | 미참조 |
| `src/App.css` | 미참조 (스타일은 `index.css` + Tailwind) |
| `src/hooks/use-mobile.tsx` | sidebar 컴포넌트 전용이었는데 sidebar 삭제로 미사용 |
| `src/components/ui/` 43개 파일 | shadcn 전체 세트 중 실사용 7종만 유지: `button, calendar, popover, sonner, toast, toaster, tooltip` |

## package.json 변경

- 이름: `vite_react_shadcn_ts` → `luckyping`, 버전 `1.0.0`
- **dependencies 32개 제거** (radix 24종 중 20종, recharts, react-hook-form, zod,
  cmdk, vaul, embla-carousel, input-otp, react-resizable-panels 등)
- devDependencies: `@playwright/test`(설정 파일 없음), `@tailwindcss/typography`(미사용) 제거
- 결과: dependencies 50 → 18, `bun install` 시 패키지 34개 감소, JS 번들 소폭 감소

## 유지한 것 (헷갈릴 수 있는 항목)

- `components.json` — 나중에 `bunx shadcn add <컴포넌트>`로 추가할 때 필요. 1KB라 유지
- `scripts/` — 이전용 일회성 스크립트지만 재이전/복구 시 필요할 수 있어 유지
- `src/test/` — vitest 기본 셋업. CI 확장 대비 유지
- `next-themes` — `ui/sonner.tsx`가 내부적으로 사용

## 적용 후 반드시 할 일

`.env`가 git 히스토리에 남아 있으므로 로컬에서 추적 해제 커밋이 필요합니다:

```bash
git rm --cached .env
git commit -m "chore: remove committed .env"
```

과거 커밋 히스토리에서도 완전히 지우려면 (선택):

```bash
git filter-repo --invert-paths --path .env
git push --force
```

> anon key는 프론트엔드에 노출되는 공개 키라 즉시 위험하지는 않지만,
> 혹시 service_role key 등이 커밋된 적이 있다면 Supabase에서 키 재발급을 권장합니다.
