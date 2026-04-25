import type { EventRow } from "@/lib/types/domain";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function getCurrentEvent() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<EventRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getJudgeByToken(token: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("judges")
    .select("id, name, token, active, created_at, last_seen_at, event_id")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getJudgeSessionByToken(token: string) {
  const supabase = createServiceRoleClient();

  const { data: judge, error: judgeError } = await supabase
    .from("judges")
    .select("id, name, token, active, created_at, last_seen_at, event_id")
    .eq("token", token)
    .maybeSingle();

  if (judgeError) {
    throw new Error(judgeError.message);
  }

  if (!judge) {
    return null;
  }

  const { data: judgeState, error: stateError } = await supabase
    .from("judge_state")
    .select("comparisons_completed, skips_count, last_completed_project_id")
    .eq("judge_id", judge.id)
    .maybeSingle();

  if (stateError) {
    throw new Error(stateError.message);
  }

  let lastCompletedProjectTitle: string | null = null;

  if (judgeState?.last_completed_project_id) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("title")
      .eq("id", judgeState.last_completed_project_id)
      .maybeSingle();

    if (projectError) {
      throw new Error(projectError.message);
    }

    lastCompletedProjectTitle = project?.title ?? null;
  }

  return {
    judge,
    judgeState: {
      comparisons_completed: judgeState?.comparisons_completed ?? 0,
      skips_count: judgeState?.skips_count ?? 0,
      last_completed_project_id: judgeState?.last_completed_project_id ?? null,
      last_completed_project_title: lastCompletedProjectTitle,
    },
  };
}
