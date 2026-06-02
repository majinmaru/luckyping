// API client for AWS Lambda backend (replaces Supabase Edge Functions).
import { supabase } from '@/integrations/supabase/client';

const LAMBDA_BASE = import.meta.env.VITE_LAMBDA_API_BASE as string;

async function authedFetch(path: string, body: unknown) {
  if (!LAMBDA_BASE) {
    throw new Error('VITE_LAMBDA_API_BASE is not configured');
  }
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${LAMBDA_BASE.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export interface TicketUpdateBody {
  ticketId: string;
  purchases?: Array<{ date: string; memo: string }>;
  wins?: Array<{ date: string; rank: number }>;
}

export async function updateTicket(body: TicketUpdateBody) {
  return authedFetch('/ticket-update', body);
}
