export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { JudgeApp } from "@/components/judge-app";
import { PageShell, SectionCard, SectionHeading } from "@/components/ui";
import { getNextAssignment } from "@/lib/data/judge";
import { getJudgeByToken } from "@/lib/data/public";

export default async function JudgePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const judge = await getJudgeByToken(token);

  if (!judge) {
    notFound();
  }

  const payload = await getNextAssignment(token);

  return (
    <PageShell className="max-w-3xl">
      <SectionCard>
        <SectionHeading
          eyebrow="Judge flow"
          title="Walk, listen, compare, move."
          description="The table number is deliberately oversized because that is the fastest way to navigate one crowded room."
        />
      </SectionCard>
      <JudgeApp token={token} initialPayload={payload} />
    </PageShell>
  );
}
