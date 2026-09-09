-- =============================================================================
-- FULL SETUP for a NEW Supabase project (iqftexwkzhqdagrkifrp)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste all → Run
-- =============================================================================

/*
# Create transactions table (single-tenant, no auth)

1. New Tables
- `transactions`
  - `id` (uuid, primary key)
  - `type` (text, either 'income' or 'expense')
  - `amount` (numeric, not null, must be positive)
  - `details` (text, a short description of the transaction)
  - `created_at` (timestamp, defaults to now)
2. Security
- Enable RLS on `transactions`.
- Allow anon + authenticated full CRUD because the data is intentionally shared/public (single-user shop tracker, no sign-in).
3. Notes
- A CHECK constraint ensures `type` is only 'income' or 'expense'.
- A CHECK constraint ensures `amount` is greater than zero.
*/

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);
/*
# Add team authentication and transaction attribution

1. New Tables
- `profiles`
  - `id` (uuid, primary key, linked to the signed-in Supabase user)
  - `display_name` (text, the team member name shown beside entries)
  - `created_at` (timestamp)

2. Modified Tables
- `transactions`
  - Adds `created_by` (uuid, nullable for legacy entries, defaults to the signed-in user for new entries)
  - Existing transaction amounts and descriptions are preserved.

3. Security
- Remove anonymous access to transactions.
- Require authenticated team members for transaction reads and writes.
- The database derives `created_by` from the authenticated session and prevents clients from setting or changing that attribution column.
- Authenticated team members can view all shared transactions, add transactions, update transaction content, and delete transactions.
- Authenticated team members can view public member names and edit only their own profile name.

4. Important Notes
- Existing entries remain available and show as legacy entries until a signed-in member creates new records.
- No data is deleted or renamed.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_select_profiles" ON profiles;
CREATE POLICY "team_select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "member_insert_own_profile" ON profiles;
CREATE POLICY "member_insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "member_update_own_profile" ON profiles;
CREATE POLICY "member_update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "member_delete_own_profile" ON profiles;
CREATE POLICY "member_delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE transactions
  ALTER COLUMN created_by SET DEFAULT auth.uid();

REVOKE ALL ON transactions FROM anon;
REVOKE ALL ON profiles FROM anon;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;

DROP POLICY IF EXISTS "team_select_transactions" ON transactions;
CREATE POLICY "team_select_transactions" ON transactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "team_insert_transactions" ON transactions;
CREATE POLICY "team_insert_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "team_update_transactions" ON transactions;
CREATE POLICY "team_update_transactions" ON transactions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "team_delete_transactions" ON transactions;
CREATE POLICY "team_delete_transactions" ON transactions FOR DELETE
  TO authenticated USING (true);

REVOKE INSERT ON transactions FROM authenticated;
GRANT INSERT (type, amount, details) ON transactions TO authenticated;
REVOKE UPDATE ON transactions FROM authenticated;
GRANT UPDATE (type, amount, details) ON transactions TO authenticated;
/*
# Create audit log for deleted transactions

1. New Tables
- `audit_log`
  - `id` (uuid, primary key)
  - `action` (text, the action performed — currently 'DELETE')
  - `transaction_id` (uuid, the id of the transaction that was deleted)
  - `transaction_type` (text, 'income' or 'expense' — snapshot of the deleted row)
  - `transaction_amount` (numeric, snapshot of the deleted row's amount)
  - `transaction_details` (text, snapshot of the deleted row's description)
  - `original_created_by` (uuid, who originally created the transaction)
  - `original_created_at` (timestamptz, when the transaction was originally created)
  - `deleted_by` (uuid, defaults to auth.uid() — who performed the deletion)
  - `deleted_at` (timestamptz, defaults to now — when the deletion happened)

2. New Functions
- `log_transaction_deletion()` — a trigger function that fires BEFORE DELETE on
  `transactions`, capturing a snapshot of the deleted row into `audit_log`.
  The function runs with SECURITY DEFINER as the table owner so it can insert
  into the audit log regardless of the caller's audit_log policies.
- `trg_log_transaction_deletion` — the BEFORE DELETE trigger on `transactions`
  that calls the function.

3. Security
- RLS enabled on `audit_log`.
- All authenticated team members can READ the audit log (shared team transparency).
- No direct INSERT/UPDATE/DELETE policies for authenticated or anon roles —
  rows are only ever written by the trigger function (SECURITY DEFINER),
  so team members cannot forge or tamper with audit entries through the data API.
- EXECUTE on the trigger function is revoked from anon and authenticated so it
  cannot be called directly — only the trigger can invoke it.

4. Important Notes
- The trigger captures a full snapshot of the deleted transaction so the audit
  trail remains meaningful even after the original row is gone.
- `deleted_by` defaults to auth.uid() so the identity of the person who removed
  the entry is recorded automatically by the database — it cannot be forged
  from the client.
- No existing data is modified or deleted.
*/

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL DEFAULT 'DELETE',
  transaction_id uuid NOT NULL,
  transaction_type text NOT NULL,
  transaction_amount numeric(12, 2) NOT NULL,
  transaction_details text NOT NULL,
  original_created_by uuid,
  original_created_at timestamptz NOT NULL,
  deleted_by uuid DEFAULT auth.uid(),
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_select_audit_log" ON audit_log;
CREATE POLICY "team_select_audit_log" ON audit_log FOR SELECT
  TO authenticated USING (true);

