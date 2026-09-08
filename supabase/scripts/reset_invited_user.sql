-- Reset invite setup for: bhanuyadavv124@gmail.com
-- Run in Supabase SQL Editor, then ask the user to open their invite email link again.

-- 1) See current state
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data,
  p.display_name,
  i.email AS pending_invite
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN invites i ON i.email = lower(u.email)
WHERE lower(u.email) = 'bhanuyadavv124@gmail.com';

-- 2) Remove broken profile so setup can run cleanly
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'bhanuyadavv124@gmail.com'
);

-- 3) Clear partial setup flags (keep inviter_name if present)
UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb)
  - 'name'
  - 'setup_complete'
WHERE lower(email) = 'bhanuyadavv124@gmail.com';

-- 4) Ensure a pending invite exists
INSERT INTO invites (email, invited_by)
SELECT
  'bhanuyadavv124@gmail.com',
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM invites WHERE email = 'bhanuyadavv124@gmail.com'
);

-- 5) Verify
SELECT
  u.email,
  u.raw_user_meta_data,
  p.display_name,
  i.email AS pending_invite
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN invites i ON i.email = lower(u.email)
WHERE lower(u.email) = 'bhanuyadavv124@gmail.com';
