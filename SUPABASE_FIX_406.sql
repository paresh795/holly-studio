-- 🚨 FIX FOR 406 NOT ACCEPTABLE ERROR
-- Run this SQL in your Supabase SQL Editor to fix permissions

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'project_states';

-- Option 1: DISABLE RLS (quickest fix for development)
ALTER TABLE project_states DISABLE ROW LEVEL SECURITY;

-- Option 2: OR keep RLS enabled but add permissive policy
-- (uncomment these lines if you prefer to keep RLS enabled)
-- ALTER TABLE project_states ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Allow public access to project_states" ON project_states;
-- 
-- CREATE POLICY "Allow public access to project_states" 
-- ON project_states 
-- FOR ALL 
-- TO public 
-- USING (true) 
-- WITH CHECK (true);

-- Verify the fix worked
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'project_states';

-- Test query to verify access
SELECT project_id, updated_at 
FROM project_states 
ORDER BY updated_at DESC 
LIMIT 1; 