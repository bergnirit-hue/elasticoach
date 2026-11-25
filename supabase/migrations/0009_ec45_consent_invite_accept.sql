-- EC-45: consent gap — a coach must not access a client's health data until the
-- client explicitly accepts the link. Health data is "information of special
-- sensitivity" under Israel's Privacy Protection Law (Amendment 13), so the
-- coach->client link starts as 'invited' and grants zero access; the coach-read
-- RLS on days/workouts/measures/profiles already requires status='active', so an
-- 'invited' link already leaks nothing. This migration only changes how links are
-- BORN and lets the client accept or decline. Idempotent / re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Links are born 'invited', not 'active'.
--    Only affects NEW rows. Existing rows (incl. the owner's seeded mutual-
--    coaching demo) keep their current status — we intentionally do NOT update
--    any existing coach_client row here.
-- ---------------------------------------------------------------------------
alter table public.coach_client alter column status set default 'invited';

-- ---------------------------------------------------------------------------
-- 2. link_client_by_email now creates the row as 'invited' (was 'active').
--    Same contract otherwise: SECURITY DEFINER, enforces coach_id = auth.uid(),
--    empty search_path. Returns: 'linked' | 'already' | 'not_found' | 'self'.
--    ('linked' now means "invite sent", pending the client's acceptance.)
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

  -- EC-45: born 'invited' — no coach access until the client accepts.
  insert into public.coach_client (coach_id, client_id, status)
  values (v_coach, v_client, 'invited')
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
-- 3. The client can ACCEPT their own invite (invited -> active).
--    USING scopes the policy to the client's own 'invited' rows; WITH CHECK
--    pins the result to the client's own 'active' row — so this policy permits
--    exactly the invited->active transition and nothing else (no coach change,
--    no reactivating someone else's link).
-- ---------------------------------------------------------------------------
drop policy if exists "coach_client_accept_as_client" on public.coach_client;
create policy "coach_client_accept_as_client"
  on public.coach_client for update
  using (
    client_id = (select auth.uid())
    and status = 'invited'
  )
  with check (
    client_id = (select auth.uid())
    and status = 'active'
  );

-- ---------------------------------------------------------------------------
-- 4. The client can DECLINE their own invite by deleting the 'invited' row.
--    Scoped to invited rows only, so a client can never unilaterally remove an
--    established 'active' coaching link through this policy. Decline-by-delete
--    (rather than a 'declined' status) keeps the schema simple and, crucially,
--    frees the unique(coach_id, client_id) slot so the coach can re-invite later
--    — a lingering 'declined' row would block re-invite via ON CONFLICT.
-- ---------------------------------------------------------------------------
drop policy if exists "coach_client_decline_as_client" on public.coach_client;
create policy "coach_client_decline_as_client"
  on public.coach_client for delete
  using (
    client_id = (select auth.uid())
    and status = 'invited'
  );

-- ---------------------------------------------------------------------------
-- 5. The client may read the display_name of a coach who has a link to them
--    (invited or active). Informed consent requires the invitee to know who
--    invited them; this also lets an active client see their coach's name.
--    Symmetric to profiles_select_as_coach, and reveals only the coach profile
--    row (display_name/locale), nothing else.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_as_client" on public.profiles;
create policy "profiles_select_as_client"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.coach_client cc
      where cc.client_id = (select auth.uid())
        and cc.coach_id = public.profiles.id
    )
  );
