## 문제
소셜 로그인 시 `Unsupported provider: provider is not enabled` 오류 — Lovable Cloud 백엔드에 Google OAuth 공급자가 활성화되어 있지 않습니다.

## 해결 방법
`configure_social_auth` 도구로 **Google** 공급자를 활성화합니다. Lovable Cloud의 관리형 OAuth 자격증명을 사용하므로 별도의 Google Cloud Console 설정은 필요 없습니다.

## GitHub Pages 배포 관련 추가 설정
배포 사이트(`https://<username>.github.io/luckyping/`)에서 로그인이 작동하려면 Cloud 대시보드 → Authentication → URL Configuration의 **Redirect URLs**에 다음을 추가해야 합니다:
- `https://<username>.github.io/luckyping/**`

(이 부분은 사용자가 대시보드에서 직접 추가)

## 코드 변경
없음. 백엔드 공급자 설정만 변경합니다.