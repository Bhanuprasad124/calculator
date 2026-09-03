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
