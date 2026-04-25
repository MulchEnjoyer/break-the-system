"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, MapPin, RotateCcw, TimerReset } from "lucide-react";

import { FIND_STAGE_SECONDS, JUDGE_STAGE_SECONDS } from "@/lib/constants";
import type { JudgeAssignmentPayload } from "@/lib/types/domain";
import { formatRelativeSeconds, formatStreamLabel } from "@/lib/utils";
import { EmptyState, SectionCard, StatusPill } from "@/components/ui";

type JudgeAppProps = {
  token: string;
  initialPayload: JudgeAssignmentPayload;
};

async function postJudgeAction<T>(
  endpoint: string,
  body: Record<string, string>,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "The request failed.");
  }

  return payload;
}

export function JudgeApp({ token, initialPayload }: JudgeAppProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const autoSkipAssignmentId = useRef<string | null>(null);

  const assignment = payload.assignment;
  const expiresAtMs = assignment ? new Date(assignment.expires_at).getTime() : 0;
  const secondsRemaining = assignment
    ? Math.max(0, Math.ceil((expiresAtMs - now) / 1000))
    : 0;
  const isFindStage = assignment?.status === "reserved_find";
  const isJudgeStage = assignment?.status === "reserved_judge";
  const canCompare = Boolean(isJudgeStage && secondsRemaining === 0);
  const hasReference = Boolean(payload.judgeState.last_completed_project_id);

  async function performJudgeAction(
    endpoint: string,
    body: Record<string, string>,
  ) {
    setPending(true);
    setError(null);

    try {
      const nextPayload = await postJudgeAction<JudgeAssignmentPayload>(
        endpoint,
        body,
      );
      setPayload(nextPayload);
      autoSkipAssignmentId.current = null;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "That action could not be completed.",
      );
    } finally {
      setPending(false);
    }
  }

  const refreshAssignmentInEffect = useEffectEvent(() => {
    void performJudgeAction("/api/judge/next", { token });
  });

  const skipAssignmentInEffect = useEffectEvent((assignmentId: string) => {
    void performJudgeAction("/api/judge/skip", {
      token,
      assignmentId,
    });
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!payload.judgingOpen || assignment || pending) {
      return;
    }

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        refreshAssignmentInEffect();
      });
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [assignment, payload.judgingOpen, pending]);

  useEffect(() => {
    if (!assignment || assignment.status !== "reserved_find" || secondsRemaining > 0) {
      return;
    }

    if (autoSkipAssignmentId.current === assignment.id || pending) {
      return;
    }

    autoSkipAssignmentId.current = assignment.id;
    skipAssignmentInEffect(assignment.id);
  }, [assignment, pending, secondsRemaining]);

  return (
    <div className="grid gap-4">
      <SectionCard className="overflow-hidden p-0">
        <div className="bg-[linear-gradient(145deg,#fff2db_0%,#ffe1a3_35%,#ffd18e_100%)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-700">
                Mobile judge
              </p>
              <h1 className="mt-3 font-display text-4xl leading-none text-stone-950">
                {payload.judge.name ?? "Judge session"}
              </h1>
            </div>
            <StatusPill
              label={payload.judgingOpen ? "Judging open" : "Judging closed"}
              tone={payload.judgingOpen ? "success" : "warning"}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-white/75 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Comparisons
              </p>
              <p className="mt-2 font-display text-4xl text-stone-950">
                {payload.judgeState.comparisons_completed}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/75 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Skips
              </p>
              <p className="mt-2 font-display text-4xl text-stone-950">
                {payload.judgeState.skips_count}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {!payload.judgingOpen ? (
        <EmptyState
          title="Judging is closed."
          description="Ask the organizer to open judging from the admin dashboard before requesting more assignments."
        />
      ) : null}

      {!assignment && payload.judgingOpen ? (
        <SectionCard className="space-y-4">
          <EmptyState
            title="No assignment ready right now."
            description={
              payload.message ??
              "Every eligible project may be reserved. This page will keep polling for the next open table."
            }
          />
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  void performJudgeAction("/api/judge/next", { token });
                });
              }}
              disabled={pending}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-900 transition hover:border-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 size-4" />
            )}
            Refresh queue
          </button>
        </SectionCard>
      ) : null}

      {assignment ? (
        <SectionCard className="overflow-hidden p-0">
          <div className="border-b border-stone-200/80 bg-stone-950 px-5 py-4 text-stone-50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-200">
                  {isFindStage ? "Find the team" : "Judging window"}
                </p>
                <p className="mt-2 text-sm text-stone-300">
                  {isFindStage
                    ? `You have ${FIND_STAGE_SECONDS / 60} minute to get to the table.`
                    : `You have ${JUDGE_STAGE_SECONDS / 60} minutes to hear the pitch.`}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-300">
                  Timer
                </p>
                <p className="mt-1 font-display text-5xl leading-none text-white">
                  {formatRelativeSeconds(secondsRemaining)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5">
            <div className="rounded-[28px] border border-orange-200 bg-[linear-gradient(180deg,#fffdf9_0%,#fff4e4_100%)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
                Table
              </p>
              <p className="mt-3 font-display text-[6rem] leading-none text-stone-950 sm:text-[8rem]">
                {assignment.project.table_number}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill
                  label={formatStreamLabel(assignment.project.stream)}
                  tone="default"
                />
                <StatusPill
                  label={isFindStage ? "Walking" : "At table"}
                  tone={isFindStage ? "warning" : "success"}
                />
              </div>

              <div>
                <h2 className="font-display text-4xl leading-tight text-stone-950">
                  {assignment.project.title}
                </h2>
                <p className="mt-2 text-lg text-stone-700">
                  {assignment.project.team_name}
                </p>
              </div>

              <p className="text-base leading-7 text-stone-700">
                {assignment.project.description}
              </p>

              <div className="flex flex-wrap gap-3">
                <a
                  href={assignment.project.project_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center rounded-full border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
                >
                  <ExternalLink className="mr-2 size-4" />
                  Open project link
                </a>
                <div className="inline-flex min-h-12 items-center rounded-full border border-stone-300 px-5 text-sm text-stone-700">
                  <MapPin className="mr-2 size-4" />
                  Go straight to table {assignment.project.table_number}
                </div>
              </div>
            </div>

            {isFindStage ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void performJudgeAction("/api/judge/found", {
                    token,
                    assignmentId: assignment.id,
                  });
                }}
                className="inline-flex min-h-16 w-full items-center justify-center rounded-[22px] bg-stone-950 px-6 text-base font-semibold uppercase tracking-[0.2em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {pending ? (
                  <LoaderCircle className="mr-2 size-5 animate-spin" />
                ) : (
                  <TimerReset className="mr-2 size-5" />
                )}
                Found team
              </button>
            ) : null}

            {isJudgeStage && !canCompare ? (
              <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                Listen, ask the fastest clarifying question you need, then record the overall pairwise call when the timer ends.
              </div>
            ) : null}

            {isJudgeStage && canCompare ? (
              <div className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                {hasReference ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                      Pairwise decision
                    </p>
                    <p className="text-base leading-7 text-stone-800">
                      Compared with{" "}
                      <span className="font-semibold text-stone-950">
                        {payload.judgeState.last_completed_project_title}
                      </span>
                      , this project was:
                    </p>
                    <div className="grid gap-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          void performJudgeAction("/api/judge/complete", {
                            token,
                            assignmentId: assignment.id,
                            outcome: "better",
                          });
                        }}
                        className="inline-flex min-h-16 items-center justify-center rounded-[22px] bg-emerald-600 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        Better than previous
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          void performJudgeAction("/api/judge/complete", {
                            token,
                            assignmentId: assignment.id,
                            outcome: "worse",
                          });
                        }}
                        className="inline-flex min-h-16 items-center justify-center rounded-[22px] bg-stone-900 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                      >
                        Worse than previous
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          void performJudgeAction("/api/judge/skip", {
                            token,
                            assignmentId: assignment.id,
                          });
                        }}
                        className="inline-flex min-h-16 items-center justify-center rounded-[22px] border border-stone-300 bg-white px-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-900 transition hover:border-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Skip
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                      Seed project
                    </p>
                    <p className="text-base leading-7 text-stone-800">
                      This is your first completed visit, so it becomes the baseline for your next pairwise comparison.
                    </p>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        void performJudgeAction("/api/judge/complete", {
                          token,
                          assignmentId: assignment.id,
                          outcome: "seed",
                        });
                      }}
                      className="inline-flex min-h-16 w-full items-center justify-center rounded-[22px] bg-stone-950 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                    >
                      Set as baseline
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <div className="text-center text-xs uppercase tracking-[0.24em] text-stone-500">
        <Link href="/results" className="underline decoration-dotted underline-offset-4">
          View live results
        </Link>
      </div>
    </div>
  );
}
