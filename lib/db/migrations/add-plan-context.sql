-- Migration: Add plan_context column to plans
-- Run this in Supabase SQL editor or via migration tooling

ALTER TABLE plans
ADD COLUMN plan_context TEXT;
