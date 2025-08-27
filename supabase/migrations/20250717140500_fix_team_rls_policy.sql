/*
# [MIGRATION] Corrigir Políticas de Segurança para Gerenciamento de Equipe (v2)
[Description]
Esta migração corrige e aprimora as políticas de Row-Level Security (RLS) na tabela `membros_equipe`.
A política anterior continha um erro lógico que impedia administradores de adicionar novos membros.
Esta nova política verifica o cargo do usuário autenticado através do seu email, que deve corresponder
a um registro na tabela `membros_equipe` com o cargo 'Admin'.

## Query Description:
- Remove a política de gerenciamento anterior que estava incorreta.
- Cria uma nova política de ESCRITA (INSERT, UPDATE, DELETE) que permite a operação
  apenas se o email do usuário autenticado corresponder a um membro da equipe com o cargo 'Admin'.
- Esta abordagem não requer alterações no esquema da tabela e deve resolver o problema de permissão.

## Metadata:
- Schema-Category: ["Security"]
- Impact-Level: ["Medium"]
- Requires-Backup: false
- Reversible: true

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes
- Auth Requirements: O usuário deve ser um 'Admin' para gerenciar a equipe.
*/

-- 1. Remover a política de gerenciamento anterior que estava com erro.
DROP POLICY IF EXISTS "Admins can manage team members" ON public.membros_equipe;

-- 2. Criar a nova política correta para gerenciamento de equipe.
--    Permite que um usuário gerencie a equipe se seu email autenticado
--    estiver na tabela `membros_equipe` com o cargo 'Admin'.
CREATE POLICY "Admins can manage team members"
ON public.membros_equipe
FOR ALL -- Abrange INSERT, UPDATE, DELETE
TO authenticated
USING (
  (SELECT cargo FROM public.membros_equipe WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())) = 'Admin'
)
WITH CHECK (
  (SELECT cargo FROM public.membros_equipe WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())) = 'Admin'
);

-- Observação: A política de leitura "Authenticated users can view team members"
-- criada na migração anterior permanece válida e não precisa ser alterada.
