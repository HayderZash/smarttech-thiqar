ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS description_ar text NOT NULL DEFAULT '';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS description_en text NOT NULL DEFAULT '';