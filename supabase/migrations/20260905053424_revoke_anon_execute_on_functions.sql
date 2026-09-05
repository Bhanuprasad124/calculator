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
