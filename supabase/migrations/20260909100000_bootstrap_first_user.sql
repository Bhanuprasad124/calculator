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
