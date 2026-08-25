create type member_role as enum ('owner', 'parent', 'teen', 'child');

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 80),
  timezone   text not null default 'UTC',
  week_start smallint not null default 0 check (week_start between 0 and 6),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table household_members (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  user_id        uuid references profiles(id) on delete set null,
  display_name   text not null check (length(trim(display_name)) between 1 and 40),
  role           member_role not null,
  color          text not null default '#C4643C' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url     text,
  birthday       date,
  pin_hash       text,
  points_balance integer not null default 0 check (points_balance >= 0),
  dietary_prefs  text[] not null default '{}',
  allergies      text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email        text,
  token_hash   text not null unique,
  role         member_role not null,
  member_id    uuid references household_members(id) on delete cascade,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);

create table household_settings (
  household_id     uuid primary key references households(id) on delete cascade,
  enabled_features jsonb not null default '{"family":true,"settings":true}'::jsonb,
  weather_location jsonb,
  theme_defaults   jsonb not null default '{}'::jsonb
);

create unique index household_members_user_unique
  on household_members (household_id, user_id) where user_id is not null;
create index household_members_household_idx on household_members (household_id);
create index household_members_user_idx      on household_members (user_id) where user_id is not null;
create index household_members_active_idx    on household_members (household_id, is_active);
create index household_invites_token_idx     on household_invites (token_hash);
create index household_invites_household_idx on household_invites (household_id);

alter table profiles           enable row level security;
alter table households         enable row level security;
alter table household_members  enable row level security;
alter table household_invites  enable row level security;
alter table household_settings enable row level security;
