create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'judging_stream') then
    create type public.judging_stream as enum ('most_useful', 'most_useless');
  end if;

  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('active', 'submitted', 'withdrawn');
  end if;

  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum (
      'reserved_find',
      'reserved_judge',
      'completed',
      'skipped',
      'expired'
    );
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  submissions_open boolean not null default true,
  judging_open boolean not null default false,
  rankings_frozen boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_name text not null check (length(trim(team_name)) > 0),
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  stream public.judging_stream not null,
  table_number integer not null check (table_number > 0),
  project_link text not null check (project_link ~* '^https?://'),
  status public.project_status not null default 'active',
  visit_count integer not null default 0 check (visit_count >= 0),
  comparison_count integer not null default 0 check (comparison_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, table_number)
);

create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text,
  token text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.judge_state (
  judge_id uuid primary key references public.judges(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  last_completed_project_id uuid references public.projects(id) on delete set null,
  comparisons_completed integer not null default 0 check (comparisons_completed >= 0),
  skips_count integer not null default 0 check (skips_count >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  judge_id uuid not null references public.judges(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status public.assignment_status not null,
  reserved_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  found_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.comparisons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  judge_id uuid not null references public.judges(id) on delete cascade,
  previous_project_id uuid not null references public.projects(id) on delete cascade,
  current_project_id uuid not null references public.projects(id) on delete cascade,
  winner_project_id uuid not null references public.projects(id) on delete cascade,
  loser_project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (winner_project_id <> loser_project_id)
);

create table if not exists public.project_rankings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rating numeric(10, 4) not null default 1500,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  comparisons integer not null default 0 check (comparisons >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  frozen_position integer not null,
  rating numeric(10, 4) not null,
  wins integer not null,
  losses integer not null,
  comparisons integer not null,
  visit_count integer not null,
  frozen_at timestamptz not null default timezone('utc', now()),
  unique (event_id, project_id)
);

create table if not exists public.admin_users (
  email text primary key,
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists projects_event_status_idx
  on public.projects (event_id, status, visit_count, table_number);
create index if not exists judges_event_last_seen_idx
  on public.judges (event_id, active, last_seen_at desc);
create index if not exists assignments_event_status_expiry_idx
  on public.assignments (event_id, status, expires_at);
create index if not exists assignments_judge_idx
  on public.assignments (judge_id, created_at desc);
create index if not exists assignments_project_idx
  on public.assignments (project_id, created_at desc);
create index if not exists comparisons_event_created_idx
  on public.comparisons (event_id, created_at desc);
create index if not exists ranking_snapshots_event_position_idx
  on public.ranking_snapshots (event_id, frozen_position asc);

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists set_judge_state_updated_at on public.judge_state;
create trigger set_judge_state_updated_at
before update on public.judge_state
for each row
execute function public.set_updated_at();

drop trigger if exists set_project_rankings_updated_at on public.project_rankings;
create trigger set_project_rankings_updated_at
before update on public.project_rankings
for each row
execute function public.set_updated_at();

create or replace function public.create_project_ranking()
returns trigger
language plpgsql
as $$
begin
  insert into public.project_rankings (project_id, event_id)
  values (new.id, new.event_id)
  on conflict (project_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_project_ranking_after_insert on public.projects;
create trigger create_project_ranking_after_insert
after insert on public.projects
for each row
execute function public.create_project_ranking();

create or replace function public.create_judge_state_row()
returns trigger
language plpgsql
as $$
begin
  insert into public.judge_state (judge_id, event_id)
  values (new.id, new.event_id)
  on conflict (judge_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_judge_state_after_insert on public.judges;
create trigger create_judge_state_after_insert
after insert on public.judges
for each row
execute function public.create_judge_state_row();

create or replace function public.current_event_id()
returns uuid
language sql
stable
as $$
  select id
  from public.events
  order by created_at asc
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.expire_stale_assignments(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.assignments
  set status = 'expired'
  where event_id = p_event_id
    and status in ('reserved_find', 'reserved_judge')
    and expires_at <= timezone('utc', now()) - interval '15 seconds';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.touch_judge(p_judge_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.judges
  set last_seen_at = timezone('utc', now())
  where id = p_judge_id;
$$;

create or replace function public.assignment_payload(p_assignment_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'reserved_at', a.reserved_at,
    'expires_at', a.expires_at,
    'project', jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'team_name', p.team_name,
      'description', p.description,
      'stream', p.stream,
      'table_number', p.table_number,
      'project_link', p.project_link,
      'visit_count', p.visit_count,
      'comparison_count', p.comparison_count
    )
  )
  from public.assignments a
  join public.projects p on p.id = a.project_id
  where a.id = p_assignment_id;
$$;

create or replace function public.judge_payload(p_judge_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'judge', jsonb_build_object(
      'id', j.id,
      'name', j.name,
      'active', j.active,
      'last_seen_at', j.last_seen_at
    ),
    'judgeState', jsonb_build_object(
      'comparisons_completed', coalesce(js.comparisons_completed, 0),
      'skips_count', coalesce(js.skips_count, 0),
      'last_completed_project_id', js.last_completed_project_id,
      'last_completed_project_title', lp.title
    )
  )
  from public.judges j
  left join public.judge_state js on js.judge_id = j.id
  left join public.projects lp on lp.id = js.last_completed_project_id
  where j.id = p_judge_id;
$$;

create or replace function public.apply_elo_result(
  p_event_id uuid,
  p_winner_project_id uuid,
  p_loser_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner_rating numeric(10, 4);
  loser_rating numeric(10, 4);
  winner_expected numeric;
  loser_expected numeric;
  k_factor numeric := 24;
begin
  insert into public.project_rankings (project_id, event_id)
  values (p_winner_project_id, p_event_id), (p_loser_project_id, p_event_id)
  on conflict (project_id) do nothing;

  select rating into winner_rating
  from public.project_rankings
  where project_id = p_winner_project_id
  for update;

  select rating into loser_rating
  from public.project_rankings
  where project_id = p_loser_project_id
  for update;

  winner_expected := 1 / (1 + power(10, (loser_rating - winner_rating) / 400));
  loser_expected := 1 / (1 + power(10, (winner_rating - loser_rating) / 400));

  update public.project_rankings
  set
    rating = round((winner_rating + k_factor * (1 - winner_expected))::numeric, 4),
    wins = wins + 1,
    comparisons = comparisons + 1
  where project_id = p_winner_project_id;

  update public.project_rankings
  set
    rating = round((loser_rating + k_factor * (0 - loser_expected))::numeric, 4),
    losses = losses + 1,
    comparisons = comparisons + 1
  where project_id = p_loser_project_id;
end;
$$;

create or replace function public.get_next_assignment(p_judge_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_judge public.judges%rowtype;
  v_event public.events%rowtype;
  v_assignment public.assignments%rowtype;
  v_selected_project public.projects%rowtype;
  v_min_visit_count integer;
begin
  select *
  into v_judge
  from public.judges
  where token = p_judge_token
    and active = true
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  select *
  into v_event
  from public.events
  where id = v_judge.event_id;

  insert into public.judge_state (judge_id, event_id)
  values (v_judge.id, v_judge.event_id)
  on conflict (judge_id) do nothing;

  perform public.touch_judge(v_judge.id);
  perform public.expire_stale_assignments(v_judge.event_id);

  if not v_event.judging_open then
    return jsonb_build_object(
      'judgingOpen', false,
      'assignment', null,
      'message', 'Judging is currently closed.'
    ) || public.judge_payload(v_judge.id);
  end if;

  select *
  into v_assignment
  from public.assignments
  where judge_id = v_judge.id
    and status in ('reserved_find', 'reserved_judge')
    and expires_at > timezone('utc', now()) - interval '15 seconds'
  order by created_at desc
  limit 1;

  if v_assignment.id is null then
    select min(p.visit_count)
    into v_min_visit_count
    from public.projects p
    where p.event_id = v_judge.event_id
      and p.status = 'active'
      and not exists (
        select 1
        from public.assignments active_assignment
        where active_assignment.project_id = p.id
          and active_assignment.status in ('reserved_find', 'reserved_judge')
          and active_assignment.expires_at > timezone('utc', now()) - interval '15 seconds'
      )
      and not exists (
        select 1
        from public.assignments prior_assignment
        where prior_assignment.project_id = p.id
          and prior_assignment.judge_id = v_judge.id
          and prior_assignment.status in ('completed', 'skipped')
      );

    if v_min_visit_count is not null then
      select *
      into v_selected_project
      from public.projects p
      where p.event_id = v_judge.event_id
        and p.status = 'active'
        and p.visit_count = v_min_visit_count
        and not exists (
          select 1
          from public.assignments active_assignment
          where active_assignment.project_id = p.id
            and active_assignment.status in ('reserved_find', 'reserved_judge')
            and active_assignment.expires_at > timezone('utc', now()) - interval '15 seconds'
        )
        and not exists (
          select 1
          from public.assignments prior_assignment
          where prior_assignment.project_id = p.id
            and prior_assignment.judge_id = v_judge.id
            and prior_assignment.status in ('completed', 'skipped')
        )
      order by random()
      limit 1
      for update skip locked;

      if v_selected_project.id is not null then
        insert into public.assignments (
          event_id,
          judge_id,
          project_id,
          status,
          reserved_at,
          expires_at
        )
        values (
          v_judge.event_id,
          v_judge.id,
          v_selected_project.id,
          'reserved_find',
          timezone('utc', now()),
          timezone('utc', now()) + interval '1 minute'
        )
        returning *
        into v_assignment;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'judgingOpen', true,
    'assignment', case
      when v_assignment.id is null then null
      else public.assignment_payload(v_assignment.id)
    end,
    'message', case
      when v_assignment.id is null then 'No eligible projects are available right now.'
      else null
    end
  ) || public.judge_payload(v_judge.id);
end;
$$;

create or replace function public.confirm_assignment_found(
  p_judge_token text,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_judge public.judges%rowtype;
  v_assignment public.assignments%rowtype;
begin
  select *
  into v_judge
  from public.judges
  where token = p_judge_token
    and active = true
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  perform public.expire_stale_assignments(v_judge.event_id);

  update public.assignments
  set
    status = 'reserved_judge',
    found_at = coalesce(found_at, timezone('utc', now())),
    expires_at = timezone('utc', now()) + interval '2 minutes'
  where id = p_assignment_id
    and judge_id = v_judge.id
    and status = 'reserved_find'
    and expires_at > timezone('utc', now()) - interval '15 seconds'
  returning *
  into v_assignment;

  if v_assignment.id is null then
    select *
    into v_assignment
    from public.assignments
    where id = p_assignment_id
      and judge_id = v_judge.id
      and status = 'reserved_judge'
      and expires_at > timezone('utc', now()) - interval '15 seconds';
  end if;

  if v_assignment.id is null then
    raise exception 'Assignment is no longer available.';
  end if;

  perform public.touch_judge(v_judge.id);

  return jsonb_build_object(
    'judgingOpen', true,
    'assignment', public.assignment_payload(v_assignment.id),
    'message', null
  ) || public.judge_payload(v_judge.id);
end;
$$;

create or replace function public.skip_assignment(
  p_judge_token text,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_judge public.judges%rowtype;
  v_assignment public.assignments%rowtype;
begin
  select *
  into v_judge
  from public.judges
  where token = p_judge_token
    and active = true
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  select *
  into v_assignment
  from public.assignments
  where id = p_assignment_id
    and judge_id = v_judge.id
    and status in ('reserved_find', 'reserved_judge')
  for update;

  if v_assignment.id is null then
    raise exception 'Assignment is no longer active.';
  end if;

  update public.assignments
  set
    status = 'skipped',
    completed_at = timezone('utc', now())
  where id = v_assignment.id;

  if v_assignment.found_at is not null or v_assignment.status = 'reserved_judge' then
    update public.projects
    set visit_count = visit_count + 1
    where id = v_assignment.project_id;
  end if;

  update public.judge_state
  set
    skips_count = skips_count + 1,
    updated_at = timezone('utc', now())
  where judge_id = v_judge.id;

  perform public.touch_judge(v_judge.id);

  return jsonb_build_object('skipped', true) || public.judge_payload(v_judge.id);
end;
$$;

create or replace function public.complete_assignment(
  p_judge_token text,
  p_assignment_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_judge public.judges%rowtype;
  v_assignment public.assignments%rowtype;
  v_state public.judge_state%rowtype;
  v_winner_project_id uuid;
  v_loser_project_id uuid;
begin
  select *
  into v_judge
  from public.judges
  where token = p_judge_token
    and active = true
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  if p_outcome not in ('better', 'worse', 'seed') then
    raise exception 'Outcome must be better, worse, or seed.';
  end if;

  select *
  into v_assignment
  from public.assignments
  where id = p_assignment_id
    and judge_id = v_judge.id
    and status = 'reserved_judge'
    and expires_at > timezone('utc', now()) - interval '15 seconds'
  for update;

  if v_assignment.id is null then
    raise exception 'Assignment is no longer available for completion.';
  end if;

  select *
  into v_state
  from public.judge_state
  where judge_id = v_judge.id
  for update;

  update public.assignments
  set
    status = 'completed',
    completed_at = timezone('utc', now())
  where id = v_assignment.id;

  update public.projects
  set visit_count = visit_count + 1
  where id = v_assignment.project_id;

  if v_state.last_completed_project_id is null or p_outcome = 'seed' then
    update public.judge_state
    set
      last_completed_project_id = v_assignment.project_id,
      updated_at = timezone('utc', now())
    where judge_id = v_judge.id;

    perform public.touch_judge(v_judge.id);
    return jsonb_build_object('comparisonCreated', false) || public.judge_payload(v_judge.id);
  end if;

  if p_outcome = 'better' then
    v_winner_project_id := v_assignment.project_id;
    v_loser_project_id := v_state.last_completed_project_id;
  else
    v_winner_project_id := v_state.last_completed_project_id;
    v_loser_project_id := v_assignment.project_id;
  end if;

  insert into public.comparisons (
    event_id,
    judge_id,
    previous_project_id,
    current_project_id,
    winner_project_id,
    loser_project_id
  )
  values (
    v_judge.event_id,
    v_judge.id,
    v_state.last_completed_project_id,
    v_assignment.project_id,
    v_winner_project_id,
    v_loser_project_id
  );

  update public.projects
  set comparison_count = comparison_count + 1
  where id in (v_winner_project_id, v_loser_project_id);

  perform public.apply_elo_result(
    v_judge.event_id,
    v_winner_project_id,
    v_loser_project_id
  );

  update public.judge_state
  set
    last_completed_project_id = v_assignment.project_id,
    comparisons_completed = comparisons_completed + 1,
    updated_at = timezone('utc', now())
  where judge_id = v_judge.id;

  perform public.touch_judge(v_judge.id);

  return jsonb_build_object('comparisonCreated', true) || public.judge_payload(v_judge.id);
end;
$$;

grant execute on function public.get_next_assignment(text) to anon, authenticated, service_role;
grant execute on function public.confirm_assignment_found(text, uuid) to anon, authenticated, service_role;
grant execute on function public.skip_assignment(text, uuid) to anon, authenticated, service_role;
grant execute on function public.complete_assignment(text, uuid, text) to anon, authenticated, service_role;

alter table public.events enable row level security;
alter table public.projects enable row level security;
alter table public.judges enable row level security;
alter table public.judge_state enable row level security;
alter table public.assignments enable row level security;
alter table public.comparisons enable row level security;
alter table public.project_rankings enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read event state" on public.events;
create policy "Public can read event state"
on public.events
for select
using (true);

drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events"
on public.events
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can submit while submissions are open" on public.projects;
create policy "Public can submit while submissions are open"
on public.projects
for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.submissions_open = true
  )
);

drop policy if exists "Admins manage projects" on public.projects;
create policy "Admins manage projects"
on public.projects
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage judges" on public.judges;
create policy "Admins manage judges"
on public.judges
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage judge state" on public.judge_state;
create policy "Admins manage judge state"
on public.judge_state
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage assignments" on public.assignments;
create policy "Admins manage assignments"
on public.assignments
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage comparisons" on public.comparisons;
create policy "Admins manage comparisons"
on public.comparisons
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage rankings" on public.project_rankings;
create policy "Admins manage rankings"
on public.project_rankings
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage ranking snapshots" on public.ranking_snapshots;
create policy "Admins manage ranking snapshots"
on public.ranking_snapshots
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage admin users" on public.admin_users;
create policy "Admins manage admin users"
on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.events (
  name,
  submissions_open,
  judging_open,
  rankings_frozen
)
select
  'Hackathon Judging',
  true,
  false,
  false
where not exists (
  select 1
  from public.events
);
