REVOKE ALL ON FUNCTION public.notify_admins(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_support_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_order_webhook() FROM PUBLIC, anon, authenticated;