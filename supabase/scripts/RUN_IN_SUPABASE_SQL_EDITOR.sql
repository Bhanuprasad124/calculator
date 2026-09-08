-- =============================================================================
-- RUN THIS ENTIRE FILE IN: Supabase Dashboard → SQL Editor → New query → Run
-- Project: umjanhkfojayzstnbzuj
--
-- Fixes 404 on /rpc/user_needs_account_setup and /rpc/complete_account_setup
-- =============================================================================

-- 1) Triggers: keep invite until self-signup or complete_account_setup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
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

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NULLIF(trim(NEW.raw_user_meta_data->>'name'), '') IS NOT NULL THEN
    DELETE FROM invites WHERE email = LOWER(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

-- 2) complete_account_setup — creates profile + removes pending invite
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

-- 3) user_needs_account_setup — checks if invite setup screen should show
DROP FUNCTION IF EXISTS user_needs_account_setup();

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

-- 4) Reset stuck user: bhanuyadavv124@gmail.com (optional — safe to run)
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'bhanuyadavv124@gmail.com'
);

UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb) - 'name' - 'setup_complete'
WHERE lower(email) = 'bhanuyadavv124@gmail.com';

INSERT INTO invites (email, invited_by)
SELECT
  'bhanuyadavv124@gmail.com',
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM invites WHERE email = 'bhanuyadavv124@gmail.com'
);

-- 5) Verify functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('user_needs_account_setup', 'complete_account_setup');
