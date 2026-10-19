-- Estruturas que só recebiam dados importados do Supabase; a importação foi descartada.
DROP TABLE profile_photos;
ALTER TABLE places DROP COLUMN legacy_google_place_id;
ALTER TABLE profiles DROP COLUMN avatar_url;
