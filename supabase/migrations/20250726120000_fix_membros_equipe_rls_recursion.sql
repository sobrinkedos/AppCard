/*
# [Fix RLS Policies for Team Management]
This migration fixes an "infinite recursion" error in the Row-Level Security (RLS) policies for the `membros_equipe` table. The previous policies caused a loop where checking a user's permission required querying the same table, which triggered the permission check again.

## Query Description:
This script creates a special `SECURITY DEFINER` function to safely check a user's role without triggering the recursion. It then replaces the old, faulty RLS policies with new ones that use this function for write operations (INSERT, UPDATE, DELETE) and a simple, non-recursive policy for read operations (SELECT). This change is safe and does not affect existing data. It only corrects the permission logic.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- **Function Created:** `public.get_user_role(uuid)`
- **Policies Dropped (if exist):** All previous policies on `public.membros_equipe`.
- **Policies Created:** `Allow authenticated users to view team members`, `Allow Admins to manage team members` on table `public.membros_equipe`.

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes. This change hardens the security by fixing a faulty implementation that was causing errors. It correctly enforces that only 'Admin' users can modify the team members list.
- Auth Requirements: Users must be authenticated. Write operations require the 'Admin' role.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. Involves a function call during policy checks, but this is highly efficient.
*/

-- Step 1: Create a helper function to safely check a user's role.
-- The `SECURITY DEFINER` clause is the key. It makes the function execute with the
-- permissions of its owner (usually a superuser), who is not subject to RLS.
-- This breaks the recursion loop.
create or replace function public.get_user_role(p_user_id uuid)
returns text
language plpgsql
security definer
-- Setting the search_path is a security best practice to prevent hijacking.
set search_path = public, pg_temp;
as $$
declare
  v_role text;
begin
  -- This SELECT query runs as the function's owner, bypassing the RLS
  -- policy that would normally be triggered on the 'membros_equipe' table.
  select cargo into v_role
  from public.membros_equipe
  where id = p_user_id;
  return v_role;
end;
$$;


-- Step 2: Clean up any previous, potentially recursive policies to avoid conflicts.
drop policy if exists "Admins can manage team members" on public.membros_equipe;
drop policy if exists "Authenticated users can view team members" on public.membros_equipe;
drop policy if exists "Enable all operations for admins" on public.membros_equipe;
drop policy if exists "Enable read access for all authenticated users" on public.membros_equipe;
drop policy if exists "Allow authenticated users to view team members" on public.membros_equipe;
drop policy if exists "Allow Admins to manage team members" on public.membros_equipe;


-- Step 3: Create the new, non-recursive policies.

-- Policy for SELECT: Any authenticated user can VIEW the list of team members.
-- This policy is simple and does not call our helper function, so it cannot cause recursion.
create policy "Allow authenticated users to view team members"
on public.membros_equipe
for select
to authenticated
using (true);

-- Policy for WRITE (INSERT, UPDATE, DELETE): Only users with the 'Admin' role can manage members.
-- This policy uses our safe helper function. When a user tries to write, this policy
-- calls get_user_role(), which runs as the owner and is exempt from RLS,
-- safely getting the role without causing a recursion loop.
create policy "Allow Admins to manage team members"
on public.membros_equipe
for (insert, update, delete)
to authenticated
using (public.get_user_role(auth.uid()) = 'Admin')
with check (public.get_user_role(auth.uid()) = 'Admin');
