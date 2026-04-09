CREATE TABLE public.lotto_draws (
  drw_no INTEGER PRIMARY KEY,
  drw_no_date TEXT NOT NULL,
  nums INTEGER[] NOT NULL,
  bonus_no INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lotto_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read draws" ON public.lotto_draws FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can insert draws" ON public.lotto_draws FOR INSERT TO authenticated WITH CHECK (true);