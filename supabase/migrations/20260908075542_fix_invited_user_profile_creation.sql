/*
# Fix: don't create profile or remove invite for email-invited users until they complete setup

## Problem
When an admin invites someone via inviteUserByEmail, Supabase immediately
creates an auth.users row. This fires two triggers:
  1. handle_new_user → creates a profile → person shows up in Members list
  2. remove_used_invite → deletes the invite → disappears from Pending
Both happen BEFORE the person has even opened their email, which is wrong.

## Fix
1. handle_new_user() — skip profile creation if the user has an
   invitation_token in raw_app_meta_data (set by inviteUserByEmail).
   The profile will be created later by complete_account_setup().

2. remove_used_invite() — skip invite removal if the user has an
   invitation_token. The invite stays in the Pending list until the
   person actually completes setup.

3. complete_account_setup() — now INSERTs the profile row (with
   ON CONFLICT DO UPDATE) instead of just UPDATE, since the trigger
   no longer creates it for invited users. Also removes the invite
   after successful setup.

## Flow after fix
1. Admin sends invite → inviteUserByEmail creates auth.users row +
   sends email. No profile created, invite stays in Pending.
2. Person clicks email link → logged in → sees CompleteSetup screen.
3. Person enters name + password → complete_account_setup creates
   profile, sets password, removes invite.
4. Person now appears in Members, invite gone from Pending.
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
  v_is_invited := NEW.raw_app_meta_data ? 'invitation_token';

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
  IF NEW.raw_app_meta_data ? 'invitation_token' THEN
    RETURN NEW;
  END IF;
  DELETE FROM invites WHERE email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

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

  -- Create or update the profile (trigger skipped invited users)
  INSERT INTO profiles (id, display_name, role)
  VALUES (auth.uid(), trim(p_name), 'member')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  -- Remove the invite now that setup is complete
  DELETE FROM invites WHERE email = LOWER(v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_account_setup TO authenticated;
