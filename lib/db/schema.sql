-- Collab App Database Schema
-- Phase 1: Simplified schema with TEXT columns for metadata
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql

-- ============================================================================
-- TABLES
-- ============================================================================

-- Plans (shareable workspaces)
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT title_length CHECK (char_length(title) BETWEEN 1 AND 100)
);

-- Guest Sessions (nickname-based authentication)
CREATE TABLE guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nickname_length CHECK (char_length(nickname) BETWEEN 1 AND 50),
  CONSTRAINT unique_nickname_per_plan UNIQUE (plan_id, nickname)
);

-- Buckets (semantic groupings)
CREATE TABLE buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  accent_color TEXT DEFAULT 'gray',
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_color CHECK (accent_color IN (
    'blue', 'green', 'orange', 'purple', 'pink', 'teal',
    'amber', 'rose', 'indigo', 'emerald', 'cyan', 'red', 'gray'
  ))
);

-- Ideas (core content) - SIMPLIFIED for Phase 1
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  bucket_id UUID REFERENCES buckets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Simple metadata fields (Phase 1)
  location TEXT,
  date TEXT,
  budget TEXT,
  confidence INTEGER DEFAULT 85,

  -- Tracking
  created_by UUID REFERENCES guest_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT confidence_range CHECK (confidence BETWEEN 0 AND 100)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_ideas_plan_id ON ideas(plan_id);
CREATE INDEX idx_ideas_bucket_id ON ideas(bucket_id);
CREATE INDEX idx_buckets_plan_display_order ON buckets(plan_id, display_order);
CREATE INDEX idx_sessions_plan_id ON guest_sessions(plan_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Plans: Publicly readable, anyone can create
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are publicly readable"
  ON plans FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create plans"
  ON plans FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update plans"
  ON plans FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete plans"
  ON plans FOR DELETE
  USING (true);

-- Guest Sessions: Publicly readable and writable
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions are publicly readable"
  ON guest_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create sessions"
  ON guest_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update sessions"
  ON guest_sessions FOR UPDATE
  USING (true);

-- Ideas: Publicly readable and writable
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ideas are publicly readable"
  ON ideas FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create ideas"
  ON ideas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update ideas"
  ON ideas FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete ideas"
  ON ideas FOR DELETE
  USING (true);

-- Buckets: Publicly readable and writable
ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buckets are publicly readable"
  ON buckets FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create buckets"
  ON buckets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update buckets"
  ON buckets FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete buckets"
  ON buckets FOR DELETE
  USING (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on plans
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on ideas
CREATE TRIGGER update_ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Uncomment below to add test data

-- INSERT INTO plans (id, title, description) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Moving to Italy', 'Planning our big move to Italy');

-- INSERT INTO buckets (plan_id, title, accent_color, display_order) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Location Preferences', 'blue', 0),
--   ('00000000-0000-0000-0000-000000000001', 'House Requirements', 'teal', 1),
--   ('00000000-0000-0000-0000-000000000001', 'Budget & Costs', 'orange', 2);
