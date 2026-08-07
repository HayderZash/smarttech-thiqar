INSERT INTO public.store_settings (key, value) VALUES ('telegram_chat_id', '8080788386')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;