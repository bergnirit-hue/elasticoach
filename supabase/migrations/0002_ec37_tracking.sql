-- EC-37: per-user tracking tables for the copied app (generic, starts empty).
-- Settings replace the values that were hardcoded in the artifact.
-- All tables are isolated per user via RLS; coach visibility is added in EC-38.

-- ---------------------------------------------------------------------------
-- user_settings: one row per user (the formerly-hardcoded personal values)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  goal_title text,
  start_weight numeric,
  goal_weight numeric,
  start_date date,
  water_goal_ml integer not null default 2000,
  weekly_workout_goal integer not null default 3,
  step_goal integer not null default 8000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_owner"
  on public.user_settings for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- days: daily tracking (water, steps, journal, daily challenge, menu adherence)
-- ---------------------------------------------------------------------------
create table if not exists public.days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  water_ml integer not null default 0,
  steps integer not null default 0,
  challenge_done boolean not null default false,
  journal jsonb not null default '{}'::jsonb,
  menu_picks jsonb,   -- populated once a coach menu library exists (EC-11/EC-13)
  menu_star numeric,  -- menu adherence: 0 / 0.5 / 1
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.days enable row level security;

create policy "days_owner"
  on public.days for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workouts: training sessions the user schedules; shown on the calendar and
-- marked done/not done. Flexible per client (no gym-specific coupling).
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time,
  type text not null,
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, scheduled_date);

alter table public.workouts enable row level security;

create policy "workouts_owner"
  on public.workouts for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- measures: weekly measurements. Circumferences are flexible (jsonb), and a
-- progress ("before") photo path points at a private storage object (EC-37
-- measures PR wires the bucket + upload).
-- ---------------------------------------------------------------------------
create table if not exists public.measures (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  weight numeric,
  body_fat_pct numeric,
  muscle_pct numeric,
  circumferences jsonb not null default '{}'::jsonb,
  photo_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.measures enable row level security;

create policy "measures_owner"
  on public.measures for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
