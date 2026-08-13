
-- 1) fix wrong function schema (pg_net installs into schema "net")
CREATE OR REPLACE FUNCTION public.notify_order_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'extensions'
AS $function$
declare
  _url text;
  _secret text;
  _order_id uuid;
  _order jsonb;
  _items jsonb;
begin
  select value into _url from public.store_settings where key = 'netlify_webhook_url';
  select value into _secret from public.store_settings where key = 'netlify_webhook_secret';
  if _url is null or btrim(_url) = '' or _secret is null or btrim(_secret) = '' then
    return null;
  end if;

  select order_id into _order_id from new_items limit 1;
  if _order_id is null then return null; end if;

  select to_jsonb(o) into _order from public.orders o where o.id = _order_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_name', i.product_name,
           'quantity', i.quantity,
           'unit_price', i.unit_price)), '[]'::jsonb)
    into _items
    from new_items i;

  perform net.http_post(
    url := _url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', _secret),
    body := jsonb_build_object('order', _order, 'items', _items),
    timeout_milliseconds := 8000
  );
  return null;
end;
$function$;

-- 2) helper: notify all admins
CREATE OR REPLACE FUNCTION public.notify_admins(_title text, _body text, _order_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.notifications (user_id, order_id, title, body)
  SELECT DISTINCT ur.user_id, _order_id, _title, _body
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
$$;

-- 3) new order -> notify admins
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.notify_admins(
    'طلب جديد 🛒',
    'طلب #' || NEW.order_number || ' من ' || coalesce(NEW.customer_name,'زبون') ||
    ' — الإجمالي ' || coalesce(round(NEW.total_amount)::text,'0') || ' د.ع',
    NEW.id
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_order_created_notify_admins ON public.orders;
CREATE TRIGGER on_order_created_notify_admins
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- 4) order status change -> notify customer
CREATE OR REPLACE FUNCTION public.notify_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _label text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.customer_id IS NULL THEN
    RETURN NULL;
  END IF;
  _label := CASE NEW.status
    WHEN 'preparing' THEN 'طلبك قيد التجهيز 🧰'
    WHEN 'shipped' THEN 'طلبك عند مندوب التوصيل 🚚'
    WHEN 'completed' THEN 'تم إنجاز طلبك ✅'
    WHEN 'cancelled' THEN 'تم إلغاء طلبك ❌'
    ELSE 'تحديث على طلبك'
  END;
  INSERT INTO public.notifications (user_id, order_id, title, body)
  VALUES (NEW.customer_id, NEW.id, _label, 'الطلب رقم #' || NEW.order_number);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_notify ON public.orders;
CREATE TRIGGER on_order_status_notify
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();

-- 5) support messages -> notify admins on new, customer on reply
CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins(
      'رسالة دعم جديدة 💬',
      coalesce(NEW.sender_name,'زبون') || ': ' || left(NEW.message, 160)
    );
  ELSIF TG_OP = 'UPDATE'
    AND NEW.admin_reply IS NOT NULL
    AND NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
    AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, 'رد من إدارة المتجر 💬', left(NEW.admin_reply, 300));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_support_message_notify ON public.support_messages;
CREATE TRIGGER on_support_message_notify
AFTER INSERT OR UPDATE OF admin_reply ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_support_message();

-- 6) realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
