import crypto from "node:crypto";

import { ACTIVE_JUDGE_WINDOW_MINUTES, COVERAGE_TARGET } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  AdminDashboardState,
  EventRow,
  JudgeLinkEntry,
  ProjectCoverageRow,
  RankingEntry,
  RankingSnapshotRow,
} from "@/lib/types/domain";

type AdminAction =
  | "open_submissions"
  | "close_submissions"
  | "open_judging"
  | "close_judging"
  | "freeze_rankings";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export async function verifyAdminAccess(accessToken: string) {
  const supabase = createServiceRoleClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData.user?.email) {
    throw new Error("Admin authentication failed.");
  }

  const email = authData.user.email.toLowerCase();

  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message);
  }

  if (!adminRow) {
    throw new Error("This account is not authorized for admin access.");
  }

  const { error: syncError } = await supabase
    .from("admin_users")
    .update({ user_id: authData.user.id })
    .eq("email", email);

  if (syncError) {
    throw new Error(syncError.message);
  }

  return {
    email,
    userId: authData.user.id,
  };
}

export async function getRequiredEvent() {
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

  if (!data) {
    throw new Error("No event exists yet. Run the Supabase migration first.");
  }

  return data;
}

function sortRankings(
  left: RankingEntry,
  right: RankingEntry,
  useFrozenPosition = false,
) {
  if (useFrozenPosition) {
    return (left.frozenPosition ?? 10_000) - (right.frozenPosition ?? 10_000);
  }

  if (right.rating !== left.rating) {
    return right.rating - left.rating;
  }

  if (right.comparisons !== left.comparisons) {
    return right.comparisons - left.comparisons;
  }

  if (right.visits !== left.visits) {
    return right.visits - left.visits;
  }

  return left.tableNumber - right.tableNumber;
}

function buildFrozenRankings(
  rows: RankingSnapshotRow[],
  projectMap: Map<
    string,
    {
      title: string;
      team_name: string;
      table_number: number;
      stream: "most_useful" | "most_useless";
      visit_count: number;
    }
  >,
) {
  const entries: RankingEntry[] = [];

  for (const row of rows) {
    const project = projectMap.get(row.project_id);

    if (!project) {
      continue;
    }

    entries.push({
      projectId: row.project_id,
      title: project.title,
      teamName: project.team_name,
      tableNumber: project.table_number,
      stream: project.stream,
      rating: Number(row.rating),
      wins: row.wins,
      losses: row.losses,
      comparisons: row.comparisons,
      visits: row.visit_count,
      frozenPosition: row.frozen_position,
    });
  }

  return entries.sort((left, right) => sortRankings(left, right, true));
}

function buildLiveRankings(
  rows: {
    project_id: string;
    rating: number;
    wins: number;
    losses: number;
    comparisons: number;
  }[],
  projectMap: Map<
    string,
    {
      title: string;
      team_name: string;
      table_number: number;
      stream: "most_useful" | "most_useless";
      visit_count: number;
    }
  >,
) {
  const entries: RankingEntry[] = [];

  for (const row of rows) {
    const project = projectMap.get(row.project_id);

    if (!project) {
      continue;
    }

    entries.push({
      projectId: row.project_id,
      title: project.title,
      teamName: project.team_name,
      tableNumber: project.table_number,
      stream: project.stream,
      rating: Number(row.rating),
      wins: row.wins,
      losses: row.losses,
      comparisons: row.comparisons,
      visits: project.visit_count,
      frozenPosition: null,
    });
  }

  return entries.sort(sortRankings);
}

