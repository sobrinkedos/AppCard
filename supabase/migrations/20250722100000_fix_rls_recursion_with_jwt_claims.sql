/*
# [Operation Name]
Fix RLS Policies for Team Management with JWT Claims

## Query Description: [This migration completely overhauls the permission system for the 'membros_equipe' table to resolve a persistent 'infinite recursion' error. It introduces a standard, robust pattern using JWT claims to store user roles, which prevents the RLS policies from needing to query the table they are protecting.

1.  **Cleanup:** All existing security policies and helper functions on 'membros_equipe' are removed to ensure a clean state.
2.  **Role Claim Trigger:** A new function and trigger are created. When a team member's role is changed in 'membros_equipe', their role is automatically stored in their secure JWT ('app_metadata').
3.  **New User Trigger:** A function and trigger are added to automatically create a default 'Operador' profile in 'membros_equipe' when a new user signs up via Supabase Auth. This improves the system's integrity.
4.  **New RLS Policies:** The security policies are recreated to use the new JWT role claim for permission checks, which is fast, secure, and recursion-safe.
5.  **One-Time Sync:** A command is run to sync the roles for all existing users, ensuring the fix works immediately for everyone.

This change is structural and critical for the team management feature to work correctly.]

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "High"
- Requires-Backup: true
- Reversible: false

## Structure Details:
- Tables Affected: 'membros_equipe'
- Functions Created: 'public.update_user_role_claim', 'public.handle_new_user'
- Triggers Created: 'on_member_role_change', 'on_auth_user_created'
- Policies Modified: All policies on 'membros_equipe' are replaced.

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes
- Auth Requirements: This change deeply integrates with Supabase Auth, storing roles in JWTs.

## Performance Impact:
- Indexes: None
- Triggers: Adds triggers to 'membros_equipe' and 'auth.users'. Impact is minimal and occurs only on user creation or role changes.
- Estimated Impact: Positive. RLS checks will be faster as they no longer require table lookups.
*/

-- STEP 1: Cleanup previous attempts to ensure a clean slate.
-- Drop policies first, then the functions they might depend on.
-- Using "IF EXISTS" prevents errors if objects were already removed.
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow authenticated users to read" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admins full access" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to insert new members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to update members" ON public.membros_equipe;
DROP POLICY IF EXISTS "Allow admin to delete members" ON public.membros_equipe;
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.update_user_role_claim();
DROP FUNCTION IF EXISTS public.handle_new_user();


-- STEP 2: Function to update the user's role in app_metadata when their record in membros_equipe changes.
create or replace function public.update_user_role_claim()
returns trigger
language plpgsql
security definer -- Important! Allows the function to update auth.users
set search_path = public
as $$
declare
  auth_user_id uuid;
begin
  -- Find the corresponding user in auth.users
  select id into auth_user_id from auth.users where email = new.email;

  -- If user exists, update their raw_app_meta_data
  if auth_user_id is not null then
    update auth.users
    set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', new.cargo)
    where id = auth_user_id;
  end if;
  
  return new;
end;
$$;

-- STEP 3: Trigger to call the function on insert or update of 'membros_equipe'
create trigger on_member_role_change
  after insert or update of cargo on public.membros_equipe
  for each row
  execute function public.update_user_role_claim();


-- STEP 4: Function to create a new team member when a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert a new row into public.membros_equipe
  insert into public.membros_equipe (nome, email, cargo, status)
  values (
    new.raw_user_meta_data->>'full_name', -- Assumes 'full_name' is provided at signup
    new.email,
    'Operador', -- Default role
    'Ativo'
  );
  return new;
end;
$$;

-- STEP 5: Trigger to call the new user handler
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- STEP 6: Recreate RLS policies using the JWT claim. This is recursion-safe.
-- Ensure RLS is enabled on the table
alter table public.membros_equipe enable row level security;

-- Policy 1: Allow authenticated users to read all team members.
create policy "Allow authenticated users to read"
  on public.membros_equipe for select
  to authenticated
  using (true);

-- Policy 2: Allow users with 'Admin' role to insert, update, and delete.
-- This checks the 'role' claim inside the user's JWT, which is fast and recursion-safe.
create policy "Allow admins to manage team members"
  on public.membros_equipe for all -- Covers INSERT, UPDATE, DELETE
  to authenticated
  using (auth.jwt()->'app_metadata'->>'role' = 'Admin')
  with check (auth.jwt()->'app_metadata'->>'role' = 'Admin');


-- STEP 7: One-time update for existing users to populate their role claim.
-- This ensures existing admins can work immediately after the migration.
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
    COALESCE(u.raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(m.cargo)
)
FROM public.membros_equipe m
WHERE u.email = m.email;
