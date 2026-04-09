import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AddTab from '@/components/lotto/AddTab';
import TicketsTab from '@/components/lotto/TicketsTab';
import ProbTab from '@/components/lotto/ProbTab';
import { loadTickets, type Ticket } from '@/lib/lotto';

type Tab = 'add' | 'tickets' | 'prob';

export default function Index() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('add');
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets());

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'add', icon: '✍️', label: '번호입력' },
    { id: 'tickets', icon: '🎫', label: '내 티켓' },
    { id: 'prob', icon: '📊', label: '확률분석' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border px-5 pt-7 pb-5 text-center"
        style={{ background: 'linear-gradient(135deg, hsl(240 20% 4%) 0%, hsl(280 15% 8%) 50%, hsl(240 20% 4%) 100%)' }}>
        <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[300px] h-[120px] bg-[radial-gradient(ellipse,rgba(245,200,66,0.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="flex items-center justify-between">
          <div className="flex-1" />
          <div className="text-center">
            <h1 className="font-display text-[28px] tracking-wider text-primary" style={{ textShadow: '0 0 20px rgba(245,200,66,0.4)' }}>
              🍀 행운은 내 손으로
            </h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-[4px] uppercase">lotto ticket recorder</p>
          </div>
          <div className="flex-1 flex justify-end">
            <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary transition px-3 py-1.5 rounded-lg border border-border hover:border-primary">
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex bg-card border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3.5 px-2 text-xs border-b-2 transition whitespace-nowrap ${
              tab === t.id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
            }`}
          >
            <span className="block text-lg mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="max-w-[600px] mx-auto p-5">
        {tab === 'add' && <AddTab tickets={tickets} setTickets={setTickets} />}
        {tab === 'tickets' && <TicketsTab tickets={tickets} setTickets={setTickets} />}
        {tab === 'prob' && <ProbTab tickets={tickets} />}
      </div>

      <footer className="max-w-[600px] mx-auto mt-1.5 px-5 pb-6 text-center text-muted-foreground text-[11px]">
        © 2026 Jena. All rights reserved.
      </footer>
    </div>
  );
}
