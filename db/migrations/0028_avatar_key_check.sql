-- Avatars: either a ready-made one ("preset:<name>", files in public/avatars) or a photo in the
-- user's own folder of the avatars storage, so nobody can point their avatar at another file.
-- NOT VALID: checks every change from now on without re-checking existing rows.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_key_check CHECK (
  avatar_key IS NULL
  OR avatar_key ~ '^preset:[a-z-]{1,40}$'
  OR avatar_key LIKE 'avatars/' || id::text || '/%'
) NOT VALID;
