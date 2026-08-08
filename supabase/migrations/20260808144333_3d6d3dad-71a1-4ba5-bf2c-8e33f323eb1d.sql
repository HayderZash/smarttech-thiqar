ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS admin_reply text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;