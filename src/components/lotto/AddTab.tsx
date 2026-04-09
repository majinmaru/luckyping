import { useState } from 'react';
import { BallGrid, SelectedRow, MiniBall } from './BallGrid';
import type { Ticket } from '@/hooks/use-tickets';
import { toast } from 'sonner';
import DatePickerField from './DatePickerField';

interface AddTabProps {
  tickets: Ticket[];
  addTicket: (nums: number[], purchase: { date: string; memo: string }) => Promise<void>;
}

export default function AddTab({ tickets, addTicket }: AddTabProps) {
  const [selectedNums, setSelectedNums] = useState<number[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [saveMemo, setSaveMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const randomPick = () => {
    if (selectedNums.length === 0) { toast('번호를 1개 이상 먼저 선택해주세요'); return; }
    const needed = 6 - selectedNums.length;
    if (needed === 0) { toast('이미 6개가 모두 선택됐어요'); return; }
    const pool = Array.from({ length: 45 }, (_, i) => i + 1).filter(n => !selectedNums.includes(n));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSelectedNums([...selectedNums, ...pool.slice(0, needed)]);
    toast(`🎲 ${needed}개 번호를 추천했어요!`);
  };

  const openSave = () => {
    if (selectedNums.length !== 6) { toast('6개 번호를 먼저 선택해주세요'); return; }
    setShowSave(true);
  };

  const doSave = async () => {
    if (!saveDate) { toast('날짜를 선택해주세요'); return; }
    setSaving(true);
    await addTicket(selectedNums, { date: saveDate, memo: saveMemo });
    setSaving(false);
    setShowSave(false);
    setSelectedNums([]);
    setSaveMemo('');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="bg-card border border-border rounded-lg p-5 mb-4 shadow-lg">
        <h3 className="font-display text-base text-primary mb-4 tracking-wide">🔢 번호 선택 (6개)</h3>
        <BallGrid selectedNums={selectedNums} onSelect={setSelectedNums} />
        <SelectedRow nums={selectedNums} />
        <div className="flex gap-2.5 flex-wrap">
          <button onClick={randomPick} className="px-5 py-3 rounded-lg border border-border bg-transparent text-muted-foreground text-sm hover:border-primary hover:text-primary transition">
            🎲 랜덤 추천
          </button>
          <button onClick={() => setSelectedNums([])} className="px-5 py-3 rounded-lg border border-border bg-transparent text-muted-foreground text-sm hover:border-primary hover:text-primary transition">
            ↺ 초기화
          </button>
          <button onClick={openSave} className="ml-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-glow transition">
            저장하기
          </button>
        </div>
      </div>

      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setShowSave(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg text-primary mb-5">✅ 티켓 저장</h3>
            <div className="flex gap-1.5 flex-wrap mb-5">
              {[...selectedNums].sort((a, b) => a - b).map(n => <MiniBall key={n} n={n} size={34} />)}
            </div>
             <DatePickerField label="구매 일자" value={saveDate} onChange={setSaveDate} />
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-2 tracking-widest">메모 (선택)</label>
              <input type="text" value={saveMemo} onChange={e => setSaveMemo(e.target.value)} placeholder="ex. 이번주엔 꼭!"
                className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setShowSave(false)} className="px-5 py-3 rounded-lg border border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition">취소</button>
              <button onClick={doSave} disabled={saving} className="ml-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-glow transition disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
