# Hearth — Design Specification v1.0

> Imported from the Claude Design project "Family hub PWA mockups"
> (`design_handoff_hearth/Design Spec.md`) on 2026-08-26. **This file is the authoritative
> design reference for this codebase.** Where a mockup and this spec disagree, follow the spec.
> Where this spec and an earlier decision in `docs/superpowers/` disagree, follow this spec —
> it supersedes the warm-cream/terracotta identity SP1 was originally built against.
>
> Rendered mockups live in `./mockups/` as `<mock-id>.png` (e.g. `2a.png`), captured from
> `./mockups/Family_Hub_Mockups.dc.html`.
>
> **One correction to the source:** the spec and mockups describe Ivy as age 2 (born May 2024).
> Her real birthdate is **2025-12-18**, so every age-derived string must be computed from that,
> not copied from the mocks. As of 2026-08-26 she is 8 months old — an infant, not a toddler.

Family hub PWA · Garthwaite household (Cody, Elizabeth, Ivy) · Whitewater, WI
Stack: Next.js on Vercel + Supabase. Companion doc: `Build-Prompt.md`.

---

## 1. Design principles

1. **Calm, glanceable, Apple-grade.** Large type, generous whitespace, one accent color, no decoration that isn't information.
2. **Dark-first.** The home context is evenings and a kitchen wall display. Light theme is a first-class sibling, not an afterthought.
3. **Airy density.** Fewer, bigger widgets. Max 5–6 widgets on a dashboard screen; everything else lives in the widget drawer.
4. **Glass over aurora.** Surfaces are translucent frosted cards over a subtle blue radial glow. Depth from blur + borders, not heavy shadows.
5. **Playful accents only.** Celebrations (confetti, streak flames, reward moments) are the only playful moments. Chrome stays serious.
6. **Everything glanceable is tappable.** Every widget deep-links to its full screen.

---

## 2. Color system

Single accent: **Blue #0A84FF**. Never introduce a second accent; member identity colors and semantic colors are the only other hues.

### 2.1 Semantic tokens

| Token | Dark (default) | Light |
|---|---|---|
| `bg/base` | `#0C0D10` | `#F5F5F7` |
| `bg/base-deep` (wall mode) | `#08090C` | — |
| `bg/aurora` | radial `rgba(10,132,255,.18)` top-left + `.08` top-right, over base | radial `rgba(120,170,255,.25)` + `rgba(140,235,190,.22)` |
| `surface/card` | `rgba(255,255,255,.055)` + blur 20px | `rgba(255,255,255,.75)` + blur 20px |
| `surface/card-hover` | `rgba(255,255,255,.08)` | `rgba(255,255,255,.9)` |
| `surface/inset` (rows inside cards) | `rgba(255,255,255,.05)` | `#FFFFFF` |
| `border/card` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.05)` |
| `border/dashed` (empty slots, up-for-grabs) | `rgba(255,255,255,.18)` dashed 1.5px | `rgba(0,0,0,.18)` dashed 1.5px |
| `text/primary` | `#FFFFFF` | `#1D1D1F` |
| `text/secondary` | `rgba(255,255,255,.5)` | `#6E6E73` |
| `text/tertiary` | `rgba(255,255,255,.35)` | `#8A877F` |
| `accent` | `#0A84FF` | `#0A84FF` (text-on-light: `#0A6CD6`) |
| `accent/text` (links, "Claim") | `#6FB4FF` | `#0A6CD6` |
| `accent/tint` (highlight cards) | gradient `rgba(10,132,255,.16)→.04`, border `rgba(10,132,255,.25)` | `#EEF2FB`, border `rgba(10,132,255,.3)` |
| `success` | `#34C759` | `#2F7D3B` |
| `warning` | `#FF9500` | `#A3691F` |
| `danger` | `#FF453A` | `#D70015` |
| `star/points` | `#FFD60A` | `#FF9500` |

### 2.2 Member identity colors
Fixed per person, used for avatars, calendar event bars, chore dots. Pastel so they read on both themes:
- Cody `#B6E6B0` · Elizabeth `#F3B3D4` · Ivy `#FFD08A` · (future members pick from: `#9AD0FF`, `#C9B8F5`, `#F5D48A`)
- Event color bars: 3–4px rounded bar in member color; event fill = member color at 12% opacity.

