create extension if not exists pg_net with schema extensions;

insert into public.store_settings (key, value)
values ('netlify_webhook_url', ''), ('netlify_webhook_secret', '')
on conflict (key) do nothing;

create or replace function public.notify_order_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
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

  perform extensions.net_post(
    url := _url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', _secret),
    body := jsonb_build_object('order', _order, 'items', _items),
    timeout_milliseconds := 8000
  );
  return null;
end;
$$;

drop trigger if exists on_order_items_notify on public.order_items;
create trigger on_order_items_notify
after insert on public.order_items
referencing new table as new_items
for each statement
execute function public.notify_order_webhook();