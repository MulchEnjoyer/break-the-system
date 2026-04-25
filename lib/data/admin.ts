import crypto from "node:crypto";

import { ACTIVE_JUDGE_WINDOW_MINUTES, COVERAGE_TARGET } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  AdminDashboardState,
  EventRow,
  JudgeLinkEntry,
  ProjectCoverageRow,
  ProjectRow,
  RankingEntry,
  RankingSnapshotRow,
} from "@/lib/types/domain";

type AdminAction =
  | "open_submissions"
  | "close_submissions"
  | "open_judging"
  | "close_judging"
  | "freeze_rankings";

type JudgeManagementAction = "revoke" | "delete";
type ProjectManagementAction = "withdraw";

const ELO_START_RATING = 1500;
const ELO_K_FACTOR = 24;
const LIVE_ASSIGNMENT_GRACE_MS = 15_000;

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function liveAssignmentCutoff() {
  return new Date(Date.now() - LIVE_ASSIGNMENT_GRACE_MS).toISOString();
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

  if (left.tableNumber !== right.tableNumber) {
    return left.tableNumber - right.tableNumber;
  }

  return left.title.localeCompare(right.title);
}

function applyEloResult(
  winnerRating: number,
  loserRating: number,
  kFactor = ELO_K_FACTOR,
) {
  const winnerExpected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const loserExpected = 1 / (1 + 10 ** ((winnerRating - loserRating) / 400));

  return {
    winner: Number((winnerRating + kFactor * (1 - winnerExpected)).toFixed(4)),
    loser: Number((loserRating + kFactor * (0 - loserExpected)).toFixed(4)),
  };
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

function buildFrozenRankings(
  rows: RankingSnapshotRow[],
  projectMap: Map<string, ProjectRow>,
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
  projectMap: Map<string, ProjectRow>,
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

export async function rebuildEventRankings(eventId: string) {
  const supabase = createServiceRoleClient();

  const [{ data: activeProjects, error: projectsError }, { data: comparisons, error: comparisonsError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, event_id")
        .eq("event_id", eventId)
        .neq("status", "withdrawn"),
      supabase
        .from("comparisons")
        .select("winner_project_id, loser_project_id, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
    ]);

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  if (comparisonsError) {
    throw new Error(comparisonsError.message);
  }

  const activeProjectIds = new Set((activeProjects ?? []).map((project) => project.id));
  const ratings = new Map(
    (activeProjects ?? []).map((project) => [
      project.id,
      {
        project_id: project.id,
        event_id: eventId,
        rating: ELO_START_RATING,
        wins: 0,
        losses: 0,
        comparisons: 0,
      },
    ]),
  );

  for (const comparison of comparisons ?? []) {
    if (
      !activeProjectIds.has(comparison.winner_project_id) ||
      !activeProjectIds.has(comparison.loser_project_id)
    ) {
      continue;
    }

    const winner = ratings.get(comparison.winner_project_id);
    const loser = ratings.get(comparison.loser_project_id);

    if (!winner || !loser) {
      continue;
    }

    const nextRatings = applyEloResult(winner.rating, loser.rating);
    winner.rating = nextRatings.winner;
    winner.wins += 1;
    winner.comparisons += 1;

    loser.rating = nextRatings.loser;
    loser.losses += 1;
    loser.comparisons += 1;
  }

  const { error: deleteError } = await supabase
    .from("project_rankings")
    .delete()
    .eq("event_id", eventId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows = Array.from(ratings.values());

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("project_rankings")
    .insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function withdrawProject(
  projectId: string,
  action: ProjectManagementAction = "withdraw",
) {
  if (action !== "withdraw") {
    throw new Error("Unsupported project action.");
  }

  const supabase = createServiceRoleClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, event_id, status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project) {
    throw new Error("Project not found.");
  }

  if (project.status === "withdrawn") {
    return;
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: "withdrawn" })
    .eq("id", projectId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: expireError } = await supabase
    .from("assignments")
    .update({ status: "expired" })
    .eq("project_id", projectId)
    .in("status", ["reserved_find", "reserved_judge"]);

  if (expireError) {
    throw new Error(expireError.message);
  }

  const { error: judgeStateError } = await supabase
    .from("judge_state")
    .update({ last_completed_project_id: null })
    .eq("last_completed_project_id", projectId);

  if (judgeStateError) {
    throw new Error(judgeStateError.message);
  }

  await rebuildEventRankings(project.event_id);
}

export async function manageJudge(
  judgeId: string,
  action: JudgeManagementAction,
) {
  const supabase = createServiceRoleClient();
  const { data: judge, error: judgeError } = await supabase
    .from("judges")
    .select("id, event_id, active")
    .eq("id", judgeId)
    .maybeSingle();

  if (judgeError) {
    throw new Error(judgeError.message);
  }

  if (!judge) {
    throw new Error("Judge not found.");
  }

  if (action === "revoke") {
    const { error: revokeError } = await supabase
      .from("judges")
      .update({ active: false })
      .eq("id", judgeId);

    if (revokeError) {
      throw new Error(revokeError.message);
    }

    const { error: expireError } = await supabase
      .from("assignments")
      .update({ status: "expired" })
      .eq("judge_id", judgeId)
      .in("status", ["reserved_find", "reserved_judge"]);

    if (expireError) {
      throw new Error(expireError.message);
    }

    return;
  }

  const [
    { count: assignmentCount, error: assignmentsError },
    { count: comparisonCount, error: comparisonsError },
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("judge_id", judgeId),
    supabase
      .from("comparisons")
      .select("id", { count: "exact", head: true })
      .eq("judge_id", judgeId),
  ]);

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  if (comparisonsError) {
    throw new Error(comparisonsError.message);
  }

  if ((assignmentCount ?? 0) > 0 || (comparisonCount ?? 0) > 0) {
    throw new Error("This judge has history and must be revoked instead of deleted.");
  }

  const { error: deleteError } = await supabase
    .from("judges")
    .delete()
    .eq("id", judgeId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export async function getAdminDashboardState(): Promise<AdminDashboardState> {
  const supabase = createServiceRoleClient();
  const event = await getRequiredEvent();
  const liveReservationCutoff = liveAssignmentCutoff();

  const [
    projectsResult,
    judgesResult,
    comparisonsCountResult,
    skipCountResult,
    reservationsResult,
    rankingsResult,
    frozenRankingsResult,
    assignmentsByJudgeResult,
    comparisonsByJudgeResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, event_id, team_name, title, description, stream, table_number, project_link, status, visit_count, comparison_count, created_at, updated_at",
      )
      .eq("event_id", event.id)
      .neq("status", "withdrawn")
      .order("table_number", { ascending: true })
      .order("title", { ascending: true }),
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
    supabase
      .from("assignments")
      .select("judge_id, status, expires_at")
      .eq("event_id", event.id),
    supabase
      .from("comparisons")
      .select("judge_id")
      .eq("event_id", event.id),
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
  if (assignmentsByJudgeResult.error) {
    throw new Error(assignmentsByJudgeResult.error.message);
  }
  if (comparisonsByJudgeResult.error) {
    throw new Error(comparisonsByJudgeResult.error.message);
  }

  const projects = (projectsResult.data ?? []) as ProjectRow[];
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const assignmentCountByJudge = new Map<string, number>();
  const liveAssignmentCountByJudge = new Map<string, number>();
  const comparisonCountByJudge = new Map<string, number>();

  for (const assignment of assignmentsByJudgeResult.data ?? []) {
    assignmentCountByJudge.set(
      assignment.judge_id,
      (assignmentCountByJudge.get(assignment.judge_id) ?? 0) + 1,
    );

    if (
      ["reserved_find", "reserved_judge"].includes(assignment.status) &&
      new Date(assignment.expires_at).getTime() > Date.now() - LIVE_ASSIGNMENT_GRACE_MS
    ) {
      liveAssignmentCountByJudge.set(
        assignment.judge_id,
        (liveAssignmentCountByJudge.get(assignment.judge_id) ?? 0) + 1,
      );
    }
  }

  for (const comparison of comparisonsByJudgeResult.data ?? []) {
    comparisonCountByJudge.set(
      comparison.judge_id,
      (comparisonCountByJudge.get(comparison.judge_id) ?? 0) + 1,
    );
  }

  const judges: JudgeLinkEntry[] = (judgesResult.data ?? []).map((judge) => {
    const assignmentCount = assignmentCountByJudge.get(judge.id) ?? 0;
    const comparisonCount = comparisonCountByJudge.get(judge.id) ?? 0;
    const liveAssignmentCount = liveAssignmentCountByJudge.get(judge.id) ?? 0;

    return {
      ...judge,
      assignmentCount,
      comparisonCount,
      liveAssignmentCount,
      revoked: !judge.active,
      deletable: assignmentCount === 0 && comparisonCount === 0,
    };
  });

  const judgeMap = new Map(judges.map((judge) => [judge.id, judge]));
  const rankingRows = rankingsResult.data ?? [];
  const frozenRows = (frozenRankingsResult.data ?? []) as RankingSnapshotRow[];

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
    .sort((left, right) => {
      if (left.tableNumber !== right.tableNumber) {
        return left.tableNumber - right.tableNumber;
      }

      return left.projectTitle.localeCompare(right.projectTitle);
    });

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
    .sort((left, right) => {
      if (left.tableNumber !== right.tableNumber) {
        return left.tableNumber - right.tableNumber;
      }

      return left.title.localeCompare(right.title);
    });

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

export async function createJudgeLink(name: string) {
  const supabase = createServiceRoleClient();
  const event = await getRequiredEvent();

  const { data, error } = await supabase
    .from("judges")
    .insert({
    event_id: event.id,
    name,
    token: crypto.randomBytes(24).toString("base64url"),
    active: true,
    })
    .select("id, name, token, active, created_at, last_seen_at");

  if (error) {
    throw new Error(error.message);
  }

  const judge = (data ?? [])[0];

  if (!judge) {
    throw new Error("Could not create the judge link.");
  }

  return {
    ...judge,
    assignmentCount: 0,
    comparisonCount: 0,
    liveAssignmentCount: 0,
    revoked: !judge.active,
    deletable: true,
  } as JudgeLinkEntry;
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
