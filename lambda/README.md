# LuckyPing AWS Lambda 백엔드

AWS SAM(Serverless Application Model)으로 두 개의 Lambda 함수를 배포합니다.

- **ticket-update** — 프론트가 호출. JWT 검증 후 tickets의 wins/purchases 갱신
- **lotto-sync** — EventBridge 스케줄(매주 토요일 22:00 KST)로 동행복권 신규 회차 동기화

## 사전 준비

1. **AWS 계정 + IAM 사용자**
   - Programmatic access 키 발급
   - 권한: `AWSCloudFormationFullAccess`, `AWSLambda_FullAccess`, `IAMFullAccess`, `AmazonAPIGatewayAdministrator`, `AmazonS3FullAccess`, `AmazonEventBridgeFullAccess` (실 운영에선 최소권한으로 조이세요)

2. **AWS CLI + SAM CLI 설치**
   ```bash
   # macOS
   brew install awscli aws-sam-cli
   # Windows: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
   aws configure   # access key, secret, region (ap-northeast-2 추천)
   ```

3. **본인 Supabase에서 키 확보**
   - Project Settings → API
   - `service_role` 키 (절대 프론트에 노출 금지)
   - `anon` 키

## 배포

```bash
cd lambda

# 1) 의존성 설치 + 빌드
sam build

# 2) 최초 배포 (대화형으로 스택 이름 등 입력)
sam deploy --guided \
  --parameter-overrides \
    SupabaseUrl=https://ugdsgueyidscjfluymhg.supabase.co \
    SupabaseServiceRoleKey=eyJhbGc... \
    SupabaseAnonKey=eyJhbGc... \
    CorsOrigin=https://<github-username>.github.io

# 이후 재배포
sam build && sam deploy
```

배포가 끝나면 `Outputs` 섹션에 `ApiBaseUrl`이 표시됩니다.
이 값을 GitHub Secrets의 `VITE_LAMBDA_API_BASE`에 설정하세요.

## 로컬 테스트

```bash
sam local invoke TicketUpdateFn -e events/ticket-update.json
```

## 비용 예상

- Lambda 무료 티어: 월 100만 요청 / 40만 GB-초
- API Gateway HTTP API: 월 100만 요청 무료(첫해)
- EventBridge: 매주 1회 호출은 사실상 무료
- 본 앱 규모(60 tickets 사용자)에선 **월 $0 ~ $1** 수준
