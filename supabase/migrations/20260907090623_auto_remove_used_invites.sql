/*
# Auto-remove invites when someone signs up with that email

1. New Trigger
- `remove_used_invite()` — SECURITY DEFINER trigger function that fires
  AFTER INSERT on auth.users. It deletes any invite row whose email
  matches the new user's email, so the pending invite list stays clean.
- `trg_remove_used_invite` — the AFTER INSERT trigger on auth.users.

2. Security
- The trigger function runs as SECURITY DEFINER (table owner) so it can
  delete from invites regardless of the caller's grants.
- EXECUTE is revoked from all roles — only the trigger can invoke it.
- This runs after block_uninvited_signup (BEFORE INSERT) and
  handle_new_user (AFTER INSERT), so the signup is already validated
  and the profile already created by the time this fires.

3. Important Notes
- No existing data is modified or deleted except matching invite rows.
- If no invite exists for the email (e.g. grandfathered accounts), the
  trigger does nothing — the DELETE matches zero rows.
*/

CREATE OR REPLACE FUNCTION remove_used_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM invites WHERE email = LOWER(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION remove_used_invite FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_remove_used_invite ON auth.users;
CREATE TRIGGER trg_remove_used_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION remove_used_invite();
