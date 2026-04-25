"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle, LogOut, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { COVERAGE_TARGET } from "@/lib/constants";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { AdminDashboardState } from "@/lib/types/domain";
import { buildJudgeRoute, formatDateTime, formatStreamLabel } from "@/lib/utils";
import {
  EmptyState,
  MetricCard,
  SectionCard,
  SectionHeading,
  StatusPill,
} from "@/components/ui";

type AdminAction =
  | "open_submissions"
  | "close_submissions"
  | "open_judging"
  | "close_judging"
  | "freeze_rankings";

async function postAdminAction<T>(
  endpoint: string,
  payload: Record<string, string | number>,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(json.error ?? "The admin request failed.");
  }

  return json;
}

export function AdminDashboard() {
  const router = useRouter();
  const [supabase] = useState(() =>
    typeof window === "undefined" ? null : getBrowserSupabaseClient(),
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const [judgeCount, setJudgeCount] = useState(6);
  const [judgePrefix, setJudgePrefix] = useState("Judge");

  async function loadDashboard(token: string) {
    setError(null);

    const nextDashboard = await postAdminAction<AdminDashboardState>(
      "/api/admin/dashboard",
      {
        accessToken: token,
      },
    );

    setDashboard(nextDashboard);
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) {
        return;
      }

      if (sessionError || !data.session?.access_token) {
        router.replace("/login");
        return;
      }

      setAccessToken(data.session.access_token);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      setAccessToken(session.access_token);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const initializeDashboard = async () => {
      try {
        await loadDashboard(accessToken);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load dashboard.",
        );
      } finally {
        setLoading(false);
      }
    };

    void initializeDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard(accessToken).catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not refresh dashboard.",
        );
      });
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [accessToken]);

  async function handleEventAction(action: AdminAction) {
    if (!accessToken) {
      return;
    }

    setActionPending(true);
    setError(null);

    try {
      await postAdminAction("/api/admin/event", {
        accessToken,
        action,
      });
      await loadDashboard(accessToken);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update event controls.",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function handleGenerateJudges() {
    if (!accessToken) {
      return;
    }

    setActionPending(true);
    setError(null);

    try {
      await postAdminAction("/api/admin/qr", {
        accessToken,
        count: judgeCount,
        prefix: judgePrefix,
      });
      await loadDashboard(accessToken);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate judge QR links.",
      );
    } finally {
      setActionPending(false);
    }
  }

  if (loading || !dashboard) {
    return (
      <SectionCard className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.22em] text-stone-500">
          <LoaderCircle className="size-4 animate-spin" />
          Loading dashboard
        </div>
      </SectionCard>
    );
  }

  const controlButtonClass =
    "inline-flex min-h-12 items-center justify-center rounded-full border px-5 text-xs font-semibold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="grid gap-6">
      <SectionCard className="overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,#fff4da_0%,#ffe0a0_40%,#ffd1a9_100%)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <StatusPill
                label={dashboard.event.rankings_frozen ? "Results frozen" : "Live results"}
                tone={dashboard.event.rankings_frozen ? "warning" : "success"}
              />
              <h1 className="mt-4 font-display text-5xl leading-none text-stone-950">
                {dashboard.event.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-700">
                One judging pool, live coverage monitoring, and pairwise rankings that can be frozen at any time.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={actionPending}
                onClick={() => {
                  void loadDashboard(accessToken!);
                }}
                className="inline-flex min-h-12 items-center rounded-full border border-stone-300 bg-white/85 px-5 text-sm font-semibold text-stone-900 transition hover:border-stone-950 disabled:opacity-50"
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!supabase) {
                    return;
                  }

                  await supabase.auth.signOut();
                  router.replace("/login");
                }}
                className="inline-flex min-h-12 items-center rounded-full border border-stone-300 bg-white/85 px-5 text-sm font-semibold text-stone-900 transition hover:border-stone-950"
              >
                <LogOut className="mr-2 size-4" />
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <StatusPill
              label={
                dashboard.event.submissions_open
                  ? "Submissions open"
                  : "Submissions closed"
              }
              tone={dashboard.event.submissions_open ? "success" : "warning"}
            />
            <StatusPill
              label={dashboard.event.judging_open ? "Judging open" : "Judging closed"}
              tone={dashboard.event.judging_open ? "success" : "warning"}
            />
            {dashboard.frozenAt ? (
              <StatusPill
                label={`Frozen ${formatDateTime(dashboard.frozenAt)}`}
                tone="warning"
              />
            ) : null}
          </div>
        </div>
      </SectionCard>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total submissions" value={dashboard.metrics.totalSubmissions} />
        <MetricCard label="Active judges" value={dashboard.metrics.activeJudges} />
        <MetricCard
          label="Comparisons"
          value={dashboard.metrics.completedComparisons}
          detail="Directional pairwise outcomes"
        />
        <MetricCard label="Total skips" value={dashboard.metrics.totalSkips} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="0 visits" value={dashboard.metrics.zeroVisits} />
        <MetricCard label="1 visit" value={dashboard.metrics.oneVisit} />
        <MetricCard label="2 visits" value={dashboard.metrics.twoVisits} />
        <MetricCard
          label={`3+ visits`}
          value={dashboard.metrics.threePlusVisits}
          detail={`Coverage target is ${COVERAGE_TARGET}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard className="space-y-5">
          <SectionHeading
            eyebrow="Controls"
            title="Event switches"
            description="These are the only day-of controls the organizer should need."
          />
          <div className="grid gap-3">
            <button
              type="button"
              disabled={actionPending}
              className={`${controlButtonClass} border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-600`}
              onClick={() => {
                void handleEventAction("open_submissions");
              }}
            >
              Open submissions
            </button>
            <button
              type="button"
              disabled={actionPending}
              className={`${controlButtonClass} border-stone-300 bg-white text-stone-900 hover:border-stone-950`}
              onClick={() => {
                void handleEventAction("close_submissions");
              }}
            >
              Close submissions
            </button>
            <button
              type="button"
              disabled={actionPending}
              className={`${controlButtonClass} border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-600`}
              onClick={() => {
                void handleEventAction("open_judging");
              }}
            >
              Open judging
            </button>
            <button
              type="button"
              disabled={actionPending}
              className={`${controlButtonClass} border-stone-300 bg-white text-stone-900 hover:border-stone-950`}
              onClick={() => {
                void handleEventAction("close_judging");
              }}
            >
              Close judging
            </button>
            <button
              type="button"
              disabled={actionPending}
              className={`${controlButtonClass} border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-600`}
              onClick={() => {
                void handleEventAction("freeze_rankings");
              }}
            >
              Freeze rankings
            </button>
          </div>
        </SectionCard>

        <SectionCard className="space-y-5">
          <SectionHeading
            eyebrow="Judge QR"
            title="Generate entry links"
            description="Each link lands directly on the mobile judge flow. Print the QR or open it directly from this panel."
          />

          <div className="grid gap-4 md:grid-cols-[0.6fr_0.4fr]">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-stone-900">Judge count</span>
              <input
                type="number"
                min={1}
                max={24}
                value={judgeCount}
                onChange={(event) => {
                  setJudgeCount(Number(event.target.value));
                }}
                className="min-h-13 rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-stone-900">Name prefix</span>
              <input
                value={judgePrefix}
                onChange={(event) => {
                  setJudgePrefix(event.target.value);
                }}
                className="min-h-13 rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={actionPending}
            onClick={() => {
              void handleGenerateJudges();
            }}
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-stone-950 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-50 transition hover:bg-stone-800 disabled:opacity-50"
          >
            {actionPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
            Generate judge links
          </button>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard className="space-y-5">
          <SectionHeading
            eyebrow="Coverage"
            title="Under-reviewed projects"
            description={`Projects below ${COVERAGE_TARGET} visits are still prioritized by dispatch.`}
          />
          {dashboard.underReviewed.length === 0 ? (
            <EmptyState
              title="Coverage target reached."
              description="Every project has hit the current minimum visit threshold."
            />
          ) : (
            <div className="grid gap-3">
              {dashboard.underReviewed.slice(0, 12).map((entry) => (
                <div
                  key={entry.projectId}
                  className="rounded-[22px] border border-stone-200 bg-white/85 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
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

        <SectionCard className="space-y-5">
          <SectionHeading
            eyebrow="Live queue"
            title="Assignment reservations"
            description="Reserved projects are unavailable to other judges until the lease expires or a result is recorded."
          />
          {dashboard.reservations.length === 0 ? (
            <EmptyState
              title="No active reservations."
              description="Judges are idle, or their current leases have already completed."
            />
          ) : (
            <div className="grid gap-3">
              {dashboard.reservations.map((reservation) => (
                <div
                  key={reservation.assignmentId}
                  className="rounded-[22px] border border-stone-200 bg-white/85 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-950">
                        Table {reservation.tableNumber}: {reservation.projectTitle}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {reservation.judgeName} · {reservation.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                        Remaining
                      </p>
                      <p className="font-display text-3xl text-stone-950">
                        {reservation.secondsRemaining}s
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard className="space-y-5">
        <SectionHeading
          eyebrow="Leaderboard"
          title="Current rankings"
          description="Ratings are Elo-style pairwise updates. The board is coverage-aware, but it still reflects only the comparisons completed so far."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-stone-500">
              <tr>
                <th className="pb-3">Rank</th>
                <th className="pb-3">Project</th>
                <th className="pb-3">Table</th>
                <th className="pb-3">Stream</th>
                <th className="pb-3">Rating</th>
                <th className="pb-3">Visits</th>
                <th className="pb-3">W-L</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.rankings.map((entry, index) => (
                <tr key={entry.projectId} className="border-t border-stone-200/80">
                  <td className="py-4 font-display text-2xl text-stone-950">
                    {entry.frozenPosition ?? index + 1}
                  </td>
                  <td className="py-4">
                    <p className="font-semibold text-stone-950">{entry.title}</p>
                    <p className="mt-1 text-stone-600">{entry.teamName}</p>
                  </td>
                  <td className="py-4 text-stone-700">{entry.tableNumber}</td>
                  <td className="py-4 text-stone-700">
                    {formatStreamLabel(entry.stream)}
                  </td>
                  <td className="py-4 text-stone-700">
                    {entry.rating.toFixed(1)}
                  </td>
                  <td className="py-4 text-stone-700">{entry.visits}</td>
                  <td className="py-4 text-stone-700">
                    {entry.wins}-{entry.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="space-y-5">
        <SectionHeading
          eyebrow="Coverage board"
          title="Project visit state"
          description="Use this grid to spot under-reviewed tables and active reservations at a glance."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-stone-500">
              <tr>
                <th className="pb-3">Table</th>
                <th className="pb-3">Project</th>
                <th className="pb-3">Visits</th>
                <th className="pb-3">Comparisons</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.projectCoverage.map((project) => (
                <tr key={project.id} className="border-t border-stone-200/80">
                  <td className="py-4 font-display text-2xl text-stone-950">
                    {project.tableNumber}
                  </td>
                  <td className="py-4">
                    <p className="font-semibold text-stone-950">{project.title}</p>
                    <p className="mt-1 text-stone-600">{project.teamName}</p>
                  </td>
                  <td className="py-4 text-stone-700">{project.visitCount}</td>
                  <td className="py-4 text-stone-700">{project.comparisonCount}</td>
                  <td className="py-4">
                    {project.reservationStatus ? (
                      <StatusPill
                        label={`${project.reservationStatus.replaceAll("_", " ")} · ${project.reservationJudgeName ?? "Assigned"}`}
                        tone={
                          project.reservationStatus === "reserved_find"
                            ? "warning"
                            : "success"
                        }
                      />
                    ) : (
                      <StatusPill
                        label={project.status}
                        tone={project.visitCount < COVERAGE_TARGET ? "warning" : "default"}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="space-y-5">
        <SectionHeading
          eyebrow="Judge links"
          title="QR entry cards"
          description="Use these existing links for quick in-room onboarding. New links are added to this list every time you generate more."
        />
        {dashboard.judges.length === 0 ? (
          <EmptyState
            title="No judge links yet."
            description="Generate QR codes above and they will appear here immediately."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.judges.map((judge) => {
              const judgeUrl = origin ? buildJudgeRoute(origin, judge.token) : "";

              return (
                <div
                  key={judge.id}
                  className="rounded-[24px] border border-stone-200 bg-white/85 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-950">
                        {judge.name ?? "Unnamed judge"}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        Last seen {formatDateTime(judge.last_seen_at)}
                      </p>
                    </div>
                    <StatusPill
                      label={judge.active ? "Active" : "Inactive"}
                      tone={judge.active ? "success" : "warning"}
                    />
                  </div>
                  {judgeUrl ? (
                    <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                      <QRCodeSVG value={judgeUrl} size={180} className="mx-auto" />
                    </div>
                  ) : null}
                  <p className="mt-4 break-all text-xs leading-6 text-stone-600">
                    {judgeUrl}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
