import Link from "next/link";

import { PageShell, SectionCard, SectionHeading, StatusPill } from "@/components/ui";

export default function Home() {
  return (
    <PageShell className="justify-center">
      <SectionCard className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,214,128,0.4),transparent_35%),linear-gradient(180deg,#fff4de_0%,#ffe0a8_100%)] p-6 sm:p-8">
            <StatusPill label="Pairwise judging MVP" tone="success" />
            <h1 className="mt-6 max-w-3xl font-display text-5xl leading-none text-stone-950 sm:text-6xl">
              Fast in-room hackathon judging built around table numbers and live coverage.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
              Judges enter by QR, walk table to table on a timed flow, and rank projects through quick pairwise comparisons instead of slow rubric forms.
            </p>
          </div>

          <div className="grid gap-4 p-6 sm:p-8">
            <SectionHeading
              eyebrow="Routes"
              title="Run the event from four pages."
              description="Everything important is intentionally visible and shallow."
            />
            <div className="grid gap-3">
              <Link
                href="/submit"
                className="rounded-[24px] border border-stone-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-stone-950"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Public
                </p>
                <p className="mt-2 font-display text-3xl text-stone-950">/submit</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Team submission form with smart link parsing and shared-table support.
                </p>
              </Link>
              <Link
                href="/login"
                className="rounded-[24px] border border-stone-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-stone-950"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Organizer
                </p>
                <p className="mt-2 font-display text-3xl text-stone-950">/admin</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Live controls, rankings, coverage, reservations, and QR generation.
                </p>
              </Link>
              <Link
                href="/results"
                className="rounded-[24px] border border-stone-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-stone-950"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Read only
                </p>
                <p className="mt-2 font-display text-3xl text-stone-950">/results</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Public-facing live or frozen ranking board.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
