/*
# Complete-account-setup function + fix profile trigger for invited users

1. New Functions
- `complete_account_setup(p_name text, p_password text)` — SECURITY DEFINER
  function that updates the invited user's name (raw_user_meta_data) and
  sets their password. Called by an authenticated user who was invited via
  inviteUserByEmail (they're already logged in via the email link but need
  to set their own name and password).

2. Security
- SECURITY DEFINER so it can update auth.users (which the client cannot do directly).
- EXECUTE granted to authenticated only.
- Only operates on the calling user's own row (auth.uid()).

3. Important Notes
- The inviteUserByEmail flow creates the auth.users row AND logs the user in
  via the email link. But the user has no password set and no display name
  in their metadata. This function lets them set both.
- The existing handle_new_user trigger will create a profile row using the
  name from raw_user_meta_data — so we update that BEFORE the profile is
  read, or the profile can be updated separately.
*/
CREATE OR REPLACE FUNCTION complete_account_setup(p_name text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Update the user's display name in metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{name}',
    to_jsonb(trim(p_name))
  )
  WHERE id = auth.uid();

  -- Set the user's password
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = auth.uid();

  -- Update the profile display name if it exists
  UPDATE profiles
  SET display_name = trim(p_name)
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup TO authenticated;
