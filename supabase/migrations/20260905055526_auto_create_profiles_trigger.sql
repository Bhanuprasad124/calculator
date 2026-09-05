/*
# Auto-create profiles for orphaned users and add safety trigger

1. Data Fix
- Creates profile rows for any auth.users that do not yet have a matching
  profile row. The display_name is set to the portion of the email before
  the @ sign, and role defaults to 'member'. This fixes existing orphaned
  accounts that signed up but whose profile creation failed.

2. New Trigger
- `handle_new_user()` — a SECURITY DEFINER trigger function that fires
  AFTER INSERT on auth.users, automatically creating a matching profile
  row with the email prefix as display_name and role 'member'.
- `trg_handle_new_user` — the AFTER INSERT trigger on auth.users.

3. Security
- The trigger function runs as SECURITY DEFINER (table owner) so it can
  insert into profiles regardless of the caller's grants.
- EXECUTE on the trigger function is revoked from all roles — only the
  trigger can invoke it.
- The display_name is derived from the email prefix, NOT user-supplied
  input, so it cannot be forged.

4. Important Notes
- No existing data is modified or deleted.
- The trigger ensures that even if the frontend profile creation fails,
  a profile row is always created for every new signup.
- The user can update their display_name later through the app.
*/

-- Fix existing orphaned users
INSERT INTO profiles (id, display_name, role)
SELECT
  u.id,
  split_part(u.email, '@', 1),
  'member'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

-- Create trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
