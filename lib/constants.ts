export const COVERAGE_TARGET = 3;
export const FIND_STAGE_SECONDS = 60;
export const JUDGE_STAGE_SECONDS = 120;
export const RESERVATION_GRACE_SECONDS = 15;
export const ACTIVE_JUDGE_WINDOW_MINUTES = 10;

export const STREAM_OPTIONS = [
  { value: "most_useful", label: "Most useful" },
  { value: "most_useless", label: "Most useless" },
] as const;

export const OUTCOME_OPTIONS = [
  { value: "better", label: "Better than previous" },
  { value: "worse", label: "Worse than previous" },
  { value: "skip", label: "Skip" },
] as const;