export async function getAdminDashboardState(): Promise<AdminDashboardState> {
  const supabase = createServiceRoleClient();
  const event = await getRequiredEvent();

  const liveReservationCutoff = new Date(Date.now() - 15_000).toISOString();

  const [
    projectsResult,
    judgesResult,
    comparisonsCountResult,
    skipCountResult,
    reservationsResult,
    rankingsResult,
    frozenRankingsResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, team_name, title, description, stream, table_number, project_link, status, visit_count, comparison_count, created_at, updated_at",
      )
      .eq("event_id", event.id)
      .order("table_number", { ascending: true }),
    supabase
      .from("judges")
      .select("id, name, token, active, created_at, last_seen_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("comparisons")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "skipped"),
    supabase
      .from("assignments")
      .select(
        "id, judge_id, project_id, status, reserved_at, expires_at, found_at, completed_at, created_at",
      )
      .eq("event_id", event.id)
      .in("status", ["reserved_find", "reserved_judge"])
      .gt("expires_at", liveReservationCutoff),
    supabase
      .from("project_rankings")
      .select(
        "project_id, event_id, rating, wins, losses, comparisons, updated_at",
      )
      .eq("event_id", event.id),
    supabase
      .from("ranking_snapshots")
      .select(
        "id, project_id, event_id, frozen_position, rating, wins, losses, comparisons, visit_count, frozen_at",
      )
      .eq("event_id", event.id)
      .order("frozen_position", { ascending: true }),
  ]);

  if (projectsResult.error) {
    throw new Error(projectsResult.error.message);
  }
  if (judgesResult.error) {
    throw new Error(judgesResult.error.message);
  }
  if (comparisonsCountResult.error) {
    throw new Error(comparisonsCountResult.error.message);
  }
  if (skipCountResult.error) {
    throw new Error(skipCountResult.error.message);
  }
  if (reservationsResult.error) {
    throw new Error(reservationsResult.error.message);
  }
  if (rankingsResult.error) {
    throw new Error(rankingsResult.error.message);
  }
  if (frozenRankingsResult.error) {
    throw new Error(frozenRankingsResult.error.message);
  }

  const projects = projectsResult.data ?? [];
  const judges = (judgesResult.data ?? []) as JudgeLinkEntry[];
  const rankingRows = rankingsResult.data ?? [];
  const frozenRows = (frozenRankingsResult.data ?? []) as RankingSnapshotRow[];
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const judgeMap = new Map(judges.map((judge) => [judge.id, judge]));

  const rankings = event.rankings_frozen
    ? buildFrozenRankings(frozenRows, projectMap)
    : buildLiveRankings(rankingRows, projectMap);

  const reservations = (reservationsResult.data ?? [])
    .map((assignment) => {
      const project = projectMap.get(assignment.project_id);
      const judge = judgeMap.get(assignment.judge_id);

      if (!project || !judge) {
        return null;
      }

      const secondsRemaining = Math.max(
        0,
        Math.ceil(
          (new Date(assignment.expires_at).getTime() - Date.now()) / 1000,
        ),
      );

      return {
        assignmentId: assignment.id,
        judgeId: assignment.judge_id,
        judgeName: judge.name ?? "Unnamed judge",
        judgeLastSeenAt: judge.last_seen_at,
        projectId: assignment.project_id,
        projectTitle: project.title,
        tableNumber: project.table_number,
        status: assignment.status,
        expiresAt: assignment.expires_at,
        secondsRemaining,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => left.tableNumber - right.tableNumber);

  const reservationByProjectId = new Map(
    reservations.map((reservation) => [reservation.projectId, reservation]),
  );

  const projectCoverage: ProjectCoverageRow[] = projects
    .map((project) => {
      const reservation = reservationByProjectId.get(project.id);

      return {
        id: project.id,
        title: project.title,
        teamName: project.team_name,
        tableNumber: project.table_number,
        stream: project.stream,
        visitCount: project.visit_count,
        comparisonCount: project.comparison_count,
        status: project.status,
        reservationStatus: reservation?.status ?? null,
        reservationJudgeName: reservation?.judgeName ?? null,
      };
    })
    .sort((left, right) => left.tableNumber - right.tableNumber);

  const metrics = {
    totalSubmissions: projects.length,
    activeJudges: judges.filter(
      (judge) =>
        judge.active &&
        new Date(judge.last_seen_at).getTime() >
          new Date(minutesAgo(ACTIVE_JUDGE_WINDOW_MINUTES)).getTime(),
    ).length,
    completedComparisons: comparisonsCountResult.count ?? 0,
    totalSkips: skipCountResult.count ?? 0,
    zeroVisits: projects.filter((project) => project.visit_count === 0).length,
    oneVisit: projects.filter((project) => project.visit_count === 1).length,
    twoVisits: projects.filter((project) => project.visit_count === 2).length,
    threePlusVisits: projects.filter((project) => project.visit_count >= 3)
      .length,
  };

  return {
    event,
    metrics,
    rankings,
    underReviewed: rankings.filter((entry) => entry.visits < COVERAGE_TARGET),
    reservations,
    projectCoverage,
    judges,
    frozenAt:
      event.rankings_frozen && frozenRows.length > 0
        ? frozenRows[0]?.frozen_at ?? null
        : null,
  };
}

export async function generateJudgeLinks(count: number, prefix = "Judge") {
  const supabase = createServiceRoleClient();
  const event = await getRequiredEvent();

  const judgeRows = Array.from({ length: count }, (_, index) => ({
    event_id: event.id,
    name: `${prefix} ${index + 1}`,
    token: crypto.randomBytes(24).toString("base64url"),
    active: true,
  }));

  const { data, error } = await supabase
    .from("judges")
    .insert(judgeRows)
    .select("id, name, token, active, created_at, last_seen_at");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as JudgeLinkEntry[];
}

export async function updateEventState(action: AdminAction) {
  const supabase = createServiceRoleClient();
  const event = await getRequiredEvent();

  if (action === "freeze_rankings") {
    const dashboard = await getAdminDashboardState();
    const frozenAt = new Date().toISOString();

    const snapshotRows = dashboard.rankings.map((entry, index) => ({
      event_id: event.id,
      project_id: entry.projectId,
      frozen_position: index + 1,
      rating: entry.rating,
      wins: entry.wins,
      losses: entry.losses,
      comparisons: entry.comparisons,
      visit_count: entry.visits,
      frozen_at: frozenAt,
    }));

    const { error: deleteError } = await supabase
      .from("ranking_snapshots")
      .delete()
      .eq("event_id", event.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (snapshotRows.length > 0) {
      const { error: insertError } = await supabase
        .from("ranking_snapshots")
        .insert(snapshotRows);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    const { error: freezeError } = await supabase
      .from("events")
      .update({ rankings_frozen: true })
      .eq("id", event.id);

    if (freezeError) {
      throw new Error(freezeError.message);
    }

    return;
  }

  const updates =
    action === "open_submissions"
      ? { submissions_open: true }
      : action === "close_submissions"
        ? { submissions_open: false }
        : action === "open_judging"
          ? { judging_open: true }
          : { judging_open: false };

  const { error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", event.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getResultsState() {
  const dashboard = await getAdminDashboardState();

  return {
    event: dashboard.event,
    rankings: dashboard.rankings,
    underReviewed: dashboard.underReviewed,
    frozenAt: dashboard.frozenAt,
  };
}
