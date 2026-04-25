alter table public.projects
  drop constraint if exists projects_event_id_table_number_key;

create index if not exists projects_event_table_number_idx
  on public.projects (event_id, table_number);

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
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  if not v_judge.active then
    raise exception 'Judge access has been revoked.';
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
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  if not v_judge.active then
    raise exception 'Judge access has been revoked.';
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
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  if not v_judge.active then
    raise exception 'Judge access has been revoked.';
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
  for update;

  if not found then
    raise exception 'Judge session not found.';
  end if;

  if not v_judge.active then
    raise exception 'Judge access has been revoked.';
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
