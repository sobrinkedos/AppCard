/*
# [Fix] Corrige a Recursão Infinita na Tabela de Membros da Equipe

Este script resolve um erro crítico de "recursão infinita" nas políticas de segurança (RLS) da tabela `membros_equipe`. O erro ocorria porque as regras para modificar dados (INSERT, UPDATE) precisavam ler a mesma tabela, acionando um loop de verificação de permissões.

## Descrição da Query:
A solução implementada segue as melhores práticas do Supabase/PostgreSQL para este cenário:
1. **Limpeza:** Remove todas as políticas e funções antigas associadas à tabela `membros_equipe` para evitar conflitos.
2. **Função Segura:** Cria uma função `get_my_role()` com `SECURITY DEFINER`. Isso permite que a função leia a tabela com privilégios de administrador, sem acionar as políticas de segurança do usuário, quebrando o loop de recursão.
3. **Políticas Específicas:** Cria políticas separadas e específicas para cada ação (SELECT, INSERT, UPDATE, DELETE). A política de leitura (SELECT) é simples e não depende da função, enquanto as políticas de escrita (INSERT, UPDATE, DELETE) usam a função segura para verificar se o usuário é 'Admin'.

Esta abordagem garante que a verificação de permissão seja feita de forma segura e eficiente, sem causar erros.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true (revertendo a migração)

## Structure Details:
- **Tabelas Afetadas:** `public.membros_equipe`
- **Funções Criadas:** `public.get_my_role()`
- **Políticas Criadas:**
  - `Allow authenticated users to view members` (SELECT)
  - `Allow admins to insert members` (INSERT)
  - `Allow admins to update members` (UPDATE)
  - `Allow admins to delete members` (DELETE)
- **Políticas/Funções Removidas:** Todas as políticas anteriores na tabela e funções de verificação de cargo (`is_admin`, `get_my_role` antigas).

## Security Implications:
- RLS Status: Habilitado e corrigido.
- Policy Changes: Sim, as políticas foram recriadas para serem mais seguras e específicas.
- Auth Requirements: A função `get_my_role` depende do `auth.uid()` para identificar o usuário logado.

## Performance Impact:
- Indexes: Nenhum.
- Triggers: Nenhum.
- Estimated Impact: Baixo. A nova função é eficiente e a separação de políticas pode até melhorar a clareza e a performance das verificações de permissão.
*/

-- Passo 1: Limpar políticas e funções antigas para evitar conflitos e erros de dependência.
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to view members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to insert members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins to delete members" ON public.membros_equipe;

DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_my_role();


-- Passo 2: Criar uma função segura que não causa recursão.
-- A cláusula SECURITY DEFINER é a chave para evitar o loop de RLS.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
-- SET search_path para mitigar riscos de segurança, conforme recomendado.
SET search_path = ''
AS $$
  SELECT cargo FROM public.membros_equipe WHERE id = auth.uid()
$$;


-- Passo 3: Habilitar RLS na tabela (se ainda não estiver) e criar políticas específicas.
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Política de Leitura (SELECT): Simples e segura, não usa a função.
CREATE POLICY "Allow authenticated users to view members"
ON public.membros_equipe
FOR SELECT
TO authenticated
USING (true);

-- Política de Inserção (INSERT): Usa a função segura para verificar se o usuário é Admin.
CREATE POLICY "Allow admins to insert members"
ON public.membros_equipe
FOR INSERT
TO authenticated
WITH CHECK (get_my_role() = 'Admin'::text);

-- Política de Atualização (UPDATE): Usa a função segura.
CREATE POLICY "Allow admins to update members"
ON public.membros_equipe
FOR UPDATE
TO authenticated
USING (get_my_role() = 'Admin'::text);

-- Política de Exclusão (DELETE): Usa a função segura.
CREATE POLICY "Allow admins to delete members"
ON public.membros_equipe
FOR DELETE
TO authenticated
USING (get_my_role() = 'Admin'::text);
