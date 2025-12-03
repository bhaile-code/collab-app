-- Phase 5A: Embeddings for ideas and buckets
-- Run this migration in Supabase SQL Editor

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns for ideas and buckets
-- Nullable to allow incremental rollout without backfilling
ALTER TABLE ideas
  ADD COLUMN embedding vector(1536);

ALTER TABLE buckets
  ADD COLUMN embedding vector(1536);

-- Approximate nearest-neighbor indexes for cosine similarity
CREATE INDEX IF NOT EXISTS idx_ideas_embedding
  ON ideas USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_buckets_embedding
  ON buckets USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Optional: update statistics for query planner
ANALYZE ideas;
ANALYZE buckets;

-- Optional: verify pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Optional: verify embedding indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('ideas', 'buckets')
  AND indexname IN ('idx_ideas_embedding', 'idx_buckets_embedding')
ORDER BY tablename, indexname;
