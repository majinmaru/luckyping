// AWS Lambda port of the Supabase Edge Function `ticket-update`.
// Validates JWT issued by user's Supabase project, then updates tickets
// with the service-role client (bypasses RLS + protect trigger).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validatePurchases(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every(
    (p) =>
      p && typeof p === 'object' &&
      typeof p.date === 'string' && DATE_RE.test(p.date) &&
      typeof p.memo === 'string' && p.memo.length <= 200
  );
}

function validateWins(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every(
    (w) =>
      w && typeof w === 'object' &&
      typeof w.date === 'string' && DATE_RE.test(w.date) &&
      typeof w.rank === 'number' && [1, 2, 3, 4, 5].includes(w.rank)
  );
}

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });
    const token = authHeader.slice('Bearer '.length);

    // Verify token via anon client
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { error: 'Unauthorized' });
    const userId = userData.user.id;

    // Parse body
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    const { ticketId, purchases, wins } = body;
    if (!ticketId || typeof ticketId !== 'string') {
      return json(400, { error: 'ticketId is required' });
    }

    const payload = {};
    if (purchases !== undefined) {
      if (!validatePurchases(purchases)) return json(400, { error: 'Invalid purchases format' });
      payload.purchases = purchases;
    }
    if (wins !== undefined) {
      if (!validateWins(wins)) return json(400, { error: 'Invalid wins format' });
      payload.wins = wins;
    }
    if (Object.keys(payload).length === 0) return json(400, { error: 'No fields to update' });

    // Service role: bypass RLS + trigger
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ticket, error: fetchErr } = await svc
      .from('tickets')
      .select('user_id')
      .eq('id', ticketId)
      .single();
    if (fetchErr || !ticket) return json(404, { error: 'Ticket not found' });
    if (ticket.user_id !== userId) return json(403, { error: 'Forbidden' });

    const { error: updErr } = await svc.from('tickets').update(payload).eq('id', ticketId);
    if (updErr) return json(500, { error: 'Update failed' });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Internal error' });
  }
};