REVOKE ALL ON audit_log FROM anon;

CREATE OR REPLACE FUNCTION log_transaction_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    transaction_id,
    transaction_type,
    transaction_amount,
    transaction_details,
    original_created_by,
    original_created_at,
    deleted_by
  )
  VALUES (
    OLD.id,
    OLD.type,
    OLD.amount,
    OLD.details,
    OLD.created_by,
    OLD.created_at,
    auth.uid()
  );
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION log_transaction_deletion FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_transaction_deletion ON transactions;
CREATE TRIGGER trg_log_transaction_deletion
  BEFORE DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION log_transaction_deletion();

CREATE INDEX IF NOT EXISTS audit_log_deleted_at_idx ON audit_log (deleted_at DESC);
/*
# Lock down audit_log table grants

1. Changes
- Revoke INSERT, UPDATE, DELETE privileges on `audit_log` from the `authenticated` role.
- Grant only SELECT to `authenticated` so team members can read the audit trail
  but cannot add, modify, or remove audit entries through the data API.

2. Security
- Audit entries are only ever written by the `log_transaction_deletion()` trigger
  function (SECURITY DEFINER), which bypasses RLS and column grants.
- This ensures the audit trail is tamper-proof: no team member can forge or
  erase audit records, even by calling the data API directly.

3. Important Notes
- No data is modified or deleted.
- The existing SELECT policy ("team_select_audit_log") remains in place.
*/

REVOKE INSERT, UPDATE, DELETE ON audit_log FROM authenticated;
GRANT SELECT ON audit_log TO authenticated;
/*
# Add role-based access control and promote first user to admin

1. Modified Tables
- `profiles`
  - Adds `role` column (text, NOT NULL, defaults to 'member')
  - Values: 'admin' (full CRUD) or 'member' (read-only)
  - The `role` column is revoked from client writes — only the
    `set_member_role()` SECURITY DEFINER function can change it.

2. Modified Policies
- `transactions` INSERT/UPDATE/DELETE: restricted to users whose profile
  role is 'admin'. Members retain SELECT (read-only).
- `transactions` INSERT WITH CHECK: the `created_by = auth.uid()` ownership
  requirement is preserved so the attribution column stays accurate.
- `audit_log`: unchanged (read-only to all authenticated users).

3. New Functions
- `set_member_role(p_target uuid, p_role text)` — SECURITY DEFINER function
  that lets an admin promote or demote another member. Derives the caller
  from `auth.uid()` (never the parameter), validates the target exists,
  and validates `p_role` is 'admin' or 'member'.
- `is_current_admin()` — SECURITY DEFINER helper that returns true if the
  caller's profile role is 'admin'. Used inside RLS policies so the policy
  predicate itself checks the role on the server, not in the client.

4. Data Changes
- The first registered user (earliest `created_at` in `profiles`) is
  promoted to 'admin'. All other existing users remain 'member'.

5. Security
- The `role` column on `profiles` is NOT writable by authenticated users.
  REVOKE INSERT/UPDATE on `profiles` is re-granted narrowly (display_name
  only for updates; display_name + id for inserts via upsert).
- `set_member_role` EXECUTE is revoked from anon; granted to authenticated
  but the function body checks the caller is an admin.
- `is_current_admin` EXECUTE is revoked from anon; granted to authenticated.

6. Important Notes
- No data is deleted. Existing transaction and audit records are preserved.
- Members can still view all transactions and the audit trail (read-only).
- Only admins can add, edit, or delete transactions.
- Only admins can change another member's role.
*/

