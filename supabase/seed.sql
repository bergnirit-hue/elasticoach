-- Elasticoach — staging demo seed (idempotent, data only, no schema changes).
--
-- Creates two TEST users (nirit / friend) who coach each other, plus recent
-- days, workouts and measures. Safe to run repeatedly: users are matched by
-- email, rows are upserted, and demo workouts carry a "דמו:" note prefix that
-- is used to replace only the demo rows on re-run.
--
-- Run it against the STAGING Supabase project only (SQL editor, or
-- `psql "$STAGING_DB_URL" -f supabase/seed.sql`).
--
-- Passwords are NOT stored in this file. Set them in the two set_config lines
-- below before running (do not commit the edited values), e.g. with a
-- generated value:  openssl rand -base64 18

select set_config('seed.nirit_password',  'CHANGE_ME', false);
select set_config('seed.friend_password', 'CHANGE_ME', false);

do $seed$
declare
  nirit_email  constant text := 'berg.nirit+ec-nirit@gmail.com';
  friend_email constant text := 'berg.nirit+ec-friend@gmail.com';
  nirit_pw  text := current_setting('seed.nirit_password', true);
  friend_pw text := current_setting('seed.friend_password', true);
  nirit_id  uuid;
  friend_id uuid;
  today date := current_date;
  u record;
begin
  if coalesce(nirit_pw, 'CHANGE_ME') = 'CHANGE_ME'
     or coalesce(friend_pw, 'CHANGE_ME') = 'CHANGE_ME' then
    raise exception 'Set seed.nirit_password and seed.friend_password at the top of supabase/seed.sql before running';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Auth users (email + password, already confirmed). The
  --    on_auth_user_created trigger creates the matching profiles rows.
  -- -------------------------------------------------------------------------
  for u in
    select * from (values
      (nirit_email,  nirit_pw,  'נירית (דמו)'),
      (friend_email, friend_pw, 'חברה (דמו)')
    ) as t(email, pw, display_name)
  loop
    if exists (select 1 from auth.users where email = u.email) then
      update auth.users
         set encrypted_password = extensions.crypt(u.pw, extensions.gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             raw_user_meta_data = jsonb_build_object('display_name', u.display_name),
             updated_at = now()
       where email = u.email;
    else
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', u.email,
        extensions.crypt(u.pw, extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', u.display_name),
        now(), now(),
        '', '', '', ''
      );
    end if;
  end loop;

  select id into nirit_id  from auth.users where email = nirit_email;
  select id into friend_id from auth.users where email = friend_email;

  -- Email identity rows (needed for password sign-in).
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), x.id, x.id::text, 'email',
         jsonb_build_object('sub', x.id::text, 'email', x.email,
                            'email_verified', true, 'phone_verified', false),
         now(), now(), now()
    from (values (nirit_id, nirit_email), (friend_id, friend_email)) as x(id, email)
  on conflict (provider_id, provider) do nothing;

  -- Profiles normally come from the trigger; make sure and set display names.
  insert into public.profiles (id, display_name) values
    (nirit_id,  'נירית (דמו)'),
    (friend_id, 'חברה (דמו)')
  on conflict (id) do update set display_name = excluded.display_name;

  -- -------------------------------------------------------------------------
  -- 2. Mutual coaching: each is coach AND client of the other.
  -- -------------------------------------------------------------------------
  insert into public.coach_client (coach_id, client_id, status) values
    (nirit_id,  friend_id, 'active'),
    (friend_id, nirit_id,  'active')
  on conflict (coach_id, client_id) do update set status = 'active';

  -- -------------------------------------------------------------------------
  -- 3. Settings
  -- -------------------------------------------------------------------------
  insert into public.user_settings
    (user_id, goal_title, start_weight, goal_weight, start_date, water_goal_ml,
     weekly_workout_goal, step_goal)
  values
    (nirit_id,  'הדרך שלי (דמו)', 78, 68, today - 30, 2500, 3, 8000),
    (friend_id, 'חוזרת לכושר (דמו)', 90, 80, today - 21, 2000, 3, 7000)
  on conflict (user_id) do update set
    goal_title = excluded.goal_title,
    start_weight = excluded.start_weight,
    goal_weight = excluded.goal_weight,
    start_date = excluded.start_date,
    water_goal_ml = excluded.water_goal_ml,
    weekly_workout_goal = excluded.weekly_workout_goal,
    step_goal = excluded.step_goal,
    updated_at = now();

  -- -------------------------------------------------------------------------
  -- 4. Days: the last 7 days for each user (today included).
  -- -------------------------------------------------------------------------
  insert into public.days
    (user_id, date, water_ml, steps, challenge_done, journal, menu_star)
  select
    x.uid,
    today - g.n,
    1200 + ((g.n * 370 + x.salt) % 1500),
    4500 + ((g.n * 1130 + x.salt * 3) % 6500),
    (g.n % 2 = 0),
    jsonb_build_object(
      'breakfast', 'יוגורט, גרנולה ופירות',
      'lunch',     'חזה עוף, אורז וסלט',
      'dinner',    'ביצים וסלט ירקות',
      'snacks',    'תפוח ושקדים',
      'notes',     'יום טוב, שבעה/שבע ברוב היום'
    ),
    case when g.n % 3 = 0 then 1 when g.n % 3 = 1 then 0.5 else 0 end
  from (values (nirit_id, 0), (friend_id, 7)) as x(uid, salt)
  cross join generate_series(0, 6) as g(n)
  on conflict (user_id, date) do update set
    water_ml = excluded.water_ml,
    steps = excluded.steps,
    challenge_done = excluded.challenge_done,
    journal = excluded.journal,
    menu_star = excluded.menu_star,
    updated_at = now();

  -- -------------------------------------------------------------------------
  -- 5. Workouts: replace only the demo rows (note prefix "דמו:").
  -- -------------------------------------------------------------------------
  delete from public.workouts
   where user_id in (nirit_id, friend_id) and note like 'דמו:%';

  insert into public.workouts (user_id, scheduled_date, scheduled_time, type, note, done) values
    (nirit_id,  today - 2, '07:00', 'ריצה קלה',     'דמו: 5 ק"מ',          true),
    (nirit_id,  today,     '18:30', 'אימון כוח',    'דמו: רגליים וגב',     false),
    (nirit_id,  today + 2, '07:00', 'פילאטיס',      'דמו: שיעור סטודיו',   false),
    (friend_id, today - 1, '19:00', 'הליכה מהירה',  'דמו: 40 דקות',        true),
    (friend_id, today + 1, '18:00', 'יוגה',         'דמו: שיעור ערב',      false);

  -- -------------------------------------------------------------------------
  -- 6. Measures: one at the start, one recent (shows progress).
  -- -------------------------------------------------------------------------
  insert into public.measures
    (user_id, date, weight, body_fat_pct, muscle_pct, circumferences)
  values
    (nirit_id,  today - 28, 78.0, 31.0, 36.0, '{"waist":84,"hips":104,"chest":96}'::jsonb),
    (nirit_id,  today - 3,  75.6, 29.5, 36.8, '{"waist":81,"hips":102,"chest":95}'::jsonb),
    (friend_id, today - 20, 90.0, 34.0, 33.0, '{"waist":98,"hips":112,"chest":104}'::jsonb),
    (friend_id, today - 2,  88.1, 32.8, 33.6, '{"waist":95,"hips":110,"chest":102}'::jsonb)
  on conflict (user_id, date) do update set
    weight = excluded.weight,
    body_fat_pct = excluded.body_fat_pct,
    muscle_pct = excluded.muscle_pct,
    circumferences = excluded.circumferences;
end
$seed$;
