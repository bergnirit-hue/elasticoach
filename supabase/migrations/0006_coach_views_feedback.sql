-- EC-38 / EC-15 / EC-16: coach visibility + linking + feedback.
--   * EC-38: link a client by email into coach_client (supports mutual coaching).
--   * EC-15: a coach may READ an actively-linked client's tracking (days,
--            workouts, measures) — read-only; writes stay owner-only.
--   * EC-16: coach_feedback — a coach writes feedback on a client's day/meal;
--            the client may only read feedback about themselves.

-- ---------------------------------------------------------------------------
-- EC-38: link_client_by_email — resolve an email in auth.users and create the
-- coach -> client row for the current user. auth.users is not exposed through
-- the API, so this runs SECURITY DEFINER but enforces coach_id = auth.uid()
-- itself. search_path is emptied, so every name is schema-qualified.
-- Returns: 'linked' | 'already' | 'not_found' | 'self'.
-- ---------------------------------------------------------------------------
create or replace function public.link_client_by_email(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach uuid := auth.uid();
  v_client uuid;
begin
  if v_coach is null then
    raise exception 'not authenticated';
  end if;

  select id into v_client
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_client is null then
    return 'not_found';
  end if;

  if v_client = v_coach then
    return 'self';
  end if;

  insert into public.coach_client (coach_id, client_id, status)
  values (v_coach, v_client, 'active')
  on conflict (coach_id, client_id) do nothing;

  if not found then
    return 'already';
  end if;

  return 'linked';
end;
$$;

-- Callable only by authenticated users (never anon / the public role).
revoke execute on function public.link_client_by_email(text) from public, anon;
grant execute on function public.link_client_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- EC-15: coach read access to linked clients' tracking data.
-- These are additive SELECT policies; the existing `<table>_owner` (FOR ALL)
-- policies are unchanged, so the owner keeps full access and the coach gets
-- read-only. Permissive policies are OR'd per command.
-- ---------------------------------------------------------------------------
create policy "days_select_as_coach"
  on public.days for select
  using (
    exists (
      select 1 from public.coach_client cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = public.days.user_id
        and cc.status = 'active'
    )
  );

create policy "workouts_select_as_coach"
  on public.workouts for select
  using (
    exists (
      select 1 from public.coach_client cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = public.workouts.user_id
        and cc.status = 'active'
    )
  );

create policy "measures_select_as_coach"
  on public.measures for select
  using (
    exists (
      select 1 from public.coach_client cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = public.measures.user_id
        and cc.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- EC-16: coach_feedback — one note from a coach about a client's day or meal.
-- meal_key: null = feedback on the whole day; otherwise a journal slot key
-- (breakfast / lunch / dinner / snacks / notes — see lib/feedback.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  meal_key text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coach_id <> client_id)
);

create index if not exists coach_feedback_client_date_idx
  on public.coach_feedback (client_id, date);
create index if not exists coach_feedback_coach_id_idx
  on public.coach_feedback (coach_id);

alter table public.coach_feedback enable row level security;

-- The coach who wrote the feedback can read it (for the edit UI).
create policy "coach_feedback_select_as_coach"
  on public.coach_feedback for select
  using (coach_id = (select auth.uid()));

-- The client can read feedback written about them.
create policy "coach_feedback_select_as_client"
  on public.coach_feedback for select
  using (client_id = (select auth.uid()));

-- A coach may write feedback only for a client actively linked to them.
create policy "coach_feedback_insert_as_coach"
  on public.coach_feedback for insert
  with check (
    coach_id = (select auth.uid())
    and exists (
      select 1 from public.coach_client cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = public.coach_feedback.client_id
        and cc.status = 'active'
    )
  );

-- A coach may edit their own feedback (while still linked to the client).
create policy "coach_feedback_update_as_coach"
  on public.coach_feedback for update
  using (coach_id = (select auth.uid()))
  with check (
    coach_id = (select auth.uid())
    and exists (
      select 1 from public.coach_client cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = public.coach_feedback.client_id
        and cc.status = 'active'
    )
  );

-- A coach may delete their own feedback.
create policy "coach_feedback_delete_as_coach"
  on public.coach_feedback for delete
  using (coach_id = (select auth.uid()));
