import { useState } from 'react';
import { MiniBall } from './BallGrid';
import type { Ticket } from '@/hooks/use-tickets';
import { toast } from 'sonner';
import DatePickerField from './DatePickerField';

interface TicketsTabProps {
  tickets: Ticket[];
  updateTicket: (id: string, updates: Partial<Pick<Ticket, 'purchases' | 'wins'>>) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  deleteAllTickets: () => Promise<void>;
}

const PAGE_SIZE = 10;

export default function TicketsTab({ tickets, updateTicket, deleteTicket, deleteAllTickets }: TicketsTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState('recent-update');
  const [confirmMode, setConfirmMode] = useState<'single' | 'all' | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [buyModal, setBuyModal] = useState<string | null>(null);
  const [winModal, setWinModal] = useState<string | null>(null);
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [buyMemo, setBuyMemo] = useState('');
  const [winDate, setWinDate] = useState(new Date().toISOString().split('T')[0]);
  const [winRank, setWinRank] = useState(1);

  const sorted = (() => {
    const arr = [...tickets];
    const lp = (t: Ticket) => t.purchases.map(p => p.date).sort().at(-1) || '';
    const lw = (t: Ticket) => t.wins.map(w => w.date).sort().at(-1) || '';
    switch (sortMode) {
      case 'recent-update': return arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      case 'reg-newest': return arr.sort((a, b) => lp(b).localeCompare(lp(a)));
      case 'reg-oldest': return arr.sort((a, b) => lp(a).localeCompare(lp(b)));
      case 'wins-most': return arr.sort((a, b) => b.wins.length - a.wins.length);
      case 'wins-least': return arr.sort((a, b) => {
        if (a.wins.length && b.wins.length) return a.wins.length - b.wins.length;
        if (a.wins.length) return -1;
        if (b.wins.length) return 1;
        return 0;
      });
      case 'win-date-newest': return arr.sort((a, b) => lw(b).localeCompare(lw(a)));
      case 'win-date-oldest': return arr.sort((a, b) => {
        if (!lw(a) && !lw(b)) return 0;
        if (!lw(a)) return 1;
        if (!lw(b)) return -1;
        return lw(a).localeCompare(lw(b));
      });
      default: return arr;
    }
  })();

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const doDelete = async () => {
    if (confirmMode === 'all') {
      await deleteAllTickets();
      setCurrentPage(1);
      toast('티켓 전체가 삭제됐어요');
    } else if (pendingDeleteId) {
      await deleteTicket(pendingDeleteId);
      if (expandedId === pendingDeleteId) setExpandedId(null);
      toast('티켓이 삭제됐어요');
    }
    setConfirmMode(null);
    setPendingDeleteId(null);
  };

  const addBuy = async () => {
    if (!buyDate || !buyModal) { toast('날짜를 선택해주세요'); return; }
    const t = tickets.find(x => x.id === buyModal);
    if (!t) return;
    const newPurchases = [...t.purchases, { date: buyDate, memo: buyMemo }].sort((a, b) => b.date.localeCompare(a.date));
    await updateTicket(t.id, { purchases: newPurchases });
    setBuyModal(null);
    setBuyMemo('');
    toast('🛒 구매 이력이 추가됐어요');
  };

  const addWin = async () => {
    if (!winDate || !winModal) { toast('날짜를 선택해주세요'); return; }
    const t = tickets.find(x => x.id === winModal);
    if (!t) return;
    const newWins = [...t.wins, { date: winDate, rank: winRank }].sort((a, b) => b.date.localeCompare(a.date));
    await updateTicket(t.id, { wins: newWins });
    setWinModal(null);
    toast(`🏆 ${winRank}등 당첨 기록 완료!`);
  };

  return (
    <div className="animate-fade-in-up">
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground bg-surface2 border border-border rounded-full px-3 py-1.5">
          총 {tickets.length}개
        </span>
        <button
          onClick={() => { if (!tickets.length) { toast('삭제할 티켓이 없어요'); return; } setConfirmMode('all'); }}
          className="text-xs px-3 py-2 rounded-lg border border-destructive/30 text-destructive bg-transparent hover:bg-destructive/10 transition"
        >
          전체 삭제
        </button>
        <select
          value={sortMode}
          onChange={e => { setSortMode(e.target.value); setCurrentPage(1); }}
          className="flex-1 min-w-0 bg-surface2 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary appearance-none"
        >
          <option value="recent-update">최근 업데이트순</option>
          <option value="reg-newest">등록 최신순</option>
          <option value="reg-oldest">등록 오래된 순</option>
          <option value="wins-most">당첨 최다순</option>
          <option value="wins-least">당첨 최소순</option>
          <option value="win-date-newest">당첨일 최신순</option>
          <option value="win-date-oldest">당첨일 오래된 순</option>
        </select>
      </div>

      {/* Tickets list */}
      {tickets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <div className="text-5xl mb-3">🎫</div>
          <p className="text-sm leading-relaxed">아직 저장된 티켓이 없어요<br/>번호 입력 탭에서 추가해보세요</p>
        </div>
      ) : (
        <>
          {pageItems.map(t => {
            const isOpen = expandedId === t.id;
            const sp = [...t.purchases].sort((a, b) => b.date.localeCompare(a.date));
            const sw = [...t.wins].sort((a, b) => b.date.localeCompare(a.date));
            return (
              <div key={t.id} className={`bg-card border rounded-lg mb-3 overflow-hidden transition ${isOpen ? 'border-primary/60' : 'border-border hover:border-primary/30'}`}>
                <div className="flex items-center justify-between px-4 py-3.5 bg-surface2 cursor-pointer gap-2.5" onClick={() => setExpandedId(isOpen ? null : t.id)}>
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {t.nums.map(n => <MiniBall key={n} n={n} />)}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] bg-primary/15 text-primary border border-primary/30 rounded-full px-2.5 py-0.5 font-mono">{t.purchases.length}회 구매</span>
                    <div className="text-[11px] text-muted-foreground mt-1">{sp[0]?.date}</div>
                  </div>
                </div>
                {sw.length > 0 && (
                  <div className="px-4 py-2 flex gap-2 flex-wrap bg-primary/5 border-t border-primary/15">
                    {sw.slice(0, 3).map((w, i) => (
                      <span key={i} className="text-[11px] text-primary">🏆 {w.date} · {w.rank}등</span>
                    ))}
                  </div>
                )}
                {isOpen && (
                  <div>
                    <div className="px-4 py-3.5">
                      <div className="text-[11px] text-muted-foreground tracking-widest uppercase mb-3">구매 이력</div>
                      {sp.map((p, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-surface2 text-[13px] last:border-b-0">
                          <span>{p.date}{p.memo && <span className="text-muted-foreground"> · {p.memo}</span>}</span>
                          {i === 0 && <span className="text-[11px] bg-primary/15 text-primary border border-primary/30 rounded-full px-2.5 py-0.5 font-mono">최신</span>}
                        </div>
                      ))}
                      {sw.length > 0 && (
                        <>
                          <div className="h-px bg-border my-4" />
                          <div className="text-[11px] text-muted-foreground tracking-widest uppercase mb-3">당첨 이력</div>
                          {sw.map((w, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b border-surface2 text-[13px] last:border-b-0">
                              <span>{w.date}</span>
                              <span className="text-[11px] bg-success/15 text-success border border-success/30 rounded-full px-2.5 py-0.5 font-mono">{w.rank}등 🏆</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 px-4 py-2.5 border-t border-border flex-wrap">
                      <button onClick={() => { setBuyModal(t.id); setBuyDate(new Date().toISOString().split('T')[0]); }} className="text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary transition">🛒 구매 추가</button>
                      <button onClick={() => { setWinModal(t.id); setWinDate(new Date().toISOString().split('T')[0]); }} className="text-xs px-3 py-2 rounded-lg border border-success/30 text-success hover:bg-success/10 transition">🏆 당첨 기록</button>
                      <button onClick={() => { setPendingDeleteId(t.id); setConfirmMode('single'); }} className="text-xs px-3 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition">삭제</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-8 h-8 rounded-lg border border-border bg-surface2 text-muted-foreground font-mono text-sm flex items-center justify-center disabled:opacity-30 hover:border-primary hover:text-primary transition">‹</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 rounded-lg border font-mono text-sm flex items-center justify-center transition ${currentPage === i + 1 ? 'bg-primary text-primary-foreground border-primary font-bold' : 'border-border bg-surface2 text-muted-foreground hover:border-primary hover:text-primary'}`}>{i + 1}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="w-8 h-8 rounded-lg border border-border bg-surface2 text-muted-foreground font-mono text-sm flex items-center justify-center disabled:opacity-30 hover:border-primary hover:text-primary transition">›</button>
            </div>
          )}
        </>
      )}

      {/* Confirm delete overlay */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setConfirmMode(null)}>
          <div className="bg-card border border-border rounded-lg p-7 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg text-destructive mb-2.5">{confirmMode === 'all' ? '🗑️ 전체 삭제' : '🗑️ 티켓 삭제'}</h3>
            <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
              {confirmMode === 'all' ? `티켓 ${tickets.length}개를 모두 삭제할까요?` : '이 티켓을 삭제할까요?'}<br/>삭제 후 복구할 수 없어요.
            </p>
            <div className="flex gap-2.5 justify-center">
              <button onClick={() => setConfirmMode(null)} className="px-5 py-2.5 rounded-lg border border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition">취소</button>
              <button onClick={doDelete} className="px-5 py-2.5 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Buy modal */}
      {buyModal && (() => {
        const t = tickets.find(x => x.id === buyModal);
        if (!t) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setBuyModal(null)}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg text-primary mb-5">🛒 구매 이력 추가</h3>
              <div className="flex gap-1.5 flex-wrap mb-5">{t.nums.map(n => <MiniBall key={n} n={n} size={34} />)}</div>
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-2 tracking-widest">구매 일자</label>
                <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-2 tracking-widest">메모 (선택)</label>
                <input type="text" value={buyMemo} onChange={e => setBuyMemo(e.target.value)} placeholder="ex. 3회차 도전!" className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => setBuyModal(null)} className="px-5 py-3 rounded-lg border border-border text-muted-foreground text-sm transition hover:border-primary hover:text-primary">취소</button>
                <button onClick={addBuy} className="ml-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-glow transition">추가</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Win modal */}
      {winModal && (() => {
        const t = tickets.find(x => x.id === winModal);
        if (!t) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setWinModal(null)}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg text-primary mb-5">🏆 당첨 기록 추가</h3>
              <div className="flex gap-1.5 flex-wrap mb-5">{t.nums.map(n => <MiniBall key={n} n={n} size={34} />)}</div>
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-2 tracking-widest">당첨 일자</label>
                <input type="date" value={winDate} onChange={e => setWinDate(e.target.value)} className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-2 tracking-widest">당첨 등수</label>
                <select value={winRank} onChange={e => setWinRank(Number(e.target.value))} className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary appearance-none">
                  {[1,2,3,4,5].map(r => <option key={r} value={r}>{r}등</option>)}
                </select>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => setWinModal(null)} className="px-5 py-3 rounded-lg border border-border text-muted-foreground text-sm transition hover:border-primary hover:text-primary">취소</button>
                <button onClick={addWin} className="ml-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-glow transition">기록</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
