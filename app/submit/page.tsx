export const dynamic = "force-dynamic";

import { SubmissionForm } from "@/components/submission-form";
import { PageShell, SectionCard, SectionHeading, StatusPill } from "@/components/ui";
import { getCurrentEvent } from "@/lib/data/public";

export default async function SubmitPage() {
  const event = await getCurrentEvent();

  return (
    <PageShell>
      <div className="grid gap-6">
        <SectionCard>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionHeading
                eyebrow="Public submission"
                title="Register your table for judging."
                description="Keep the form short and exact so judges can route by number without back-and-forth."
              />
            </div>
            <StatusPill
              label={event?.submissions_open ? "Submissions open" : "Submissions closed"}
              tone={event?.submissions_open ? "success" : "warning"}
            />
          </div>
        </SectionCard>

        <SubmissionForm submissionsOpen={Boolean(event?.submissions_open)} />
      </div>
    </PageShell>
  );
}
