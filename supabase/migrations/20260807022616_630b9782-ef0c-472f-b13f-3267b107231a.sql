
-- 1) Product extra images + deal expiry
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deal_ends_at timestamptz;

-- 2) Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews public read approved" ON public.reviews;
CREATE POLICY "reviews public read approved" ON public.reviews
  FOR SELECT USING (is_approved OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "reviews own insert" ON public.reviews;
CREATE POLICY "reviews own insert" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND rating BETWEEN 1 AND 5);
DROP POLICY IF EXISTS "reviews admin write" ON public.reviews;
CREATE POLICY "reviews admin write" ON public.reviews
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "reviews admin delete" ON public.reviews;
CREATE POLICY "reviews admin delete" ON public.reviews
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS reviews_product_idx ON public.reviews(product_id);

-- 3) Back-in-stock alerts
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  phone text NOT NULL,
  is_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.stock_alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_alerts TO authenticated;
GRANT ALL ON public.stock_alerts TO service_role;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts anyone insert" ON public.stock_alerts;
CREATE POLICY "alerts anyone insert" ON public.stock_alerts
  FOR INSERT WITH CHECK (length(phone) BETWEEN 7 AND 20);
DROP POLICY IF EXISTS "alerts admin read" ON public.stock_alerts;
CREATE POLICY "alerts admin read" ON public.stock_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "alerts admin write" ON public.stock_alerts;
CREATE POLICY "alerts admin write" ON public.stock_alerts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) Public order tracking by order number + phone
CREATE OR REPLACE FUNCTION public.track_order(_order_number integer, _phone text)
RETURNS TABLE (
  order_number integer,
  status text,
  created_at timestamptz,
  total_amount numeric,
  governorate_name text,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.order_number, o.status, o.created_at, o.total_amount, o.governorate_name,
         COALESCE(
           (SELECT jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.quantity, 'price', i.unit_price))
            FROM order_items i WHERE i.order_id = o.id), '[]'::jsonb)
  FROM orders o
  WHERE o.order_number = _order_number
    AND regexp_replace(o.phone, '\D', '', 'g') LIKE '%' || right(regexp_replace(_phone, '\D', '', 'g'), 9)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.track_order(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(integer, text) TO anon, authenticated;
