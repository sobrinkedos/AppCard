-- Script para corrigir o problema de recursão infinita no RLS da tabela membros_equipe
-- Execute este script no Supabase Dashboard > SQL Editor

-- 1. Primeiro, vamos remover todas as políticas RLS existentes que podem estar causando recursão
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
DROP POLICY IF EXISTS "membros_equipe_select_policy" ON public.membros_equipe;
DROP POLICY IF EXISTS "membros_equipe_insert_policy" ON public.membros_equipe;
DROP POLICY IF EXISTS "membros_equipe_update_policy" ON public.membros_equipe;
DROP POLICY IF EXISTS "membros_equipe_delete_policy" ON public.membros_equipe;

-- 2. Remover funções que podem estar causando recursão
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_current_user_admin();
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.check_user_is_admin();

-- 3. Criar uma função RPC segura para buscar membros da equipe
CREATE OR REPLACE FUNCTION public.get_membros_equipe_safe()
RETURNS TABLE (
  id bigint,
  nome text,
  email text,
  cargo text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Esta função usa SECURITY DEFINER para contornar RLS
  -- e permite que usuários autenticados vejam os membros da equipe
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  RETURN QUERY
  SELECT 
    me.id,
    me.nome,
    me.email,
    me.cargo,
    me.status,
    me.created_at,
    me.updated_at
  FROM public.membros_equipe me
  ORDER BY me.nome ASC;
END;
$$;

-- 4. Criar uma função para verificar se o usuário é admin sem recursão
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
    is_admin_user BOOLEAN := FALSE;
BEGIN
    -- Obter o email do usuário atual
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    -- Se não encontrou email, usuário não está autenticado
    IF user_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar se o usuário é admin (usando SECURITY DEFINER para contornar RLS)
    SELECT EXISTS(
        SELECT 1 FROM public.membros_equipe 
        WHERE email = user_email AND cargo = 'Admin'
    ) INTO is_admin_user;
    
    RETURN is_admin_user;
END;
$$;

-- 5. Desabilitar RLS temporariamente para permitir acesso
ALTER TABLE public.membros_equipe DISABLE ROW LEVEL SECURITY;

-- 6. Ou, se preferir manter RLS, criar políticas mais simples
-- ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Política simples para SELECT - permite todos os usuários autenticados
-- CREATE POLICY "membros_equipe_select_simple"
-- ON public.membros_equipe
-- FOR SELECT
-- USING (auth.role() = 'authenticated');

-- Política para INSERT/UPDATE/DELETE - apenas para admins usando a função segura
-- CREATE POLICY "membros_equipe_modify_admin"
-- ON public.membros_equipe
-- FOR ALL
-- USING (public.is_user_admin())
-- WITH CHECK (public.is_user_admin());

-- 7. Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION public.get_membros_equipe_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_membros_equipe_safe() TO anon;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO anon;

-- 8. Comentários para orientação
-- Para testar se a função funciona, execute:
-- SELECT * FROM public.get_membros_equipe_safe();

-- Para reabilitar RLS com políticas seguras, descomente as linhas 77-86
-- e execute:
-- ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;