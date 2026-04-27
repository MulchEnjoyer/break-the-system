export const dynamic = "force-dynamic";

import Link from "next/link";

import { getResultsState } from "@/lib/data/admin";
import { formatDateTime, formatStreamLabel } from "@/lib/utils";
import {
  EmptyState,
  PageShell,
  SectionCard,
  SectionHeading,
  StatusPill,
} from "@/components/ui";

function getProjectReveal(index: number, tableNumber: number) {
  if (index < 10) {
    return {
      title: `Classified contender #${String(index + 1).padStart(2, "0")}`,
      subtitle: `Table ${tableNumber} is in the top 10. Full project details stay off the public board for now.`,
      stream: "Identity withheld",
    };
  }

  return null;
}

export default async function ResultsPage() {
  const { event, rankings, frozenAt } = await getResultsState();

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
              Break The System
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
              The live board for {event.name}. Rankings are streaming in, the signal is real, and the strongest entries are starting to separate from the pack.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Top placements are intentionally censored on this public view. You can track momentum, but the leading project names stay hidden.
            </p>
            {frozenAt ? (
              <p className="mt-4 text-sm text-stone-600">
                Frozen at {formatDateTime(frozenAt)}
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard className="space-y-5">
          <SectionHeading
            eyebrow="Leaderboard"
            title="Current order"
            description="Scores update from pairwise outcomes. The board stays public, but the top 10 names are masked until organizers decide to reveal them."
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
                  {rankings.map((entry, index) => {
                    const reveal = getProjectReveal(index, entry.tableNumber);

                    return (
                      <tr key={entry.projectId} className="border-t border-stone-200/80">
                        <td className="py-4 font-display text-2xl text-stone-950">
                          {entry.frozenPosition ?? index + 1}
                        </td>
                        <td className="py-4">
                          <p className="font-semibold text-stone-950">
                            {reveal?.title ?? entry.title}
                          </p>
                          <p className="mt-1 text-stone-600">
                            {reveal?.subtitle ?? entry.teamName}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                            {reveal?.stream ?? formatStreamLabel(entry.stream)}
                          </p>
                        </td>
                        <td className="py-4 text-stone-700">{entry.tableNumber}</td>
                        <td className="py-4 text-stone-700">
                          {entry.rating.toFixed(1)}
                        </td>
                        <td className="py-4 text-stone-700">{entry.visits}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="text-center text-sm text-stone-600">
          <Link href="/submit" className="underline decoration-dotted underline-offset-4">
            Submit a new project
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
