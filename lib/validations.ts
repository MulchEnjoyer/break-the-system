import { z } from "zod";

export const streamSchema = z.enum(["most_useful", "most_useless"]);

function normalizeProjectLink(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export const submissionSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(80, "Keep team names under 80 characters."),
  projectTitle: z
    .string()
    .trim()
    .min(1, "Project title is required.")
    .max(120, "Keep project titles under 120 characters."),
  shortDescription: z
    .string()
    .trim()
    .min(1, "Short description is required.")
    .max(300, "Keep the description under 300 characters."),
  stream: streamSchema,
  tableNumber: z.coerce
    .number()
    .int("Table number must be a whole number.")
    .positive("Table number must be positive."),
  projectLink: z.preprocess(
    normalizeProjectLink,
    z
      .string()
      .trim()
      .url("Project link must be a valid URL.")
      .refine((value) => /^https?:\/\//.test(value), {
        message: "Project link must use http:// or https://.",
      }),
  ),
});

export const judgeTokenSchema = z.object({
  token: z.string().trim().min(1),
});

export const assignmentActionSchema = z.object({
  token: z.string().trim().min(1),
  assignmentId: z.string().uuid("Assignment ID is invalid."),
});

export const completionSchema = assignmentActionSchema.extend({
  outcome: z.enum(["better", "worse", "seed"]),
});

export const adminSessionSchema = z.object({
  accessToken: z.string().trim().min(1),
});

export const judgeGenerationSchema = z.object({
  accessToken: z.string().trim().min(1),
  count: z.coerce
    .number()
    .int()
    .min(1, "Generate at least one judge link.")
    .max(24, "This MVP caps bulk judge generation at 24."),
  prefix: z
    .string()
    .trim()
    .max(32, "Keep the judge prefix under 32 characters.")
    .optional()
    .transform((value) => value || "Judge"),
});

export const eventControlSchema = z.object({
  accessToken: z.string().trim().min(1),
  action: z.enum([
    "open_submissions",
    "close_submissions",
    "open_judging",
    "close_judging",
    "freeze_rankings",
  ]),
});

export const adminProjectActionSchema = z.object({
  accessToken: z.string().trim().min(1),
  projectId: z.string().uuid("Project ID is invalid."),
  action: z.enum(["withdraw"]),
});

export const adminJudgeActionSchema = z.object({
  accessToken: z.string().trim().min(1),
  judgeId: z.string().uuid("Judge ID is invalid."),
  action: z.enum(["revoke", "delete"]),
});

export const judgePayloadSchema = z.object({
  judgingOpen: z.boolean(),
  message: z.string().nullable().optional(),
  judge: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    active: z.boolean(),
    last_seen_at: z.string(),
  }),
  judgeState: z.object({
    comparisons_completed: z.number().int().nonnegative(),
    skips_count: z.number().int().nonnegative(),
    last_completed_project_id: z.string().uuid().nullable(),
    last_completed_project_title: z.string().nullable(),
  }),
  assignment: z
    .object({
      id: z.string().uuid(),
      status: z.enum([
        "reserved_find",
        "reserved_judge",
        "completed",
        "skipped",
        "expired",
      ]),
      reserved_at: z.string(),
      expires_at: z.string(),
      project: z.object({
        id: z.string().uuid(),
        title: z.string(),
        team_name: z.string(),
        description: z.string(),
        stream: streamSchema,
        table_number: z.number().int(),
        project_link: z.string().url(),
        visit_count: z.number().int().nonnegative(),
        comparison_count: z.number().int().nonnegative(),
      }),
    })
    .nullable(),
});
