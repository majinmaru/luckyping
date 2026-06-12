# Auth 리다이렉트 URL 수정 플랜

## 문제
`src/pages/Auth.tsx`에서 Supabase Auth 호출 시 `window.location.origin`만 전달 → GitHub Pages 서브패스(`/luckyping/`)가 빠져 OAuth/이메일 콜백이 `https://majinmaru.github.io/`로 떨어져 404 발생.

## 변경 사항

### 1. `src/pages/Auth.tsx`
컴포넌트 상단에 헬퍼 추가:
```ts
const redirectBase = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '');
```

세 곳 교체:
- `signUp` → `emailRedirectTo: redirectBase`
- `resetPasswordForEmail` → `redirectTo: \`${redirectBase}/reset-password\``
- `signInWithOAuth` (Google, Apple) → `redirectTo: redirectBase`

`BASE_URL`은 Vite가 빌드 시 `/luckyping/`(prod) 또는 `/`(dev)로 치환하므로 로컬/배포 모두 동작합니다.

### 2. Supabase 콘솔 등록 안내 (사용자 작업)
Supabase `ugdsgueyidscjfluymhg` → Authentication → URL Configuration에 아래 URL 등록 필요:
- Site URL: `https://majinmaru.github.io/luckyping/`
- Redirect URLs:
  - `https://majinmaru.github.io/luckyping`
  - `https://majinmaru.github.io/luckyping/`
  - `https://majinmaru.github.io/luckyping/reset-password`
  - `http://localhost:8080`
  - `http://localhost:8080/reset-password`

또한 Google Cloud Console OAuth Client의 Authorized redirect URI에 Supabase 콜백
`https://ugdsgueyidscjfluymhg.supabase.co/auth/v1/callback`이 등록되어 있어야 합니다.

## 검증
- 로컬: `bun run dev` → `http://localhost:8080/auth`에서 Google 로그인 → `/`로 복귀
- 프로덕션: GitHub Pages 배포 후 `https://majinmaru.github.io/luckyping/auth` → Google 선택 → `/luckyping/`로 복귀

## 영향 범위
프론트엔드 단 1개 파일 수정. 비즈니스 로직 변경 없음.
