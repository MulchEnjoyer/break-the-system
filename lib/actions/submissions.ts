"use server";

import { revalidatePath } from "next/cache";

import type { SubmissionFormState } from "@/lib/types/domain";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { submissionSchema } from "@/lib/validations";
import { getCurrentEvent } from "@/lib/data/public";

export async function submitProjectAction(
  _previousState: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const parsed = submissionSchema.safeParse({
    teamName: formData.get("teamName"),
    projectTitle: formData.get("projectTitle"),
    shortDescription: formData.get("shortDescription"),
    stream: formData.get("stream"),
    tableNumber: formData.get("tableNumber"),
    projectLink: formData.get("projectLink"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Fix the highlighted fields and try again.",
      success: false,
    };
  }

  const event = await getCurrentEvent();

  if (!event || !event.submissions_open) {
    return {
      message: "Submissions are closed right now.",
      success: false,
    };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("projects").insert({
    event_id: event.id,
    team_name: parsed.data.teamName,
    title: parsed.data.projectTitle,
    description: parsed.data.shortDescription,
    stream: parsed.data.stream,
    table_number: parsed.data.tableNumber,
    project_link: parsed.data.projectLink,
    status: "active",
  });

  if (error) {
    return {
      message: error.message,
      success: false,
    };
  }

  revalidatePath("/submit");
  revalidatePath("/admin");
  revalidatePath("/results");

  return {
    success: true,
    message:
      "Submission received. Judges can now find you by table number, team, and project title.",
  };
}
