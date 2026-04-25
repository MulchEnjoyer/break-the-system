import { judgePayloadSchema } from "@/lib/validations";
import type { JudgeAssignmentPayload } from "@/lib/types/domain";
import { createServiceRoleClient } from "@/lib/supabase/server";

function getRpcErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The judge action could not be completed.";
}

async function callJudgeRpc(
  fn:
    | "get_next_assignment"
    | "confirm_assignment_found"
    | "skip_assignment"
    | "complete_assignment",
  args: Record<string, string>,
) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc(fn, args as never);

  if (error) {
    throw new Error(getRpcErrorMessage(error));
  }

  return judgePayloadSchema.parse(data) as JudgeAssignmentPayload;
}

export async function getNextAssignment(token: string) {
  return callJudgeRpc("get_next_assignment", {
    p_judge_token: token,
  });
}

export async function confirmAssignmentFound(
  token: string,
  assignmentId: string,
) {
  return callJudgeRpc("confirm_assignment_found", {
    p_assignment_id: assignmentId,
    p_judge_token: token,
  });
}

export async function skipAssignment(token: string, assignmentId: string) {
  await callJudgeRpc("skip_assignment", {
    p_assignment_id: assignmentId,
    p_judge_token: token,
  });

  return getNextAssignment(token);
}

export async function completeAssignment(
  token: string,
  assignmentId: string,
  outcome: "better" | "worse" | "seed",
) {
  await callJudgeRpc("complete_assignment", {
    p_assignment_id: assignmentId,
    p_judge_token: token,
    p_outcome: outcome,
  });

  return getNextAssignment(token);
}
