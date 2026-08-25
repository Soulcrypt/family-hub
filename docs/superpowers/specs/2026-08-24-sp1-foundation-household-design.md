# Family Hub — SP1: Foundation & Household

**Status:** Approved design, ready for implementation planning
**Date:** 2026-08-24
**Sub-project:** 1 of 6

---

## 1. Context

Family Hub is a PWA that gives a household one place to manage meals, calendars, chores,
habits, fitness, photos, budgets and rewards. The full vision spans roughly fourteen feature
domains and thirty tables.

That vision is too large for one design document. Attempting it in a single pass would either
run to fifteen thousand words or treat the genuinely hard parts — the points economy, RLS for
mixed-age households, recurrence rules, the widget layout system — with a sentence each. Those
are exactly the parts that fail expensively.

The work is therefore split into six sub-projects, each ending in a state the family could
actually use, and each getting its own design → plan → implementation cycle.

| | Sub-project | Ends with the user able to |
|---|---|---|
| **SP1** | **Foundation & Household** | Sign up, create a household, add family members, install to home screen |
| SP2 | Food — recipes, URL import, meal planner, groceries, cook mode | Plan and cook a week of dinners |
| SP3 | Accountability — todos, chores, free-for-grab, points, rewards, habits | Run the kids' chores and habits |
| SP4 | Calendar — internal events, views, ICS, Google OAuth | See the family week |
| SP5 | Dashboard & Display Mode — widget system, layouts, family display | Mount a tablet on the kitchen wall |
| SP6+ | Photos, budget, fitness, news, push notifications | — |

**This document covers SP1 only.**

### Ordering note

The original vision placed the configurable dashboard at phase 3, before content existed. It is
deliberately moved to SP5. A widget system designed against imaginary widgets gets its
abstraction wrong; built after three real verticals exist, the API generalises from things that
actually ship. SP1 still delivers a home screen — a purposeful static one, not a configurable grid.

---

## 2. Scope

### In scope

- Next.js + TypeScript project foundation, deployed to Vercel
- Supabase: local-first development via Docker, migrations in repo
- Auth: email/password and Google
- Households, family members, roles, invitations
- The hybrid identity model (login-less children, claimable later)
- Row Level Security with proven household isolation
- Onboarding flow
- App shell: feature-flag-driven navigation, desktop sidebar / mobile bottom nav
- Design system: tokens, light and dark themes, themed shadcn/ui
- Profile switcher with PIN gating
- PWA baseline: manifest, icons, service worker, offline fallback
- Seed data

### Explicitly not in scope

Recipes, meal planning, groceries, cook mode, calendar, events, todos, chores, rewards, habits,
fitness, photos, budget, weather, news, the family feed, global search, realtime subscriptions,
push notifications, the configurable widget dashboard, and Family Display Mode. Each belongs to
a later sub-project.

---

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Six sub-projects; SP1 is foundation | Single spec would go vague where it must be sharp |
| D2 | Dashboard deferred to SP5 | Widget abstraction needs real widgets to generalise from |
| D3 | Hybrid identity: `user_id` nullable, claimable later | Covers a 6-year-old and a 16-year-old without a rewrite |
| D4 | Auth = email/password + Google; no magic link | Magic link needs custom SMTP; Google covers the passwordless need |
| D5 | Visual direction: Warm Minimal | Chosen over dark-glow and adaptive alternatives |
| D6 | Logo: FH monogram / roofline (SVG) | Reads as monogram and house at once; survives 22px |
| D7 | Local-first Supabase; cloud provisioned at deploy | RLS needs fast, destructive, offline iteration |
| D8 | Attribution ≠ authority (see §4) | Only model that is neither insecure nor over-built |
| D9 | Roles: owner, parent, teen, child | `adult` cut as a distinction the household would never make |
| D10 | Nav driven by `enabled_features` from day one | Makes per-household modularity real infrastructure |

---

## 4. Identity and authority model

A shared kitchen tablet is signed in as one parent's account while the UI says "you are Ivy." The question
this model answers: **when the app says you are Ivy, what does that authorize?**

