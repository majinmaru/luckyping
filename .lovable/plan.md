

# `LOTTO_SYNC_TOKEN`에 입력할 값 안내

## 결론
**아무 값이나 길고 무작위한 문자열이면 됩니다.** 어디서 발급받는 토큰이 아니라, **사용자가 직접 만드는 비밀번호** 같은 값입니다.

## 이 토큰의 역할

```text
GitHub Actions ──[ x-sync-token: <값> ]──▶ Edge Function (lotto-sync)
                                              │
                                              └─ 헤더의 토큰이 LOTTO_SYNC_TOKEN과
                                                 일치하는지 확인 → 일치해야 DB upsert 허용
```

즉, "GitHub Actions만 이 함수를 호출할 수 있게" 막기 위한 **사전 공유 비밀(shared secret)** 입니다. 외부 서비스에서 받아오는 토큰이 아닙니다.

## 어떻게 만들면 되나

아래 중 아무 방법이나 사용:

**방법 1 — 터미널 (Mac/Linux):**
```bash
openssl rand -hex 32
```
출력 예시: `a3f1c9d8e7b6450f2c8d9e1a4b7c6f8d2e3a5c7b9d1f4e6a8c2b5d7e9f1a3c4d`

**방법 2 — 온라인 생성기:**
- https://www.random.org/strings/ 에서 길이 64, 문자/숫자 선택
- 또는 1Password / Bitwarden 같은 패스워드 매니저의 "강력한 암호 생성"

**방법 3 — 직접 타이핑:**
- 최소 32자 이상, 영문 대소문자 + 숫자 섞어서
- 예: `LuckyPing-Sync-2026-xY9zK3mN7pQ2vR8tW1jH5fG6dB4sA0cE` (이런 식, 단 이 예시는 그대로 쓰지 말 것)

## 입력해야 하는 위치 (총 2곳, 같은 값)

| 위치 | 용도 |
|---|---|
| Lovable Cloud 시크릿 `LOTTO_SYNC_TOKEN` | Edge Function이 검증할 정답 |
| GitHub Repository Secrets `LOTTO_SYNC_TOKEN` | Action이 헤더에 실어 보낼 값 |

**두 값은 반드시 동일해야** 합니다. 한 번 만들어서 양쪽에 똑같이 붙여넣으면 끝.

## 주의사항

- 한 번 정한 값은 **어디에도 평문으로 저장하지 말 것** (메신저, 메모장, 코드 안 등)
- 생성한 값을 바로 두 시크릿에 등록 → 로컬 메모는 삭제
- 유출 의심 시: 새 값 생성 → 양쪽 시크릿 둘 다 갱신 (하나만 바꾸면 동기화 깨짐)

## 진행
값을 만드신 다음 알려주시면, Lovable Cloud 시크릿 등록 요청을 진행합니다. (GitHub Repository Secrets 쪽은 Lovable이 접근 불가하므로 사용자가 직접 등록)

