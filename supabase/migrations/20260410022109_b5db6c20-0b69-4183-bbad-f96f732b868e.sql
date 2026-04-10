
-- Function to protect wins/purchases from client-side modification
CREATE OR REPLACE FUNCTION public.protect_ticket_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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

-- Attach trigger to tickets table
CREATE TRIGGER protect_tickets_sensitive_cols
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.protect_ticket_sensitive_columns();
