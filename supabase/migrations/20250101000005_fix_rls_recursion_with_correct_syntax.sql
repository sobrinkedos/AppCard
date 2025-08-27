/*
          # [Critical RLS Fix] Corrigir Recursão Infinita nas Políticas de Segurança da Tabela `membros_equipe`

          ## Descrição da Query:
          Esta migração corrige um erro crítico de "recursão infinita" que impedia a visualização e manipulação de dados na tabela `membros_equipe`. O erro era causado por políticas de segurança (RLS) que, para verificar a permissão de um usuário, consultavam a mesma tabela, criando um loop.

          O script realiza as seguintes ações:
          1.  **DROP (Remoção Segura):** Remove a função `is_admin()` e todas as políticas de RLS da tabela `membros_equipe` criadas anteriormente para limpar o estado inconsistente.
          2.  **CREATE FUNCTION:** Cria uma nova função `is_admin(p_user_id UUID)` com a sintaxe corrigida. Esta função verifica se o usuário autenticado possui o cargo 'Admin' na tabela `membros_equipe`. O `SECURITY DEFINER` é usado para evitar o problema de recursão, permitindo que a função execute com privilégios elevados de forma segura.
          3.  **CREATE POLICY:** Reimplementa as políticas de segurança para `SELECT`, `INSERT`, `UPDATE`, e `DELETE` usando a nova função `is_admin()`. Agora, apenas administradores podem realizar operações na tabela.

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "High"
          - Requires-Backup: false
          - Reversible: true

          ## Detalhes da Estrutura:
          - **Tabelas Afetadas:** `membros_equipe`
          - **Funções Criadas:** `is_admin(p_user_id UUID)`
          - **Políticas Modificadas:** Políticas de `SELECT`, `INSERT`, `UPDATE`, `DELETE` para a tabela `membros_equipe`.

          ## Implicações de Segurança:
          - RLS Status: Habilitado e Corrigido
          - Policy Changes: Sim. As políticas agora usam uma função `SECURITY DEFINER` para evitar recursão e garantir que apenas administradores possam gerenciar a equipe.
          - Auth Requirements: O usuário deve estar autenticado e ter o cargo 'Admin'.

          ## Impacto de Performance:
          - Indexes: Nenhum
          - Triggers: Nenhum
          - Estimated Impact: Baixo. A correção melhora a performance ao eliminar o loop de recursão.
          */

-- 1. Limpar as políticas e a função anteriores para evitar conflitos.
DROP POLICY IF EXISTS "Enable read access for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable update for admins" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.membros_equipe;
DROP FUNCTION IF EXISTS public.is_admin(uuid);


-- 2. Criar a função auxiliar com a sintaxe correta e SECURITY DEFINER para evitar recursão.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.membros_equipe
    WHERE email = (SELECT email FROM auth.users WHERE id = p_user_id) AND cargo = 'Admin'
  );
END;
$$;


-- 3. Recriar as políticas usando a nova função.
-- Garante que a tabela `membros_equipe` já tenha RLS ativado.
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Admins podem ver todos os membros.
CREATE POLICY "Enable read access for admins"
ON public.membros_equipe
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Política para INSERT: Admins podem adicionar novos membros.
CREATE POLICY "Enable insert for admins"
ON public.membros_equipe
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Política para UPDATE: Admins podem atualizar membros.
CREATE POLICY "Enable update for admins"
ON public.membros_equipe
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Política para DELETE: Admins podem remover membros.
CREATE POLICY "Enable delete for admins"
ON public.membros_equipe
FOR DELETE
USING (public.is_admin(auth.uid()));
