/*
# [Policy] Admins can manage team members
Allows users with the 'Admin' role to perform all CRUD operations on the team members table.

## Query Description:
This operation establishes a new security policy for the `membros_equipe` table. It ensures that only authenticated users who are themselves registered as 'Admin' in the `membros_equipe` table can view, create, update, or delete team members. This is a critical security measure to prevent unauthorized users from modifying team data. There is no risk to existing data, but it will restrict access for any non-admin users who might have had it previously.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true (by dropping the policy)

## Structure Details:
- Table: public.membros_equipe
- Operation: CREATE POLICY

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes, a new policy is created to replace potentially faulty old ones.
- Auth Requirements: Requires an authenticated user who is an 'Admin'.

## Performance Impact:
- Indexes: No change
- Triggers: No change
- Estimated Impact: Low. The policy check adds a minor overhead to queries on this table, but it's essential for security.
*/

-- Garante que RLS está habilitado na tabela.
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas que possam estar causando conflito.
-- É seguro, pois a nova política abaixo cobrirá todos os casos para administradores.
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.membros_equipe;
DROP POLICY IF EXISTS "Admins can manage team members." ON public.membros_equipe;

-- Cria a política correta que permite aos administradores gerenciar a equipe.
CREATE POLICY "Admins can manage team members."
ON public.membros_equipe
FOR ALL
USING (
  (SELECT cargo FROM public.membros_equipe WHERE id = auth.uid()) = 'Admin'
)
WITH CHECK (
  (SELECT cargo FROM public.membros_equipe WHERE id = auth.uid()) = 'Admin'
);
