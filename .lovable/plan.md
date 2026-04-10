

## 보안 문제 분석

현재 `tickets` 테이블의 UPDATE RLS 정책이 `auth.uid() = user_id`만 확인하므로, 사용자가 Supabase API를 직접 호출해 `wins` 데이터를 임의로 조작할 수 있습니다.

## 해결 방안: Edge Function을 통한 서버 사이드 업데이트

`wins`와 `purchases` 업데이트를 서버(Edge Function)에서만 처리하도록 변경합니다.

### 1. Postgres 트리거 추가 (클라이언트 직접 수정 차단)

`BEFORE UPDATE` 트리거를 생성해서, service_role이 아닌 일반 사용자가 `wins` 또는 `purchases` 컬럼을 변경하려고 하면 차단합니다.

```sql
CREATE OR REPLACE FUNCTION public.protect_ticket_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    IF NEW.wins IS DISTINCT FROM OLD.wins THEN
      RAISE EXCEPTION 'wins column cannot be modified by client';
    END IF;
    IF NEW.purchases IS DISTINCT FROM OLD.purchases THEN
      RAISE EXCEPTION 'purchases column cannot be modified by client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

### 2. Edge Function 생성 (`ticket-update`)

`wins`와 `purchases` 업데이트를 처리하는 Edge Function을 만들어, service_role 키로 DB를 업데이트합니다.

- JWT 인증으로 요청자 확인
- 본인 소유 티켓만 수정 가능하도록 검증
- 입력값 유효성 검사 (Zod)

### 3. 클라이언트 코드 수정 (`use-tickets.ts`)

`updateTicket` 함수가 직접 `supabase.from('tickets').update()`를 호출하는 대신, Edge Function을 `supabase.functions.invoke('ticket-update', ...)`로 호출하도록 변경합니다.

`addTicket`에서 기존 티켓에 구매 이력을 추가하는 부분도 동일하게 Edge Function을 통해 처리합니다.

### 변경 파일 목록

| 파일 | 작업 |
|------|------|
| DB 마이그레이션 | `protect_ticket_sensitive_columns` 트리거 생성 |
| `supabase/functions/ticket-update/index.ts` | 새 Edge Function 생성 |
| `src/hooks/use-tickets.ts` | `updateTicket`, `addTicket` → Edge Function 호출로 변경 |

