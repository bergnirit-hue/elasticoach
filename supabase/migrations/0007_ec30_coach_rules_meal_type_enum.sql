-- EC-30 follow-up: forward fix for environments where the first version of
-- 0004 was already applied. That version typed coach_rules.allowed_meal_types
-- as text[] with a CHECK using underscored ids (lunch_carb / lunch_protein),
-- which never matched the real public.meal_type enum (lunch-carb / lunch-protein).
-- 0004 now creates the column as public.meal_type[] directly; on a fresh
-- database this migration is a no-op. Idempotent.

do $$
declare
  con record;
begin
  if (
    select format_type(a.atttypid, a.atttypmod)
    from pg_attribute a
    where a.attrelid = 'public.coach_rules'::regclass
      and a.attname = 'allowed_meal_types'
      and not a.attisdropped
  ) = 'text[]' then
    -- Drop the old underscore CHECK (whatever name it was given).
    for con in
      select conname
      from pg_constraint
      where conrelid = 'public.coach_rules'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%allowed_meal_types%'
    loop
      execute format('alter table public.coach_rules drop constraint %I', con.conname);
    end loop;

    -- Convert, translating any old underscored ids to the enum's hyphens.
    alter table public.coach_rules
      alter column allowed_meal_types type public.meal_type[]
      using (
        replace(replace(allowed_meal_types::text, 'lunch_carb', 'lunch-carb'),
                'lunch_protein', 'lunch-protein')::public.meal_type[]
      );
  end if;
end
$$;
