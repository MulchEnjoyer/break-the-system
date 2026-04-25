import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { STREAM_OPTIONS } from "@/lib/constants";
import type { Stream } from "@/lib/types/domain";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStreamLabel(stream: Stream) {
  return (
    STREAM_OPTIONS.find((option) => option.value === stream)?.label ?? stream
  );
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeSeconds(seconds: number) {
  if (seconds <= 0) {
    return "00:00";
  }

  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

export function buildJudgeRoute(origin: string, token: string) {
  return new URL(`/judge/${token}`, origin).toString();
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
