-- EC-10: base schema — profiles, coach_client (many-to-many), RLS.
-- Roles are per relationship, not per user: one user can be a coach to some
-- people and a client of others.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'he',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read and edit their own profile.
create policy "profiles_select_own"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- coach_client: directed coach -> client relationship (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_client (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('invited', 'active')),
  created_at timestamptz not null default now(),
  unique (coach_id, client_id),
  check (coach_id <> client_id)
);

create index if not exists coach_client_coach_id_idx on public.coach_client (coach_id);
create index if not exists coach_client_client_id_idx on public.coach_client (client_id);

alter table public.coach_client enable row level security;

-- Either party in the relationship can read the row.
create policy "coach_client_select_party"
  on public.coach_client for select
  using (
    coach_id = (select auth.uid())
    or client_id = (select auth.uid())
  );

-- A user may create relationships only where they are the coach.
create policy "coach_client_insert_as_coach"
  on public.coach_client for insert
  with check (coach_id = (select auth.uid()));

-- The coach manages the relationship (status) and may remove it.
create policy "coach_client_update_as_coach"
  on public.coach_client for update
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

create policy "coach_client_delete_as_coach"
  on public.coach_client for delete
  using (coach_id = (select auth.uid()));

-- A coach may read the profiles of clients actively linked to them.
create policy "profiles_select_as_coach"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.coach_client cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = public.profiles.id
        and cc.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The trigger fires regardless of EXECUTE grants; remove the function from the
-- public REST API so it cannot be called directly by anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
