## 문제 진단

`https://majinmaru.github.io/luckyping/`의 HTML을 확인해보니 `<script src="/src/main.tsx">`가 들어 있습니다. 이는 **빌드되지 않은 원본 `index.html`**이 서빙되고 있다는 증거입니다. 정상 빌드라면 `/luckyping/assets/index-XXXX.js` 같은 해시된 번들이 들어가야 합니다.

원인은 두 가지 중 하나(또는 둘 다)입니다:

1. **GitHub Pages 소스 설정이 "GitHub Actions"가 아니라 "Deploy from a branch (main / root)"로 되어 있음** → Actions 워크플로가 만든 `dist/`가 무시되고 저장소 루트가 그대로 서빙됨
2. **`VITE_BASE_PATH` Secret이 `/`로 되어 있거나 비어 있음** → 빌드가 되더라도 자산 경로가 `/assets/...`로 나와 `/luckyping/...`에서 404

## 해결 계획 (사용자가 GitHub에서 직접 해야 하는 작업)

### 1단계: GitHub Pages 배포 소스 변경
- 저장소 → **Settings → Pages**
- **Source** 드롭다운을 **"GitHub Actions"**로 변경 (현재 "Deploy from a branch"로 되어 있을 것)

### 2단계: Repository Secret 확인/수정
**Settings → Secrets and variables → Actions** 에서 다음 값 확인:

| Secret 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://ugdsgueyidscjfluymhg.supabase.co` (새 프로젝트) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 새 Supabase 프로젝트의 anon key |
| `VITE_BASE_PATH` | `/luckyping/` ← **슬래시 양쪽 포함** |
| `VITE_LAMBDA_API_BASE` | (Lambda 안 쓰면 비워둬도 됨) |

### 3단계: 워크플로 재실행
- **Actions** 탭 → "Deploy to GitHub Pages" → **Run workflow** (또는 아무 커밋 푸시)
- 빌드 완료 후 `https://majinmaru.github.io/luckyping/` 새로고침 (캐시 무시: Ctrl+Shift+R)

### 4단계: 새 Supabase에서 Auth Redirect URL 등록
새 Supabase 프로젝트 대시보드 → **Authentication → URL Configuration**:
- **Site URL**: `https://majinmaru.github.io/luckyping/`
- **Redirect URLs** 에 추가:
  - `https://majinmaru.github.io/luckyping/`
  - `https://majinmaru.github.io/luckyping/auth`
  - `https://majinmaru.github.io/luckyping/reset-password`

이게 빠지면 로그인은 되더라도 콜백에서 흰 화면/오류가 납니다.

## 검증 방법

배포 후 `view-source:https://majinmaru.github.io/luckyping/`에서 `<script>` 태그가 `/luckyping/assets/index-XXXXXX.js`처럼 해시된 경로를 가리키면 정상입니다.

## 추가로 확인할 점

- **GitHub Actions 로그 확인**: 가장 최근 워크플로 실행이 성공했는지(녹색 체크)? 실패했다면 어느 단계에서 멈췄는지 알려주시면 추가 진단 가능합니다.
- 이 프로젝트(Lovable 쪽) 코드는 **수정할 부분이 없습니다**. 모든 작업은 GitHub 저장소 설정에서 이뤄집니다.

진행하시고 막히면 Actions 로그 스크린샷이나 에러 메시지 공유해주세요.