### 2.3 Rules
- Whites/blacks are subtly toned, never pure `#000` page backgrounds (wall mode `#08090C` is the darkest).
- Semantic colors appear only as text/small fills, never large surfaces.
- Photos and food imagery are the only saturated areas — let them carry color.

---

## 3. Typography

Font: **system stack** — `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif`. No webfonts. Tabular numerals (`font-variant-numeric: tabular-nums`) for times, timers, money.

| Style | Size/weight | Tracking | Use |
|---|---|---|---|
| Display XL | 64/700 | -0.03em | Wall-mode clock |
| Display | 42/700 | -0.03em | Dashboard greeting (desktop) |
| Title 1 | 30/700 | -0.02em | Screen titles (desktop) |
| Title 2 | 26/700 | -0.02em | Screen titles (phone), cook-mode step text |
| Title 3 | 20/700 | -0.01em | Featured card headings |
| Headline | 15/600 | 0 | Widget titles, row primary text (desktop) |
| Body | 13–14/500–600 | 0 | Row text (phone 14, desktop 13) |
| Caption | 11–12/400–600 | 0 | Secondary metadata |
| Overline | 11–13/700 | +0.06–0.08em, uppercase | Section labels (`UP FOR GRABS`, `TONIGHT · 6:30`) |
| Numeric | 44–52/700, tabular | -0.02em | Timers, temperature, big stats |

