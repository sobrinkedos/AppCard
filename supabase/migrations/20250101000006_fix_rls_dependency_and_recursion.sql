/*
          # [Fix RLS Dependency and Recursion Error]
          This script corrects the Row-Level Security (RLS) policies for the 'membros_equipe' table to fix an infinite recursion error and a dependency issue from previous migrations.

          ## Query Description: [This operation will reset and correctly configure the security policies for the team management feature. It first removes the old, problematic policies and functions in the correct order to resolve dependency errors. It then creates a new, secure function (`get_my_role`) and applies the correct policies, allowing administrators to manage the team without errors.]

          ## Metadata:
          - Schema-Category: "Security"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: true

          ## Structure Details:
          - Drops policies on `membros_equipe` table.
          - Drops function `get_my_role()`.
          - Recreates function `get_my_role()` with `SECURITY DEFINER`.
          - Recreates policies on `membros_equipe` table.

          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: This change is essential for the authentication-based team management to work correctly.
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Low. This change affects permissions and should not impact query performance.
          */

-- Step 1: Drop existing policies to remove dependencies. Using IF EXISTS to prevent errors on a clean run.
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to view" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;

-- Step 2: Drop the old functions now that they are no longer in use.
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_admin();

-- Step 3: Recreate the function to get the user's role securely.
-- SECURITY DEFINER allows the function to run with the definer's privileges,
-- bypassing the RLS check on the 'membros_equipe' table inside the function itself, thus avoiding recursion.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
-- Set a secure search_path to prevent potential hijacking.
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT cargo
    FROM public.membros_equipe
    WHERE email = auth.email()
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Step 4: Re-apply the correct policies.

-- Policy 1: Allow Admins to perform all actions.
CREATE POLICY "Allow admins full access"
ON public.membros_equipe
FOR ALL
TO authenticated
USING (public.get_my_role() = 'Admin')
WITH CHECK (public.get_my_role() = 'Admin');

-- Policy 2: Allow all authenticated users to view the team members list.
CREATE POLICY "Allow authenticated users to view"
ON public.membros_equipe
FOR SELECT
TO authenticated
USING (true);

-- Step 5: Ensure RLS is enabled on the table.
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;
