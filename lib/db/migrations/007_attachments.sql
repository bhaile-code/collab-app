-- Phase 4C: Attachments support for ideas

ALTER TABLE ideas
ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
