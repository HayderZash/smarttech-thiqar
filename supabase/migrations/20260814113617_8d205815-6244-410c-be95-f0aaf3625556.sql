CREATE POLICY "chat media upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'store-media' AND (storage.foldername(name))[1] = 'chat');

CREATE POLICY "chat media delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'store-media' AND (storage.foldername(name))[1] = 'chat'
       AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));