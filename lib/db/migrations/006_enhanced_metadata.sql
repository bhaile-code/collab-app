-- Phase 4B: Enhanced metadata columns for ideas

ALTER TABLE ideas
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN geocoded_place_name TEXT,
ADD COLUMN link_preview_json JSONB;

-- Index for map queries (spatial queries in future phases)
CREATE INDEX idx_ideas_coordinates ON ideas(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
