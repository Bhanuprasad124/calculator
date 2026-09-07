/*
# Create invite allowlist — restrict signups to admin-approved emails

1. New Tables
- `invites`
  - `id` (uuid, primary key)
  - `email` (text, unique, not null) — the email address the admin invited
  - `invited_by` (uuid, not null) — the admin who created the invite, references profiles
  - `created_at` (timestamptz, default now())

2. Security — RLS
- `invites` is RLS-enabled.
- SELECT: any authenticated user can see the invite list (so the members
  page can show pending invites to everyone).
- INSERT / UPDATE / DELETE: only admins (via is_current_admin()).

3. Signup Blocking
- A trigger `block_uninvited_signup()` fires BEFORE INSERT on auth.users.
  It checks if the new user's email exists in `invites`. If not found, it
  raises an exception that aborts the signup. This is enforced at the
  database level so no client can bypass it.
- The first admin (bhanu) and all existing users are grandfathered in —
  the trigger only blocks NEW signups going forward.

4. Important Notes
- Existing accounts (bhanu, chanti, chantiyadav) are unaffected — they
  already exist in auth.users.
- To invite a new member, an admin adds their email on the Members page.
  That person can then sign up using that exact email.
- The invite row is NOT consumed on signup — it remains as a record of
  who was invited. The new user's profile is created by the existing
  handle_new_user trigger.
*/

CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_select_invites" ON invites;
CREATE POLICY "team_select_invites" ON invites FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_invites" ON invites;
CREATE POLICY "admin_insert_invites" ON invites FOR INSERT
  TO authenticated WITH CHECK (is_current_admin());

DROP POLICY IF EXISTS "admin_delete_invites" ON invites;
CREATE POLICY "admin_delete_invites" ON invites FOR DELETE
  TO authenticated USING (is_current_admin());

-- Trigger: block signups for emails not on the allowlist
CREATE OR REPLACE FUNCTION block_uninvited_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM invites WHERE email = LOWER(NEW.email)) THEN
    RAISE EXCEPTION 'This email is not on the team invite list. Ask a team admin to invite you.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION block_uninvited_signup FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_block_uninvited_signup ON auth.users;
CREATE TRIGGER trg_block_uninvited_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION block_uninvited_signup();
