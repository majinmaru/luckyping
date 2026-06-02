-- LuckyPing schema migration for self-hosted Supabase project.
-- Run this ONCE in SQL Editor of your new Supabase project.

-- =========================
-- lotto_draws (public read)
-- =========================
CREATE TABLE IF NOT EXISTS public.lotto_draws (
  drw_no       INTEGER PRIMARY KEY,
  drw_no_date  TEXT    NOT NULL,
  nums         INTEGER[] NOT NULL,
  bonus_no     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lotto_draws TO anon;
GRANT SELECT ON public.lotto_draws TO authenticated;
GRANT ALL    ON public.lotto_draws TO service_role;

ALTER TABLE public.lotto_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read draws"
  ON public.lotto_draws FOR SELECT
  TO anon, authenticated
  USING (true);

-- =========================
-- tickets (per-user)
-- =========================
CREATE TABLE IF NOT EXISTS public.tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  nums        INTEGER[] NOT NULL,
  purchases   JSONB NOT NULL DEFAULT '[]'::jsonb,
  wins        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tickets"
  ON public.tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets"
  ON public.tickets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tickets"
  ON public.tickets FOR DELETE
  USING (auth.uid() = user_id);

-- =========================
-- updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_set_updated_at ON public.tickets;
CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- protect wins/purchases from client mutation
-- (only service_role — i.e. Lambda — may change these)
-- =========================
CREATE OR REPLACE FUNCTION public.protect_ticket_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    IF NEW.wins IS DISTINCT FROM OLD.wins THEN
      RAISE EXCEPTION 'wins column cannot be modified by client';
    END IF;
    IF NEW.purchases IS DISTINCT FROM OLD.purchases THEN
      RAISE EXCEPTION 'purchases column cannot be modified by client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_protect_sensitive ON public.tickets;
CREATE TRIGGER tickets_protect_sensitive
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.protect_ticket_sensitive_columns();
