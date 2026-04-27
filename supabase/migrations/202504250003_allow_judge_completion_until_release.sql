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

grant execute on function public.complete_assignment(text, uuid, text) to anon, authenticated, service_role;
