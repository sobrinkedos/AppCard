/*
  # [Correção Definitiva da Política de Segurança da Tabela membros_equipe]
  Este script corrige o erro de "recursão infinita" ao refatorar as políticas de segurança (RLS) da tabela `membros_equipe`.

  ## Query Description:
  1.  **Limpeza:** Remove todas as políticas e funções antigas associadas à tabela para evitar conflitos.
  2.  **Função Segura:** Cria uma nova função `is_current_user_admin()` com `SECURITY DEFINER`. Isso permite que a função verifique o cargo de um usuário sem acionar as políticas de RLS da própria tabela, quebrando o loop de recursão.
  3.  **Novas Políticas:**
      -   Uma política simples é criada para permitir que todos os usuários autenticados leiam (SELECT) a lista de membros.
      -   Uma política robusta é criada para permitir que apenas administradores (verificados pela nova função) possam escrever (INSERT, UPDATE, DELETE) na tabela.
  Esta abordagem é segura, eficiente e resolve o problema na raiz.

  ## Metadata:
  - Schema-Category: ["Security", "Structural"]
  - Impact-Level: ["Medium"]
  - Requires-Backup: false
  - Reversible: false (as políticas antigas são removidas)
*/

-- 1. Limpeza: Remove as políticas e funções antigas para evitar conflitos.
-- A ordem é importante: primeiro as políticas, depois a função que elas usam.
DROP POLICY IF EXISTS "Allow authenticated users to view team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to insert members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to delete members" ON public.membros_equipe;

-- Remove as funções antigas que podem existir de tentativas anteriores
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_current_user_admin();

-- 2. Criação da Função Segura: A chave para resolver a recursão.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.membros_equipe
    WHERE email = auth.email() AND cargo = 'Admin'
  ) INTO is_admin_user;
  RETURN is_admin_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Aplicação das Novas Políticas de Segurança (RLS)
-- Habilita a RLS na tabela, caso ainda não esteja.
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Política de Leitura (SELECT): Permite que todos os usuários autenticados vejam a lista de membros.
-- É simples e não causa recursão.
CREATE POLICY "Allow authenticated users to view team members"
ON public.membros_equipe FOR SELECT
USING (auth.role() = 'authenticated');

-- Política de Escrita (INSERT, UPDATE, DELETE): Permite apenas a administradores.
-- Usa a função segura que não causa recursão.
CREATE POLICY "Allow admins to manage team members"
ON public.membros_equipe FOR ALL -- Cobre INSERT, UPDATE, DELETE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());