**Attribution and authority are separate concerns.**

- **Attribution** — who gets the chore points, whose habits appear, whose name lands on an action.
  Carried by an **httpOnly, server-signed cookie** holding the active `household_member.id`.
  Drives UI scoping only.
- **Authority** — who may edit settings, manage members, issue invitations, see the budget.
  Determined **solely** by the authenticated account's role in `household_members`, looked up
  server-side on every privileged operation. The active-member cookie is never consulted.

RLS trusts `auth.uid()` and nothing else. A forged or tampered cookie therefore produces a wrong
name on a chore — never cross-household access, never a privileged write.

PINs (`pin_hash`, bcrypt) gate *switching into* an `owner` or `parent` profile. This is a
convenience lock that stops a child wandering into a parent view; it is not the security
boundary, and the server re-checks the real account's role regardless of what the PIN gate allowed.

Rejected alternatives: a client-side active member (conflates attribution with authority — a
child could claim to be a parent for privileged calls); per-member JWTs via custom access-token
hooks (genuinely stronger, but complicates refresh and every login path for a benefit that
matters only if household members are mutually untrusted).

---

## 5. Data model

Six tables.

```sql
create type member_role as enum ('owner', 'parent', 'teen', 'child');

profiles
  id            uuid primary key references auth.users(id) on delete cascade
  display_name  text not null
  avatar_url    text
  created_at    timestamptz not null default now()

households
  id            uuid primary key default gen_random_uuid()
  name          text not null
  timezone      text not null default 'UTC'
  week_start    smallint not null default 0
  created_by    uuid not null references profiles(id)
  created_at    timestamptz not null default now()

household_members
  id             uuid primary key default gen_random_uuid()
  household_id   uuid not null references households(id) on delete cascade
  user_id        uuid references profiles(id) on delete set null   -- NULLABLE
  display_name   text not null
  role           member_role not null
  color          text not null
  avatar_url     text
  birthday       date
  pin_hash       text
  points_balance integer not null default 0
  dietary_prefs  text[] not null default '{}'
  allergies      text[] not null default '{}'
  is_active      boolean not null default true
  created_at     timestamptz not null default now()

household_invites
  id            uuid primary key default gen_random_uuid()
  household_id  uuid not null references households(id) on delete cascade
  email         text
  token_hash    text not null unique
  role          member_role not null
  member_id     uuid references household_members(id) on delete cascade  -- NULLABLE
  expires_at    timestamptz not null
  accepted_at   timestamptz
  created_by    uuid not null references profiles(id)
  created_at    timestamptz not null default now()

household_settings
  household_id      uuid primary key references households(id) on delete cascade
  enabled_features  jsonb not null default '{"family":true,"settings":true}'
  weather_location  jsonb
  theme_defaults    jsonb not null default '{}'
```

### The two fields carrying the hybrid model

**`household_members.user_id` is nullable.** This single decision lets a six-year-old exist as a
full family member — with points, chores, a birthday, a color — and no account.

**`household_invites.member_id` is nullable.** When set, the invitation means *claim this existing
profile* rather than *join as someone new*. This is the teen upgrade path: the member row keeps
its id, history, streaks and points balance, and simply gains a `user_id`. No data migration, no
duplicate row, no orphaned history.

### Constraints and indexes

```sql
create unique index household_members_user_unique
  on household_members (household_id, user_id) where user_id is not null;

create index household_members_household_idx on household_members (household_id);
create index household_members_user_idx      on household_members (user_id) where user_id is not null;
create index household_members_active_idx    on household_members (household_id, is_active);
create index household_invites_token_idx     on household_invites (token_hash);
```

A `pin_hash` is required for `owner` and `parent` rows that have a `user_id`; enforced in
application logic during onboarding rather than as a check constraint, since PINs are set after
the row is created.

---

## 6. Row Level Security

Every household-owned row carries `household_id`. Every policy answers one question: *is
`auth.uid()` a member of this household, and with what role?*

### The recursion trap

