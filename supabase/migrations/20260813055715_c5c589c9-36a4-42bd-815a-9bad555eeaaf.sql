CREATE OR REPLACE FUNCTION public.cancel_own_order(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _status text; _owner uuid;
BEGIN
  SELECT status, customer_id INTO _status, _owner FROM public.orders WHERE id = _order_id;
  IF _owner IS NULL OR _owner IS DISTINCT FROM auth.uid() THEN
    RETURN 'NOT_FOUND';
  END IF;
  IF _status <> 'review' THEN
    RETURN 'CANNOT_CANCEL';
  END IF;
  UPDATE public.orders SET status = 'cancelled' WHERE id = _order_id AND status = 'review';
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_order(uuid) TO authenticated;