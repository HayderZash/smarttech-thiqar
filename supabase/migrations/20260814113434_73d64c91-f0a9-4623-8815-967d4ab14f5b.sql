-- 1) Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'customer',
  body text NOT NULL DEFAULT '',
  image_url text,
  image_path text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat read own or admin" ON public.chat_messages
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat customer insert own" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND sender = 'customer'
  AND length(body) <= 2000
);

CREATE POLICY "chat admin insert" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND sender = 'admin');

CREATE POLICY "chat update own or admin" ON public.chat_messages
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "chat delete own or admin" ON public.chat_messages
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX chat_messages_user_created_idx ON public.chat_messages (user_id, created_at DESC);

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 2) Notifications on chat activity
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _name text;
BEGIN
  IF NEW.sender = 'customer' THEN
    SELECT COALESCE(NULLIF(full_name,''), 'زبون') INTO _name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.notify_admins(
      'رسالة جديدة من زبون 💬',
      COALESCE(_name,'زبون') || ': ' || left(COALESCE(NULLIF(NEW.body,''), '📷 صورة'), 160)
    );
  ELSE
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, 'رد من إدارة المتجر 💬', left(COALESCE(NULLIF(NEW.body,''), '📷 صورة'), 300));
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_chat_message() FROM public, anon, authenticated;

CREATE TRIGGER on_chat_message_notify
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();

-- 3) Purge chat images older than 24 hours (metadata side)
CREATE OR REPLACE FUNCTION public.purge_old_chat_images()
RETURNS TABLE(path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.chat_messages c
     SET image_url = NULL, image_path = NULL
   WHERE c.image_path IS NOT NULL
     AND c.created_at < now() - interval '24 hours'
  RETURNING c.image_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_old_chat_images() TO authenticated;

-- 4) Admin marks an order item unavailable (host independent)
CREATE OR REPLACE FUNCTION public.admin_set_item_unavailable(_item_id uuid, _flag boolean)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order_id uuid; _name text; _sub numeric; _disc numeric; _total numeric;
  _o record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.order_items SET is_unavailable = _flag
   WHERE id = _item_id
  RETURNING order_id, product_name INTO _order_id, _name;
  IF _order_id IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id;

  SELECT COALESCE(sum(unit_price * quantity), 0) INTO _sub
    FROM public.order_items WHERE order_id = _order_id AND is_unavailable = false;

  _disc := least(COALESCE(_o.discount_amount, 0), _sub);
  _total := greatest(0, _sub - _disc) + COALESCE(_o.shipping_fee, 0);

  UPDATE public.orders
     SET subtotal = _sub, discount_amount = _disc, total_amount = _total,
         needs_customer_action = _flag
   WHERE id = _order_id;

  IF _flag AND _o.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, order_id, title, body)
    VALUES (_o.customer_id, _order_id,
      'المنتج «' || _name || '» غير متوفر',
      'بخصوص طلبك رقم #' || _o.order_number || ': المنتج غير متوفر حالياً. يمكنك إكمال الطلب بدونه أو طلب تغييره قبل بدء التجهيز.');
  END IF;

  RETURN _total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_item_unavailable(uuid, boolean) TO authenticated;

-- 5) Private AI provider settings (admins only)
CREATE TABLE public.ai_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai settings admin only" ON public.ai_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));