The obvious implementation — a subquery against `household_members` inside a policy — recurses
infinitely when that policy is **on** `household_members` itself. This is the most common way
Supabase multi-tenant schemas break, and it fails at query time rather than at migration time,
so it is easy to ship.

Membership checks therefore go through `SECURITY DEFINER` functions, which bypass RLS internally:

```sql
create function is_household_member(hid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from household_members
      where household_id = hid and user_id = auth.uid() and is_active
    );
  $$;

create function household_role(hid uuid) returns member_role
  language sql security definer stable set search_path = public as $$
    select role from household_members
    where household_id = hid and user_id = auth.uid() and is_active
    limit 1;
  $$;
```

Both are `stable`, pin `search_path`, and are revoked from `public` then granted to `authenticated`.

### Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | self, plus members of shared households | trigger on `auth.users` | self | — |
| `households` | members | via `create_household()` RPC only | `owner`, `parent` | `owner` |
| `household_members` | members | `owner`, `parent` | `owner`, `parent`; self for own `avatar_url`, `color`, `display_name` | `owner`, `parent` |
| `household_invites` | `owner`, `parent` | `owner`, `parent` | — | `owner`, `parent` |
| `household_settings` | members | `owner`, `parent` | `owner`, `parent` | cascade only |

### Two bootstrap problems

Both are cases where a user must create the very membership that the policies require them to
already have. Neither is solvable with policies alone; both need a `SECURITY DEFINER` RPC.

**Creating a household.** Inserting a `households` row is useless without also inserting the
creator as its `owner` in `household_members` — but that insert requires an `owner` or `parent`
role, which requires a membership that does not yet exist. `create_household(name, timezone)`
therefore creates the household, the owner member row, and the settings row in one transaction,
returning the new household id.

**Accepting an invitation.** The accepting user is by definition not yet a member and so satisfies
no membership policy. `accept_invite(token)` validates the token hash and expiry, then either
inserts a new member row or — when `member_id` is set — attaches `auth.uid()` to that existing
row, preserving its points and history. It marks the invitation accepted in the same transaction.

Both functions pin `search_path`, are revoked from `public`, granted to `authenticated`, and
validate their inputs independently of any client-supplied role.

A `profiles` row is created by an `after insert` trigger on `auth.users` rather than by the
client, so no INSERT policy on `profiles` is needed at all.

---

## 7. Routing and navigation

```
/                    → /dashboard when authenticated, else /welcome
/login  /signup  /auth/callback
/onboarding          multi-step, resumable
/dashboard           static home screen
/family  /family/[memberId]
/settings  /settings/household  /settings/members  /settings/appearance
/invite/[token]      join household, or claim an existing profile
/offline             PWA fallback
```

Server Components by default; Client Components only where interactivity requires them — the
profile switcher, onboarding form steps, theme toggle.

**Navigation is data-driven from `household_settings.enabled_features` starting in SP1.** Meals,
Calendar, Chores and the rest appear as nav entries the moment their flag flips, so SP2–SP5 ship
a feature by enabling it rather than by editing navigation in several places. This also makes the
"modular, enable or disable per household" requirement real infrastructure rather than a promise.

Desktop uses a sidebar; mobile uses bottom navigation with an intentionally different layout and
card treatment — not a shrunk desktop.

---

## 8. Design system

Direction: **Warm Minimal** — cream, terracotta, generous space. Chosen over a dark-glow direction
and an adaptive light/dark-accent direction.

Tokens are CSS custom properties surfaced through the Tailwind theme, so shadcn/ui components
inherit them rather than shipping default zinc.

| Token | Light | Dark |
|---|---|---|
| `bg` | `#FBF7F1` | `#1A1614` |
| `surface` | `#FFFFFF` | `#221D1A` |
| `sunken` | `#F4EDE3` | `#2A2320` |
| `ink` | `#2A2520` | `#F0E9E1` |
| `muted` | `#8A7F73` | `#A89B8E` |
| `accent` | `#C4643C` | `#E08B5F` |
| `border` | `#EDE4D8` | `#332B26` |

Dark mode is a **warm** dark — browns and umbers, not slate. A neutral-grey dark theme beneath a
terracotta accent is what makes an application look like a dashboard wearing a costume.

