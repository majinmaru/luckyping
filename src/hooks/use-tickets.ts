import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateTicket as updateTicketApi } from '@/lib/api';
import { toast } from 'sonner';

export interface Ticket {
  id: string;
  nums: number[];
  purchases: { date: string; memo: string }[];
  wins: { date: string; rank: number }[];
  createdAt: number;
  updatedAt: number;
}

interface DbTicket {
  id: string;
  user_id: string;
  nums: number[];
  purchases: { date: string; memo: string }[];
  wins: { date: string; rank: number }[];
  created_at: string;
  updated_at: string;
}

function toTicket(row: DbTicket): Ticket {
  return {
    id: row.id,
    nums: row.nums,
    purchases: (row.purchases as any) || [],
    wins: (row.wins as any) || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function useTickets() {
  const { user } = useAuth();
  const [tickets, setTicketsState] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!user) { setTicketsState([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('Failed to load tickets:', error);
      toast.error('티켓을 불러오지 못했어요');
    } else {
      setTicketsState((data as DbTicket[]).map(toTicket));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const addTicket = useCallback(async (nums: number[], purchase: { date: string; memo: string }) => {
    if (!user) return;
    const sorted = [...nums].sort((a, b) => a - b);

    // Check if same nums already exist
    const existing = tickets.find(t => t.nums.join(',') === sorted.join(','));
    if (existing) {
      const newPurchases = [...existing.purchases, purchase].sort((a, b) => b.date.localeCompare(a.date));
      try {
        await updateTicketApi({ ticketId: existing.id, purchases: newPurchases });
      } catch { toast.error('저장 실패'); return; }
      toast('✅ 기존 티켓에 구매 이력 추가');
    } else {
      const { error } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          nums: sorted,
          purchases: [purchase] as any,
          wins: [] as any,
        });
      if (error) { toast.error('저장 실패'); return; }
      toast('🎫 새 티켓 저장 완료!');
    }
    await fetchTickets();
  }, [user, tickets, fetchTickets]);

  const updateTicket = useCallback(async (id: string, updates: Partial<Pick<Ticket, 'purchases' | 'wins'>>) => {
    if (!user) return;
    const body: { ticketId: string; purchases?: any; wins?: any } = { ticketId: id };
    if (updates.purchases) body.purchases = updates.purchases;
    if (updates.wins) body.wins = updates.wins;
    try {
      await updateTicketApi(body);
    } catch { toast.error('수정 실패'); return; }
    await fetchTickets();
  }, [user, fetchTickets]);

  const deleteTicket = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) { toast.error('삭제 실패'); return; }
    await fetchTickets();
  }, [user, fetchTickets]);

  const deleteAllTickets = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('tickets').delete().eq('user_id', user.id);
    if (error) { toast.error('삭제 실패'); return; }
    setTicketsState([]);
  }, [user]);

  return { tickets, loading, addTicket, updateTicket, deleteTicket, deleteAllTickets, refetch: fetchTickets };
}
