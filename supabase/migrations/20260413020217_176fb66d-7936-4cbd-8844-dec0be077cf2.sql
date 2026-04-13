CREATE TRIGGER protect_ticket_sensitive_columns
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.protect_ticket_sensitive_columns();