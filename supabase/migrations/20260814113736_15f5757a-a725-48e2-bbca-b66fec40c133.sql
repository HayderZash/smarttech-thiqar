CREATE OR REPLACE FUNCTION public.resolve_order_issue(_order_id uuid, _action text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _status text; _owner uuid;
BEGIN
  IF _action NOT IN ('continue','change') THEN RETURN 'BAD_ACTION'; END IF;
  SELECT status, customer_id INTO _status, _owner FROM public.orders WHERE id = _order_id;
  IF _owner IS NULL OR _owner IS DISTINCT FROM auth.uid() THEN RETURN 'NOT_FOUND'; END IF;
  IF _status <> 'review' THEN RETURN 'CANNOT_CANCEL'; END IF;
  UPDATE public.orders
     SET needs_customer_action = false,
         notes = CASE WHEN _action = 'continue'
                   THEN 'الزبون وافق على إكمال الطلب بدون المنتج غير المتوفر.'
                   ELSE 'الزبون يريد تغيير المنتج غير المتوفر — يرجى التواصل معه.' END
   WHERE id = _order_id AND status = 'review';
  RETURN 'OK';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_order_issue(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_order_issue(uuid, text) TO authenticated;