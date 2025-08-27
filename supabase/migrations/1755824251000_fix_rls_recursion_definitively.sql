/*
          # [Fix RLS Recursion]
          This migration fixes the "infinite recursion" error on the "membros_equipe" table by creating a SECURITY DEFINER function to check user roles safely.

          ## Query Description: This operation drops all existing RLS policies on the "membros_equipe" table and replaces them with new ones that rely on a secure helper function. This is a safe structural change and does not affect existing data. It is crucial for fixing the application's team management functionality.
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tables affected: membros_equipe
          - Functions created: get_my_role()
          - Policies created: "Allow admins to view all members", "Allow admins to insert new members", "Allow admins to update members", "Allow admins to delete members"
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: Requires authenticated user with 'Admin' role in "membros_equipe" table for access.
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Negligible. The function call is very fast.
          */

-- 1. Cleanup: Remove old policies and function to avoid conflicts.
DROP POLICY IF EXISTS "Allow admins to view all members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to delete members" ON public.membros_equipe;
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_my_role();

-- 2. Create a secure function to get the current user's role.
-- SECURITY DEFINER allows this function to bypass RLS policies, preventing recursion.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
-- Set a secure search_path to address the security warning and ensure stability.
SET search_path = public
AS $$
  SELECT cargo FROM public.membros_equipe WHERE email = auth.email();
$$;

-- 3. Re-create policies using the new secure function.
-- Enable RLS on the table first.
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT
CREATE POLICY "Allow admins to view all members"
ON public.membros_equipe FOR SELECT
USING (public.get_my_role() = 'Admin');

-- Policy for INSERT
CREATE POLICY "Allow admins to insert new members"
ON public.membros_equipe FOR INSERT
WITH CHECK (public.get_my_role() = 'Admin');

-- Policy for UPDATE
CREATE POLICY "Allow admins to update members"
ON public.membros_equipe FOR UPDATE
USING (public.get_my_role() = 'Admin');

-- Policy for DELETE
CREATE POLICY "Allow admins to delete members"
ON public.membros_equipe FOR DELETE
USING (public.get_my_role() = 'Admin');
