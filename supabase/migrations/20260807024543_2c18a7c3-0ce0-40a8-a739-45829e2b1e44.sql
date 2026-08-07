CREATE TABLE public.solar_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('panel','battery','inverter')),
  name_ar text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  capacity numeric NOT NULL DEFAULT 0,
  voltage numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.solar_components TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solar_components TO authenticated;
GRANT ALL ON public.solar_components TO service_role;
ALTER TABLE public.solar_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solar components public read" ON public.solar_components FOR SELECT USING (true);
CREATE POLICY "solar components admin write" ON public.solar_components FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));