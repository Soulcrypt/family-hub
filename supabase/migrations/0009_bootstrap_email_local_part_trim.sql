-- Task 6 fix round 3: 0008_bootstrap_display_name_hardening.sql's own
-- safety write-up (lines 60-70) claimed handle_new_user's email-derived
-- branch "cannot start with whitespace... so left(...,40) can never
-- produce an entirely-whitespace prefix here." That claim is FALSE, and
-- is corrected here rather than left standing where the next reader
-- would trust it.
--
-- The metadata branch is nullif(trim(new.raw_user_meta_data->>'display_name'), '')
-- -- trimmed. The email branch was
-- nullif(split_part(coalesce(new.email, ''), '@', 1), '') -- NOT trimmed.
-- For an email local part of '   ' (three spaces), split_part returns
-- '   ', which is not '' (nullif's own equality check is exact, not
-- trimmed-empty), so it was passed through as the chosen candidate.
-- Once 0008's profiles_display_name_check exists, inserting that value
-- fails the CHECK -- and because handle_new_user runs inside the same
-- transaction as the auth.users insert (it is an AFTER INSERT trigger),
-- that failure aborts the entire signup, not just the profile row. That
-- is a strictly worse outcome than the bug 0007/0008 were fixing: the
-- original I-1 bricked one account after signup; this would have
-- stopped the signup from happening at all.
--
-- GoTrue almost certainly rejects a whitespace-only local part on the
-- normal product signup path, so this was unlikely to be reachable
-- through the app UI. But it is directly reachable through any raw
-- auth.users insert -- exactly how this test suite works throughout, and
-- how Task 18's seed script and any future admin/backfill script will
-- work too. A latent constraint violation in the signup trigger is not
-- something to leave sitting for a seed script to trip over.
--
-- Fix: wrap the email branch in trim() as well, so a whitespace-only
-- local part is caught by nullif() the same way a whitespace-only
-- metadata display_name already was, and falls through to the 'Member'
-- literal fallback instead of reaching the CHECK at all.
--
-- What is actually true after this fix (replacing 0008's false claim):
-- both non-literal candidates in the coalesce chain are now pre-trimmed
-- by their own nullif(trim(...), '') before being chosen, so whichever
-- one is selected is guaranteed non-empty and starts with a
-- non-whitespace character *before* left(..., 40) ever runs -- meaning
-- truncating it can shorten it but cannot turn its first character into
-- whitespace. Combined with the literal 'Member' fallback (never
-- whitespace, never touched by either nullif), every branch of this
-- coalesce chain now provably satisfies profiles_display_name_check
-- (length(trim(display_name)) between 1 and 80) before the row is ever
-- inserted -- this is what 0008 asserted was already true and was not,
-- for the email branch specifically.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    insert into profiles (id, display_name)
    values (
      new.id,
      left(
        coalesce(
          nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
          nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
          'Member'
        ),
        40
      )
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;
