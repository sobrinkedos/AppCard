/*
# [Fix RLS Infinite Recursion - Final Solution]
Corrige definitivamente o erro de recursão infinita nas políticas RLS da tabela membros_equipe.

## Query Description:
Esta migração implementa uma solução definitiva para o erro "infinite recursion detected in policy for relation 'membros_equipe'".
A estratégia utiliza uma função SECURITY DEFINER que quebra o ciclo de recursão ao verificar permissões
sem acionar as próprias políticas RLS da tabela.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes
- Auth Requirements: Baseado no email do usuário autenticado

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Positive (removes infinite recursion)
*/

-- Step 1: Clean up all existing policies and functions to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable update for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to view all members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to delete members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to view team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores visualizem todos os membros" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores insiram novos membros" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores atualizem membros" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores deletem membros" ON public.membros_equipe;

-- Drop all possible function variations
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_current_user_admin();
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- Step 2: Create a secure function that breaks the recursion cycle
CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
    is_admin_user BOOLEAN := FALSE;
BEGIN
    -- Get the current user's email from auth.users
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    -- If no email found, user is not authenticated
    IF user_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user exists in membros_equipe with Admin role
    -- Using SECURITY DEFINER allows this function to bypass RLS
    SELECT EXISTS(
        SELECT 1 FROM public.membros_equipe 
        WHERE email = user_email AND cargo = 'Admin'
    ) INTO is_admin_user;
    
    RETURN is_admin_user;
END;
$$;

-- Step 3: Ensure RLS is enabled on the table
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Step 4: Create new policies using the secure function

-- Policy for SELECT: Allow all authenticated users to view team members
-- This prevents recursion by not checking admin status for read operations
CREATE POLICY "membros_equipe_select_policy"
ON public.membros_equipe
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy for INSERT: Only admins can add new members
CREATE POLICY "membros_equipe_insert_policy"
ON public.membros_equipe
FOR INSERT
WITH CHECK (public.check_user_is_admin());

-- Policy for UPDATE: Only admins can update members
CREATE POLICY "membros_equipe_update_policy"
ON public.membros_equipe
FOR UPDATE
USING (public.check_user_is_admin())
WITH CHECK (public.check_user_is_admin());

-- Policy for DELETE: Only admins can delete members
CREATE POLICY "membros_equipe_delete_policy"
ON public.membros_equipe
FOR DELETE
USING (public.check_user_is_admin());

-- Step 5: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.check_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_is_admin() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_user_is_admin() IS 'Securely checks if the current authenticated user has Admin role in membros_equipe table. Uses SECURITY DEFINER to avoid RLS recursion.';