Greeting is time-aware: "Good morning / afternoon / evening, {firstName}." Subline is a generated daily summary sentence (events left · dinner status · Ivy's nap).

---

## 4. Layout, spacing, shape

- **Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 / 28 / 40. Gaps between widgets: 18px desktop, 12–16px phone.
- **Radius scale:** 8 (event blocks) · 12 (inset rows, thumbnails) · 16 (small tiles) · 20–24 (cards/widgets) · 26 (wall tiles) · 99px (pills, buttons, chips, avatars).
- **Blur:** `backdrop-filter: blur(20px)` on all glass surfaces.
- **Shadows:** essentially none on dark (borders carry depth). Light theme: `0 1px 3px rgba(0,0,0,.06)`. Floating dock: `0 8px 30px rgba(0,0,0,.5)`.
- **Breakpoints:** phone < 640 · tablet 640–1024 · desktop > 1024 · wall mode = fullscreen landscape kiosk route.
- **Desktop grid:** 12-col, max-width 1140, margins 40px. Dashboard rows use asymmetric spans (e.g. 1.25fr/1fr) — avoid uniform 3-up monotony.
- **Phone:** single column, 18px margins, cards full-width; content bottom-padded 96px to clear the dock.
- **Hit targets:** ≥ 44×44px everywhere; wall mode ≥ 56px.

---

## 5. Navigation

### Desktop
Top bar, transparent over aurora: logo mark (32px blue rounded square "H") + wordmark left; center links `Home · Meals · Calendar · Chores · Ivy · Photos · Budget`; right: weather pill + stacked family avatars. Active link = `text/primary`, inactive = `text/secondary`. No underlines; 200ms color transition.

### Phone — floating dock
Pill dock, bottom-center, 18px above safe-area: `rgba(28,29,34,.85)` + blur 20px + border `rgba(255,255,255,.1)`. Five 48px circular items (Home, Meals, Cal, Chores, Ivy); active item = filled `#0A84FF` circle, white icon+label (9px/700); inactive 50% white. Dock hides on scroll-down, returns on scroll-up (250ms spring). Overflow screens (Photos, Budget, Settings) via profile avatar top-right → sheet.

### Wall mode
No nav. Clock + weather header, 3 glance tiles, family footer. Wakes on motion, dims after 5 min. Tap anywhere → dashboard.

---

## 6. Core components

### Buttons
- **Primary:** filled `#0A84FF`, white 13/700 text, pill, padding 10×18 (14×28 phone-primary). Hover: brightness 1.1. Active: scale .97.
- **On-tint primary** (inside blue-tinted cards): filled white, dark text.
- **Secondary:** `rgba(255,255,255,.08)` fill + `border/card`, white 13/600.
- **Ghost/text:** accent-text color, 12–13/700, no fill (e.g. "Cook mode →").
- **Destructive:** ghost in `danger`; confirm via sheet, never instant.
- Disabled: 40% opacity, no pointer events.

### Forms & inputs
All inputs share: `surface/inset` fill, `border/card` 1px, radius 14, height 48 (44 desktop), 15px text, placeholder = `text/tertiary`.
- **Focus:** border `#0A84FF` 1.5px + ring `0 0 0 3px rgba(10,132,255,.25)`. Never remove focus outlines.
- **Error:** border `danger`, 12px caption below in `danger`, icon optional. Validate on blur, revalidate on change.
- **Label:** 12/600 `text/secondary`, 6px above field. No floating labels.
- **Text area:** min 3 rows. **Select:** native on phone, custom popover desktop. **Stepper** (servings, points): − / value / + pill group, 44px targets.
- **Toggle:** iOS-style 51×31, green `success` when on. **Checkbox:** 22px circle; checked = `success` fill + white ✓ (used for routines/steps). **Radio/segmented:** pill segmented control — container `rgba(255,255,255,.08)` pill, active segment = white fill + dark text (see calendar Week/Month, Agenda/Week).
- **Search:** pill, leading magnifier, appears in Recipes, Photos, Calendar.
- **URL import field:** paste field + primary "Import" button; on parse shows a preview card (photo, title, detected macros) with editable fields before saving.
- **Date/time:** native pickers on phone; inline calendar popover on desktop.
- **PIN pad (profile switch):** 4-digit, large 64px keys, dots feedback.

### Cards / widgets
Standard widget: glass card, radius 24, padding 24–26. Header row = Headline title left + Caption meta right. One widget per screen may be **featured** (accent-tint gradient card) — on the dashboard that's Tonight's Dinner.

### Chips / macro pills
Pill, 11–12/600. On glass: `rgba(255,255,255,.12)` white text. On light: tinted pastels (`#EEF6EE`/green text etc.). Macro pills always ordered: kcal · protein · carbs · fat · time.

### Lists & rows
Row = 12–14px gap flex: leading element (color bar / avatar / checkbox) + primary/secondary text stack + trailing meta. Completed rows: 45% opacity + line-through primary text. Row press: background lightens 4%, 150ms.

### Avatars
Circle, member identity color fill (initial optional at ≥36px). Stacks overlap −8px with 2px bg-color ring. Ivy may show 🧸 at large sizes only.

### Progress
- Linear: 5–6px pill track (`rgba(255,255,255,.1)` / `#E8E6E1`), fill = accent (over-budget → `warning`).
- Step progress (cook mode): equal segments 3px; done = `success`, current = white, upcoming = 15% white.
- Streak: 10px rounded squares, `success` filled per done day; flame 🔥 + count in `warning` for streaks ≥ 7.

### Overlays
- **Sheet (phone):** bottom sheet, radius 28 top, grabber, `bg/base` + blur; used for create/edit forms, chore detail, event detail.
- **Modal (desktop):** centered 480–560px glass card, dim `rgba(0,0,0,.5)`.
- **Toast:** top-center pill, glass, 3s, icon + one line ("Chore claimed · ★10").
- **Confirm:** sheet/modal with destructive action in `danger`, cancel secondary.

### Empty states
Dashed-border card (`border/dashed`), centered: one-line prompt in `text/secondary` + accent action ("+ Add meal"). No illustrations, no mascots.

### Loading
Skeletons: card shapes at `rgba(255,255,255,.04)` with 1.2s shimmer. Never spinners for content; spinner only for actions (inside the pressed button, 16px).

### Celebration (the one playful moment)
Full-screen confetti burst (member color + gold, ~1.2s, respects reduced-motion → static burst) + haptic + short chime (mutable). Triggers: reward redeemed, points milestone, streak milestone, chore claimed by a kid. Reward banner: warm gradient (`rgba(255,214,10,.14)→rgba(243,179,212,.12)`) card with 🎉, message, Redeem button.

---

## 7. Motion — "alive by default"

The app should feel gently alive: ambient movement you sense more than see, plus responsive micro-interactions. Rule of thumb — ambient motion is **slow (8–30s loops), low-amplitude, and never moves text**; interactive motion is fast springs.

### 7.1 Foundations
- Springs everywhere: ~`cubic-bezier(0.32, 0.72, 0, 1)`, 250–350ms. Micro-interactions 150ms ease-out.
- Page transitions: phone = 300ms slide-over; desktop = 200ms crossfade + 8px rise.
- Widget rearrange: long-press → lift (scale 1.03 + shadow) → drag; others reflow with spring.
- Numbers (points, budget, temperature) animate count-up 400ms on change.
- Claim button → success morph: pill fills `success`, ✓, then row moves to Assigned (400ms).

### 7.2 Ambient (always running, GPU-cheap)
- **Aurora drift:** the background radial glows slowly translate/scale (~30s loop, ±4%) — the signature "alive" cue on dashboard and wall mode.
- **Weather widget:** condition-aware micro-scene — sun glyph slowly rotates rays (20s), clouds drift 2–3px, rain ticks. Wall mode gets the larger version.
- **Streak flame:** subtle 1.5s flicker (scale/opacity ±5%).
- **Photos widget:** crossfades to a new photo every 12s (Ken Burns ≤ 2% zoom).
- **Cook-mode timer:** soft breathing glow behind the countdown in the final 60s; pulses `warning` at 0.
- **Live dot:** realtime-connected screens show a 2px breathing dot next to the clock/title (3s cycle).
- Max 2–3 ambient animations visible per screen; pause all when tab is hidden (`visibilitychange`) to save battery.

### 7.3 Entrance & feedback
- **Staggered widget entrance:** on dashboard load, cards fade + rise 12px, 40ms stagger, once per session (not on back-nav).
- **Hover (desktop):** cards lift 2px + border brightens; buttons brighten; list rows tint 4%.
- **Press:** scale .97 on all tappables; haptic tick on phone for claims, checks, timer buttons.
- **Checklist check:** circle fills with a 250ms radial wipe + ✓ draws in; bedtime routine's last check triggers a tiny star-puff (not full confetti).
- **New realtime item** (event added, chore claimed by someone else): row slides in with a 1s accent-tint highlight that fades.
- **Pull-to-refresh (phone):** logo "H" mark draws its stroke as the spinner.
- **Tab switch (dock):** active circle morphs position with a spring; icon does a 1-frame bounce.

### 7.4 Restraint
- `prefers-reduced-motion`: kill all ambient motion and staggers; keep 150ms opacity fades only.
- Never animate layout during reading (no marquees, no auto-scrolling lists); news/schedule content is static.
- One celebration at a time; ambient motion pauses during confetti.

---

## 8. Screens

### 8.1 Dashboard (Home) — ref 2a / 2f
- Header greeting (time-aware) + daily summary line.
- Default widgets: **Today's schedule, Tonight's dinner + macros (featured), Weather, Photos, Local news**. Optional from drawer: Chores, Ivy tracker, Budget, Habits.
- **Widget system:** per-user layout stored as jsonb. "Edit widgets" dashed pill at page bottom → edit mode: cards jiggle subtly (2° rotate alternating), ⊖ remove badges, "+ Add" opens drawer of remaining widgets with previews. Sizes: 1×1, 2×1, 2×2 (desktop grid); phone stacks in order.
- Schedule widget: next 3 events, member color bar + dot; past events collapsed at 45% opacity.
- Weather: current temp Display-size + condition, H/L, 4-day strip. Data: Open-Meteo, Whitewater WI.
- News: 2 headlines max, divider-separated, source caption. Tap → source link.
- Photos: 3-up thumbnail grid + album caption; tap → Photos.

### 8.2 Meal planner — ref 2b / 2g
- Desktop: title + week range + "Ivy: toddler portions auto-scaled" note; actions right: Import from URL (secondary), + Add recipe (secondary), **✦ Generate plan** (primary).
- 7-day card strip; today = accent border + tinted fill; empty days = dashed "+ Add meal". Day card: photo, name, kcal + protein.
- Below: Recipe database rail (filter chips: meal type, time, tags, "family fav ★") + **✦ Generated for you** tint card: plan rationale sentence (protein %, no-repeat window, kept traditions e.g. Friday pizza), grocery summary (items, est. cost), Accept week / Shuffle.
- Phone: day-strip selector (selected = accent pill), then Dinner (featured tint card), Lunch, Breakfast slots; Groceries + Import tiles at bottom.
- Recipe detail: full-bleed photo top, title, macro pills, servings stepper (auto-scales ingredient quantities; toddler portion = 0.5× flag for Ivy), ingredients checklist, steps, tags, source URL, "Add to plan" primary + "Cook mode" ghost.
- Generate constraints sheet: macro targets, nights to fill, exclude tags, no-repeat window (default 14 days).
- **Grocery list — ref 5b:** auto-generated from planned meals; items merged across recipes ("Jasmine rice · 2 recipes"), grouped by store section, each item tagged with source recipe + day; check-off syncs realtime between phones in-store. "✦ Regenerate" rebuilds after plan changes, preserving checked/custom items. Pantry-staples list (salt, oil…) auto-skips. **Export row:** Instacart (deep link / Instacart Developer Platform shopping-list API → opens a prefilled cart), Apple Notes + Reminders + anything else via Web Share API (formatted checklist text), and Copy as plain text. Est. cost from last-paid prices.

### 8.3 Cook mode — ref 1e (restyle to committed palette: bg `#0C0D10`)
- Fullscreen, wake-lock on. Header: ✕ Exit · "Cook mode" · Step n/n. Segmented progress bar.
- Step text at Title 2 (26/700), max ~2 sentences per step.
- Timer card auto-appears when step includes a duration: tabular 52/700 countdown, Pause (white pill) / +1 min (ghost). Timer persists across steps; multiple timers stack as compact pills.
- **Macro card:** green-tinted card (`rgba(143,227,168,.14)` tones), overline "MACRO CARD · PER SERVING", 4-col grid kcal/protein/carbs/fat with color-coded values, "serves n" caption.
- Footer: ← Back (ghost, 1fr) / Next step → (white filled, 2fr), 56px tall. Swipe also navigates. Last step → "Done — mark cooked" (logs meal, returns to planner).

### 8.4 Calendar — ref 2c / 2h
- Sources: local + Google (OAuth, two-way) + HEY (ICS, read-only — creation for HEY events disabled with tooltip "HEY is read-only").
- Desktop: Month/Week segmented toggle; member legend dots; week grid (Mon–Fri prominent, weekend togglable) + right **Agenda rail** (Today, Tomorrow groups) + "+ New event" ghost at rail bottom.
- Event block: member-tinted fill, color bar left, 11.5/600 title, caption time + source. Done events: 45% + strikethrough.
- Phone: Agenda/Week toggle; week-strip day selector (selected = accent pill); agenda groups TODAY/TOMORROW; routine-linked events (Ivy bedtime) show progress fraction chip (e.g. "1/4"). FAB-style "+ New event" primary pill bottom-center above dock.
- New event form: title, member(s) (avatar multi-select), date/time, repeat, calendar destination (Hearth/Google), notes.

### 8.5 Chores & rewards — ref 2d
- Member point cards row (avatar, name, ★ points in `star/points`); Ivy card = dashed "joins at ~4 yrs" placeholder (system designed for future kids: kid view = same components, bigger type, only their chores + up-for-grabs).
- Two columns: **ASSIGNED** (member avatar per row, ★ value; done = struck + green ✓) and **UP FOR GRABS** (accent dashed card; rows have "Claim ★n" primary micro-pill). Claiming is realtime-safe: first tap wins, others see toast "Already claimed by Cody".
- New chore sheet: name, points stepper, assign-to (avatar select or "Up for grabs"), repeat schedule, photo-proof toggle (for kids later).
- Rewards: parent-managed catalog (name, cost in ★, per-member or family). Redemption → confirm → **celebration**. Reward-unlocked banner appears on the relevant member's screens.
- Parents-only: approve/adjust points, manage catalog (behind parent PIN).

### 8.6 Ivy — toddler tracker — ref 2e
- Header: avatar + name + age (computed from birthdate) + "+ Log" primary.
- **Naps & sleep:** today's nap duration (big numeric) + times; 7-day bar chart (today = solid accent, rest 40%); last-night + weekly-avg caption. Log via + Log sheet: start/stop timer or manual entry.
- **Bedtime routine (7:30):** ordered checklist (Bath, Brush teeth, Two books, Lights out + sound machine) — check circles; current step = accent ring. Resets nightly; completion reflected in calendar event chip.
- **Milestones:** age-band card (warm `#FFD08A` tint), 4-up tiles: emoji + label + status (✓ date in `success` / "watching" in tertiary). Parents can check off + add custom; band advances with age.
- When Ivy turns ~4: settings offers role upgrade → chores appear, tracker archives.

### 8.7 Photos
Masonry grid, album strips ("Ivy at the lake · 18 new"), upload FAB, dashboard widget = latest 3. Lightbox: black, swipe, share/download. Storage: Supabase.

### 8.8 Fitness — ref 4i
- Per-member weekly goal rings (conic progress in member color; % center), goal type configurable (workouts/runs/steps). Week leader gets 👑; hitting a weekly goal earns ★15 toward rewards.
- Activity log rows: member dot, activity + distance, timestamp + duration, kcal trailing. "+ Log activity" sheet: type select, duration, distance (optional), member(s) — family activities credit everyone.
- Monthly leaderboard card (accent tint). Streaks use the standard streak component (§6).
- Dashboard widget (optional): your ring + week leader line.

### 8.9 Budget — ref 5a (Rocket Money)
Rocket Money is the source of truth; Hearth is a family-friendly read-only mirror.
- Header pill "🚀 Rocket Money · synced Xm ago · read-only" + "Open in Rocket Money ↗" + Sync now.
- Featured card: "Left to spend" big numeric + on-pace status. Category rows with progress (>90% → warning). Recent transactions (merchant icon, category, amount, Rocket Money flags surfaced).
- **Integration reality:** Rocket Money has no public API — build the sync as (a) Plaid connection to the same accounts (preferred, real-time), or (b) Rocket Money CSV export → upload/email-in parser. Ship (b) first; the UI is identical.
- **Hearth-only layer:** kid allowance funds fed by chore points (★→$ rate configurable, default ★10 = $1). Never written back to Rocket Money.
- No manual transaction entry in v1; allowances are the only Hearth-native money.

### 8.10 Settings / Family management — ref 4h
Household name, members (add/edit, role: parent/kid/toddler, color, PIN), theme (Auto/Light/Dark), calendar connections (Google OAuth status, HEY ICS URL), location (weather/news), notifications, wall-mode launcher, data export.

### 8.11 Auth & onboarding (first run) — ref 4a–4e
1. Welcome + sign in (Supabase auth, email + OAuth) → 2. Create household → 3. Add members (name, role, color) → 4. Connect calendars (skippable) → 5. Location → 6. Pick starter widgets (pre-checked default five) → dashboard. Each step: one decision per screen, Title 2 heading, primary continue pinned bottom.

---

## 9. Theming & PWA

- Theme: Auto (system) default; manual override in Settings. Both themes ship v1. Wall mode is always dark.
- `theme-color` meta: `#0C0D10` dark / `#F5F5F7` light. `background_color` in manifest matches.
- Manifest: name "Hearth", display `standalone`, orientation `any`; icon = blue rounded-square "H" mark (maskable + monochrome variants).
- Offline: app shell + last-loaded dashboard data cached; offline banner (toast-style, persistent) when stale; queue writes (chore checks, logs) and sync on reconnect.
- Push: chore claimed/completed, event reminders, bedtime routine reminder, reward unlocked.
- iOS safe areas respected (`env(safe-area-inset-*)`); dock sits above home indicator.

## 10. Accessibility

- Contrast: all text ≥ 4.5:1 against its surface (secondary text on glass verified against base+aurora); `text/tertiary` reserved for non-essential meta.
- Focus visible on every interactive element (accent ring). Full keyboard nav on desktop (widgets, calendar grid).
- Member color is never the only signal — always paired with name or avatar.
- Dynamic type: respect user font scaling up to 130% without layout breakage (cards grow, grid reflows).
- `aria-live="polite"` for claim/points updates; celebration announces "Reward redeemed".
- Reduced motion honored (see §7). Reduced transparency: glass surfaces fall back to solid `#16171B` / `#FFFFFF`.

## 11. Copy voice

Short, warm, lowercase-calm. Sentence case everywhere (no Title Case except proper nouns). Numbers over words ("2 events left"). Daily summary reads like a person: "Dinner's planned · Ivy napped 1h 40m." Errors are helpful, never blaming: "Couldn't reach Google Calendar — retrying."
