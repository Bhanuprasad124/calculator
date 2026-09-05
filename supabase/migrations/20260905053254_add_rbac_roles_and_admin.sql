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
