# 흰 화면 원인과 해결 계획

## 진단 결과

브라우저로 `https://majinmaru.github.io/luckyping/`를 직접 열어 확인:

- 배포된 HTML이 빌드된 산출물이 아니라 **저장소 루트의 원본 `index.html`** 입니다.
- 콘솔 에러: `GET https://majinmaru.github.io/src/main.tsx 404`
  → `<script src="/src/main.tsx">`가 그대로 들어있다는 뜻 = Vite 번들(`/luckyping/assets/index-XXXX.js`)이 아닌 개발용 소스가 서빙되고 있음.

즉, **워크플로 파일은 존재하지만 GitHub Pages가 워크플로 산출물(`dist/`)을 사용하지 않고, `main` 브랜치 루트를 그대로 정적 호스팅** 하고 있는 상태입니다. (Pages Source = "Deploy from a branch" / main / root)

`deploy.yml`, `vite.config.ts`, `package.json` 자체는 정상이라 **코드 변경 없이 GitHub 설정만 바꾸면 됩니다.**

---

## 해결 절차 (코드 변경 없음)

### 1. Pages Source 전환 (가장 중요)
GitHub 저장소 → **Settings → Pages**
- **Source: "Deploy from a branch" → "GitHub Actions"** 로 변경
- 저장 후 안내 배너가 "Your site is being built by a GitHub Actions workflow"로 바뀌어야 정상

### 2. Repository Secrets 확인
저장소 → **Settings → Secrets and variables → Actions → Repository secrets**
다음 4개가 정확히 등록되어 있어야 함 (대소문자 일치):

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://ugdsgueyidscjfluymhg.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 새 Supabase 프로젝트의 anon key |
| `VITE_BASE_PATH` | `/luckyping/` (앞뒤 슬래시 모두 포함) |
| `VITE_LAMBDA_API_BASE` | 사용 중이라면 해당 URL (미사용이면 생략 가능) |

`VITE_BASE_PATH`가 비어 있으면 워크플로가 기본값 `/`를 쓰고, 그러면 GitHub Pages 경로 `/luckyping/` 아래에서 에셋 404가 다시 발생합니다.

### 3. 워크플로 재실행
저장소 → **Actions → "Deploy to GitHub Pages" → Run workflow** (main 브랜치)
- `build` job, `deploy` job 둘 다 초록 체크 확인
- 실패 시 로그(특히 `Build` 단계) 공유 필요

### 4. 배포 확인
- 페이지 새로고침: **Ctrl/Cmd + Shift + R** (캐시 무시)
- 정상이면 페이지 소스의 `<script>` 태그가 `/luckyping/assets/index-XXXXXXXX.js` 형태여야 함

### 5. 새 Supabase 프로젝트 Auth Redirect URLs
새 Supabase 대시보드 → **Authentication → URL Configuration**
- **Site URL**: `https://majinmaru.github.io/luckyping/`
- **Additional Redirect URLs**:
  - `https://majinmaru.github.io/luckyping/`
  - `https://majinmaru.github.io/luckyping/**`

---

## 기술 메모

- 현재 응답한 HTML은 워크플로가 산출한 `dist/index.html`(Vite가 `base=/luckyping/`로 변환한 버전)이 **아닙니다**. 즉 워크플로가 실행되지 않았거나, 실행되었더라도 Pages가 산출물을 사용하지 않고 브랜치 파일을 서빙 중입니다.
- 1단계(Source = GitHub Actions)로 전환하면 `actions/deploy-pages@v4`가 업로드한 아티팩트가 실제 호스팅 대상이 되어 문제가 해소됩니다.
- 코드/워크플로 파일 자체는 수정할 필요 없습니다. 1단계만 해도 화면이 정상화될 가능성이 가장 높고, 2번 secrets가 비어있으면 Supabase 연결 단계에서 또 흰 화면이 날 수 있으니 같이 확인해 주세요.
