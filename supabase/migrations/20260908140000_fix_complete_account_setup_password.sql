/*
# Fix complete_account_setup — stop setting password via SQL

Direct UPDATE of auth.users.encrypted_password fails on hosted Supabase
(pgcrypto / hash format). Password is now set client-side via
supabase.auth.updateUser(). This RPC only finalizes profile + invite cleanup.
*/

DROP FUNCTION IF EXISTS complete_account_setup(text, text);

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
    COALESCE(raw_user_meta_data, '{}'::jsonb) - 'inviter_name',
    '{name}',
    to_jsonb(trim(p_name))
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
