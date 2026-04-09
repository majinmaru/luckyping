import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[600px] mx-auto px-5 py-8">
        <Link to="/" className="text-sm text-primary hover:underline mb-6 inline-block">← 돌아가기</Link>
        <h1 className="text-2xl font-display text-primary mb-6">이용약관</h1>

        <div className="space-y-6 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제1조 (목적)</h2>
            <p>본 약관은 LuckyPing(이하 "서비스")이 제공하는 로또 번호 기록 및 분석 서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제2조 (서비스의 내용)</h2>
            <p>서비스는 다음과 같은 기능을 제공합니다:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>수동 로또 번호 기록 및 저장</li>
              <li>로또 번호 확률 분석</li>
              <li>당첨 번호 조회 및 비교</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제3조 (이용자의 의무)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이용자는 관계 법령, 본 약관의 규정 등을 준수하여야 합니다.</li>
              <li>이용자는 타인의 개인정보를 도용하거나 부정하게 사용해서는 안 됩니다.</li>
              <li>이용자는 서비스를 이용하여 얻은 정보를 서비스의 사전 동의 없이 상업적으로 이용해서는 안 됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제4조 (면책 조항)</h2>
            <p>본 서비스는 로또 번호의 기록 및 통계 분석 목적으로만 제공됩니다. 서비스가 제공하는 분석 결과는 당첨을 보장하지 않으며, 이를 근거로 한 구매 결정에 대해 서비스는 어떠한 책임도 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제5조 (광고)</h2>
            <p>서비스는 운영을 위해 광고를 게재할 수 있으며, 이용자는 서비스 이용 시 노출되는 광고 게재에 동의합니다. 서비스는 Google AdSense 등 제3자 광고 서비스를 이용할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제6조 (서비스 변경 및 중단)</h2>
            <p>서비스는 운영상, 기술상의 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">제7조 (약관의 변경)</h2>
            <p>본 약관은 필요 시 변경될 수 있으며, 변경된 약관은 서비스 내 공지를 통해 효력이 발생합니다.</p>
          </section>

          <p className="text-muted-foreground text-xs mt-8">시행일: 2026년 4월 9일</p>
        </div>
      </div>
    </div>
  );
}
