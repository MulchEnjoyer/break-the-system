"use client";

import { useActionState } from "react";

import { submitProjectAction } from "@/lib/actions/submissions";
import { STREAM_OPTIONS } from "@/lib/constants";
import type { SubmissionFormState } from "@/lib/types/domain";
import { SectionCard, SectionHeading, StatusPill } from "@/components/ui";

const initialState: SubmissionFormState = {};

function FieldError({
  messages,
}: {
  messages?: string[] | undefined;
}) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return <p className="mt-2 text-sm text-rose-700">{messages[0]}</p>;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex min-h-14 items-center justify-center rounded-full bg-stone-950 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    >
      {disabled ? "Submissions closed" : "Submit project"}
    </button>
  );
}

export function SubmissionForm({
  submissionsOpen,
}: {
  submissionsOpen: boolean;
}) {
  const [state, action, pending] = useActionState(
    submitProjectAction,
    initialState,
  );

  return (
    <SectionCard className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,180,92,0.35),transparent_45%),linear-gradient(180deg,#fff9f1_0%,#fff4dc_100%)] p-6 sm:p-8">
          <StatusPill
            label={submissionsOpen ? "Submissions open" : "Submissions closed"}
            tone={submissionsOpen ? "success" : "warning"}
          />
          <div className="mt-6">
            <SectionHeading
              eyebrow="Expo Flow"
              title="Submit once. Get judged by table number."
              description="This form keeps the event floor moving: one table number, one project link, one shared judging pool."
            />
          </div>
          <div className="mt-8 space-y-4 text-sm leading-6 text-stone-700">
            <p>Required fields stay intentionally short so teams can finish on their phones in under a minute.</p>
            <p>Table numbers must be unique. If a number is already taken, the form will block it immediately after submit.</p>
            <p>Category stream is stored for filtering and prize segmentation, but judges still operate in one common room-wide queue.</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {state.success ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Submission received
              </p>
              <h3 className="mt-3 font-display text-3xl text-emerald-950">
                You are in the judging pool.
              </h3>
              <p className="mt-4 text-sm leading-6 text-emerald-900/80">
                {state.message}
              </p>
            </div>
          ) : (
            <form action={action} className="grid gap-5">
              <div>
                <label className="text-sm font-semibold text-stone-900">
                  Team name
                </label>
                <input
                  name="teamName"
                  className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  placeholder="The Socket Goblins"
                  disabled={pending || !submissionsOpen}
                />
                <FieldError messages={state.errors?.teamName} />
              </div>

              <div>
                <label className="text-sm font-semibold text-stone-900">
                  Project title
                </label>
                <input
                  name="projectTitle"
                  className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  placeholder="TrashGPT"
                  disabled={pending || !submissionsOpen}
                />
                <FieldError messages={state.errors?.projectTitle} />
              </div>

              <div>
                <label className="text-sm font-semibold text-stone-900">
                  Short description
                </label>
                <textarea
                  name="shortDescription"
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  placeholder="One sentence on what it does and why it matters."
                  disabled={pending || !submissionsOpen}
                />
                <FieldError messages={state.errors?.shortDescription} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-stone-900">
                    Category stream
                  </label>
                  <select
                    name="stream"
                    defaultValue="most_useful"
                    className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    disabled={pending || !submissionsOpen}
                  >
                    {STREAM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FieldError messages={state.errors?.stream} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-stone-900">
                    Table number
                  </label>
                  <input
                    name="tableNumber"
                    inputMode="numeric"
                    className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    placeholder="17"
                    disabled={pending || !submissionsOpen}
                  />
                  <FieldError messages={state.errors?.tableNumber} />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-stone-900">
                  Project link
                </label>
                <input
                  name="projectLink"
                  type="url"
                  className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  placeholder="https://example.com/demo"
                  disabled={pending || !submissionsOpen}
                />
                <FieldError messages={state.errors?.projectLink} />
              </div>

              {state.message && !state.success ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {state.message}
                </p>
              ) : null}

              <div className="pt-2">
                <SubmitButton disabled={pending || !submissionsOpen} />
              </div>
            </form>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
