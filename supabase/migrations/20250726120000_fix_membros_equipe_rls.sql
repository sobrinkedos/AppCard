/*
# [Fix RLS for membros_equipe]
This migration script corrects the Row-Level Security (RLS) policies for the `membros_equipe` table to resolve a "cannot drop function" dependency error and a persistent "infinite recursion" error. It ensures that administrative actions (INSERT, UPDATE, DELETE) can be performed without issues.

## Query Description:
This operation will first drop all existing policies and the problematic function from the `membros_equipe` table. It then recreates them in the correct order and with a secure architecture. This is a safe operation as it only restructures security rules and does not affect existing data in the table.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (by dropping the new policies/function and restoring the old ones, though not recommended)

## Structure Details:
- **Tables Affected:** `membros_equipe`
- **Functions Affected:** `get_my_role()` (dropped and recreated)
- **Policies Affected:** All policies on `membros_equipe` (dropped and recreated)

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes. This script replaces the faulty RLS implementation with a secure and correct one.
- Auth Requirements: Operations are checked against the authenticated user's role.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. This change improves the reliability of security checks.
*/

-- STEP 1: Drop the old policies that depend on the function.
-- This must be done FIRST to remove the dependency.
DROP POLICY IF EXISTS "Allow admins to insert members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to delete members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to view" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;

-- STEP 2: Now that no policies depend on it, drop the old function.
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_admin(); -- Also remove any other old functions to be safe.

-- STEP 3: Recreate the function with SECURITY DEFINER.
-- This is the key to fixing the recursion error. It allows the function to run
-- with the definer's permissions, bypassing the RLS check on the `membros_equipe` table.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
-- Set a secure search path to prevent hijacking and address security warnings.
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Find the role of the currently authenticated user from the membros_equipe table.
  SELECT cargo INTO user_role
  FROM public.membros_equipe
  WHERE email = auth.email();
  RETURN user_role;
END;
$$;

-- STEP 4: Recreate the policies in a secure and non-recursive way.

-- Policy for SELECT: Allow any authenticated user to view the team members.
-- This is a simple check and does not cause recursion.
CREATE POLICY "Allow authenticated users to view"
ON public.membros_equipe
FOR SELECT
TO authenticated
USING (true);

-- Policy for INSERT: Only allow users whose role is 'Admin' to insert.
CREATE POLICY "Allow admins to insert members"
ON public.membros_equipe
FOR INSERT
TO authenticated
WITH CHECK (public.get_my_role() = 'Admin');

-- Policy for UPDATE: Only allow users whose role is 'Admin' to update.
CREATE POLICY "Allow admins to update members"
ON public.membros_equipe
FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'Admin');

-- Policy for DELETE: Only allow users whose role is 'Admin' to delete.
CREATE POLICY "Allow admins to delete members"
ON public.membros_equipe
FOR DELETE
TO authenticated
USING (public.get_my_role() = 'Admin');
