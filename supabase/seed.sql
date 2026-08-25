-- Local-development-only bootstrap. `supabase db reset` runs this after
-- applying all migrations (see supabase/config.toml, [db.seed]); it is
-- never applied to a deployed project via `supabase db push`, so this is
-- the correct place for pgTAP -- needed only to run supabase/tests/*.sql
-- via `supabase test db` -- rather than in a migration (see
-- 0004_harden_member_boundary.sql's fix 5 for why it was removed from
-- there).
create extension if not exists pgtap with schema extensions;

-- Task 18: demo household, so every screen has real content on `supabase db reset` instead of
-- an empty state. Fixed UUIDs throughout (prefix a10a0000, suffix ...0001-...0006) so the seed
-- is deterministic across resets.
--
-- One confirmed auth account -- 'demo@familyhub.local' / 'demo-password-123' -- so there is
-- something to actually log into locally. Its profile row is deliberately NOT inserted by
-- hand: handle_new_user() (0006_bootstrap_rpc.sql) fires on the auth.users insert below (an
-- AFTER INSERT trigger, so it has already run by the time the next statement executes) and
-- derives it from raw_user_meta_data.display_name, exactly like a real signup. Hand-inserting a
-- profile here would both duplicate that trigger's job and risk silently drifting from whatever
-- handle_new_user derives if either shape changes later.
--
-- encrypted_password is generated with pgcrypto's crypt()/gen_salt('bf', 10) -- never a pasted
-- hash. 0011_member_pin_verification.sql's own comment records why this matters: pgcrypto's
-- crypt() cannot verify a bcryptjs '$2b$' hash (the two libraries tag bcrypt variants
-- differently) -- it returns false for the CORRECT password, silently, which would ship a seed
-- account that looks right and cannot log in. The member PIN below is set the same way, by
-- calling set_member_pin() itself rather than hand-rolling an UPDATE ... set pin_hash, so it
-- goes through the exact function production PIN-setting uses.
--
-- Every column below besides the obviously-demo ones (email, encrypted_password, the two
-- *_meta_data blobs) matches what GoTrue itself writes for a real email+password signup --
-- instance_id, aud, role, email_confirmed_at, and the empty-string token columns all matter:
-- get instance_id, aud, or role wrong and the row exists and looks fine but GoTrue's password
-- grant will not authenticate it. This was verified empirically against the local GoTrue token
-- endpoint (POST /auth/v1/token?grant_type=password) before being committed; see this task's
-- report for the transcript.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'a10a0000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@familyhub.local',
  extensions.crypt('demo-password-123', extensions.gen_salt('bf', 10)),
  now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Alex Rivera"}'::jsonb,
  now(), now(), now()
);

-- The email/password provider identity a real signup creates alongside the auth.users row.
-- Not required for the password grant itself (GoTrue reads auth.users directly for that), but
-- its absence is one more way a hand-written seed account can differ from a real one, so it is
-- included for parity.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'a10a0000-0000-4000-8000-000000000001',
  'a10a0000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', 'a10a0000-0000-4000-8000-000000000001',
    'email', 'demo@familyhub.local',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
);

-- 'America/Chicago' also doubles as a live positive case for
-- 0017_household_timezone_guard.sql's BEFORE INSERT trigger.
insert into households (id, name, timezone, created_by) values (
  'a10a0000-0000-4000-8000-000000000002',
  'The Rivera Family',
  'America/Chicago',
  'a10a0000-0000-4000-8000-000000000001'
);

insert into household_settings (household_id, enabled_features) values (
  'a10a0000-0000-4000-8000-000000000002',
  '{"family":true,"settings":true,"calendar":true}'::jsonb
);

-- Four members: owner (has the one login above), parent, teen, and child -- the latter two
-- (and the parent) are login-less rows, `user_id` null, exactly like a real household that
-- hasn't sent every member an invite yet.
--
-- Member color is how you tell your family apart at a glance across a kitchen, so these are
-- chosen to differ in VALUE as well as hue: two dark fills that take white text (terracotta,
-- teal) and two light ones that take ink (gold, dusty rose). An earlier all-dark set cleared
-- contrast comfortably and still failed the actual job -- four muddy brown circles that were
-- hard to tell apart at avatar size. Every value below was checked against the same formula
-- components/family/member-avatar.tsx's foregroundFor() uses, and clears 4.5:1 against the
-- foreground that function picks for it:
--   #7C4A6B plum       -> white 6.89:1
--   #2F6F7A teal       -> white 5.71:1
--   #E8B44A gold       -> ink   7.99:1
--   #C98A96 dusty rose -> ink   5.46:1
--
-- The owner was terracotta (#A9522F) until review pointed out that is literally
-- --color-accent-strong (app/globals.css) -- the fill behind the app's own primary buttons.
-- A person's identity colour should not be the same colour as the app's chrome, or a white
-- initial on that fill reads as a control rather than a face. Plum keeps the warmth and is
-- unmistakably not a button.
-- The schema's own default, #C4643C, is deliberately NOT reused: it only clears ~4.0:1 (see
-- foregroundFor's own comment).
insert into household_members (id, household_id, user_id, display_name, role, color, points_balance) values
  ('a10a0000-0000-4000-8000-000000000003', 'a10a0000-0000-4000-8000-000000000002',
   'a10a0000-0000-4000-8000-000000000001', 'Alex Rivera', 'owner',  '#7C4A6B', 0),
  ('a10a0000-0000-4000-8000-000000000004', 'a10a0000-0000-4000-8000-000000000002',
   null, 'Jamie Rivera', 'parent', '#2F6F7A', 0),
  ('a10a0000-0000-4000-8000-000000000005', 'a10a0000-0000-4000-8000-000000000002',
   null, 'Sam Rivera',   'teen',   '#E8B44A', 0),
  ('a10a0000-0000-4000-8000-000000000006', 'a10a0000-0000-4000-8000-000000000002',
   null, 'Ivy Rivera',   'child',  '#C98A96', 250);

-- The owner's PIN (1234), set through set_member_pin() (0011_member_pin_verification.sql)
-- rather than a hand-rolled UPDATE ... set pin_hash, so it is hashed exactly the way production
-- PIN-setting hashes it. set_member_pin() derives its caller entirely from auth.uid() (read from
-- the request.jwt.claims GUC), never from an argument, so that GUC has to be set first; scoped
-- to its own transaction so nothing after it inherits a stray session-level claim.
begin;
set local request.jwt.claims = '{"sub":"a10a0000-0000-4000-8000-000000000001","role":"authenticated"}';
select set_member_pin('a10a0000-0000-4000-8000-000000000003', '1234');
commit;