-- Step 1: Add role column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('admin', 'member'));

-- Step 2: Promote the first registered user to admin
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM profiles
  ORDER BY created_at ASC
  LIMIT 1
);

-- Step 3: Create is_current_admin() helper
CREATE OR REPLACE FUNCTION is_current_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_current_admin FROM anon;
GRANT EXECUTE ON FUNCTION is_current_admin TO authenticated;

-- Step 4: Create set_member_role() function
CREATE OR REPLACE FUNCTION set_member_role(p_target uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_target) THEN
    RAISE EXCEPTION 'Target member does not exist';
  END IF;

  UPDATE profiles SET role = p_role WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_member_role FROM anon;
GRANT EXECUTE ON FUNCTION set_member_role TO authenticated;

-- Step 5: Lock down the role column on profiles
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name) ON profiles TO authenticated;

REVOKE INSERT ON profiles FROM authenticated;
GRANT INSERT (id, display_name) ON profiles TO authenticated;

-- Step 6: Replace transaction write policies to require admin
DROP POLICY IF EXISTS "team_insert_transactions" ON transactions;
CREATE POLICY "team_insert_transactions" ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (is_current_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "team_update_transactions" ON transactions;
CREATE POLICY "team_update_transactions" ON transactions FOR UPDATE
  TO authenticated
  USING (is_current_admin())
  WITH CHECK (is_current_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "team_delete_transactions" ON transactions;
CREATE POLICY "team_delete_transactions" ON transactions FOR DELETE
  TO authenticated
  USING (is_current_admin());

-- SELECT policy stays the same: all authenticated users can read
/*
# Revoke anon execute on security functions

1. Changes
- Revoke EXECUTE on `is_current_admin()` and `set_member_role()` from PUBLIC
  and anon, ensuring only authenticated users can invoke them.

2. Security
- Both functions check auth.uid() internally, so anon calls would fail anyway,
  but revoking access prevents unnecessary exposure.
*/

REVOKE EXECUTE ON FUNCTION is_current_admin FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION set_member_role FROM PUBLIC, anon;
/*
# Auto-create profiles for orphaned users and add safety trigger

1. Data Fix
- Creates profile rows for any auth.users that do not yet have a matching
  profile row. The display_name is set to the portion of the email before
  the @ sign, and role defaults to 'member'. This fixes existing orphaned
  accounts that signed up but whose profile creation failed.

2. New Trigger
- `handle_new_user()` — a SECURITY DEFINER trigger function that fires
  AFTER INSERT on auth.users, automatically creating a matching profile
  row with the email prefix as display_name and role 'member'.
- `trg_handle_new_user` — the AFTER INSERT trigger on auth.users.

3. Security
- The trigger function runs as SECURITY DEFINER (table owner) so it can
  insert into profiles regardless of the caller's grants.
- EXECUTE on the trigger function is revoked from all roles — only the
  trigger can invoke it.
- The display_name is derived from the email prefix, NOT user-supplied
  input, so it cannot be forged.

4. Important Notes
- No existing data is modified or deleted.
- The trigger ensures that even if the frontend profile creation fails,
  a profile row is always created for every new signup.
- The user can update their display_name later through the app.
*/

-- Fix existing orphaned users
INSERT INTO profiles (id, display_name, role)
SELECT
  u.id,
  split_part(u.email, '@', 1),
  'member'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

-- Create trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
/*
# Fix profile trigger to use signup name instead of email prefix

1. Changes
- Updates `handle_new_user()` trigger function to read the display name from
  `NEW.raw_user_meta_data->>'name'` (passed via signUp options.data) instead
  of using the email prefix. Falls back to the email prefix if no name was
  provided.

2. Data Fix
- Updates the display_name for the recently created orphaned user
  (chantiyadav@gmail.com) — but only if their name is still the email prefix,
  so we don't overwrite a name the user may have already updated.

3. Important Notes
- No data is deleted.
- The trigger uses ON CONFLICT (id) DO NOTHING so it won't overwrite an
  existing profile row.
- The frontend now passes the user's name through signUp options.data so
  the trigger can read it at creation time.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO profiles (id, display_name, role)
  VALUES (NEW.id, v_name, 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;
/*
# Create invite allowlist — restrict signups to admin-approved emails

1. New Tables
- `invites`
  - `id` (uuid, primary key)
  - `email` (text, unique, not null) — the email address the admin invited
  - `invited_by` (uuid, not null) — the admin who created the invite, references profiles
  - `created_at` (timestamptz, default now())

2. Security — RLS
- `invites` is RLS-enabled.
- SELECT: any authenticated user can see the invite list (so the members
  page can show pending invites to everyone).
- INSERT / UPDATE / DELETE: only admins (via is_current_admin()).

3. Signup Blocking
- A trigger `block_uninvited_signup()` fires BEFORE INSERT on auth.users.
  It checks if the new user's email exists in `invites`. If not found, it
  raises an exception that aborts the signup. This is enforced at the
  database level so no client can bypass it.
- The first admin (bhanu) and all existing users are grandfathered in —
  the trigger only blocks NEW signups going forward.

4. Important Notes
- Existing accounts (bhanu, chanti, chantiyadav) are unaffected — they
  already exist in auth.users.
- To invite a new member, an admin adds their email on the Members page.
  That person can then sign up using that exact email.
- The invite row is NOT consumed on signup — it remains as a record of
  who was invited. The new user's profile is created by the existing
  handle_new_user trigger.
*/

CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_select_invites" ON invites;
CREATE POLICY "team_select_invites" ON invites FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_invites" ON invites;
CREATE POLICY "admin_insert_invites" ON invites FOR INSERT
  TO authenticated WITH CHECK (is_current_admin());

DROP POLICY IF EXISTS "admin_delete_invites" ON invites;
CREATE POLICY "admin_delete_invites" ON invites FOR DELETE
  TO authenticated USING (is_current_admin());

-- Trigger: block signups for emails not on the allowlist
CREATE OR REPLACE FUNCTION block_uninvited_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM invites WHERE email = LOWER(NEW.email)) THEN
    RAISE EXCEPTION 'This email is not on the team invite list. Ask a team admin to invite you.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION block_uninvited_signup FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_block_uninvited_signup ON auth.users;
CREATE TRIGGER trg_block_uninvited_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION block_uninvited_signup();
/*
# Create is_email_invited() function for anon signup checks

1. New Functions
- `is_email_invited(p_email text)` — SECURITY DEFINER function that checks
  whether an email exists in the invites table. Returns boolean.
- EXECUTE granted to anon AND authenticated so the unauthenticated signup
  screen can verify an email before attempting signup.

2. Security
- SECURITY DEFINER runs as table owner, bypassing RLS on invites.
- The function only returns a boolean — it does NOT expose invite data
  (no ids, no who invited, no timestamps). An anonymous caller can only
  check "is this email allowed?" — nothing more.
- This is the minimum privilege needed for the signup screen to work.
*/

CREATE OR REPLACE FUNCTION is_email_invited(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM invites WHERE email = LOWER(p_email)
  );
$$;

REVOKE EXECUTE ON FUNCTION is_email_invited FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_email_invited TO anon, authenticated;
/*
# Auto-remove invites when someone signs up with that email

1. New Trigger
- `remove_used_invite()` — SECURITY DEFINER trigger function that fires
  AFTER INSERT on auth.users. It deletes any invite row whose email
  matches the new user's email, so the pending invite list stays clean.
- `trg_remove_used_invite` — the AFTER INSERT trigger on auth.users.

2. Security
- The trigger function runs as SECURITY DEFINER (table owner) so it can
  delete from invites regardless of the caller's grants.
- EXECUTE is revoked from all roles — only the trigger can invoke it.
- This runs after block_uninvited_signup (BEFORE INSERT) and
  handle_new_user (AFTER INSERT), so the signup is already validated
  and the profile already created by the time this fires.

3. Important Notes
- No existing data is modified or deleted except matching invite rows.
- If no invite exists for the email (e.g. grandfathered accounts), the
  trigger does nothing — the DELETE matches zero rows.
*/

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM invites WHERE email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_remove_used_invite ON auth.users;
CREATE TRIGGER trg_remove_used_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION remove_used_invite();
/*
# Complete-account-setup function + fix profile trigger for invited users

1. New Functions
- `complete_account_setup(p_name text, p_password text)` — SECURITY DEFINER
  function that updates the invited user's name (raw_user_meta_data) and
  sets their password. Called by an authenticated user who was invited via
  inviteUserByEmail (they're already logged in via the email link but need
  to set their own name and password).

2. Security
- SECURITY DEFINER so it can update auth.users (which the client cannot do directly).
- EXECUTE granted to authenticated only.
- Only operates on the calling user's own row (auth.uid()).

3. Important Notes
- The inviteUserByEmail flow creates the auth.users row AND logs the user in
  via the email link. But the user has no password set and no display name
  in their metadata. This function lets them set both.
- The existing handle_new_user trigger will create a profile row using the
  name from raw_user_meta_data — so we update that BEFORE the profile is
  read, or the profile can be updated separately.
*/
CREATE OR REPLACE FUNCTION complete_account_setup(p_name text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Update the user's display name in metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{name}',
    to_jsonb(trim(p_name))
  )
  WHERE id = auth.uid();

  -- Set the user's password
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = auth.uid();

  -- Update the profile display name if it exists
  UPDATE profiles
  SET display_name = trim(p_name)
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup TO authenticated;
/*
# Fix: don't create profile or remove invite for email-invited users until they complete setup

## Problem
When an admin invites someone via inviteUserByEmail, Supabase immediately
creates an auth.users row. This fires two triggers:
  1. handle_new_user → creates a profile → person shows up in Members list
  2. remove_used_invite → deletes the invite → disappears from Pending
Both happen BEFORE the person has even opened their email, which is wrong.

## Fix
1. handle_new_user() — skip profile creation if the user has an
   invitation_token in raw_app_meta_data (set by inviteUserByEmail).
   The profile will be created later by complete_account_setup().

2. remove_used_invite() — skip invite removal if the user has an
   invitation_token. The invite stays in the Pending list until the
   person actually completes setup.

3. complete_account_setup() — now INSERTs the profile row (with
   ON CONFLICT DO UPDATE) instead of just UPDATE, since the trigger
   no longer creates it for invited users. Also removes the invite
   after successful setup.

## Flow after fix
1. Admin sends invite → inviteUserByEmail creates auth.users row +
   sends email. No profile created, invite stays in Pending.
2. Person clicks email link → logged in → sees CompleteSetup screen.
3. Person enters name + password → complete_account_setup creates
   profile, sets password, removes invite.
4. Person now appears in Members, invite gone from Pending.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
  v_is_invited boolean;
BEGIN
  v_is_invited := NEW.raw_app_meta_data ? 'invitation_token';

  IF v_is_invited THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO profiles (id, display_name, role)
  VALUES (NEW.id, v_name, 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_app_meta_data ? 'invitation_token' THEN
    RETURN NEW;
  END IF;
  DELETE FROM invites WHERE email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION complete_account_setup(p_name text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Update the user's display name in metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{name}',
    to_jsonb(trim(p_name))
  )
  WHERE id = auth.uid();

  -- Set the user's password
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = auth.uid();

  -- Create or update the profile (trigger skipped invited users)
  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  -- Remove the invite now that setup is complete
  DELETE FROM invites WHERE email = LOWER(v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup TO authenticated;
/*
# Fix invited-user detection: use inviter_name instead of invitation_token

## Problem
The previous fix checked raw_app_meta_data for 'invitation_token' to
detect email-invited users. But Supabase's inviteUserByEmail does NOT
set that key in raw_app_meta_data — it sets inviter_name in
raw_user_meta_data (via the data option). So the triggers never
skipped profile creation for invited users, and they appeared in the
Members list immediately.

## Fix
1. handle_new_user() — skip profile creation if
   raw_user_meta_data->>'inviter_name' is set.
2. remove_used_invite() — skip invite removal if
   raw_user_meta_data->>'inviter_name' is set.
3. complete_account_setup() — unchanged, still creates profile + removes invite.

## Cleanup
- Delete premature profiles for invited users who haven't completed setup
  (inviter_name is set but display_name is just the email prefix).
- Restore their invites so they appear in the Pending list again.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
  v_is_invited boolean;
BEGIN
  v_is_invited := NEW.raw_user_meta_data ? 'inviter_name';

  IF v_is_invited THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO profiles (id, display_name, role)
  VALUES (NEW.id, v_name, 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'inviter_name' THEN
    RETURN NEW;
  END IF;
  DELETE FROM invites WHERE email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

-- Clean up: delete premature profiles for invited users who haven't completed setup
-- (display_name is the email prefix = no real name was set)
DELETE FROM profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.raw_user_meta_data ? 'inviter_name'
    AND p.display_name = split_part(u.email, '@', 1)
);

-- Restore invites for invited users who haven't completed setup
INSERT INTO invites (email, invited_by, created_at)
SELECT
  LOWER(u.email),
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  u.created_at
FROM auth.users u
WHERE u.raw_user_meta_data ? 'inviter_name'
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.email = LOWER(u.email))
ON CONFLICT (email) DO NOTHING;
/*
# Clear inviter_name from metadata after account setup completes

After complete_account_setup runs, remove inviter_name from raw_user_meta_data
so invited users are not re-routed to the setup screen on future logins.
*/

CREATE OR REPLACE FUNCTION complete_account_setup(p_name text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb) - 'inviter_name',
      '{name}',
      to_jsonb(trim(p_name))
    ),
    encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = auth.uid();

  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  DELETE FROM invites WHERE email = LOWER(v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup TO authenticated;
/*
# Fix CompleteSetup not showing for email-invited users

## Root cause
The remove_used_invite trigger deleted the invite as soon as inviteUserByEmail
created auth.users — often before inviter_name metadata was available — so the
frontend could not detect that setup was still required.

## Fix
1. remove_used_invite() — only consume an invite on self-signup (name present in metadata).
2. handle_new_user() — skip profile creation for email invites (no name yet, invite pending).
3. user_needs_account_setup() — server RPC: true when the logged-in user still has a pending invite.
4. Cleanup — restore invites and remove placeholder profiles for affected users.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  -- Email invite: user row exists but they have not chosen a name yet.
  IF NULLIF(trim(NEW.raw_user_meta_data->>'name'), '') IS NULL
     AND EXISTS (SELECT 1 FROM invites WHERE email = LOWER(NEW.email)) THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO profiles (id, display_name, role)
  VALUES (NEW.id, v_name, 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Self-signup supplies a name; email invites do not — keep invite until setup completes.
  IF NULLIF(trim(NEW.raw_user_meta_data->>'name'), '') IS NOT NULL THEN
    DELETE FROM invites WHERE email = LOWER(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION user_needs_account_setup()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM invites i
    INNER JOIN auth.users u ON LOWER(u.email) = i.email
    WHERE u.id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION user_needs_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION user_needs_account_setup TO authenticated;

-- Remove placeholder profiles for users who still have a pending invite.
DELETE FROM profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  INNER JOIN invites i ON LOWER(u.email) = i.email
  LEFT JOIN profiles p ON p.id = u.id
  WHERE p.id IS NOT NULL
    AND LOWER(trim(p.display_name)) = LOWER(split_part(u.email, '@', 1))
);

-- Restore invites that were wrongly deleted when inviteUserByEmail created the user.
INSERT INTO invites (email, invited_by, created_at)
SELECT
  LOWER(u.email),
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  u.created_at
FROM auth.users u
WHERE NULLIF(trim(u.raw_user_meta_data->>'name'), '') IS NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.email = LOWER(u.email))
ON CONFLICT (email) DO NOTHING;

-- Users who slipped through with a placeholder profile and no pending invite.
INSERT INTO invites (email, invited_by, created_at)
SELECT
  LOWER(u.email),
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  u.created_at
FROM auth.users u
INNER JOIN profiles p ON p.id = u.id
WHERE NULLIF(trim(u.raw_user_meta_data->>'name'), '') IS NULL
  AND LOWER(trim(p.display_name)) = LOWER(split_part(u.email, '@', 1))
  AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.email = LOWER(u.email))
ON CONFLICT (email) DO NOTHING;

DELETE FROM profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  INNER JOIN profiles p ON p.id = u.id
  INNER JOIN invites i ON LOWER(u.email) = i.email
  WHERE NULLIF(trim(u.raw_user_meta_data->>'name'), '') IS NULL
    AND LOWER(trim(p.display_name)) = LOWER(split_part(u.email, '@', 1))
);
/*
# Fix complete_account_setup — stop setting password via SQL

Direct UPDATE of auth.users.encrypted_password fails on hosted Supabase
(pgcrypto / hash format). Password is now set client-side via
supabase.auth.updateUser(). This RPC only finalizes profile + invite cleanup.
*/

DROP FUNCTION IF EXISTS complete_account_setup(text, text);

CREATE OR REPLACE FUNCTION complete_account_setup(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb) - 'inviter_name',
    '{name}',
    to_jsonb(trim(p_name))
  )
  WHERE id = auth.uid();

  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  DELETE FROM invites WHERE email = LOWER(v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup(text) TO authenticated;
/*
# Fix CompleteSetup loop after submitting name + password

## Root cause
1. updateUser() fires USER_UPDATED → loadWorkspace runs while the invite still exists.
2. user_needs_account_setup() only checked pending invites, not whether setup finished.

## Fix
1. Mark setup_complete in user metadata when setup finishes.
2. user_needs_account_setup() returns false once setup_complete is set or profile has a real name.
3. complete_account_setup sets setup_complete and removes the invite.
*/

CREATE OR REPLACE FUNCTION complete_account_setup(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb) - 'inviter_name',
      '{name}',
      to_jsonb(trim(p_name))
    ),
    '{setup_complete}',
    'true'::jsonb
  )
  WHERE id = auth.uid();

  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  DELETE FROM invites WHERE email = LOWER(v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup(text) TO authenticated;

CREATE OR REPLACE FUNCTION user_needs_account_setup()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE((v_user.raw_user_meta_data->>'setup_complete')::boolean, false) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid();
  IF FOUND
     AND NULLIF(trim(v_profile.display_name), '') IS NOT NULL
     AND lower(trim(v_profile.display_name)) <> lower(split_part(v_user.email, '@', 1)) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM invites i WHERE i.email = lower(v_user.email)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION user_needs_account_setup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION user_needs_account_setup() TO authenticated;

-- Mark users who already completed setup but still have a stale pending invite.
UPDATE auth.users u
SET raw_user_meta_data = jsonb_set(
  COALESCE(u.raw_user_meta_data, '{}'::jsonb),
  '{setup_complete}',
  'true'::jsonb
)
FROM profiles p
WHERE p.id = u.id
  AND lower(trim(p.display_name)) <> lower(split_part(u.email, '@', 1));

DELETE FROM invites i
USING auth.users u
INNER JOIN profiles p ON p.id = u.id
WHERE lower(i.email) = lower(u.email)
  AND lower(trim(p.display_name)) <> lower(split_part(u.email, '@', 1));
/*
# Simplify complete_account_setup — profile + invite only

Client sets password/name via supabase.auth.updateUser().
This RPC only creates the profile and removes the pending invite.
Avoids auth.users UPDATE failures on hosted Supabase.
*/

DROP FUNCTION IF EXISTS complete_account_setup(text, text);
DROP FUNCTION IF EXISTS complete_account_setup(text);

CREATE OR REPLACE FUNCTION complete_account_setup(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  DELETE FROM invites WHERE email = v_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup(text) TO authenticated;
/*
# Bootstrap first user on a fresh project

1. Allow the very first signup without a pre-existing invite (empty auth.users).
2. Auto-promote the first profile to admin.
3. Expose is_bootstrap_signup_allowed() for the signup screen.
*/

CREATE OR REPLACE FUNCTION block_uninvited_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  -- First user on a brand-new project: no invite required.
  IF NOT EXISTS (SELECT 1 FROM auth.users) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM invites WHERE email = LOWER(NEW.email)) THEN
    RAISE EXCEPTION 'This email is not on the team invite list. Ask a team admin to invite you.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM profiles) = 0 THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_first_user_admin FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_first_user_admin ON profiles;
CREATE TRIGGER trg_set_first_user_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_first_user_admin();

CREATE OR REPLACE FUNCTION is_bootstrap_signup_allowed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM auth.users);
$$;

REVOKE EXECUTE ON FUNCTION is_bootstrap_signup_allowed FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_bootstrap_signup_allowed TO anon, authenticated;
