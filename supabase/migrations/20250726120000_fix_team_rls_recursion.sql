/*
# [Fix] Corrige Políticas de Segurança da Tabela de Equipe
Corrige o erro de "recursão infinita" ao acessar a tabela `membros_equipe`, limpando as políticas antigas e criando novas que usam uma função segura.

## Descrição da Query:
Esta operação irá primeiro remover todas as políticas de segurança (RLS) e a função auxiliar da tabela `membros_equipe`. Em seguida, criará uma nova função `is_admin()` com `SECURITY DEFINER`, que permite verificar o cargo de um usuário sem causar loops de permissão. Por fim, recriará as políticas para garantir que apenas administradores possam gerenciar a equipe, e que todos os membros autenticados possam visualizar a lista.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true

## Implicações de Segurança:
- RLS Status: As políticas serão redefinidas para uma configuração mais segura e robusta.
- Policy Changes: Sim. As operações de escrita (INSERT, UPDATE, DELETE) serão restritas a usuários com o cargo 'Admin'. A leitura será permitida para todos os usuários autenticados.
*/

-- Passo 1: Remover as políticas antigas para quebrar as dependências.
-- É seguro executar mesmo que as políticas não existam.
DROP POLICY IF EXISTS "Allow admin to select members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to view team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow all authenticated users to view team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to view team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to delete members" ON public.membros_equipe;

-- Passo 2: Remover as funções antigas agora que não há mais dependências.
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_current_user_admin();

-- Passo 3: Criar a nova função com SECURITY DEFINER para evitar recursão.
-- Esta função verifica se o usuário logado é um administrador.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
-- SET search_path para mitigar riscos de segurança com SECURITY DEFINER.
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verifica se existe um membro na equipe com o email do usuário logado e o cargo 'Admin'.
  -- A verificação é feita pelo email, que é um identificador único do usuário na autenticação do Supabase.
  RETURN EXISTS (
    SELECT 1
    FROM public.membros_equipe
    WHERE email = auth.email() AND cargo = 'Admin'
  );
END;
$$;

-- Passo 4: Recriar as políticas de segurança usando a nova função.

-- Política de SELECT: Permite que qualquer usuário autenticado veja a lista de membros.
-- Isso não causa recursão pois não chama a função is_admin().
CREATE POLICY "Allow authenticated users to view team members"
ON public.membros_equipe
FOR SELECT
USING (auth.role() = 'authenticated');

-- Política de INSERT: Apenas administradores podem adicionar novos membros.
CREATE POLICY "Allow admins to insert new members"
ON public.membros_equipe
FOR INSERT
WITH CHECK (public.is_admin());

-- Política de UPDATE: Apenas administradores podem atualizar os dados dos membros.
CREATE POLICY "Allow admins to update members"
ON public.membros_equipe
FOR UPDATE
USING (public.is_admin());

-- Política de DELETE: Apenas administradores podem remover membros.
CREATE POLICY "Allow admins to delete members"
ON public.membros_equipe
FOR DELETE
USING (public.is_admin());
