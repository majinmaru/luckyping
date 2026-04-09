import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[600px] mx-auto px-5 py-8">
        <Link to="/" className="text-sm text-primary hover:underline mb-6 inline-block">← 돌아가기</Link>
        <h1 className="text-2xl font-display text-primary mb-6">개인정보 처리방침</h1>

        <div className="space-y-6 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-primary mb-2">1. 수집하는 개인정보</h2>
            <p>서비스는 회원가입 및 서비스 제공을 위해 다음의 개인정보를 수집합니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>필수 항목:</strong> 이메일 주소</li>
              <li><strong>자동 수집:</strong> 서비스 이용 기록, 접속 로그, 쿠키</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">2. 개인정보의 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 식별 및 로그인 처리</li>
              <li>로또 번호 티켓 데이터의 저장 및 관리</li>
              <li>서비스 개선 및 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">3. 개인정보의 보유 및 이용 기간</h2>
            <p>이용자의 개인정보는 서비스 이용 기간 동안 보유하며, 회원 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">4. 개인정보의 제3자 제공</h2>
            <p>서비스는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>법령에 의거하여 제공이 요구되는 경우</li>
              <li>이용자가 사전에 동의한 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">5. 쿠키 및 광고</h2>
            <p>서비스는 Google AdSense를 통해 광고를 제공하며, 이 과정에서 쿠키가 사용될 수 있습니다. Google의 광고 쿠키 사용에 대한 자세한 내용은{' '}
              <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Google 광고 정책
              </a>
              을 참고해주세요.
            </p>
            <p className="mt-2">이용자는 웹 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 이 경우 서비스 일부 기능이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">6. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>비밀번호 암호화 저장</li>
              <li>SSL/TLS를 통한 데이터 전송 암호화</li>
              <li>접근 권한 관리 및 접근 통제</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">7. 이용자의 권리</h2>
            <p>이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며, 회원 탈퇴를 통해 개인정보 처리의 정지를 요청할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">8. 개인정보 보호책임자</h2>
            <p>개인정보 처리에 관한 문의는 아래 연락처로 문의해주세요:</p>
            <p className="mt-2">이메일: support@luckyping.lovable.app</p>
          </section>

          <p className="text-muted-foreground text-xs mt-8">시행일: 2026년 4월 9일</p>
        </div>
      </div>
    </div>
  );
}
