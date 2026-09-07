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
