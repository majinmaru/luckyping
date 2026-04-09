import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTickets } from '@/hooks/use-tickets';
import AddTab from '@/components/lotto/AddTab';
import TicketsTab from '@/components/lotto/TicketsTab';
import ProbTab from '@/components/lotto/ProbTab';

type Tab = 'add' | 'tickets' | 'prob';

export default function Index() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('add');
  const { tickets, loading, addTicket, updateTicket, deleteTicket, deleteAllTickets } = useTickets();

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'add', icon: '✍️', label: '번호입력' },
    { id: 'tickets', icon: '🎫', label: '내 티켓' },
    { id: 'prob', icon: '📊', label: '확률분석' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-12 h-12 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border px-5 pt-7 pb-5 text-center"
        style={{ background: 'linear-gradient(135deg, hsl(240 20% 4%) 0%, hsl(280 15% 8%) 50%, hsl(240 20% 4%) 100%)' }}>
        <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[300px] h-[120px] bg-[radial-gradient(ellipse,rgba(245,200,66,0.15)_0%,transparent_70%)] pointer-events-none" />
        <h1 className="font-display text-[28px] tracking-wider text-primary" style={{ textShadow: '0 0 20px rgba(245,200,66,0.4)' }}>
          🍀 행운은 내 손으로
        </h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-[4px] uppercase">lotto ticket recorder</p>
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
        {tab === 'add' && <AddTab tickets={tickets} addTicket={addTicket} />}
        {tab === 'tickets' && <TicketsTab tickets={tickets} updateTicket={updateTicket} deleteTicket={deleteTicket} deleteAllTickets={deleteAllTickets} />}
        {tab === 'prob' && <ProbTab tickets={tickets} />}
      </div>

      <footer className="max-w-[600px] mx-auto mt-1.5 px-5 pb-6 text-center">
        <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary transition px-4 py-2 rounded-lg border border-border hover:border-primary mb-3">
          로그아웃
        </button>
        <p className="text-muted-foreground text-[11px]">© 2026 Jena. All rights reserved.</p>
      </footer>
    </div>
  );
}
