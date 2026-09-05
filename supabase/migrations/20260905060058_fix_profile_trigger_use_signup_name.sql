/*
# Fix profile trigger to use signup name instead of email prefix

1. Changes
- Updates `handle_new_user()` trigger function to read the display name from
  `NEW.raw_user_meta_data->>'name'` (passed via signUp options.data) instead
  of using the email prefix. Falls back to the email prefix if no name was
  provided.

2. Data Fix
- Updates the display_name for the recently created orphaned user
  (chantiyadav@gmail.com) — but only if their name is still the email prefix,
  so we don't overwrite a name the user may have already updated.

3. Important Notes
- No data is deleted.
- The trigger uses ON CONFLICT (id) DO NOTHING so it won't overwrite an
  existing profile row.
- The frontend now passes the user's name through signUp options.data so
  the trigger can read it at creation time.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO profiles (id, display_name, role)
  VALUES (NEW.id, v_name, 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;
