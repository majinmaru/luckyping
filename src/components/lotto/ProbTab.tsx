import { useState, useEffect, useCallback } from 'react';
import { MiniBall } from './BallGrid';
import type { Ticket } from '@/hooks/use-tickets';
import type { StatsCache, DrawData } from '@/lib/lotto';
import { loadStatsCache, saveStatsCache, loadHistoryCache, saveHistoryCache, fetchLottoData, getUpdateStatusText, getExpectedLatestDrawKST, colorClass } from '@/lib/lotto';
import { toast } from 'sonner';

interface ProbTabProps {
  tickets: Ticket[];
}

export default function ProbTab({ tickets }: ProbTabProps) {
  const [stats, setStats] = useState<StatsCache>(loadStatsCache);
  const [history, setHistory] = useState<DrawData[]>(loadHistoryCache);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [algo, setAlgo] = useState<'freq' | 'recent20' | 'gap50'>('freq');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recent20Expanded, setRecent20Expanded] = useState(false);
  const [statusState, setStatusState] = useState<'ok' | 'warn' | 'err' | 'loading'>('ok');
  const [statusText, setStatusText] = useState('');

  const hasData = !!(stats.freq && stats.totalDraws > 0);

  useEffect(() => {
    if (hasData) {
      setStatusState('ok');
      setStatusText(getUpdateStatusText(stats.latestDrwNo));
    } else {
      setStatusState('warn');
      setStatusText('데이터 없음 · 업데이트 필요');
      loadData(false);
    }
  }, []);

  const loadData = async (force: boolean) => {
    setLoading(true);
    setStatusState('loading');
    setStatusText(force ? '최신 데이터 업데이트 중...' : '데이터 로드 중...');
    try {
      const { stats: newStats, draws, syncFailed } = await fetchLottoData(force);
      setStats(newStats);
      setHistory(draws);
      saveStatsCache(newStats);
      saveHistoryCache(draws);
      const expected = getExpectedLatestDrawKST();
      if (newStats.latestDrwNo >= expected) {
        setStatusState('ok');
        setStatusText(getUpdateStatusText(newStats.latestDrwNo));
        if (force) toast('✅ 최신 데이터로 업데이트 완료');
      } else if (syncFailed) {
        setStatusState('warn');
        setStatusText(`외부 데이터 소스 호출 실패 · 기존 데이터 사용 중 (${newStats.latestDrwNo}회차)`);
        if (force) toast('⚠️ 외부 데이터 소스에서 최신 회차를 가져오지 못했어요');
      } else {
        setStatusState('warn');
        setStatusText(`최신 회차 미발표 · ${newStats.latestDrwNo}회차까지 반영`);
        if (force) toast('⏳ 아직 최신 회차가 발표되지 않았어요');
      }
    } catch (err: any) {
      if (stats.freq && stats.totalDraws > 0) {
        setStatusState('warn');
        setStatusText(`업데이트 실패 · 기존 데이터 사용 중 (${stats.latestDrwNo}회차)`);
      } else {
        setStatusState('err');
        setStatusText(`로드 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkAndRefresh = async () => {
    const expected = getExpectedLatestDrawKST();
    if (stats.latestDrwNo >= expected) {
      toast(`이미 최신 데이터예요. (${stats.latestDrwNo}회차)`);
      return;
    }
    await loadData(true);
  };

  const selectedTicket = selectedId ? tickets.find(t => t.id === selectedId) : null;

  const filteredTickets = (() => {
    const sorted = [...tickets].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!searchQuery.trim()) return sorted;
    const tokens = searchQuery.split(/[\s,]+/).filter(s => /\d/.test(s));
    return sorted.filter(t => tokens.every(tok => t.nums.some(n => String(n).includes(tok))));
  })();

  const selectTicket = (id: string) => {
    setSelectedId(id);
    setAlgo('freq');
    setRecent20Expanded(false);
    setDropdownOpen(false);
    const t = tickets.find(x => x.id === id);
    if (t) setSearchQuery(t.nums.join('  '));
  };

  // Probability calculations
  const renderResult = () => {
    if (!selectedTicket || !hasData) return null;
    const t = selectedTicket;
    const totalDraws = stats.totalDraws;

    const overallProbs = t.nums.map(n => {
      const count = Number(stats.freq?.[n] || 0);
      return { n, p: totalDraws ? (count / totalDraws) * 100 : 0, count };
    });

    const recent20 = [...history].sort((a, b) => b.drwNo - a.drwNo).slice(0, 20);
    const recent20Probs = t.nums.map(n => {
      const count = recent20.filter(d => d.nums.includes(n)).length;
      return { n, p: recent20.length ? (count / recent20.length) * 100 : 0, count };
    });

    const recent50 = [...history].sort((a, b) => b.drwNo - a.drwNo).slice(0, 50);
    const sortedNums = [...t.nums].sort((a, b) => a - b);
    const gaps = sortedNums.slice(1).map((n, i) => n - sortedNums[i]);
    const posMatches = gaps.map((gap, idx) => {
      const count = recent50.filter(draw => {
        const dn = [...draw.nums].sort((a, b) => a - b);
        return (dn[idx + 1] - dn[idx]) === gap;
      }).length;
      return { gap, idx, count, pct: recent50.length ? (count / recent50.length) * 100 : 0 };
    });
    const exactPatternCount = recent50.filter(draw => {
      const dn = [...draw.nums].sort((a, b) => a - b);
      const dg = dn.slice(1).map((n, i) => n - dn[i]);
      return dg.join(',') === gaps.join(',');
    }).length;
    const gapMultiplied = posMatches.reduce((acc, item) => acc * (item.pct / 100), 1) * 100;

    const exactKey = sortedNums.join(',');
    const exactMatches = history.filter(d => d.nums.join(',') === exactKey);

    const compareRows = history
      .map(draw => {
        const matched = t.nums.filter(n => draw.nums.includes(n));
        const bonus = draw.bonusNo ? t.nums.includes(draw.bonusNo) : false;
        return { ...draw, matchCount: matched.length, bonusMatch: bonus, matchedNums: matched };
      })
      .filter(r => r.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount || (b.bonusMatch ? 1 : 0) - (a.bonusMatch ? 1 : 0) || b.drwNo - a.drwNo)
      .slice(0, 5);

    const algoData = {
      freq: {
        label: '전체 빈도',
        pct: overallProbs.reduce((acc, item) => acc * (item.p / 100), 1) * 100,
      },
      recent20: {
        label: '최근 20회',
        pct: recent20Probs.reduce((acc, item) => acc * (item.p / 100), 1) * 100,
      },
      gap50: {
        label: '간격 패턴',
        pct: gapMultiplied,
      },
    };

    const current = algoData[algo];
    const probText = current.pct === 0 ? '0%' : `${current.pct.toFixed(12)}%`;

    return (
      <div className="bg-card border border-border rounded-lg p-5 mt-4 shadow-lg animate-fade-in-up">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-surface2 border border-border rounded-lg mb-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusState === 'ok' ? 'bg-success' : statusState === 'warn' ? 'bg-primary' : statusState === 'err' ? 'bg-destructive' : 'bg-muted-foreground animate-pulse'}`} />
            <span className="text-muted-foreground">{statusText}</span>
          </div>
          <button onClick={checkAndRefresh} className="px-3 py-1 text-[11px] border border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition">↻ 업데이트</button>
        </div>

        {/* Algo chips */}
        <div className="flex gap-2 flex-wrap mb-3">
          {(['freq', 'recent20', 'gap50'] as const).map(a => (
            <button key={a} onClick={() => { setAlgo(a); if (a !== 'recent20') setRecent20Expanded(false); }}
              className={`px-3 py-2 rounded-full border text-xs transition ${algo === a ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface2 text-muted-foreground hover:border-primary hover:text-primary'}`}>
              {algoData[a].label}
            </button>
          ))}
        </div>

        {/* Prob display */}
        <div className="bg-gradient-to-br from-surface2 to-card border border-primary/30 rounded-xl p-5 text-center mb-4">
          <div className="font-mono text-[28px] text-primary font-bold" style={{ textShadow: '0 0 20px rgba(245,200,66,0.3)' }}>{probText}</div>
          <div className="text-xs text-muted-foreground mt-1">{current.label}</div>
        </div>

        {/* Detail section */}
        {algo === 'freq' && (
          <>
            <div className="text-[11px] text-muted-foreground tracking-widest uppercase mb-2.5">번호별 과거 출현 현황</div>
            {overallProbs.map(({ n, p, count }) => (
              <div key={n} className="flex items-center justify-between bg-surface2 rounded-lg px-3.5 py-2.5 mb-2">
                <span className="flex items-center gap-2">
                  <MiniBall n={n} size={24} />
                  <span className="text-[11px] text-muted-foreground">({count}회 출현)</span>
                </span>
                <span className="font-mono text-primary text-sm">{p.toFixed(4)}%</span>
              </div>
            ))}
          </>
        )}

        {algo === 'recent20' && (
          <>
            <div className="text-[11px] text-muted-foreground mb-2.5">최근 20회 안에서 선택 번호가 등장한 횟수 비율을 곱해 계산해요.</div>
            {(recent20Expanded ? recent20 : recent20.slice(0, 6)).map(draw => (
              <div key={draw.drwNo} className="bg-surface2 rounded-lg px-3.5 py-2.5 mb-2 text-xs leading-relaxed">
                <div className="flex justify-between items-center gap-2 mb-2">
                  <span>{draw.drwNoDate} · 제{draw.drwNo}회</span>
                  <span className="font-mono text-primary">{t.nums.filter(n => draw.nums.includes(n)).length}개 겹침</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {draw.nums.map(n => <MiniBall key={n} n={n} size={24} />)}
                  {draw.bonusNo > 0 && <span className="text-[11px] text-muted-foreground self-center ml-1">+ {draw.bonusNo}</span>}
                </div>
              </div>
            ))}
            {recent20.length > 6 && (
              <button onClick={() => setRecent20Expanded(!recent20Expanded)} className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1 py-1.5">
                {recent20Expanded ? '접기' : '펼치기'} <span className={`inline-block transition-transform ${recent20Expanded ? 'rotate-180' : ''}`}>▼</span>
              </button>
            )}
          </>
        )}

        {algo === 'gap50' && (
          <>
            <div className="bg-surface2 rounded-lg px-3.5 py-2.5 mb-2 text-xs">
              <div className="text-muted-foreground mb-2">선택 번호 간격식</div>
              <div className="font-mono text-primary leading-relaxed">
                {sortedNums.join(' → ')}<br/>간격: {gaps.join(' · ')}
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">최근 50회에서 같은 위치의 간격이 나온 비율을 곱해 계산해요.</div>
            </div>
            <div className="bg-surface2 rounded-lg px-3.5 py-2.5 mb-2">
              {posMatches.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[56px_1fr_auto] gap-2.5 items-center py-2">
                  <div className="font-mono text-muted-foreground text-sm">Gap {idx + 1}</div>
                  <div className="h-2 bg-background rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-gradient-to-r from-primary to-gold-glow rounded-full" style={{ width: `${Math.max(2, Math.min(100, item.pct))}%` }} />
                  </div>
                  <div className="font-mono text-primary text-[11px]">{item.gap} ({item.count}회)</div>
                </div>
              ))}
            </div>
            <div className="bg-surface2 rounded-lg px-3.5 py-2.5 text-xs">
              동일 간격 패턴 완전 일치: <span className="font-mono text-primary">{exactPatternCount}회</span> / 최근 50회
            </div>
          </>
        )}

        {/* Exact matches */}
        <div className="h-px bg-border my-4" />
        <div className="text-[11px] text-muted-foreground tracking-widest uppercase mb-2.5">이전 당첨 이력 확인</div>
        {exactMatches.length > 0 ? exactMatches.map(m => (
          <div key={m.drwNo} className="flex justify-between items-center bg-surface2 rounded-lg px-3.5 py-2.5 mb-2 text-[13px]">
            <span>{m.drwNoDate} · 제{m.drwNo}회</span>
            <span className="text-[11px] bg-success/15 text-success border border-success/30 rounded-full px-2.5 py-0.5 font-mono">같은 번호 조합</span>
          </div>
        )) : (
          <p className="text-center text-[13px] text-muted-foreground py-3">동일한 번호 조합 당첨 이력은 없어요</p>
        )}

        {/* Best matches */}
        <div className="h-px bg-border my-4" />
        <div className="text-[11px] text-muted-foreground tracking-widest uppercase mb-2.5">가장 많이 겹친 과거 회차 (참고)</div>
        {compareRows.length > 0 ? compareRows.map(m => (
          <div key={m.drwNo} className="bg-surface2 rounded-lg px-3.5 py-2.5 mb-2 text-[13px]">
            <div className="flex justify-between items-center gap-2 mb-2">
              <span>{m.drwNoDate} · 제{m.drwNo}회</span>
              <span className="text-[11px] bg-surface border border-border text-foreground rounded-full px-2.5 py-0.5">{m.matchCount}개 일치{m.bonusMatch ? ' + 보너스' : ''}</span>
            </div>
            <div className="text-xs text-muted-foreground">당첨번호: {m.nums.join(', ')}{m.bonusNo ? ` + 보너스 ${m.bonusNo}` : ''}</div>
            <div className="text-xs text-primary mt-1">겹친 번호: {m.matchedNums.join(', ')}{m.bonusMatch ? ` · 보너스 일치 ${m.bonusNo}` : ''}</div>
          </div>
        )) : (
          <p className="text-center text-[13px] text-muted-foreground py-3">비교 가능한 회차 데이터가 없어요</p>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in-up">
      <div className="bg-card border border-border rounded-lg p-5 shadow-lg">
        <h3 className="font-display text-base text-primary mb-3 tracking-wide">📊 당첨 확률 분석</h3>
        <p className="text-[13px] text-muted-foreground mb-3">분석할 티켓을 선택하세요</p>

        {/* Dropdown */}
        <div className="relative">
          <div className="flex items-center bg-surface2 border border-border rounded-xl px-3.5 gap-2 transition focus-within:border-primary cursor-pointer" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
              placeholder="번호로 검색하거나 클릭해서 선택..."
              className="flex-1 bg-transparent border-none outline-none py-3.5 text-base text-foreground placeholder:text-muted-foreground min-w-0"
              onClick={e => { e.stopPropagation(); setDropdownOpen(true); }}
            />
            {searchQuery && (
              <button onClick={e => { e.stopPropagation(); setSearchQuery(''); setSelectedId(null); setDropdownOpen(true); }} className="text-muted-foreground hover:text-foreground text-base">✕</button>
            )}
            <span className={`text-muted-foreground text-sm pointer-events-none transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </div>

          {dropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-card border border-border rounded-xl z-[60] max-h-80 overflow-y-auto shadow-xl">
              {filteredTickets.length === 0 ? (
                <div className="px-5 py-5 text-center text-muted-foreground text-[13px]">
                  {searchQuery ? '일치하는 티켓이 없어요' : '저장된 티켓이 없어요'}
                </div>
              ) : filteredTickets.map(t => (
                <div
                  key={t.id}
                  onClick={() => selectTicket(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 cursor-pointer border-b border-surface2 last:border-b-0 transition hover:bg-surface2 ${t.id === selectedId ? 'bg-surface2' : ''}`}
                >
                  <div className="flex gap-[3px] flex-shrink-0">
                    {t.nums.map(n => <MiniBall key={n} n={n} size={24} />)}
                  </div>
                  <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">{t.purchases.length}회 구매</span>
                  {t.id === selectedId && <span className="text-primary text-[11px]">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected preview */}
        {selectedTicket && (
          <div className="flex items-center gap-2 px-3.5 py-3 bg-surface2 rounded-lg mt-3 flex-wrap">
            {selectedTicket.nums.map(n => <MiniBall key={n} n={n} />)}
            <span className="ml-auto text-[11px] text-muted-foreground">{selectedTicket.purchases.length}회 구매</span>
          </div>
        )}
      </div>

      {/* No data */}
      {!hasData && !loading && selectedId && (
        <div className="bg-card border border-border rounded-lg p-5 mt-4">
          <div className="bg-surface2 border border-dashed border-border rounded-xl p-6 text-center">
            <div className="text-3xl mb-2.5">📡</div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
              확률 계산을 위해 data 파일이 필요해요.<br/>아래 버튼을 눌러 데이터를 불러오세요.
            </p>
            <button onClick={() => loadData(true)} disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-gold-glow transition disabled:opacity-50">
              📥 데이터 불러오기
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[300] bg-background/90 flex flex-col items-center justify-center gap-5">
          <div className="w-12 h-12 border-[3px] border-border border-t-primary rounded-full animate-[spin-slow_0.8s_linear_infinite]" />
          <p className="text-sm text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      )}

      {renderResult()}
    </div>
  );
}
