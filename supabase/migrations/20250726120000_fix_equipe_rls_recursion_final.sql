/*
          # [Fix RLS Recursion on membros_equipe]
          This migration fixes the "infinite recursion" error on the 'membros_equipe' table by separating read and write policies and using a SECURITY DEFINER function to check for admin privileges safely.

          ## Query Description: 
          This operation will drop and recreate all security policies and helper functions for the 'membros_equipe' table. There is no risk to existing data, but access to the table will be temporarily unavailable during the migration. This change is essential for the team management functionality to work correctly.

          ## Metadata:
          - Schema-Category: "Security"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: true

          ## Structure Details:
          - Drops all existing policies on 'membros_equipe'.
          - Drops functions: 'get_my_role()', 'is_admin()', 'is_current_user_admin()' if they exist.
          - Creates a new function: 'is_current_user_admin()'.
          - Creates new policies for SELECT and ALL (INSERT, UPDATE, DELETE) on 'membros_equipe'.

          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: Policies are based on the authenticated user's role.

          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Low. The new function is efficient and resolves a performance-blocking recursion issue.
          */

-- Step 1: Clean up previous policies and functions to avoid conflicts.
-- The order is important: drop policies first, then the functions they depend on.
DROP POLICY IF EXISTS "Allow authenticated users to view team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to manage members" ON public.membros_equipe;


DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_current_user_admin();


-- Step 2: Create a secure function to check if the current user is an admin.
-- SECURITY DEFINER allows the function to bypass RLS for its internal query, preventing recursion.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.membros_equipe
    WHERE id = auth.uid() AND cargo = 'Admin'
  ) INTO is_admin_user;
  RETURN is_admin_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Step 3: Re-create policies using the secure function.
-- Policy for reading (SELECT): All authenticated users can see the team list. This is safe and non-recursive.
CREATE POLICY "Allow authenticated users to view team members"
ON public.membros_equipe
FOR SELECT
TO authenticated
USING (true);

-- Policy for writing (INSERT, UPDATE, DELETE): Only admins can perform these actions.
-- This uses the secure function, which prevents the recursion error.
CREATE POLICY "Allow admins to manage team members"
ON public.membros_equipe
FOR ALL -- Covers INSERT, UPDATE, DELETE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());
