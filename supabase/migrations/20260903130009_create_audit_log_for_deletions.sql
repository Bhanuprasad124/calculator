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
