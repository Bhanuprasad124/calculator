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
