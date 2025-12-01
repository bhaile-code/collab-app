-- Performance Indexes for Phase 4D
-- Run this migration in Supabase SQL Editor

-- Index for sorting ideas by creation time (dashboard view)
CREATE INDEX IF NOT EXISTS idx_ideas_created_at
  ON ideas(created_at DESC);

-- Index for filtering ideas by date (timeline view)
CREATE INDEX IF NOT EXISTS idx_ideas_date
  ON ideas(date)
  WHERE date IS NOT NULL;

-- Composite index for timeline queries (plan + date)
CREATE INDEX IF NOT EXISTS idx_ideas_plan_date
  ON ideas(plan_id, date DESC)
  WHERE date IS NOT NULL;

-- Index for bucket ordering within plans
CREATE INDEX IF NOT EXISTS idx_buckets_display_order
  ON buckets(plan_id, display_order);

-- Index for coordinate-based map queries
-- (Already created in migration 006, but verify)
CREATE INDEX IF NOT EXISTS idx_ideas_coordinates
  ON ideas(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Update table statistics for query planner
ANALYZE ideas;
ANALYZE buckets;
ANALYZE plans;
ANALYZE guest_sessions;

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('ideas', 'buckets', 'plans')
ORDER BY tablename, indexname;
