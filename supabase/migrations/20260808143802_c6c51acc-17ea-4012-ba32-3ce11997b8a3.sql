CREATE OR REPLACE FUNCTION public.popular_products(_limit integer DEFAULT 20)
RETURNS TABLE(product_id uuid, orders_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id, sum(oi.quantity)::bigint AS orders_count
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id IS NOT NULL
    AND oi.is_unavailable = false
    AND o.status <> 'cancelled'
  GROUP BY oi.product_id
  ORDER BY orders_count DESC
  LIMIT greatest(1, least(coalesce(_limit, 20), 100));
$$;

GRANT EXECUTE ON FUNCTION public.popular_products(integer) TO anon, authenticated, service_role;