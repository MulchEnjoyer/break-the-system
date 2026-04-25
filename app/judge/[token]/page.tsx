export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { JudgeApp } from "@/components/judge-app";
import { PageShell, SectionCard, SectionHeading } from "@/components/ui";
import { getNextAssignment } from "@/lib/data/judge";
import { getJudgeSessionByToken } from "@/lib/data/public";

export default async function JudgePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const judgeSession = await getJudgeSessionByToken(token);

  if (!judgeSession) {
    notFound();
  }

  const payload = judgeSession.judge.active
    ? await getNextAssignment(token)
    : {
        assignment: null,
        judge: {
          id: judgeSession.judge.id,
          name: judgeSession.judge.name,
          active: judgeSession.judge.active,
          last_seen_at: judgeSession.judge.last_seen_at,
        },
        judgeState: judgeSession.judgeState,
        judgingOpen: false,
        message: "Judge access has been revoked.",
      };

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
