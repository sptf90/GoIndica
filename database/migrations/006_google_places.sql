-- Store only the provider identifier; names and addresses are fetched without persistent cache.
ALTER TABLE places ADD COLUMN google_place_id VARCHAR(255) NULL UNIQUE;
