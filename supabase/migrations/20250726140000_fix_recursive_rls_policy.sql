/*
# [Fix RLS Infinite Recursion]
Corrige a política de segurança de nível de linha (RLS) na tabela `membros_equipe` que estava causando um erro de recursão infinita.

## Query Description:
Esta operação substitui as políticas de RLS existentes na tabela `membros_equipe` por novas políticas que utilizam uma função `SECURITY DEFINER`. Isso resolve o erro "infinite recursion detected" que impedia a visualização e gerenciamento de membros da equipe. A nova abordagem verifica se o usuário autenticado é um 'Admin' de forma segura, sem causar loops. Não há risco de perda de dados.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Tabela afetada: `membros_equipe`
- Políticas RLS afetadas: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- Nova função criada: `is_admin()`

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes. As políticas são redefinidas para serem mais seguras e eficientes.
- Auth Requirements: A função `is_admin()` utiliza `auth.email()` para identificar o usuário.

## Performance Impact:
- Indexes: Nenhum
- Triggers: Nenhum
- Estimated Impact: Positivo. Remove a recursão infinita que causava falha na consulta.
*/

-- Step 1: Create a helper function with SECURITY DEFINER to break the recursion.
-- This function checks if the currently authenticated user has the 'Admin' role.
-- By using SECURITY DEFINER, it runs with the permissions of the function owner, bypassing the RLS policy on a subsequent check.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the user's email exists in the team members table and their role is 'Admin'
  RETURN EXISTS (
    SELECT 1
    FROM public.membros_equipe
    WHERE email = auth.email() AND cargo = 'Admin'
  );
END;
$$;

-- Step 2: Drop all existing policies on the table to ensure a clean state.
DROP POLICY IF EXISTS "Permitir que administradores visualizem todos os membros" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores insiram novos membros" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores atualizem membros" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores deletem membros" ON public.membros_equipe;
-- Drop older policy names as well, just in case.
DROP POLICY IF EXISTS "Enable read access for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable update for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Permitir que administradores gerenciem membros" ON public.membros_equipe;


-- Step 3: Recreate policies using the non-recursive helper function.

-- Policy for SELECT: Admins can see all members.
CREATE POLICY "Permitir que administradores visualizem todos os membros"
ON public.membros_equipe
FOR SELECT
USING (public.is_admin());

-- Policy for INSERT: Admins can add new members.
CREATE POLICY "Permitir que administradores insiram novos membros"
ON public.membros_equipe
FOR INSERT
WITH CHECK (public.is_admin());

-- Policy for UPDATE: Admins can update any member.
CREATE POLICY "Permitir que administradores atualizem membros"
ON public.membros_equipe
FOR UPDATE
USING (public.is_admin());

-- Policy for DELETE: Admins can delete members.
CREATE POLICY "Permitir que administradores deletem membros"
ON public.membros_equipe
FOR DELETE
USING (public.is_admin());
