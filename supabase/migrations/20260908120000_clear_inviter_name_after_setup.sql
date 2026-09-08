/*
# Clear inviter_name from metadata after account setup completes

After complete_account_setup runs, remove inviter_name from raw_user_meta_data
so invited users are not re-routed to the setup screen on future logins.
*/

CREATE OR REPLACE FUNCTION complete_account_setup(p_name text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb) - 'inviter_name',
      '{name}',
      to_jsonb(trim(p_name))
    ),
    encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE id = auth.uid();

  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  DELETE FROM invites WHERE email = LOWER(v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup TO authenticated;
