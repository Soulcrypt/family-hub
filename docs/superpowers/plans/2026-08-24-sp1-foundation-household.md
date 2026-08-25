# SP1 Foundation & Household Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, installable Family Hub PWA where a user can sign up, create a household, add family members (with or without logins), switch profiles, and manage settings — on a proven-isolated database.

**Architecture:** Next.js App Router with Server Components by default; Supabase Postgres for data with Row Level Security as the only trust boundary. Identity splits into two independent concerns: *authority* comes from `auth.uid()` and the account's role, *attribution* comes from a signed httpOnly cookie naming the active family member. Navigation is driven by a per-household feature-flag record so later sub-projects ship by enabling a flag.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), React 19, Tailwind CSS v4, shadcn/ui, Lucide, React Hook Form, Zod, Supabase (Postgres/Auth/RLS via `@supabase/ssr`), Vitest, pgTAP, Playwright, next-themes, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-24-sp1-foundation-household-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **TypeScript strict mode. `any` is forbidden** — use `unknown` plus a type guard, or a generated Supabase type.
- **Server Components by default.** Add `"use client"` only where interactivity genuinely requires it.
- **RLS trusts `auth.uid()` and nothing else.** The active-member cookie must never appear in a policy, a `SECURITY DEFINER` function, or an authorization decision.
- **Roles are exactly:** `owner`, `parent`, `teen`, `child`. There is no `adult` role.
- **Every household-owned row carries `household_id`.**
- **Privileged operations** (settings, invites, member management, role changes) check the *authenticated account's* role server-side, never the active-member cookie.
- **Palette — exact values.** Light: bg `#FBF7F1`, surface `#FFFFFF`, sunken `#F4EDE3`, ink `#2A2520`, muted `#8A7F73`, accent `#C4643C`, border `#EDE4D8`. Dark: bg `#1A1614`, surface `#221D1A`, sunken `#2A2320`, ink `#F0E9E1`, muted `#A89B8E`, accent `#E08B5F`, border `#332B26`.
- **Radii 12–18px. Touch targets ≥44px.**
- **Type:** Inter for UI, Fraunces for display headings.
- **Local environment:** Node 26.7.0, npm, Docker 29.7.2. All present.
- **Commit after every task.** Conventional commit prefixes (`feat:`, `test:`, `chore:`, `fix:`).

## File Structure

```
app/
  layout.tsx                     root layout, fonts, ThemeProvider
  page.tsx                       redirect gate → /dashboard | /welcome
  welcome/page.tsx               logged-out landing
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  auth/callback/route.ts         OAuth + email confirm exchange
  auth/signout/route.ts
  onboarding/page.tsx            5-step resumable wizard
  (app)/layout.tsx               authed shell: sidebar + bottom nav
  (app)/dashboard/page.tsx
  (app)/family/page.tsx
  (app)/family/[memberId]/page.tsx
  (app)/settings/page.tsx
  (app)/settings/household/page.tsx
  (app)/settings/members/page.tsx
  (app)/settings/appearance/page.tsx
  switch/page.tsx                full-screen profile switcher
  invite/[token]/page.tsx        join or claim
  offline/page.tsx               PWA fallback
  globals.css                    @theme tokens

components/
  ui/                            shadcn primitives (themed)
  theme/theme-provider.tsx, theme-toggle.tsx
  shell/sidebar.tsx, bottom-nav.tsx, nav-items.ts
  family/member-form.tsx, member-avatar.tsx, member-grid.tsx
  onboarding/step-*.tsx
  switcher/pin-dialog.tsx

lib/
  supabase/server.ts, client.ts, middleware.ts, types.ts
  auth/permissions.ts            role predicates — pure, unit-tested
  auth/active-member.ts          signed cookie read/write
  validation/schemas.ts          Zod schemas
  constants/roles.ts, features.ts

supabase/
  migrations/*.sql
  tests/*.sql                    pgTAP
  seed.sql

tests/e2e/*.spec.ts              Playwright
middleware.ts                    session refresh + route protection
```

---

### Task 1: Project scaffold and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working `npm run dev`, `npm run build`, `npm test`; strict TS; Tailwind v4 pipeline

- [ ] **Step 1: Scaffold the app**

Run in `/home/soulcrypt/Projects/family-hub`:

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias "@/*" --use-npm --no-turbopack --yes
```

If the directory-not-empty prompt appears, accept keeping existing files — `README.md`, `docs/`, `assets/`, `.gitignore` and `logo.png` must survive.

- [ ] **Step 2: Enforce strict TypeScript**

In `tsconfig.json`, ensure `compilerOptions` contains:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "forceConsistentCasingInFileNames": true
}
```

- [ ] **Step 3: Install the test harness**

```bash
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "tests/e2e"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Add to `package.json` scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Write the failing smoke test**

Create `lib/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("lets later tailwind classes win over earlier conflicting ones", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/utils"`.

- [ ] **Step 7: Create the utility**

```bash
npm i clsx tailwind-merge
```

Create `lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Run tests and the build**

Run: `npm test`
Expected: PASS — 2 tests.

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with strict TS and Vitest"
```

---

### Task 2: Design tokens, fonts, and theming

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `components/theme/theme-provider.tsx`, `components/theme/theme-toggle.tsx`
- Test: `lib/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: `cn` from Task 1
- Produces: CSS variables `--color-bg|surface|sunken|ink|muted|accent|border`; `<ThemeProvider>`; `<ThemeToggle>`; font variables `--font-inter`, `--font-fraunces`

- [ ] **Step 1: Write the failing token test**

Create `lib/__tests__/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

const LIGHT = {
  "--color-bg": "#FBF7F1",
  "--color-surface": "#FFFFFF",
  "--color-sunken": "#F4EDE3",
  "--color-ink": "#2A2520",
  "--color-muted": "#8A7F73",
  "--color-accent": "#C4643C",
  "--color-border": "#EDE4D8",
};

const DARK = {
  "--color-bg": "#1A1614",
  "--color-surface": "#221D1A",
  "--color-sunken": "#2A2320",
  "--color-ink": "#F0E9E1",
  "--color-muted": "#A89B8E",
  "--color-accent": "#E08B5F",
  "--color-border": "#332B26",
};

describe("design tokens", () => {
  it("defines every light token on :root", () => {
    const root = css.slice(css.indexOf(":root"), css.indexOf(".dark"));
    for (const [name, value] of Object.entries(LIGHT)) {
      expect(root).toContain(`${name}: ${value}`);
    }
  });

  it("redefines every token in the dark scope", () => {
    const dark = css.slice(css.indexOf(".dark"));
    for (const [name, value] of Object.entries(DARK)) {
      expect(dark).toContain(`${name}: ${value}`);
    }
  });

  it("never leaves a token defined only in dark", () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- tokens`
Expected: FAIL — tokens not found in `globals.css`.

- [ ] **Step 3: Write the tokens**

Replace `app/globals.css` with:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --color-bg: #FBF7F1;
  --color-surface: #FFFFFF;
  --color-sunken: #F4EDE3;
  --color-ink: #2A2520;
  --color-muted: #8A7F73;
  --color-accent: #C4643C;
  --color-border: #EDE4D8;

  --radius-card: 16px;
  --radius-control: 12px;
  --tap-min: 44px;
}

.dark {
  --color-bg: #1A1614;
  --color-surface: #221D1A;
  --color-sunken: #2A2320;
  --color-ink: #F0E9E1;
  --color-muted: #A89B8E;
  --color-accent: #E08B5F;
  --color-border: #332B26;
}

@theme inline {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-sunken: var(--color-sunken);
  --color-ink: var(--color-ink);
  --color-muted: var(--color-muted);
  --color-accent: var(--color-accent);
  --color-border: var(--color-border);
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;
}

@layer base {
  body {
    background-color: var(--color-bg);
    color: var(--color-ink);
    font-family: var(--font-sans);
  }
  h1, h2, h3 {
    font-family: var(--font-display);
    letter-spacing: -0.02em;
  }
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 4: Run the token test**

Run: `npm test -- tokens`
Expected: PASS — 3 tests.

- [ ] **Step 5: Install and wire theming**

```bash
npm i next-themes lucide-react
```

Create `components/theme/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemeProvider>
  );
}
```

Create `components/theme/theme-toggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex gap-1 rounded-[12px] bg-sunken p-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mounted ? theme === value : false}
          aria-label={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] transition-colors",
            mounted && theme === value ? "bg-surface text-accent" : "text-muted hover:text-ink",
          )}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Load fonts and provider in the root layout**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "Family Hub",
  description: "One home for your family's meals, plans, and days.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` is required — `next-themes` writes the theme class on the client before React hydrates.

