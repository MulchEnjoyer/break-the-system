import type { Database } from "@/lib/types/database";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type JudgeRow = Database["public"]["Tables"]["judges"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
export type JudgeStateRow = Database["public"]["Tables"]["judge_state"]["Row"];
export type ProjectRankingRow =
  Database["public"]["Tables"]["project_rankings"]["Row"];
export type RankingSnapshotRow =
  Database["public"]["Tables"]["ranking_snapshots"]["Row"];

export type Stream = Database["public"]["Enums"]["judging_stream"];
export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];

export type SubmissionFormState = {
  errors?: Record<string, string[] | undefined>;
  success?: boolean;
  message?: string;
};

export type JudgeProjectCard = Pick<
  ProjectRow,
  | "id"
  | "title"
  | "team_name"
  | "description"
  | "stream"
  | "table_number"
  | "project_link"
  | "visit_count"
  | "comparison_count"
>;

export type JudgeAssignment = Pick<
  AssignmentRow,
  "id" | "status" | "reserved_at" | "expires_at"
> & {
  project: JudgeProjectCard;
};

export type JudgeProgressState = {
  comparisons_completed: number;
  skips_count: number;
  last_completed_project_id: string | null;
  last_completed_project_title: string | null;
};

export type JudgeAssignmentPayload = {
  assignment: JudgeAssignment | null;
  judge: Pick<JudgeRow, "id" | "name" | "active" | "last_seen_at">;
  judgeState: JudgeProgressState;
  judgingOpen: boolean;
  message?: string | null;
};

export type RankingEntry = {
  projectId: string;
  title: string;
  teamName: string;
  tableNumber: number;
  stream: Stream;
  rating: number;
  wins: number;
  losses: number;
  comparisons: number;
  visits: number;
  frozenPosition?: number | null;
};

export type ReservationEntry = {
  assignmentId: string;
  judgeId: string;
  judgeName: string;
  judgeLastSeenAt: string;
  projectId: string;
  projectTitle: string;
  tableNumber: number;
  status: AssignmentStatus;
  expiresAt: string;
  secondsRemaining: number;
};

export type ProjectCoverageRow = {
  id: string;
  title: string;
  teamName: string;
  tableNumber: number;
  stream: Stream;
  visitCount: number;
  comparisonCount: number;
  status: ProjectRow["status"];
  reservationStatus: AssignmentStatus | null;
  reservationJudgeName: string | null;
};

export type JudgeLinkEntry = Pick<
  JudgeRow,
  "id" | "name" | "token" | "active" | "created_at" | "last_seen_at"
> & {
  assignmentCount: number;
  comparisonCount: number;
  liveAssignmentCount: number;
  revoked: boolean;
  deletable: boolean;
};

export type AdminDashboardState = {
  event: EventRow;
  metrics: {
    totalSubmissions: number;
    activeJudges: number;
    completedComparisons: number;
    totalSkips: number;
    zeroVisits: number;
    oneVisit: number;
    twoVisits: number;
    threePlusVisits: number;
  };
  rankings: RankingEntry[];
  underReviewed: RankingEntry[];
  reservations: ReservationEntry[];
  projectCoverage: ProjectCoverageRow[];
  judges: JudgeLinkEntry[];
  frozenAt: string | null;
};

export type AuthenticatedAdmin = {
  accessToken: string;
  email: string;
};
