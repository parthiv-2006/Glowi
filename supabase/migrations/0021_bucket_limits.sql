-- Glowi · 0021_bucket_limits
-- The scan-images bucket was created without size or MIME constraints, so any
-- authenticated client could upload arbitrarily large or non-image objects
-- into its own prefix. Both app upload sites (scan/analyzing.tsx, api.ts)
-- send image/jpeg; png/webp are allowed as headroom for future capture paths.
-- 10 MB comfortably covers a guided-capture photo (typically 1–4 MB).

update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'scan-images';
