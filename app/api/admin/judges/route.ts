import { NextResponse } from "next/server";

import { manageJudge, verifyAdminAccess } from "@/lib/data/admin";
import { adminJudgeActionSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminJudgeActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "The judge action is invalid." },
        { status: 400 },
      );
    }

    await verifyAdminAccess(parsed.data.accessToken);
    await manageJudge(parsed.data.judgeId, parsed.data.action);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update the judge.",
      },
      { status: 400 },
    );
  }
}
