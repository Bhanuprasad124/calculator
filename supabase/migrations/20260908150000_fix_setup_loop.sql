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
