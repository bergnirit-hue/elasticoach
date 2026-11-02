# elasticoach

Nutrition & training coaching platform for coaches and their clients.
Hebrew UI, RTL-first. See [`CLAUDE.md`](./CLAUDE.md) for product & engineering decisions.

## Stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS v4
- Vitest for unit tests

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env and fill in the Supabase values:

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` — the project API URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the publishable (or anon) key

3. Run the dev server:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run test` — unit tests (Vitest)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Database

SQL migrations live in [`supabase/migrations/`](./supabase/migrations). The base
schema (`profiles`, `coach_client`, RLS) is in `0001_init_profiles_coach_client.sql`.

## Auth note

Login uses Supabase email magic links. For links to work, the project's
**Auth → URL configuration** must allow the callback redirect URLs, e.g.
`http://localhost:3000/**` and the Vercel preview/production URLs.
