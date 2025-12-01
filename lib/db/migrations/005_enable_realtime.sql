-- Phase 4A: Enable Supabase Realtime for core tables

-- Attach ideas and buckets tables to the default Supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE buckets;
