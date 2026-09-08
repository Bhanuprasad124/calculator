/*
# Fix CompleteSetup not showing for email-invited users

## Root cause
The remove_used_invite trigger deleted the invite as soon as inviteUserByEmail
created auth.users — often before inviter_name metadata was available — so the
frontend could not detect that setup was still required.

## Fix
1. remove_used_invite() — only consume an invite on self-signup (name present in metadata).
2. handle_new_user() — skip profile creation for email invites (no name yet, invite pending).
3. user_needs_account_setup() — server RPC: true when the logged-in user still has a pending invite.
4. Cleanup — restore invites and remove placeholder profiles for affected users.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  -- Email invite: user row exists but they have not chosen a name yet.
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

REVOKE EXECUTE ON FUNCTION handle_new_user FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Self-signup supplies a name; email invites do not — keep invite until setup completes.
  IF NULLIF(trim(NEW.raw_user_meta_data->>'name'), '') IS NOT NULL THEN
    DELETE FROM invites WHERE email = LOWER(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION user_needs_account_setup()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM invites i
    INNER JOIN auth.users u ON LOWER(u.email) = i.email
    WHERE u.id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION user_needs_account_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION user_needs_account_setup TO authenticated;

-- Remove placeholder profiles for users who still have a pending invite.
DELETE FROM profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  INNER JOIN invites i ON LOWER(u.email) = i.email
  LEFT JOIN profiles p ON p.id = u.id
  WHERE p.id IS NOT NULL
    AND LOWER(trim(p.display_name)) = LOWER(split_part(u.email, '@', 1))
);

-- Restore invites that were wrongly deleted when inviteUserByEmail created the user.
INSERT INTO invites (email, invited_by, created_at)
SELECT
  LOWER(u.email),
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  u.created_at
FROM auth.users u
WHERE NULLIF(trim(u.raw_user_meta_data->>'name'), '') IS NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.email = LOWER(u.email))
ON CONFLICT (email) DO NOTHING;

-- Users who slipped through with a placeholder profile and no pending invite.
INSERT INTO invites (email, invited_by, created_at)
SELECT
  LOWER(u.email),
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
  u.created_at
FROM auth.users u
INNER JOIN profiles p ON p.id = u.id
WHERE NULLIF(trim(u.raw_user_meta_data->>'name'), '') IS NULL
  AND LOWER(trim(p.display_name)) = LOWER(split_part(u.email, '@', 1))
  AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.email = LOWER(u.email))
ON CONFLICT (email) DO NOTHING;

DELETE FROM profiles
WHERE id IN (
  SELECT u.id
  FROM auth.users u
  INNER JOIN profiles p ON p.id = u.id
  INNER JOIN invites i ON LOWER(u.email) = i.email
  WHERE NULLIF(trim(u.raw_user_meta_data->>'name'), '') IS NULL
    AND LOWER(trim(p.display_name)) = LOWER(split_part(u.email, '@', 1))
);
