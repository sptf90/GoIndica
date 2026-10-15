-- Historical provenance only; never queried from or sent to an external provider at runtime.
ALTER TABLE places ADD COLUMN legacy_google_place_id VARCHAR(255) NULL UNIQUE;
