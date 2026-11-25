-- EC-45 hardening: make the IDENTITY columns of a coach_client link immutable.
--
-- The accept-invite RLS policy (0009, `coach_client_accept_as_client`) pins the
-- NEW row to the caller's own `client_id` and `status='active'`, but a WITH CHECK
-- only constrains the resulting row's predicate — it does NOT restrict which
-- columns an UPDATE may touch. So a client could, in the same update that flips
-- 'invited' -> 'active', also rewrite `coach_id` to an arbitrary user, pointing
-- their link at a coach who never invited them (self-exposure of their own data,
-- and a contradiction of that policy's stated "no coach change" invariant).
--
-- `coach_id` and `client_id` define WHICH relationship a row is; they must never
-- change on an existing row (a different pairing is a different link, created via
-- link_client_by_email). A BEFORE UPDATE trigger enforces this regardless of
-- which RLS policy permitted the update, so it also covers any future
-- coach-side update path. Idempotent / re-runnable.

create or replace function public.coach_client_lock_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.coach_id is distinct from old.coach_id
     or new.client_id is distinct from old.client_id then
    raise exception
      'coach_id and client_id are immutable on coach_client (relationship identity)';
  end if;
  return new;
end;
$$;

drop trigger if exists coach_client_lock_identity on public.coach_client;
create trigger coach_client_lock_identity
  before update on public.coach_client
  for each row
  execute function public.coach_client_lock_identity();