- Radii 12–18px; touch targets ≥44px; a single spacing scale
- Light / dark / system, plus a household accent override
- Type: **Inter** for UI, **Fraunces** for display headings
  *(Assumption — proposed and not explicitly confirmed. Reversible in one token change.)*

### Logo

The chosen mark is an FH monogram whose shared crossbar and diagonal cut also read as a pitched
roof. Source SVGs are in `assets/logo-concepts/`; `c6-monogram.svg` is the selection.

Production work required, none of it needing regeneration:
- strip the baked cream background rect to transparent
- produce a single-color variant for dark backgrounds and small sizes
- derive favicon, maskable PWA icons (192/512), and Apple touch icon

---

## 9. Onboarding

Five steps, resumable: **Welcome → Create household → Add members → Choose features → Ready.**

The vision's sixth step, "Customize your dashboard," moves to SP5. There are no widgets to
arrange in SP1, and including it would mean building a throwaway version of it twice.

Adding members is where the hybrid model surfaces in the UI. Each member is added with a name,
color, birthday and role, plus a toggle: *"they'll have their own login."* Off by default for
children — writing a row with `user_id NULL`. On — generating a claim invitation.

The profile switcher is a full-screen avatar grid. Child and teen tiles switch instantly; owner
and parent tiles prompt for a PIN.

---

## 10. PWA

Manifest with name, theme colors matching the light and dark `bg` tokens, `standalone` display,
and maskable icons. Service worker caches the app shell and static assets, with `/offline` as the
navigation fallback.

**Nothing household-scoped is cached in SP1.** Recipe, meal-plan and schedule caching belongs to
the sub-projects that own that data, where the staleness and privacy trade-offs can be reasoned
about against real content.

---

## 11. Testing

Test-driven throughout: RLS tests and permission helpers are written before the policies and
helpers they describe.

**pgTAP — the load-bearing layer.** Asserts that a member of household A, using a real session,
cannot read, update or delete any row belonging to household B; that a `teen` cannot touch
settings, invitations, or another member's row; that a `child` cannot escalate; that the
`SECURITY DEFINER` helpers do not recurse. If these tests pass, the security model is real. If
they do not exist, it is decoration.

**Vitest.** Zod schemas, permission helpers, invite-token generation and expiry.

**Playwright.** Sign up → onboard → add a login-less child → switch profiles → PIN gate blocks a
child reaching settings → invite a teen → teen claims the existing profile and retains points.
Run at phone, tablet, laptop and kitchen-display widths.

**Review passes.** `web-interface-guidelines` and `impeccable` over the UI before SP1 is complete.

---

## 12. Prerequisites and assumptions

**Blocking on the user:**
- Google Cloud OAuth client ID, secret, and authorized redirect URI. Email/password can be built
  and verified end-to-end without it; Google sign-in cannot.

**Non-blocking:**
- Higgsfield credits are exhausted. Two logo concepts from the original batch never generated.
  The chosen mark needs no further generation, so this blocks nothing in SP1.
- The Supabase cloud project is not yet provisioned. One free slot is available in the
  `Crypthouse` organisation; a new project reports $0/month. Provisioned at deploy time.

**Assumptions:**
- One household per user in SP1. The schema permits many-to-many; the UI assumes one primary
  household and does not present a switcher.
- Fraunces + Inter as the type pairing (§8).
- Node 26.7.0, npm, Docker 29.7.2 — all present locally.

---

## 13. Definition of done

1. `supabase start` brings up local Postgres; migrations apply cleanly from empty
2. pgTAP suite passes, including cross-household isolation
3. A user can sign up, onboard, and land on a populated dashboard
4. A parent can add a login-less child and a teen with a login
5. A teen can accept a claim invitation and retain their existing member row and points
6. Profile switching works; PIN gates owner and parent profiles
7. Light, dark and system themes all render correctly across every screen
8. The app installs as a PWA and serves `/offline` when disconnected
9. Playwright suite passes at four widths
10. Deployed to Vercel against a provisioned Supabase project
