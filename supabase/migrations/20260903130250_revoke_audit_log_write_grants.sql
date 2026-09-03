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
