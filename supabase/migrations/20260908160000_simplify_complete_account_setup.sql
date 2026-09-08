/*
# Simplify complete_account_setup — profile + invite only

Client sets password/name via supabase.auth.updateUser().
This RPC only creates the profile and removes the pending invite.
Avoids auth.users UPDATE failures on hosted Supabase.
*/

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
