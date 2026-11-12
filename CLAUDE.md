# Elasticoach — Decisions & Principles

Source of truth for product and engineering decisions. This file mirrors the Linear
document **"Decisions & Principles (source for CLAUDE.md)"** (team Elasticoach).
When a decision changes, **update the Linear doc first (with a date), then this file.**

---

## Product

- **What:** a nutrition + training coaching app for coaches/dietitians and their clients.
  Israeli market, **Hebrew UI, RTL first**.
- **Owner:** Nirit (PM, ex-full-stack dev). She reviews and merges every PR.
- **Market:** an existing category with competitors. Differentiators to protect:
  flexible cross-menu meal swapping, WhatsApp agent, per-coach AI "brain".
- **First users (2026-11-02):** Nirit and a friend. Each is **both coach and client** of the
  other (mutual coaching). No external coach yet; Nirit plays the coach until the MVP is
  demo-ready.

## Stack

- Next.js (App Router) + TypeScript, Supabase (Postgres, Auth, Storage, RLS, pgvector), Vercel.
- Later: Green API (WhatsApp), Claude API (vision + assistant), an Israeli payment provider
  (Grow / PayPlus / Cardcom, TBD), Capacitor or Expo wrapper for the step counter (TBD).

## Working agreement

- One branch per Linear issue, named with the issue key (e.g. `ec-10-...`). The PR title
  includes the key so Linear auto-updates.
- **Never merge yourself.** Nirit approves and merges every PR.
- Each PR: a short **Hebrew** summary of what was built and how to test it on the Vercel preview.
- **When data or a decision is missing: ask, don't invent.** Prefer deterministic,
  evidence-based logic over guessing.
- Small PRs. Tests for business logic (especially menu-policy availability and RLS).

---

## Key decisions

### 2026-11-03 — Client self-registration is in MVP; lead capture is optional

- **Self-registration (MVP):** a client can sign up on their own and link to a coach
  (code/invite) with a `pending` → coach-approved `active` handshake (EC-45). This formalizes
  the consent-based accept flow that EC-38's direct-`active` linking deferred. Manual linking
  by the coach remains.
- **Lead capture (optional, post-MVP):** collecting leads — a `leads` table, a public
  per-coach landing/signup page (+QR), and a "leads" inbox tab that converts a lead to
  `coach_client` — is its own optional epic, **P-EC-18**, not part of the MVP.

### 2026-11-02 — Skip editing the artifact; copy it to the new app

- The existing app "הדרך של נירית" is a single-user Claude artifact:
  https://claude.ai/code/artifact/f76ed617-33c4-45c0-a6fd-013c17d051fb
- The friend has no Claude account, so the artifact is **not** modified.
- **EC-37 — copy, don't convert.** Rebuild its screens in Next.js. The original artifact must
  keep working unchanged.
  (https://linear.app/niritberg/issue/EC-37)
- Nirit's data is **copied** (export → import), never moved or deleted. Source of data: the
  artifact's "גיבוי מלא (JSON)" export. If the artifact source/data can't be read, ask Nirit
  to export it.
- Everything hardcoded there (name, start weight, goal weight, start date, water goal) becomes
  per-user settings. Gym classes (Icon Holon) and Google Calendar sync become optional, off by
  default.

### Roles

- Roles are **per relationship, not per user**. A `coach_client` many-to-many table; one user
  can be coach to some and client of others. UI switch between "my tracking" and "my client(s)".
- RLS: a coach sees only clients linked to them; a client sees only themselves.
- **Signup & linking:** full client **self-registration is in the MVP** — client creates an
  account, links to a coach via code/invite, status `pending` → coach approves → `active`
  (EC-45). Manual linking by the coach stays. **Lead capture** (public landing page, lead
  inbox, `leads` table) is a separate **optional / post-MVP** epic (P-EC-18), not in the MVP.

### Menus (feature 2–3)

- Meals live once in a **meal library** (type: breakfast, lunch-carb, lunch-protein, dinner,
  snack; text; recipe link; optional macros). A menu = a set of meals + a publish date.
- Coach chooses a **menu policy** (default per coach, overridable per client):
  - `fixed` — one fixed menu
  - `rotating` — a fixed menu that changes weekly
  - `cumulative` — a new menu each week; client picks from all published so far
  - `full_pool` — everything published at once; client builds from the pool
- One function decides **"which meals are available to client X on date Y"**. It must be
  unit-tested for all four policies.
- Swap button per meal opens only same-type meals allowed by the policy. Hidden under `fixed`.
  The daily menu keeps the current layout with a recipe link when one exists.

### Coach Brain (AI) — 2026-11-02

- The "brain" is **data, not fine-tuning**. Context is assembled per request.
- Precedence when layers conflict: **platform rules > coach rules > client profile > today's
  context**.
- Coach rules are **structured fields** (table), never hardcoded in code or prompts.
  **Code enforces them:** any meal the AI suggests is validated against the client's allowed
  meal library; unknown meals are blocked.
- Coach approach/FAQ text: chunks in pgvector, retrieved per question, isolated per coach via RLS.
- Ingestion: coach uploads PDFs → AI drafts rules/meals/text → **nothing enters the brain
  without coach approval**.
- No answer in the brain → AI does not guess; it escalates to the coach ("I'll ask your coach").
- Coach sees AI conversations with sources; corrections become new brain items (with approval).
- ~20 eval questions per coach, run on every prompt/data change. A pass threshold is required
  before enabling AI for a new coach's clients.
- Platform guardrails coaches cannot override: no medical advice; refer to a doctor on warning
  signs; eating-disorder-related language → no advice, escalate to the coach and show support
  resources.
- The WhatsApp agent and meal-photo AI must go through the brain (they are blocked by it in Linear).

### Meal photo AI (feature 4)

- Vision identifies items and estimated amounts; **nutrition values come from a real database**
  (Israeli Ministry of Health "Tzameret"), not from the model. The user confirms or corrects.
  The UI states it's an estimate (~±20%). Validate on ~30 real photos before release.

### Steps (feature 7)

- A web app cannot read the phone's step counter. Requires a native wrapper with HealthKit (iOS)
  / Health Connect (Android). Last phase.

### Legal & privacy (runs in parallel from day one)

- Health data is "information of special sensitivity" under Israel's Privacy Protection Law,
  Amendment 13. Lawyer review pending (EC-5: https://linear.app/niritberg/issue/EC-5).
- Explicit, versioned consent before collecting health data, photos, videos; separate consent
  for WhatsApp messages. Users can export and delete their data.
- Accessibility per Israeli standard 5568 (WCAG 2.0 AA) incl. RTL; accessibility statement page.
- Terms state the app and AI are not medical or professional nutrition advice.
- Menus/recipes in the copied app come from Nirit's own coach's PDFs — confirm permission to
  share with the friend (EC-4: https://linear.app/niritberg/issue/EC-4).

---

## Phases (Linear projects)

0. **Copy existing app to Vercel** (EC-37, EC-38) — first users
1. **MVP** (EC-9 … EC-17, EC-30)
   - 1.5. **Coach Brain** (EC-31 … EC-36)
2. **Engagement:** WhatsApp reminders, coach daily digest, inactivity/churn alerts
   (rule-based, transparent)
3. **Meal photo AI + macros**
4. **Workouts & group challenges** (video uploads with size limit and auto-expiry)
5. **Business:** white-label branding, onboarding + health declaration, subscriptions & payments
6. **Step counter** (native wrapper)

**Legal & Compliance** — parallel, all phases.
