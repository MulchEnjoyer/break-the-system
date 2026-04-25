export const dynamic = "force-dynamic";

import Link from "next/link";

import { COVERAGE_TARGET } from "@/lib/constants";
import { getResultsState } from "@/lib/data/admin";
import { formatDateTime, formatStreamLabel } from "@/lib/utils";
import {
  EmptyState,
  PageShell,
  SectionCard,
  SectionHeading,
  StatusPill,
} from "@/components/ui";

export default async function ResultsPage() {
  const { event, rankings, underReviewed, frozenAt } = await getResultsState();

  return (
    <PageShell>
      <div className="grid gap-6">
        <SectionCard className="overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,#fff4d8_0%,#ffe1a6_40%,#ffd0a0_100%)] p-6">
            <StatusPill
              label={event.rankings_frozen ? "Frozen results" : "Live results"}
              tone={event.rankings_frozen ? "warning" : "success"}
            />
            <h1 className="mt-4 font-display text-5xl leading-none text-stone-950">
              {event.name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
              Pairwise rankings for the shared judging pool. Coverage still matters: low-visit projects should be treated with more caution than heavily seen projects.
            </p>
            {frozenAt ? (
              <p className="mt-4 text-sm text-stone-600">
                Frozen at {formatDateTime(frozenAt)}
              </p>
            ) : null}
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SectionCard className="space-y-5">
            <SectionHeading
              eyebrow="Leaderboard"
              title="Current order"
              description="Scores update from pairwise outcomes. This board is meant for shortlist generation or final placement depending on when organizers freeze it."
            />
            {rankings.length === 0 ? (
              <EmptyState
                title="No rankings yet."
                description="Results will appear once judges complete enough pairwise comparisons."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    <tr>
                      <th className="pb-3">Rank</th>
                      <th className="pb-3">Project</th>
                      <th className="pb-3">Table</th>
                      <th className="pb-3">Rating</th>
                      <th className="pb-3">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((entry, index) => (
                      <tr key={entry.projectId} className="border-t border-stone-200/80">
                        <td className="py-4 font-display text-2xl text-stone-950">
                          {entry.frozenPosition ?? index + 1}
                        </td>
                        <td className="py-4">
                          <p className="font-semibold text-stone-950">{entry.title}</p>
                          <p className="mt-1 text-stone-600">{entry.teamName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                            {formatStreamLabel(entry.stream)}
                          </p>
                        </td>
                        <td className="py-4 text-stone-700">{entry.tableNumber}</td>
                        <td className="py-4 text-stone-700">
                          {entry.rating.toFixed(1)}
                        </td>
                        <td className="py-4 text-stone-700">{entry.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard className="space-y-5">
            <SectionHeading
              eyebrow="Coverage watch"
              title="Projects still below target"
              description={`The current floor target is ${COVERAGE_TARGET} visits per project.`}
            />
            {underReviewed.length === 0 ? (
              <EmptyState
                title="Coverage target reached."
                description="Every project has met the current minimum visit threshold."
              />
            ) : (
              <div className="grid gap-3">
                {underReviewed.map((entry) => (
                  <div
                    key={entry.projectId}
                    className="rounded-[22px] border border-stone-200 bg-white/85 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-stone-950">
                          Table {entry.tableNumber}: {entry.title}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">{entry.teamName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                          Visits
                        </p>
                        <p className="font-display text-3xl text-stone-950">
                          {entry.visits}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="text-center text-sm text-stone-600">
          <Link href="/submit" className="underline decoration-dotted underline-offset-4">
            Submit a new project
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
