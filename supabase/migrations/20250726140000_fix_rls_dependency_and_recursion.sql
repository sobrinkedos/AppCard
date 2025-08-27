/*
          # [Fix RLS Dependency and Recursion]
          This migration script resolves a critical issue with Row-Level Security (RLS) policies on the `membros_equipe` table. The previous policies were causing an infinite recursion error, and subsequent attempts to fix it led to dependency errors during migration.

          ## Query Description:
          This script performs a clean reset of the RLS configuration for the `membros_equipe` table. It first drops all dependent policies, then drops the problematic functions, and finally recreates a secure function and the corresponding policies in the correct order. This will not affect any existing data in the table.

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: false

          ## Structure Details:
          - Drops all existing RLS policies on `membros_equipe`.
          - Drops the functions `get_my_role()` and `is_admin()`.
          - Creates a new, secure function `get_my_role()` with `SECURITY DEFINER`.
          - Creates new RLS policies for `SELECT` and `ALL` operations for admins.

          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: This ensures only authenticated users can interact with the table and that only users with the 'Admin' role can perform modifications.

          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Low. The new function is efficient and will not degrade performance.
          */

-- Step 1: Drop existing policies that depend on the functions.
-- The policy names might vary slightly if they were created manually, but we drop them to be safe.
DROP POLICY IF EXISTS "Allow all access for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow team members to view their own info" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to view team" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to select members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;

-- Step 2: Drop the functions now that nothing depends on them.
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_admin();

-- Step 3: Recreate a secure function to get the user's role.
-- Using SECURITY DEFINER allows this function to bypass the RLS policies on the `membros_equipe` table when called, thus preventing recursion.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
-- Set a secure search_path to prevent hijacking
SET search_path = public
AS $$
BEGIN
  -- Return 'anon' if the user is not authenticated
  IF auth.uid() IS NULL THEN
    RETURN 'anon';
  END IF;

  -- Select the role from the membros_equipe table for the currently authenticated user
  RETURN (
    SELECT cargo FROM public.membros_equipe
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- Step 4: Re-enable RLS on the table (it should already be enabled, but this is safe).
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Step 5: Create the new, correct policies.
-- Policy for Admins: Admins can do anything (SELECT, INSERT, UPDATE, DELETE).
CREATE POLICY "Allow admins full access"
ON public.membros_equipe
FOR ALL
TO authenticated
USING (public.get_my_role() = 'Admin')
WITH CHECK (public.get_my_role() = 'Admin');

-- Policy for non-admin members: They can see all other team members.
CREATE POLICY "Allow authenticated users to view team"
ON public.membros_equipe
FOR SELECT
TO authenticated
USING (true);
