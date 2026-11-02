-- EC-11 (meal library + menus) + EC-12 (menu policies).
-- Meals live once in a per-coach library; a menu is a named set of meals with a
-- publish date; a coach picks a menu policy (default per coach, overridable per
-- client). See CLAUDE.md > "Menus (feature 2–3)".
--
-- RLS model:
--   * A coach fully owns their own library / menus / policy rows.
--   * A client may READ only meals and menus that a coach who actively coaches
--     them has published on or before today (publish_date <= current_date).
--   * A client may read their coach's default policy and their own override.
--
-- Statement order matters: policy USING/WITH CHECK expressions are validated at
-- CREATE POLICY time, and several reference tables defined later in this file.
-- So we create ALL tables + indexes first, then enable RLS, then all policies.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'meal_type') then
    create type public.meal_type as enum (
      'breakfast',
      'lunch-carb',
      'lunch-protein',
      'dinner',
      'snack'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'menu_policy') then
    create type public.menu_policy as enum (
      'fixed',
      'rotating',
      'cumulative',
      'full_pool'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables + indexes
-- ---------------------------------------------------------------------------

-- meal_library: meals owned by a coach, reused across menus (EC-11)
create table if not exists public.meal_library (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  type public.meal_type not null,
  text text not null,
  recipe_url text,
  -- Optional macros (grams). AI/photo features fill the real numbers later.
  protein_g numeric,
  carb_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotent import: the same meal (per coach) collapses to one row.
  unique (coach_id, type, text)
);

create index if not exists meal_library_coach_idx
  on public.meal_library (coach_id, type);

-- menu: a named set of meals with a publish date, owned by a coach (EC-11)
create table if not exists public.menu (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  publish_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotent import: re-importing updates the menu with this name in place.
  unique (coach_id, name)
);

create index if not exists menu_coach_publish_idx
  on public.menu (coach_id, publish_date);

-- menu_meal: which meals belong to a menu (EC-11)
create table if not exists public.menu_meal (
  menu_id uuid not null references public.menu (id) on delete cascade,
  meal_id uuid not null references public.meal_library (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (menu_id, meal_id)
);

create index if not exists menu_meal_meal_idx on public.menu_meal (meal_id);

-- coach_menu_policy: a coach's default policy (EC-12)
create table if not exists public.coach_menu_policy (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  policy public.menu_policy not null default 'fixed',
  updated_at timestamptz not null default now()
);

-- client_menu_policy: per-client override of the coach default (EC-12)
create table if not exists public.client_menu_policy (
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  policy public.menu_policy not null,
  updated_at timestamptz not null default now(),
  primary key (coach_id, client_id)
);

-- ---------------------------------------------------------------------------
-- Enable row level security
-- ---------------------------------------------------------------------------
alter table public.meal_library enable row level security;
alter table public.menu enable row level security;
alter table public.menu_meal enable row level security;
alter table public.coach_menu_policy enable row level security;
alter table public.client_menu_policy enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (created last: their expressions reference the tables above)
-- ---------------------------------------------------------------------------

-- meal_library: coach owns their library.
create policy "meal_library_owner"
  on public.meal_library for all
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

-- meal_library: a client may read a meal only if it appears in a menu their
-- active coach has already published (publish_date <= today).
create policy "meal_library_client_read_published"
  on public.meal_library for select
  using (
    exists (
      select 1
      from public.menu_meal mm
      join public.menu m on m.id = mm.menu_id
      join public.coach_client cc on cc.coach_id = m.coach_id
      where mm.meal_id = public.meal_library.id
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
        and m.publish_date <= current_date
    )
  );

-- menu: coach owns their menus.
create policy "menu_owner"
  on public.menu for all
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

-- menu: a client may read menus their active coach has already published.
create policy "menu_client_read_published"
  on public.menu for select
  using (
    publish_date <= current_date
    and exists (
      select 1
      from public.coach_client cc
      where cc.coach_id = public.menu.coach_id
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
    )
  );

-- menu_meal: coach owns the links for their own menus.
create policy "menu_meal_owner"
  on public.menu_meal for all
  using (
    exists (
      select 1 from public.menu m
      where m.id = public.menu_meal.menu_id
        and m.coach_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.menu m
      where m.id = public.menu_meal.menu_id
        and m.coach_id = (select auth.uid())
    )
  );

-- menu_meal: a client may read links of menus their active coach has published.
create policy "menu_meal_client_read_published"
  on public.menu_meal for select
  using (
    exists (
      select 1
      from public.menu m
      join public.coach_client cc on cc.coach_id = m.coach_id
      where m.id = public.menu_meal.menu_id
        and m.publish_date <= current_date
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
    )
  );

-- coach_menu_policy: coach owns their default.
create policy "coach_menu_policy_owner"
  on public.coach_menu_policy for all
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

-- coach_menu_policy: a client may read the default policy of a coach who
-- actively coaches them.
create policy "coach_menu_policy_client_read"
  on public.coach_menu_policy for select
  using (
    exists (
      select 1
      from public.coach_client cc
      where cc.coach_id = public.coach_menu_policy.coach_id
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
    )
  );

-- client_menu_policy: coach owns the overrides they set for their clients.
create policy "client_menu_policy_owner"
  on public.client_menu_policy for all
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

-- client_menu_policy: a client may read their own override.
create policy "client_menu_policy_client_read"
  on public.client_menu_policy for select
  using (client_id = (select auth.uid()));
