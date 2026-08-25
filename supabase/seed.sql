-- Local-development-only bootstrap. `supabase db reset` runs this after
-- applying all migrations (see supabase/config.toml, [db.seed]); it is
-- never applied to a deployed project via `supabase db push`, so this is
-- the correct place for pgTAP -- needed only to run supabase/tests/*.sql
-- via `supabase test db` -- rather than in a migration (see
-- 0004_harden_member_boundary.sql's fix 5 for why it was removed from
-- there).
create extension if not exists pgtap with schema extensions;
