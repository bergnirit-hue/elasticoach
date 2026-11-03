-- EC-30: coach rules as structured fields (prep layer for the Coach Brain).
-- Rules are DATA, never hardcoded in code or prompts; code enforces them.
-- A row is either the coach's default (client_id is null) or a per-client
-- override (client_id set). Every rule column is nullable: null = "not set
-- here", so the override only needs to carry the fields it changes and the
-- rest are inherited from the coach default (see lib/coach-rules.ts).

create table if not exists public.coach_rules (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.profiles (id) on delete cascade,

  -- Meal restrictions. Typed with the same enum as meal_library.type (0003:
  -- breakfast, lunch-carb, lunch-protein, dinner, snack), so Postgres enforces
  -- the values. null = no restriction.
  allowed_meal_types public.meal_type[],
  -- Tags a meal must NOT carry to be suggested. Tag vocabulary is defined with
  -- the meal library; matched case-insensitively in code.
  forbidden_meal_tags text[],

  -- Daily / weekly targets.
  water_goal_ml integer,
  protein_goal_g integer,
  weekly_workout_goal integer,

  -- Short free text for the coach's own reference. Kept minimal on purpose:
  -- anything the AI must obey belongs in a structured column above.
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (client_id is null or coach_id <> client_id),
  check (water_goal_ml is null or water_goal_ml between 0 and 20000),
  check (protein_goal_g is null or protein_goal_g between 0 and 1000),
  check (weekly_workout_goal is null or weekly_workout_goal between 0 and 21),
  check (notes is null or char_length(notes) <= 1000)
);

-- One default per coach, one override per (coach, client).
create unique index if not exists coach_rules_default_uniq
  on public.coach_rules (coach_id) where client_id is null;
create unique index if not exists coach_rules_override_uniq
  on public.coach_rules (coach_id, client_id) where client_id is not null;
create index if not exists coach_rules_client_id_idx
  on public.coach_rules (client_id);

alter table public.coach_rules enable row level security;

-- A coach reads only their own rules.
create policy "coach_rules_select_as_coach"
  on public.coach_rules for select
  using (coach_id = (select auth.uid()));

-- A client may READ the rules that apply to them: the default of a coach they
-- are actively linked to, and the override written for them specifically.
create policy "coach_rules_select_as_client"
  on public.coach_rules for select
  using (
    (client_id is null or client_id = (select auth.uid()))
    and exists (
      select 1
      from public.coach_client cc
      where cc.coach_id = public.coach_rules.coach_id
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
    )
  );

-- Writes: only by the owning coach; an override may only target a client the
-- coach is linked to.
create policy "coach_rules_insert_as_coach"
  on public.coach_rules for insert
  with check (
    coach_id = (select auth.uid())
    and (
      client_id is null
      or exists (
        select 1
        from public.coach_client cc
        where cc.coach_id = (select auth.uid())
          and cc.client_id = public.coach_rules.client_id
      )
    )
  );

create policy "coach_rules_update_as_coach"
  on public.coach_rules for update
  using (coach_id = (select auth.uid()))
  with check (
    coach_id = (select auth.uid())
    and (
      client_id is null
      or exists (
        select 1
        from public.coach_client cc
        where cc.coach_id = (select auth.uid())
          and cc.client_id = public.coach_rules.client_id
      )
    )
  );

create policy "coach_rules_delete_as_coach"
  on public.coach_rules for delete
  using (coach_id = (select auth.uid()));