- [ ] **Step 7: Verify**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add warm minimal design tokens, fonts, and theming"
```

---

### Task 3: shadcn/ui primitives

**Files:**
- Create: `components.json`, `components/ui/{button,input,label,card,dialog,avatar,select,form}.tsx`
- Test: `components/__tests__/button.test.tsx`

**Interfaces:**
- Consumes: `cn`, tokens from Tasks 1–2
- Produces: themed `Button`, `Input`, `Label`, `Card`, `Dialog`, `Avatar`, `Select`, `Form`

- [ ] **Step 1: Initialize shadcn**

```bash
npx shadcn@latest init -y -b neutral
npx shadcn@latest add button input label card dialog avatar select form
```

- [ ] **Step 2: Retheme the Button to our tokens**

In `components/ui/button.tsx`, replace the `variant` and `size` maps so defaults use our palette and meet the tap target:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:brightness-95",
        outline: "border border-border bg-surface text-ink hover:bg-sunken",
        ghost: "text-ink hover:bg-sunken",
        destructive: "bg-[#9B4A38] text-white hover:brightness-95",
      },
      size: {
        default: "min-h-[44px] px-5 py-2",
        sm: "min-h-[44px] px-4 text-sm",
        lg: "min-h-[52px] px-7 text-base",
        icon: "min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

- [ ] **Step 3: Write the failing accessibility test**

Create `components/__tests__/button.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Add member</Button>);
    expect(screen.getByRole("button", { name: "Add member" })).toBeDefined();
  });

  it("applies the 44px minimum tap target at every size", () => {
    const { container } = render(
      <>
        <Button size="default">a</Button>
        <Button size="sm">b</Button>
        <Button size="icon">c</Button>
      </>,
    );
    for (const el of container.querySelectorAll("button")) {
      expect(el.className).toContain("min-h-[44px]");
    }
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test -- button`
Expected: PASS — both tests. If the tap-target test fails, Step 2's size map was not applied.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add themed shadcn/ui primitives"
```

---

### Task 4: Supabase local stack and schema migration

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/migrations/0001_schema.sql`, `.env.local.example`
- Test: migration applies cleanly from empty

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces: tables `profiles`, `households`, `household_members`, `household_invites`, `household_settings`; enum `member_role`; local Postgres on port 54322

- [ ] **Step 1: Install the CLI and initialize**

```bash
npm i -D supabase
npx supabase init
npx supabase start
```

`supabase start` pulls Docker images on first run and prints the API URL, anon key, and service role key. Record them.

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/0001_schema.sql`:

```sql
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
```

Enabling RLS with no policies denies everything — correct and deliberate. Task 5 adds the policies.

- [ ] **Step 3: Apply from empty and verify**

```bash
npx supabase db reset
```

Expected: reset completes, `0001_schema.sql` applies with no errors.

- [ ] **Step 4: Confirm the tables exist**

```bash
npx supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "\dt public.*"
```

Expected: all five tables listed.

- [ ] **Step 5: Record environment variables**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-value-from-supabase-start
SUPABASE_SERVICE_ROLE_KEY=replace-with-value-from-supabase-start
ACTIVE_MEMBER_COOKIE_SECRET=generate-with-openssl-rand-base64-32
```

Copy it to `.env.local` and fill in the real values from Step 1. `.env.local` is gitignored.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase local stack and household schema"
```

---

### Task 5: RLS helpers and policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`, `supabase/tests/010_rls_isolation.sql`
- Test: `supabase/tests/010_rls_isolation.sql` via `supabase test db`

**Interfaces:**
- Consumes: schema from Task 4
- Produces: `is_household_member(uuid) → boolean`, `household_role(uuid) → member_role`, and policies on all five tables

- [ ] **Step 1: Write the failing pgTAP isolation test**

Create `supabase/tests/010_rls_isolation.sql`:

```sql
begin;
select plan(11);

-- Two households, two owners, one teen in household A.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'teen@test.local');

insert into profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Owner A'),
  ('22222222-2222-4222-8222-222222222222', 'Owner B'),
  ('33333333-3333-4333-8333-333333333333', 'Teen A');

insert into households (id, name, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'House A', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'House B', '22222222-2222-4222-8222-222222222222');

insert into household_settings (household_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'Owner A', 'owner'),
  ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222', 'Owner B', 'owner'),
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '33333333-3333-4333-8333-333333333333', 'Teen A', 'teen'),
  ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   null, 'Ivy', 'child');

-- === Owner A's session ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from households),
  1,
  'owner A sees only their own household'
);

select is(
  (select count(*)::int from household_members),
  3,
  'owner A sees all three members of household A and none of B'
);

select is(
  (select count(*)::int from household_members where household_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'owner A cannot read household B members'
);

select lives_ok(
  $$ update households set name = 'House A renamed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'owner A can rename their own household'
);

select is(
  (select count(*)::int from (
     update households set name = 'hacked'
     where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1
   ) t),
  0,
  'owner A updating household B affects zero rows'
);

select lives_ok(
  $$ insert into household_members (household_id, display_name, role)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'New Kid', 'child') $$,
  'owner A can add a login-less member to their household'
);

select throws_ok(
  $$ insert into household_members (household_id, display_name, role)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Intruder', 'child') $$,
  '42501',
  null,
  'owner A cannot insert a member into household B'
);

-- === Teen A's session ===
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*)::int from household_members),
  4,
  'teen sees their household members'
);

select is(
  (select count(*)::int from (
     update household_members set display_name = 'Renamed'
     where id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1' returning 1
   ) t),
  0,
  'teen cannot rename another member'
);

select is(
  (select count(*)::int from (
     update household_settings set enabled_features = '{}'::jsonb
     where household_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1
   ) t),
  0,
  'teen cannot change household settings'
);

select is(
  (select count(*)::int from household_invites),
  0,
  'teen cannot read invitations'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx supabase test db
```

Expected: FAIL — with RLS enabled and no policies, even owner A sees zero households, so the first assertion fails.

- [ ] **Step 3: Write the helpers and policies**

Create `supabase/migrations/0002_rls.sql`:

```sql
-- SECURITY DEFINER bypasses RLS internally, which is what prevents the
-- infinite recursion a plain subquery would cause in a policy ON household_members.
create function is_household_member(hid uuid) returns boolean
  language sql security definer stable set search_path = public, pg_temp as $$
    select exists (
      select 1 from household_members
      where household_id = hid and user_id = auth.uid() and is_active
    );
  $$;

create function household_role(hid uuid) returns member_role
  language sql security definer stable set search_path = public, pg_temp as $$
    select role from household_members
    where household_id = hid and user_id = auth.uid() and is_active
    limit 1;
  $$;

revoke execute on function is_household_member(uuid) from public;
revoke execute on function household_role(uuid)      from public;
grant  execute on function is_household_member(uuid) to authenticated;
grant  execute on function household_role(uuid)      to authenticated;

-- profiles
create policy profiles_select_self_and_household on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from household_members m
      where m.user_id = profiles.id and is_household_member(m.household_id)
    )
  );
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- households
create policy households_select_members on households for select to authenticated
  using (is_household_member(id));
create policy households_update_admins on households for update to authenticated
  using (household_role(id) in ('owner', 'parent'))
  with check (household_role(id) in ('owner', 'parent'));
create policy households_delete_owner on households for delete to authenticated
  using (household_role(id) = 'owner');

-- household_members
create policy members_select_household on household_members for select to authenticated
  using (is_household_member(household_id));
create policy members_insert_admins on household_members for insert to authenticated
  with check (household_role(household_id) in ('owner', 'parent'));
create policy members_update_admins on household_members for update to authenticated
  using (household_role(household_id) in ('owner', 'parent'))
  with check (household_role(household_id) in ('owner', 'parent'));
create policy members_update_self on household_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy members_delete_admins on household_members for delete to authenticated
  using (household_role(household_id) in ('owner', 'parent'));

-- household_invites
create policy invites_select_admins on household_invites for select to authenticated
  using (household_role(household_id) in ('owner', 'parent'));
create policy invites_insert_admins on household_invites for insert to authenticated
  with check (household_role(household_id) in ('owner', 'parent'));
create policy invites_delete_admins on household_invites for delete to authenticated
  using (household_role(household_id) in ('owner', 'parent'));

-- household_settings
create policy settings_select_members on household_settings for select to authenticated
  using (is_household_member(household_id));
create policy settings_update_admins on household_settings for update to authenticated
  using (household_role(household_id) in ('owner', 'parent'))
  with check (household_role(household_id) in ('owner', 'parent'));
```

Note the deliberate absence of an INSERT policy on `households` and `household_settings` — Task 6's RPC is the only way to create them.

`members_update_self` intentionally has no column restriction: Postgres policies cannot limit columns. Field-level restriction (a teen may change only their own avatar, color and name) is enforced in the server action in Task 14, and the policy guarantees they can only ever touch their *own* row.

- [ ] **Step 4: Run the test again**

```bash
npx supabase test db
```

Expected: PASS — 11 of 11.

- [ ] **Step 5: Prove the recursion trap is actually avoided**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "set role authenticated;
   set request.jwt.claims = '{\"sub\":\"11111111-1111-4111-8111-111111111111\"}';
   select count(*) from household_members;"
```

Expected: returns a count, not `stack depth limit exceeded`. If it recurses, a policy is querying `household_members` directly instead of through the helper.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add RLS helpers and policies with pgTAP isolation tests"
```

---

### Task 6: Bootstrap RPCs and profile trigger

**Files:**
- Create: `supabase/migrations/0003_rpc.sql`, `supabase/tests/020_bootstrap.sql`
- Test: `supabase/tests/020_bootstrap.sql`

**Interfaces:**
- Consumes: schema and policies from Tasks 4–5
- Produces: `create_household(text, text) → uuid`, `accept_invite(text) → uuid`, trigger `on_auth_user_created`

Both functions solve bootstrap deadlocks — a user must create the membership that the policies require them to already have.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/020_bootstrap.sql`:

```sql
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444444', 'newowner@test.local', '{"display_name":"New Owner"}'::jsonb),
  ('55555555-5555-4555-8555-555555555555', 'newteen@test.local',  '{"display_name":"New Teen"}'::jsonb);

select is(
  (select display_name from profiles where id = '44444444-4444-4444-8444-444444444444'),
  'New Owner',
  'trigger creates a profile row on auth.users insert'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

select lives_ok(
  $$ select create_household('The Testers', 'America/Chicago') $$,
  'an authenticated user with no household can create one'
);

select is(
  (select count(*)::int from households where name = 'The Testers'),
  1,
  'the household row exists and is visible to its creator'
);

select is(
  (select role::text from household_members
   where user_id = '44444444-4444-4444-8444-444444444444'),
  'owner',
  'the creator is inserted as owner'
);

select is(
  (select count(*)::int from household_settings hs
   join households h on h.id = hs.household_id where h.name = 'The Testers'),
  1,
  'settings row is created alongside the household'
);

-- Claim flow: an invite bound to an existing login-less member row.
insert into household_members (id, household_id, display_name, role, points_balance)
select 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', id, 'Ivy', 'child', 250
from households where name = 'The Testers';

insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
select id, encode(digest('claim-token-abc', 'sha256'), 'hex'), 'teen',
       'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', now() + interval '7 days',
       '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

select lives_ok(
  $$ select accept_invite('claim-token-abc') $$,
  'an invited user can accept a claim invitation'
);

select is(
  (select points_balance from household_members
   where id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'),
  250,
  'claiming attaches the account to the existing row and preserves points'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx supabase test db
```

Expected: FAIL — `function create_household(...) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_rpc.sql`:

```sql
create extension if not exists pgcrypto with schema extensions;

-- Profiles are created by trigger, never by the client, so profiles needs no INSERT policy.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    insert into profiles (id, display_name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Bootstrap 1: creating a household requires a membership that cannot exist yet.
create function create_household(p_name text, p_timezone text default 'UTC')
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare
    v_uid uuid := auth.uid();
    v_household_id uuid;
    v_display_name text;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;
    if length(trim(coalesce(p_name, ''))) = 0 then
      raise exception 'household name is required' using errcode = '22023';
    end if;

    select display_name into v_display_name from profiles where id = v_uid;
    if v_display_name is null then
      raise exception 'profile missing' using errcode = '42501';
    end if;

    insert into households (name, timezone, created_by)
    values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'UTC'), v_uid)
    returning id into v_household_id;

    insert into household_members (household_id, user_id, display_name, role)
    values (v_household_id, v_uid, v_display_name, 'owner');

    insert into household_settings (household_id) values (v_household_id);

    return v_household_id;
  end;
  $$;

-- Bootstrap 2: the accepting user is not yet a member, so satisfies no policy.
create function accept_invite(p_token text)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp, extensions as $$
  declare
    v_uid uuid := auth.uid();
    v_invite household_invites%rowtype;
    v_display_name text;
    v_member_id uuid;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;

    select * into v_invite from household_invites
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    for update;

    if v_invite.id is null then
      raise exception 'invitation not found' using errcode = '22023';
    end if;
    if v_invite.accepted_at is not null then
      raise exception 'invitation already used' using errcode = '22023';
    end if;
    if v_invite.expires_at < now() then
      raise exception 'invitation expired' using errcode = '22023';
    end if;

    select display_name into v_display_name from profiles where id = v_uid;

    if v_invite.member_id is not null then
      -- Claim: attach this account to the existing row, preserving its history.
      update household_members
      set user_id = v_uid, role = v_invite.role
      where id = v_invite.member_id and user_id is null
      returning id into v_member_id;

      if v_member_id is null then
        raise exception 'profile already claimed' using errcode = '22023';
      end if;
    else
      insert into household_members (household_id, user_id, display_name, role)
      values (v_invite.household_id, v_uid, coalesce(v_display_name, 'Member'), v_invite.role)
      returning id into v_member_id;
    end if;

    update household_invites set accepted_at = now() where id = v_invite.id;
    return v_member_id;
  end;
  $$;

revoke execute on function create_household(text, text) from public;
revoke execute on function accept_invite(text)          from public;
grant  execute on function create_household(text, text) to authenticated;
grant  execute on function accept_invite(text)          to authenticated;
```

- [ ] **Step 4: Run both test files**

```bash
npx supabase db reset && npx supabase test db
```

Expected: PASS — 11 from `010`, 7 from `020`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add create_household and accept_invite bootstrap RPCs"
```

---

### Task 7: Supabase clients, generated types, and session middleware

**Files:**
- Create: `lib/supabase/types.ts` (generated), `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `middleware.ts`
- Test: `lib/__tests__/supabase-types.test.ts`

**Interfaces:**
- Consumes: schema from Tasks 4–6
- Produces: `createServerClient()`, `createBrowserClient()`, `updateSession(request)`, type `Database`, type `MemberRole`

- [ ] **Step 1: Install and generate types**

```bash
npm i @supabase/supabase-js @supabase/ssr
npx supabase gen types typescript --local > lib/supabase/types.ts
```

Add to `package.json` scripts:

```json
{ "types:db": "supabase gen types typescript --local > lib/supabase/types.ts" }
```

- [ ] **Step 2: Write the failing type test**

Create `lib/__tests__/supabase-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ROLES, type MemberRole } from "@/lib/constants/roles";

describe("member roles", () => {
  it("has exactly the four spec roles in privilege order", () => {
    expect(ROLES).toEqual(["owner", "parent", "teen", "child"]);
  });

  it("does not include the removed adult role", () => {
    expect(ROLES as readonly string[]).not.toContain("adult");
  });

  it("assigns MemberRole from the generated database enum", () => {
    const r: MemberRole = "owner";
    expect(ROLES).toContain(r);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm test -- supabase-types`
Expected: FAIL — cannot resolve `@/lib/constants/roles`.

- [ ] **Step 4: Create the roles constant**

Create `lib/constants/roles.ts`:

```ts
import type { Database } from "@/lib/supabase/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLES = ["owner", "parent", "teen", "child"] as const satisfies readonly MemberRole[];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  parent: "Parent",
  teen: "Teen",
  child: "Child",
};
```

The `satisfies` clause is load-bearing: if the database enum ever drifts from this list, the build fails rather than the app misbehaving.

- [ ] **Step 5: Run the test**

Run: `npm test -- supabase-types`
Expected: PASS — 3 tests.

- [ ] **Step 6: Create the clients**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
```

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export function createBrowserClient() {
  return createSSRBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

const PUBLIC_PATHS = ["/welcome", "/login", "/signup", "/auth", "/invite", "/offline"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser revalidates against the auth server; getSession only reads the cookie.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  return response;
}
```

Create `middleware.ts` at the repo root:

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run build`
Expected: PASS and a clean build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients, generated types, and session middleware"
```

---

### Task 8: Permission helpers and the active-member cookie

This task implements the spec's central security decision: **attribution and authority are separate**. Get it wrong and every later task inherits the flaw.

**Files:**
- Create: `lib/auth/permissions.ts`, `lib/auth/active-member.ts`, `lib/validation/schemas.ts`
- Test: `lib/__tests__/permissions.test.ts`, `lib/__tests__/active-member.test.ts`

**Interfaces:**
- Consumes: `MemberRole`, `ROLES` from Task 7; `createServerClient` from Task 7
- Produces:
  - `isAdmin(role: MemberRole): boolean`
  - `canManageMembers(role: MemberRole): boolean`
  - `canEditSettings(role: MemberRole): boolean`
  - `canInvite(role: MemberRole): boolean`
  - `requiresPin(role: MemberRole): boolean`
  - `signMemberId(id: string): string` / `verifyMemberId(signed: string): string | null`
  - `setActiveMember(id: string): Promise<void>`
  - `getActiveMember(): Promise<ActiveMember | null>`
  - `clearActiveMember(): Promise<void>`
  - type `ActiveMember = { id, display_name, role, color, avatar_url, household_id }`

- [ ] **Step 1: Write the failing permissions test**

Create `lib/__tests__/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canEditSettings, canInvite, canManageMembers, isAdmin, requiresPin } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/constants/roles";

describe("permissions", () => {
  it("treats owner and parent as administrators", () => {
    expect(isAdmin("owner")).toBe(true);
    expect(isAdmin("parent")).toBe(true);
    expect(isAdmin("teen")).toBe(false);
    expect(isAdmin("child")).toBe(false);
  });

  it("restricts member management, settings, and invites to administrators", () => {
    for (const role of ROLES) {
      const admin = role === "owner" || role === "parent";
      expect(canManageMembers(role)).toBe(admin);
      expect(canEditSettings(role)).toBe(admin);
      expect(canInvite(role)).toBe(admin);
    }
  });

  it("requires a PIN to switch into administrator profiles only", () => {
    expect(requiresPin("owner")).toBe(true);
    expect(requiresPin("parent")).toBe(true);
    expect(requiresPin("teen")).toBe(false);
    expect(requiresPin("child")).toBe(false);
  });

  it("covers every role with no gaps", () => {
    for (const role of ROLES) {
      expect(typeof isAdmin(role)).toBe("boolean");
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- permissions`
Expected: FAIL — cannot resolve `@/lib/auth/permissions`.

- [ ] **Step 3: Write the permission helpers**

Create `lib/auth/permissions.ts`:

```ts
import type { MemberRole } from "@/lib/constants/roles";

const ADMIN_ROLES: readonly MemberRole[] = ["owner", "parent"];

export function isAdmin(role: MemberRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageMembers(role: MemberRole): boolean {
  return isAdmin(role);
}

export function canEditSettings(role: MemberRole): boolean {
  return isAdmin(role);
}

export function canInvite(role: MemberRole): boolean {
  return isAdmin(role);
}

/** A PIN gates *switching into* an admin profile. It is a convenience lock, not the security boundary. */
export function requiresPin(role: MemberRole): boolean {
  return isAdmin(role);
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- permissions`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing cookie-signing test**

Create `lib/__tests__/active-member.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { signMemberId, verifyMemberId } from "@/lib/auth/active-member";

beforeAll(() => {
  process.env.ACTIVE_MEMBER_COOKIE_SECRET = "test-secret-not-used-in-production";
});

const ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";

describe("active member cookie signing", () => {
  it("round-trips a member id", () => {
    expect(verifyMemberId(signMemberId(ID))).toBe(ID);
  });

  it("rejects a tampered member id", () => {
    const signed = signMemberId(ID);
    const tampered = signed.replace(ID, "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2");
    expect(verifyMemberId(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const signed = signMemberId(ID);
    expect(verifyMemberId(`${signed}x`)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyMemberId("")).toBeNull();
    expect(verifyMemberId("no-separator")).toBeNull();
    expect(verifyMemberId("..")).toBeNull();
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npm test -- active-member`
Expected: FAIL — cannot resolve `@/lib/auth/active-member`.

- [ ] **Step 7: Write the active-member module**

Create `lib/auth/active-member.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/constants/roles";

const COOKIE = "fh_active_member";
const SEPARATOR = ".";

export type ActiveMember = {
  id: string;
  user_id: string | null;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
  household_id: string;
};

function secret(): string {
  const value = process.env.ACTIVE_MEMBER_COOKIE_SECRET;
  if (!value) throw new Error("ACTIVE_MEMBER_COOKIE_SECRET is not set");
  return value;
}

export function signMemberId(id: string): string {
  const mac = createHmac("sha256", secret()).update(id).digest("base64url");
  return `${id}${SEPARATOR}${mac}`;
}

export function verifyMemberId(signed: string): string | null {
  const index = signed.lastIndexOf(SEPARATOR);
  if (index <= 0) return null;

  const id = signed.slice(0, index);
  const mac = signed.slice(index + 1);
  if (!id || !mac) return null;

  const expected = createHmac("sha256", secret()).update(id).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}

export async function setActiveMember(id: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signMemberId(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveMember(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Resolves the active member for ATTRIBUTION only.
 *
 * The signature proves the cookie was not hand-edited; the database read proves the
 * member is genuinely in a household this account belongs to — RLS enforces that, so a
 * forged cookie naming a stranger's member id returns null rather than leaking anything.
 *
 * Never use the returned role for an authorization decision. Authority comes from the
 * authenticated account's own row — see requireAdmin() below.
 */
export async function getActiveMember(): Promise<ActiveMember | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const id = verifyMemberId(raw);
  if (!id) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, color, avatar_url, household_id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

/**
 * Resolves the AUTHENTICATED ACCOUNT's own membership. This is the only thing that may
 * gate a privileged operation.
 */
export async function requireAccountMembership(): Promise<ActiveMember> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, color, avatar_url, household_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) throw new Error("No household membership");
  return data;
}
```

- [ ] **Step 8: Run the test**

Run: `npm test -- active-member`
Expected: PASS — 4 tests.

- [ ] **Step 9: Add the Zod schemas**

```bash
npm i zod react-hook-form @hookform/resolvers
```

Create `lib/validation/schemas.ts`:

```ts
import { z } from "zod";
import { ROLES } from "@/lib/constants/roles";

export const roleSchema = z.enum(ROLES);

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Your name is required").max(40),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const householdSchema = z.object({
  name: z.string().trim().min(1, "Give your household a name").max(80),
  timezone: z.string().trim().min(1).default("UTC"),
});

export const memberSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(40),
  role: roleSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a color"),
  birthday: z.string().date().optional().or(z.literal("")),
  hasLogin: z.boolean().default(false),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Enter your 4-digit PIN"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type HouseholdInput = z.infer<typeof householdSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
```

- [ ] **Step 10: Verify and commit**

Run: `npm test && npm run build`
Expected: all PASS, clean build.

```bash
git add -A
git commit -m "feat: separate attribution from authority with signed active-member cookie"
```

---

### Task 9: Email and password authentication

**Files:**
- Create: `app/welcome/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/actions.ts`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`, `app/page.tsx`
- Test: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `createServerClient`, schemas from Task 8
- Produces: `signUp(formData)`, `signIn(formData)` server actions; a session cookie after either

- [ ] **Step 1: Install Playwright**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "kitchen", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

Add to `package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

function uniqueEmail(): string {
  return `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

test("a new user can sign up and reach onboarding", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Test Parent");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
});

test("an unauthenticated visitor is redirected away from the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/welcome/);
});

test("a wrong password shows an error and does not sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@test.local");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid/i);
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run test:e2e -- --project=desktop`
Expected: FAIL — `/signup` 404s.

- [ ] **Step 4: Disable email confirmation for local development**

In `supabase/config.toml`, under `[auth.email]`, set:

```toml
enable_confirmations = false
```

Then `npx supabase stop && npx supabase start`. Without this, signup returns a user with no session and the redirect never happens.

- [ ] **Step 5: Write the server actions**

Create `app/(auth)/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

export type AuthState = { error: string | null };

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) return { error: error.message };

  redirect("/onboarding");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password" };

  redirect("/");
}
```

`redirect()` throws internally, so it must sit outside any try/catch.

- [ ] **Step 6: Write the auth pages**

Create `app/(auth)/signup/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-3xl">Create your account</h1>
        <p className="mt-2 text-muted">One home for your family's meals, plans, and days.</p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">Your name</Label>
          <Input id="displayName" name="displayName" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-[12px] bg-[#F5DEDA] px-4 py-3 text-sm text-[#9B4A38]">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline underline-offset-4">Sign in</Link>
      </p>
    </main>
  );
}
```

Create `app/(auth)/login/page.tsx` — identical structure, but importing `signIn`, with heading "Welcome back", no name field, `autoComplete="current-password"`, submit label "Sign in", and a footer link to `/signup` reading "Create one".

- [ ] **Step 7: Write the routing gate, welcome page, and auth routes**

Create `app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function IndexPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  const { data: membership } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  redirect(membership ? "/dashboard" : "/onboarding");
}
```

Create `app/welcome/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-10 px-6 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl">Family Hub</h1>
        <p className="text-lg text-muted">
          Meals, plans, chores and days — for everyone under one roof.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild size="lg"><Link href="/signup">Get started</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/login">I already have an account</Link></Button>
      </div>
    </main>
  );
}
```

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

Create `app/auth/signout/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { clearActiveMember } from "@/lib/auth/active-member";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  await clearActiveMember();
  return NextResponse.redirect(new URL("/welcome", request.nextUrl.origin), { status: 303 });
}
```

- [ ] **Step 8: Run the E2E tests**

Run: `npm run test:e2e -- --project=desktop`
Expected: PASS — 3 tests. The signup test lands on `/onboarding`, which 404s until Task 10 — that is expected and does not fail this assertion, which only checks the URL.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add email and password authentication"
```

---

### Task 10: Onboarding wizard

**Files:**
- Create: `app/onboarding/page.tsx`, `app/onboarding/actions.ts`, `components/onboarding/step-household.tsx`, `components/onboarding/step-members.tsx`, `components/onboarding/step-features.tsx`, `lib/constants/features.ts`
- Test: `tests/e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `create_household` RPC (Task 6), schemas (Task 8), `setActiveMember` (Task 8)
- Produces: `createHouseholdAction`, `addMemberAction`, `saveFeaturesAction`, `finishOnboardingAction`; `FEATURES` constant

Five steps: Welcome → Create household → Add members → Choose features → Ready. The vision's sixth step, dashboard customization, belongs to SP5.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/onboarding.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

function uniqueEmail(): string {
  return `owner-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

test("a new user can complete onboarding and reach the dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Dana Parent");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /welcome to family hub/i })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByLabel("Household name").fill("The Testers");
  await page.getByRole("button", { name: "Continue" }).click();

  // A login-less child.
  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill("Ivy");
  await page.getByLabel("Role").selectOption("child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Ivy")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /go to my dashboard/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("The Testers")).toBeVisible();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- --project=desktop onboarding`
Expected: FAIL — `/onboarding` 404s.

- [ ] **Step 3: Define the feature catalogue**

Create `lib/constants/features.ts`:

```ts
export const FEATURES = [
  { key: "family",   label: "Family",   description: "Profiles, roles and birthdays", locked: true },
  { key: "settings", label: "Settings", description: "Household preferences",         locked: true },
  { key: "calendar", label: "Calendar", description: "Shared family schedule",        locked: false },
  { key: "meals",    label: "Meals",    description: "Recipes and weekly planning",   locked: false },
  { key: "chores",   label: "Chores",   description: "Tasks, points and rewards",     locked: false },
  { key: "habits",   label: "Habits",   description: "Daily streaks",                 locked: false },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export type EnabledFeatures = Partial<Record<FeatureKey, boolean>>;

export function isFeatureEnabled(features: EnabledFeatures, key: FeatureKey): boolean {
  return features[key] === true;
}
```

Features beyond `family` and `settings` have no screens until SP2–SP5. They appear here so the household's choices are recorded during onboarding and the navigation lights up the moment those sub-projects land.

- [ ] **Step 4: Write the server actions**

Create `app/onboarding/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { householdSchema, memberSchema } from "@/lib/validation/schemas";
import { requireAccountMembership, setActiveMember } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import type { EnabledFeatures } from "@/lib/constants/features";

export type ActionState = { error: string | null };

export async function createHouseholdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = householdSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone") || "UTC",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
  });
  if (error) return { error: error.message };

  const membership = await requireAccountMembership();
  await setActiveMember(membership.id);

  revalidatePath("/onboarding");
  return { error: null };
}

export async function addMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberSchema.safeParse({
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    color: formData.get("color") || "#C4643C",
    birthday: formData.get("birthday") || "",
    hasLogin: formData.get("hasLogin") === "on",
    email: formData.get("email") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  // Authority check against the ACCOUNT's role — never the active-member cookie.
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to add members" };

  const supabase = await createServerClient();
  const { error } = await supabase.from("household_members").insert({
    household_id: account.household_id,
    display_name: parsed.data.displayName,
    role: parsed.data.role,
    color: parsed.data.color,
    birthday: parsed.data.birthday || null,
    user_id: null,
  });
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { error: null };
}

export async function saveFeaturesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to change features" };

  const enabled: EnabledFeatures = { family: true, settings: true };
  for (const key of formData.getAll("features")) {
    if (typeof key === "string") enabled[key as keyof EnabledFeatures] = true;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_settings")
    .update({ enabled_features: enabled })
    .eq("household_id", account.household_id);
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { error: null };
}

export async function finishOnboardingAction(): Promise<void> {
  redirect("/dashboard");
}
```

- [ ] **Step 5: Write the wizard**

Create `app/onboarding/page.tsx` as a Server Component that reads current state and renders the correct step:

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { StepHousehold } from "@/components/onboarding/step-household";
import { StepMembers } from "@/components/onboarding/step-members";
import { StepFeatures } from "@/components/onboarding/step-features";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Search = { step?: string };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { step = "welcome" } = await searchParams;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  const { data: membership } = await supabase
    .from("household_members")
    .select("id, household_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Resumable: a returning user with a household skips straight past step 2.
  const effective = step === "welcome" && membership ? "members" : step;

  if (effective === "welcome") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 text-center">
        <h1 className="text-4xl">Welcome to Family Hub</h1>
        <p className="text-lg text-muted">Four short steps and your household is ready.</p>
        <Button asChild size="lg"><Link href="/onboarding?step=household">Get started</Link></Button>
      </main>
    );
  }

  if (effective === "household") return <StepHousehold />;

  if (!membership) redirect("/onboarding?step=household");

  if (effective === "members") {
    const { data: members } = await supabase
      .from("household_members")
      .select("id, display_name, role, color")
      .eq("household_id", membership.household_id)
      .order("created_at");
    return <StepMembers members={members ?? []} />;
  }

  if (effective === "features") return <StepFeatures />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 text-center">
      <h1 className="text-4xl">You're ready</h1>
      <p className="text-lg text-muted">Your household is set up. You can change any of this later in Settings.</p>
      <Button asChild size="lg"><Link href="/dashboard">Go to my dashboard</Link></Button>
    </main>
  );
}
```

Create the three step components as Client Components using `useActionState`, each navigating to the next step with `router.push` on success:

- `components/onboarding/step-household.tsx` — heading "Create your household", `Label htmlFor="name"` reading **Household name**, submit **Continue**, then `/onboarding?step=members`.
- `components/onboarding/step-members.tsx` — heading "Add your family", a list of existing members, a **Add a family member** button opening a `Dialog` with fields **Name** (`name="displayName"`), **Role** (a native `<select name="role">` with the four roles), **Color**, **Birthday**, a checkbox **They'll have their own login** (unchecked by default), and submit **Add member**. A **Continue** button goes to `/onboarding?step=features`.
- `components/onboarding/step-features.tsx` — heading "Choose your features", a checkbox per non-locked entry in `FEATURES` (locked ones rendered checked and disabled), submit **Continue**, then `/onboarding?step=ready`.

- [ ] **Step 6: Run the E2E test**

Run: `npm run test:e2e -- --project=desktop onboarding`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add five-step household onboarding wizard"
```

---

### Task 11: App shell and feature-driven navigation

**Files:**
- Create: `app/(app)/layout.tsx`, `components/shell/nav-items.ts`, `components/shell/sidebar.tsx`, `components/shell/bottom-nav.tsx`
- Test: `lib/__tests__/nav-items.test.ts`

**Interfaces:**
- Consumes: `FEATURES`, `EnabledFeatures`, `getActiveMember`, `requireAccountMembership`
- Produces: `navItemsFor(features: EnabledFeatures): NavItem[]`; type `NavItem = { href, label, icon, feature }`

- [ ] **Step 1: Write the failing navigation test**

Create `lib/__tests__/nav-items.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { navItemsFor } from "@/components/shell/nav-items";

describe("navItemsFor", () => {
  it("always includes home, family and settings", () => {
    const hrefs = navItemsFor({ family: true, settings: true }).map((i) => i.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/family");
    expect(hrefs).toContain("/settings");
  });

  it("omits features the household has not enabled", () => {
    const hrefs = navItemsFor({ family: true, settings: true }).map((i) => i.href);
    expect(hrefs).not.toContain("/meals");
    expect(hrefs).not.toContain("/calendar");
  });

  it("includes a feature as soon as its flag is on", () => {
    const hrefs = navItemsFor({ family: true, settings: true, meals: true }).map((i) => i.href);
    expect(hrefs).toContain("/meals");
  });

  it("keeps settings last", () => {
    const items = navItemsFor({ family: true, settings: true, meals: true, calendar: true });
    expect(items[items.length - 1]?.href).toBe("/settings");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- nav-items`
Expected: FAIL — cannot resolve `@/components/shell/nav-items`.

- [ ] **Step 3: Implement**

Create `components/shell/nav-items.ts`:

```ts
import { CalendarDays, Home, ListChecks, Settings, Sparkles, Users, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EnabledFeatures, FeatureKey } from "@/lib/constants/features";

export type NavItem = { href: string; label: string; icon: LucideIcon; feature: FeatureKey | null };

const ALL: NavItem[] = [
  { href: "/dashboard", label: "Home",     icon: Home,              feature: null },
  { href: "/calendar",  label: "Calendar", icon: CalendarDays,      feature: "calendar" },
  { href: "/meals",     label: "Meals",    icon: UtensilsCrossed,   feature: "meals" },
  { href: "/chores",    label: "Chores",   icon: ListChecks,        feature: "chores" },
  { href: "/habits",    label: "Habits",   icon: Sparkles,          feature: "habits" },
  { href: "/family",    label: "Family",   icon: Users,             feature: "family" },
  { href: "/settings",  label: "Settings", icon: Settings,          feature: "settings" },
];

export function navItemsFor(features: EnabledFeatures): NavItem[] {
  return ALL.filter((item) => item.feature === null || features[item.feature] === true);
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- nav-items`
Expected: PASS — 4 tests.

- [ ] **Step 5: Build the shell**

Create `app/(app)/layout.tsx` as a Server Component that loads the account membership and settings, then renders `Sidebar` (hidden below `md`) and `BottomNav` (hidden at `md` and above):

```tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveMember } from "@/lib/auth/active-member";
import { navItemsFor } from "@/components/shell/nav-items";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import type { EnabledFeatures } from "@/lib/constants/features";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, households(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: settings } = await supabase
    .from("household_settings")
    .select("enabled_features")
    .eq("household_id", membership.household_id)
    .maybeSingle();

  const features = (settings?.enabled_features ?? {}) as EnabledFeatures;
  const items = navItemsFor(features);
  const active = await getActiveMember();

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar items={items} householdName={membership.households?.name ?? "Family Hub"} activeMember={active} />
      <div className="flex-1 pb-24 md:pb-0">{children}</div>
      <BottomNav items={items} />
    </div>
  );
}
```

`Sidebar` is a Client Component (it needs `usePathname` for the active state): a fixed 260px column with the logo, household name, the nav list, the active member's avatar linking to `/switch`, and a `ThemeToggle` at the bottom. `BottomNav` is a Client Component rendering at most five items in a fixed bottom bar with `min-h-[44px]` targets, collapsing any overflow into a **More** entry linking to `/settings`.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run build`
Expected: PASS, clean build.

```bash
git add -A
git commit -m "feat: add app shell with feature-driven navigation"
```

---

### Task 12: Profile switcher and PIN gate

**Files:**
- Create: `app/switch/page.tsx`, `app/switch/actions.ts`, `components/switcher/pin-dialog.tsx`, `components/family/member-avatar.tsx`, `lib/auth/pin.ts`
- Test: `lib/__tests__/pin.test.ts`, `tests/e2e/switcher.spec.ts`

**Interfaces:**
- Consumes: `setActiveMember`, `requiresPin`, `requireAccountMembership`
- Produces: `hashPin(pin): Promise<string>`, `verifyPin(pin, hash): Promise<boolean>`, `switchToMemberAction(memberId, pin?)`

- [ ] **Step 1: Write the failing PIN test**

Create `lib/__tests__/pin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth/pin";

describe("pin hashing", () => {
  it("verifies a correct pin", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
  });

  it("rejects an incorrect pin", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("1234", hash)).toBe(false);
  });

  it("never stores the pin in plaintext", async () => {
    const hash = await hashPin("4821");
    expect(hash).not.toContain("4821");
  });

  it("produces a different hash for the same pin each time", async () => {
    expect(await hashPin("4821")).not.toBe(await hashPin("4821"));
  });

  it("returns false for a null hash rather than throwing", async () => {
    expect(await verifyPin("4821", null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- pin`
Expected: FAIL — cannot resolve `@/lib/auth/pin`.

- [ ] **Step 3: Implement**

```bash
npm i bcryptjs && npm i -D @types/bcryptjs
```

Create `lib/auth/pin.ts`:

```ts
import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- pin`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write the switch action**

Create `app/switch/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership, setActiveMember } from "@/lib/auth/active-member";
import { requiresPin } from "@/lib/auth/permissions";
import { verifyPin } from "@/lib/auth/pin";

export type SwitchState = { error: string | null };

export async function switchToMemberAction(_prev: SwitchState, formData: FormData): Promise<SwitchState> {
  const memberId = String(formData.get("memberId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  // RLS restricts this read to the caller's household, so a foreign id yields nothing.
  const { data: target } = await supabase
    .from("household_members")
    .select("id, role, pin_hash, household_id")
    .eq("id", memberId)
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!target) return { error: "That profile is not available" };

  if (requiresPin(target.role)) {
    if (!pin) return { error: "This profile needs a PIN" };
    if (!(await verifyPin(pin, target.pin_hash))) return { error: "Incorrect PIN" };
  }

  await setActiveMember(target.id);
  redirect("/dashboard");
}
```

Switching never grants privileges — it only changes attribution. Every privileged action independently re-reads the account's own role.

- [ ] **Step 6: Build the switcher UI**

Create `components/family/member-avatar.tsx` — a Server-safe component rendering a circle filled with the member's `color`, showing `avatar_url` when present and otherwise the first initial of `display_name`, with `size` prop (`sm` 40px, `md` 64px, `lg` 96px) and an `aria-hidden` decorative flag.

Create `app/switch/page.tsx` — a full-screen grid of every active member in the household. Each tile is a `<form>` posting `memberId`. Tiles whose role does not require a PIN submit directly; tiles that do open `PinDialog`. Minimum tile size 120px, tap targets well past 44px.

Create `components/switcher/pin-dialog.tsx` — a Client Component wrapping shadcn `Dialog` with a 4-digit `inputMode="numeric"` field labelled **PIN**, an `role="alert"` error region, and a **Unlock** submit.

- [ ] **Step 7: Write and run the E2E test**

Create `tests/e2e/switcher.spec.ts` asserting: after onboarding, visiting `/switch` shows both the owner and the child; clicking the child's tile lands on `/dashboard` with the child's name shown in the shell; clicking the owner's tile opens a PIN dialog; a wrong PIN shows "Incorrect PIN" and does not switch.

Run: `npm run test:e2e -- --project=desktop switcher`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add profile switcher with PIN-gated admin profiles"
```

---

### Task 13: Family screens and member management

**Files:**
- Create: `app/(app)/family/page.tsx`, `app/(app)/family/[memberId]/page.tsx`, `app/(app)/family/actions.ts`, `components/family/member-form.tsx`, `components/family/member-grid.tsx`
- Test: `tests/e2e/family.spec.ts`

**Interfaces:**
- Consumes: `memberSchema`, `canManageMembers`, `requireAccountMembership`, `MemberAvatar`
- Produces: `updateMemberAction`, `deactivateMemberAction`, `setPinAction`

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/family.spec.ts` asserting: a parent sees every member on `/family`; opening a member shows name, role and birthday; editing the name persists after reload; a member can be deactivated and disappears from the grid; and — the security assertion — after switching to the child profile, `/settings/members` does **not** offer edit controls.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- --project=desktop family`
Expected: FAIL — `/family` 404s.

- [ ] **Step 3: Write the actions**

Create `app/(app)/family/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import { memberSchema, pinSchema } from "@/lib/validation/schemas";
import { hashPin } from "@/lib/auth/pin";

export type MemberState = { error: string | null };

export async function updateMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const memberId = String(formData.get("memberId") ?? "");
  const parsed = memberSchema.omit({ hasLogin: true, email: true }).safeParse({
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    color: formData.get("color"),
    birthday: formData.get("birthday") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const account = await requireAccountMembership();
  const isSelf = account.id === memberId;

  // Authority: admins may edit anyone; everyone else may edit only their own presentation.
  if (!canManageMembers(account.role) && !isSelf) {
    return { error: "You do not have permission to edit this member" };
  }

  const patch = canManageMembers(account.role)
    ? {
        display_name: parsed.data.displayName,
        role: parsed.data.role,
        color: parsed.data.color,
        birthday: parsed.data.birthday || null,
      }
    : { display_name: parsed.data.displayName, color: parsed.data.color };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update(patch)
    .eq("id", memberId)
    .eq("household_id", account.household_id);
  if (error) return { error: error.message };

  revalidatePath("/family");
  return { error: null };
}

export async function deactivateMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const memberId = String(formData.get("memberId") ?? "");
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to remove members" };
  if (memberId === account.id) return { error: "You cannot remove yourself" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update({ is_active: false })
    .eq("id", memberId)
    .eq("household_id", account.household_id);
  if (error) return { error: error.message };

  revalidatePath("/family");
  return { error: null };
}

export async function setPinAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const parsed = pinSchema.safeParse({ pin: formData.get("pin") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a 4-digit PIN" };

  // A member may only ever set their own PIN.
  const account = await requireAccountMembership();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update({ pin_hash: await hashPin(parsed.data.pin) })
    .eq("id", account.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}
```

The role restriction on non-admins is enforced here because Postgres policies cannot restrict columns; `members_update_self` guarantees the row is theirs, and this action guarantees the fields are safe.

- [ ] **Step 4: Build the screens**

`app/(app)/family/page.tsx` — a Server Component listing active members as `MemberGrid` cards: avatar, name, role label, birthday, points balance. An **Add member** button renders only when `canManageMembers(account.role)`.

`app/(app)/family/[memberId]/page.tsx` — member detail with `MemberForm`. Fields that a non-admin cannot change are rendered `disabled` with an explanatory line, so the UI matches what the server will actually allow.

Every list needs the spec's empty-state treatment — never a bare "No members." Use: heading "No one here yet.", body "Add the people who live in your household.", and an **Add a family member** button.

- [ ] **Step 5: Run the E2E test**

Run: `npm run test:e2e -- --project=desktop family`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add family screens and member management"
```

---

### Task 14: Invitations and the claim flow

This is where the hybrid identity model pays off: a child who has used the app for months gains a login without losing a single point.

**Files:**
- Create: `app/(app)/settings/members/page.tsx`, `app/(app)/settings/invites/actions.ts`, `app/invite/[token]/page.tsx`
- Test: `supabase/tests/030_claim.sql`, `tests/e2e/claim.spec.ts`

**Interfaces:**
- Consumes: `accept_invite` RPC (Task 6), `canInvite`
- Produces: `createInviteAction(memberId?, role, email?) → { token }`, `revokeInviteAction(inviteId)`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/030_claim.sql` asserting that a claim invitation cannot be accepted twice (second call raises), that an expired invitation raises, and that accepting a claim invitation for a member row that already has a `user_id` raises `profile already claimed`. Follow the setup pattern from `020_bootstrap.sql`, with `select plan(3);` and matching `throws_ok` assertions.

- [ ] **Step 2: Run it and watch it fail, then confirm it passes**

```bash
npx supabase test db
```

Expected: these three assertions pass against the Task 6 implementation. If any fail, the guard clauses in `accept_invite` are wrong — fix `0003_rpc.sql` and add a migration rather than editing the applied one if it has already been pushed anywhere.

- [ ] **Step 3: Write the invite action**

Create `app/(app)/settings/invites/actions.ts`:

```ts
"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canInvite } from "@/lib/auth/permissions";
import { roleSchema } from "@/lib/validation/schemas";

export type InviteState = { error: string | null; token: string | null };

export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const account = await requireAccountMembership();
  if (!canInvite(account.role)) return { error: "You do not have permission to invite", token: null };
  // requireAccountMembership resolves by user_id, so this is non-null — narrowing it for the FK.
  if (!account.user_id) return { error: "You do not have permission to invite", token: null };

  const parsedRole = roleSchema.safeParse(formData.get("role"));
  if (!parsedRole.success) return { error: "Choose a role", token: null };

  const rawMemberId = formData.get("memberId");
  const memberId = typeof rawMemberId === "string" && rawMemberId ? rawMemberId : null;

  // The raw token is shown once and never stored; only its SHA-256 hash is persisted.
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const supabase = await createServerClient();
  const { error } = await supabase.from("household_invites").insert({
    household_id: account.household_id,
    role: parsedRole.data,
    member_id: memberId,
    token_hash: tokenHash,
    email: (formData.get("email") as string) || null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: account.user_id,
  });
  if (error) return { error: error.message, token: null };

  revalidatePath("/settings/members");
  return { error: null, token };
}
```

`accept_invite` hashes the presented token with the same `sha256` and matches on `token_hash`, so the two must stay in step — `encode(digest(p_token,'sha256'),'hex')` in SQL equals `createHash("sha256").update(token).digest("hex")` in Node.

- [ ] **Step 4: Build the claim page**

`app/invite/[token]/page.tsx` — public (already in `PUBLIC_PATHS`). When signed out, it explains the invitation and sends the user to `/signup?next=/invite/<token>`. When signed in, it calls `accept_invite` and redirects to `/dashboard` on success, or renders the specific failure (expired, already used, already claimed) with a way forward.

`app/(app)/settings/members/page.tsx` — lists members with, for each login-less member, an **Invite them to log in** button that creates a claim invitation and displays the resulting link once, with a copy button and a clear warning that it will not be shown again.

- [ ] **Step 5: Write and run the E2E test**

Create `tests/e2e/claim.spec.ts`: as a parent, create a claim invitation for the login-less child; copy the link; sign out; open the link; sign up as a new account; confirm the dashboard shows the child's name and that the child's points balance is unchanged.

Run: `npm run test:e2e -- --project=desktop claim`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add invitations and profile claim flow"
```

---

### Task 15: Settings

**Files:**
- Create: `app/(app)/settings/page.tsx`, `app/(app)/settings/household/page.tsx`, `app/(app)/settings/appearance/page.tsx`, `app/(app)/settings/actions.ts`
- Test: `tests/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `canEditSettings`, `setPinAction`, `ThemeToggle`, `FEATURES`
- Produces: `updateHouseholdAction`, `updateFeaturesAction`

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/settings.spec.ts` asserting: a parent can rename the household and the new name appears in the sidebar; enabling the Meals feature makes a **Meals** entry appear in navigation; the theme toggle switches the `<html>` class between `light` and `dark`; and after switching to the child profile, `/settings/household` renders read-only with no save control.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- --project=desktop settings`
Expected: FAIL — settings routes 404.

- [ ] **Step 3: Implement**

`app/(app)/settings/actions.ts` follows the exact shape of Task 13's actions: parse with Zod, load `requireAccountMembership()`, gate on `canEditSettings(account.role)`, update scoped by `household_id`, `revalidatePath`.

`updateFeaturesAction` must always force `family: true` and `settings: true` regardless of submitted values — those two are marked `locked` in `FEATURES` and disabling them would strand the user with no navigation.

The three pages: `/settings` is an index of cards linking onward plus a **Set your PIN** control wired to `setPinAction`; `/settings/household` edits name, timezone, week start, and the feature toggles; `/settings/appearance` hosts `ThemeToggle` and the household accent override.

- [ ] **Step 4: Run the E2E test**

Run: `npm run test:e2e -- --project=desktop settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add household, appearance, and member settings"
```

---

### Task 16: Dashboard home screen

Deliberately a static, purposeful home screen. The configurable widget grid is SP5 — do not build a layout engine here.

**Files:**
- Create: `app/(app)/dashboard/page.tsx`, `components/dashboard/greeting.tsx`, `components/dashboard/family-strip.tsx`
- Test: `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `getActiveMember`, `requireAccountMembership`, `MemberAvatar`
- Produces: nothing consumed by later SP1 tasks

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/dashboard.spec.ts` asserting: the dashboard greets by household name; it renders a time-appropriate greeting; every active member appears in the family strip; each disabled feature shows a "coming soon" placeholder card rather than an empty region; and the page has exactly one `<h1>`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- --project=desktop dashboard`
Expected: FAIL.

- [ ] **Step 3: Implement**

`components/dashboard/greeting.tsx` — a pure function `greetingFor(hour: number): "Good morning" | "Good afternoon" | "Good evening"` plus its rendering. Add `lib/__tests__/greeting.test.ts` covering hour 5, 11, 12, 17, 18, 23 and 0 so the boundaries are pinned rather than assumed.

`app/(app)/dashboard/page.tsx` — Server Component: greeting with household name, today's date in the household timezone, the family strip of avatars linking to `/switch`, and one placeholder card per disabled feature reading e.g. "Meals arrive soon — turn it on in Settings when you're ready."

- [ ] **Step 4: Run tests**

Run: `npm test && npm run test:e2e -- --project=desktop dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dashboard home screen"
```

---

### Task 17: Logo assets and PWA

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png`, `public/favicon.ico`, `public/logo.svg`, `public/logo-mono.svg`, `app/manifest.ts`, `app/offline/page.tsx`, `public/sw.js`, `components/pwa/register-sw.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `assets/logo-concepts/c6-monogram.svg`
- Produces: an installable manifest and a registered service worker

- [ ] **Step 1: Clean the chosen mark**

The generated SVG has a cream background rect baked in. Produce two production files:

```bash
mkdir -p public/icons
cp assets/logo-concepts/c6-monogram.svg public/logo.svg
```

Open `public/logo.svg` and delete the full-bleed `<rect>` whose fill is `#FBF7F1` (or any near-cream value) so the mark is transparent. Then create `public/logo-mono.svg` as a copy with every `fill` attribute replaced by `currentColor`, for use on dark backgrounds and at small sizes.

- [ ] **Step 2: Generate the raster icon set**

```bash
magick -background none public/logo.svg -resize 192x192 public/icons/icon-192.png
magick -background none public/logo.svg -resize 512x512 public/icons/icon-512.png
magick -background "#FBF7F1" public/logo.svg -resize 410x410 -gravity center -extent 512x512 public/icons/maskable-512.png
magick -background "#FBF7F1" public/logo.svg -resize 180x180 public/icons/apple-touch-icon.png
magick -background none public/logo.svg -resize 32x32 public/favicon.ico
```

The maskable icon needs the mark inset to roughly 80% of the canvas — Android crops maskable icons to arbitrary shapes and a full-bleed mark loses its edges.

- [ ] **Step 3: Write the failing E2E test**

Create `tests/e2e/pwa.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("serves a valid web manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.name).toBe("Family Hub");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
});

test("serves the icons the manifest promises", async ({ request }) => {
  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) {
    expect((await request.get(path)).ok()).toBe(true);
  }
});

test("serves an offline fallback page", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npm run test:e2e -- --project=desktop pwa`
Expected: FAIL — no manifest route.

- [ ] **Step 5: Implement the manifest**

Create `app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Hub",
    short_name: "Family Hub",
    description: "One home for your family's meals, plans, and days.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F1",
    theme_color: "#FBF7F1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 6: Add the service worker**

Create `public/sw.js`:

```js
const CACHE = "family-hub-shell-v1";
const SHELL = ["/offline", "/icons/icon-192.png", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Navigation requests only. Household data is deliberately never cached in SP1 —
// staleness and privacy trade-offs belong to the sub-projects that own that data.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
});
```

Create `components/pwa/register-sw.tsx` as a Client Component registering `/sw.js` in a `useEffect` guarded by `"serviceWorker" in navigator` and `process.env.NODE_ENV === "production"`, and mount it in `app/layout.tsx`.

Create `app/offline/page.tsx` with an `<h1>` reading "You're offline" and body text explaining that Family Hub will reconnect on its own.

- [ ] **Step 7: Run the tests**

Run: `npm run build && npm run test:e2e -- --project=desktop pwa`
Expected: PASS — 3 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add production logo assets and PWA manifest with offline fallback"
```

---

### Task 18: Seed data

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Consumes: schema from Tasks 4–6
- Produces: a demo household so every screen has real content on `supabase db reset`

- [ ] **Step 1: Write the seed**

Create `supabase/seed.sql` inserting one confirmed auth user (`demo@familyhub.local`, password `demo-password-123`, via `auth.users` with a bcrypt `encrypted_password`), letting the Task 6 trigger create the profile, then one household "The Rivera Family", its settings row with `{"family":true,"settings":true,"calendar":true}`, and four members: an owner with a PIN hash for `1234`, a parent, a teen with a `user_id` of null, and a child with `points_balance` 250 and null `user_id`.

Every member needs a distinct `color` drawn from the warm palette so the family strip and switcher look right immediately.

- [ ] **Step 2: Verify**

```bash
npx supabase db reset
npx supabase test db
```

Expected: reset applies migrations then the seed with no errors; all pgTAP suites still pass (they run in their own transactions and roll back, so seed rows do not affect counts — if a count assertion breaks, the test is reading global state and must be scoped to its own fixture household).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add demo household seed data"
```

---

### Task 19: Full E2E suite across four widths

**Files:**
- Modify: `tests/e2e/*.spec.ts`
- Create: `tests/e2e/responsive.spec.ts`, `tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: every prior task
- Produces: a green suite at phone, tablet, desktop and kitchen widths

- [ ] **Step 1: Write the responsive test**

Create `tests/e2e/responsive.spec.ts` asserting: at phone width the bottom navigation is visible and the sidebar is not; at desktop width the sidebar is visible and the bottom navigation is not; and — the check that catches the most real bugs — `document.documentElement.scrollWidth` never exceeds `window.innerWidth` on `/dashboard`, `/family`, `/settings` and `/switch`, so nothing overflows horizontally at any width.

- [ ] **Step 2: Write the accessibility test**

```bash
npm i -D @axe-core/playwright
```

Create `tests/e2e/a11y.spec.ts` running axe against `/welcome`, `/login`, `/dashboard`, `/family`, `/switch` and `/settings` in both light and dark, failing on any `serious` or `critical` violation. Dark mode is toggled by setting the `class` on `<html>` before the scan.

- [ ] **Step 3: Run the whole suite on every project**

Run: `npm run test:e2e`
Expected: PASS across all four projects. Fix real failures; do not weaken an assertion to make it green.

- [ ] **Step 4: Run the design review passes**

Invoke the `web-interface-guidelines` skill against the changed UI files and address its findings. Then invoke `impeccable` for a visual and interaction-quality pass on `/dashboard`, `/switch`, `/family` and onboarding, at phone and kitchen widths, in both themes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add responsive and accessibility coverage across four widths"
```

---

### Task 20: Google sign-in

**Blocked** until the user supplies Google Cloud OAuth credentials. Every other task can complete without it; do this one when the credentials exist.

**Files:**
- Modify: `supabase/config.toml`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`
- Create: `components/auth/google-button.tsx`

**Interfaces:**
- Consumes: `createBrowserClient` (Task 7), `app/auth/callback/route.ts` (Task 9)
- Produces: a working Google OAuth sign-in on both auth pages

- [ ] **Step 1: Collect the credentials**

Ask the user for the OAuth **client ID** and **client secret** from Google Cloud Console, with authorized redirect URI `http://127.0.0.1:54321/auth/v1/callback` for local and `https://<project-ref>.supabase.co/auth/v1/callback` for production.

- [ ] **Step 2: Configure Supabase**

In `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_SECRET)"
```

Add `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` to `.env.local` and `.env.local.example` (placeholder values only in the example). Restart: `npx supabase stop && npx supabase start`.

- [ ] **Step 3: Add the button**

Create `components/auth/google-button.tsx`:

```tsx
"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleButton({ next = "/" }: { next?: string }) {
  async function signInWithGoogle() {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={signInWithGoogle}>
      Continue with Google
    </Button>
  );
}
```

Mount it on both auth pages beneath a divider reading "or".

- [ ] **Step 4: Verify manually**

Run `npm run dev`, click **Continue with Google**, complete consent, and confirm you land on `/onboarding` (new account) or `/dashboard` (returning). The `handle_new_user` trigger derives `display_name` from Google's metadata; confirm the profile row has a sensible name rather than an email prefix.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Google sign-in"
```

---

### Task 21: Deploy

**Files:**
- Create: `.env.production.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything
- Produces: a live URL backed by a hosted Supabase project

- [ ] **Step 1: Provision the cloud project**

Create a Supabase project named `family-hub` in the `Crypthouse` organisation (`ibgcsnmeotvzclxzntds`). One free slot is available; cost is $0/month. Record the project ref, URL, and anon key.

- [ ] **Step 2: Push migrations**

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Expected: `0001`, `0002` and `0003` apply in order. **Do not run the seed against production.**

- [ ] **Step 3: Verify RLS in the hosted database**

```bash
npx supabase test db --linked
```

Expected: every pgTAP suite passes against hosted Postgres. A policy that behaves differently here than locally means an environment-dependent assumption — find it before shipping, not after.

- [ ] **Step 4: Deploy**

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add ACTIVE_MEMBER_COOKIE_SECRET production
npx vercel --prod
```

Generate the cookie secret with `openssl rand -base64 32`. It must differ from the local value.

- [ ] **Step 5: Verify against production**

Run the smoke path by hand on the deployed URL: sign up, onboard, add a login-less child, switch profiles, install to a phone home screen, and confirm the installed app opens standalone with the FH icon.

- [ ] **Step 6: Update the README**

Replace `README.md` with setup instructions: prerequisites (Node 26, Docker), `npm install`, `npx supabase start`, copying `.env.local.example`, `npm run dev`, and how to run each test suite.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add deployment configuration and setup documentation"
```

---

## Definition of Done

Mirrors §13 of the spec. SP1 is complete when all of these hold:

- [ ] `npx supabase db reset` applies all migrations and the seed from empty with no errors
- [ ] `npx supabase test db` passes, including cross-household isolation
- [ ] A user can sign up, onboard, and land on a populated dashboard
- [ ] A parent can add a login-less child and a teen with a login
- [ ] A teen can accept a claim invitation and retain their member row and points
- [ ] Profile switching works; PIN gates owner and parent profiles
- [ ] Light, dark and system themes render correctly on every screen
- [ ] The app installs as a PWA and serves `/offline` when disconnected
- [ ] `npm run test:e2e` passes on all four projects
- [ ] Deployed to Vercel against the hosted Supabase project
