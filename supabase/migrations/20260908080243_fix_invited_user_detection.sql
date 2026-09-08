/*
# Fix invited-user detection: use inviter_name instead of invitation_token

## Problem
The previous fix checked raw_app_meta_data for 'invitation_token' to
detect email-invited users. But Supabase's inviteUserByEmail does NOT
set that key in raw_app_meta_data — it sets inviter_name in
raw_user_meta_data (via the data option). So the triggers never
skipped profile creation for invited users, and they appeared in the
Members list immediately.

## Fix
1. handle_new_user() — skip profile creation if
   raw_user_meta_data->>'inviter_name' is set.
2. remove_used_invite() — skip invite removal if
   raw_user_meta_data->>'inviter_name' is set.
3. complete_account_setup() — unchanged, still creates profile + removes invite.

## Cleanup
- Delete premature profiles for invited users who haven't completed setup
  (inviter_name is set but display_name is just the email prefix).
- Restore their invites so they appear in the Pending list again.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
  v_is_invited boolean;
BEGIN
  v_is_invited := NEW.raw_user_meta_data ? 'inviter_name';

  IF v_is_invited THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'inviter_name' THEN
    RETURN NEW;
  END IF;
  DELETE FROM invites WHERE email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

-- Clean up: delete premature profiles for invited users who haven't completed setup
-- (display_name is the email prefix = no real name was set)
DELETE FROM profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.raw_user_meta_data ? 'inviter_name'
    AND p.display_name = split_part(u.email, '@', 1)
);

-- Restore invites for invited users who haven't completed setup
INSERT INTO invites (email, invited_by, created_at)
SELECT
  LOWER(u.email),
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  u.created_at
FROM auth.users u
WHERE u.raw_user_meta_data ? 'inviter_name'
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.email = LOWER(u.email))
ON CONFLICT (email) DO NOTHING;
