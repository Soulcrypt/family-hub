-- Local-development-only bootstrap. `supabase db reset` runs this after
-- applying all migrations (see supabase/config.toml, [db.seed]); it is
-- never applied to a deployed project via `supabase db push`, so this is
-- the correct place for pgTAP -- needed only to run supabase/tests/*.sql
-- via `supabase test db` -- rather than in a migration (see
-- 0004_harden_member_boundary.sql's fix 5 for why it was removed from
-- there).
create extension if not exists pgtap with schema extensions;

-- Task 18 (rebranded for the Hearth SP1 identity task): demo household, so every screen has
-- real content on `supabase db reset` instead of an empty state. Fixed UUIDs throughout
-- (prefix a10a0000, suffix ...0001-...0006) so the seed is deterministic across resets. This is
-- now the real Garthwaite household (Design-Spec front matter) rather than the placeholder
-- "Rivera Family" the app shipped SP1 against -- id suffix ...0005 (formerly a teen member,
-- Sam Rivera) is deliberately left unused rather than renumbered, since the real household has
-- only three people and nothing should have to know the gap exists.
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
  '{"display_name":"Cody Garthwaite"}'::jsonb,
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

-- 'America/Chicago' is the Garthwaites' real timezone (Whitewater, WI -- Design-Spec front
-- matter), and also doubles as a live positive case for
-- 0017_household_timezone_guard.sql's BEFORE INSERT trigger.
insert into households (id, name, timezone, created_by) values (
  'a10a0000-0000-4000-8000-000000000002',
  'The Garthwaites',
  'America/Chicago',
  'a10a0000-0000-4000-8000-000000000001'
);

insert into household_settings (household_id, enabled_features) values (
  'a10a0000-0000-4000-8000-000000000002',
  '{"family":true,"settings":true,"calendar":true}'::jsonb
);

-- Three members: owner (has the one login above) and a login-less parent and child, `user_id`
-- null for the latter two, exactly like a real household that hasn't sent every member an
-- invite yet. Colours are the fixed per-person identity colours from Design-Spec §2.2 -- not
-- independently chosen here, so they are not re-derived or re-justified against a contrast
-- formula the way the old Rivera placeholders were; they are pasted verbatim from the spec.
--
-- Ivy's birthday is 2025-12-18. THIS IS A DELIBERATE CORRECTION, NOT A TYPO: the Design-Spec
-- front matter and the imported mockups both describe her as "age 2 / born May 2024", but the
-- real, correct birthdate is 2025-12-18 (she is 8 months old as of 2026-08-26, an infant, not a
-- toddler). Every age-derived string in the app must compute from this column, not from the
-- spec's prose. Do not "fix" this back to match the spec -- the spec is what's wrong here.
insert into household_members (id, household_id, user_id, display_name, role, color, birthday, points_balance) values
  ('a10a0000-0000-4000-8000-000000000003', 'a10a0000-0000-4000-8000-000000000002',
   'a10a0000-0000-4000-8000-000000000001', 'Cody Garthwaite',      'owner',  '#B6E6B0', null, 0),
  ('a10a0000-0000-4000-8000-000000000004', 'a10a0000-0000-4000-8000-000000000002',
   null, 'Elizabeth Garthwaite', 'parent', '#F3B3D4', null, 0),
  ('a10a0000-0000-4000-8000-000000000006', 'a10a0000-0000-4000-8000-000000000002',
   null, 'Ivy Garthwaite',       'child',  '#FFD08A', date '2025-12-18', 0);

-- The owner's PIN (1234), set through set_member_pin() (0011_member_pin_verification.sql)
-- rather than a hand-rolled UPDATE ... set pin_hash, so it is hashed exactly the way production
-- PIN-setting hashes it. set_member_pin() derives its caller entirely from auth.uid() (read from
-- the request.jwt.claims GUC), never from an argument, so that GUC has to be set first; scoped
-- to its own transaction so nothing after it inherits a stray session-level claim.
begin;
set local request.jwt.claims = '{"sub":"a10a0000-0000-4000-8000-000000000001","role":"authenticated"}';
select set_member_pin('a10a0000-0000-4000-8000-000000000003', '1234');
commit;
