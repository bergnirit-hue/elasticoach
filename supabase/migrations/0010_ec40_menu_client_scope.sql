-- EC-40 — optional per-menu client scoping for the coach menu builder.
--
-- Until now a `menu` belongs to a coach and every active client of that coach
-- can read it once published; per-client differentiation is only via the
-- menu_policy. The builder's "applies to: a single client" option needs a way
-- to target one client. This migration adds a nullable `menu.client_id`:
--     * NULL        → the menu applies to ALL of the coach's clients (today's
--                     behaviour, unchanged).
--     * a client id → the menu is visible only to that one client.
--
-- The gating is done ENTIRELY in RLS, so the EC-13 daily-plan loader
-- (loadDailyPlan) needs NO change: it still selects a coach's menus by
-- coach_id, and RLS filters out menus targeted at a different client. The
-- availability engine (EC-12) is likewise untouched.
--
-- ⚠️ NOT YET APPLIED to the live/shared Supabase project. Applying a migration
-- to the shared DB needs Nirit's approval (see CLAUDE.md / orchestration). The
-- all-clients path works without this migration; only "single client" needs it.

alter table public.menu
  add column if not exists client_id uuid
    references public.profiles (id) on delete cascade;

create index if not exists menu_coach_client_idx
  on public.menu (coach_id, client_id);

-- A single-client menu must only be written by the owning coach for a client
-- they actually coach. Extend the owner WITH CHECK via a dedicated policy that
-- also validates the link (the base menu_owner policy already enforces coach_id).
drop policy if exists "menu_single_client_owner_check" on public.menu;
create policy "menu_single_client_owner_check"
  on public.menu as restrictive for all
  using (true)
  with check (
    client_id is null
    or exists (
      select 1 from public.coach_client cc
      where cc.coach_id = public.menu.coach_id
        and cc.client_id = public.menu.client_id
        and cc.status = 'active'
    )
  );

-- Clients may read a published menu only when it is for everyone (client_id is
-- null) or targeted at them. Recreate the existing client-read policy with the
-- added client_id condition.
drop policy if exists "menu_client_read_published" on public.menu;
create policy "menu_client_read_published"
  on public.menu for select
  using (
    publish_date <= current_date
    and (public.menu.client_id is null or public.menu.client_id = (select auth.uid()))
    and exists (
      select 1
      from public.coach_client cc
      where cc.coach_id = public.menu.coach_id
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
    )
  );

-- menu_meal: a client may read the links of a menu they are allowed to see.
drop policy if exists "menu_meal_client_read_published" on public.menu_meal;
create policy "menu_meal_client_read_published"
  on public.menu_meal for select
  using (
    exists (
      select 1
      from public.menu m
      join public.coach_client cc on cc.coach_id = m.coach_id
      where m.id = public.menu_meal.menu_id
        and m.publish_date <= current_date
        and (m.client_id is null or m.client_id = (select auth.uid()))
        and cc.client_id = (select auth.uid())
        and cc.status = 'active'
    )
  );

-- meal_library: a client may read a meal only if it appears in a menu they are
-- allowed to see (add the same client_id scoping).
drop policy if exists "meal_library_client_read_published" on public.meal_library;
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
        and (m.client_id is null or m.client_id = (select auth.uid()))
    )
  );
