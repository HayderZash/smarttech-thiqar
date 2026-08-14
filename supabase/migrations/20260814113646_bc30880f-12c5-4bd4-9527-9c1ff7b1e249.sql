CREATE OR REPLACE FUNCTION public.get_ai_config(_secret text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _stored text; _cfg jsonb;
BEGIN
  SELECT value INTO _stored FROM public.ai_settings WHERE key = 'proxy_secret';
  IF _stored IS NULL OR btrim(_stored) = '' OR _secret IS NULL OR _secret <> _stored THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO _cfg
    FROM public.ai_settings WHERE key <> 'proxy_secret';
  RETURN _cfg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_config(text) TO anon, authenticated;