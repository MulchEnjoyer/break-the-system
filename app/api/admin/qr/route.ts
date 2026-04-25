import { NextResponse } from "next/server";

import { createJudgeLink, verifyAdminAccess } from "@/lib/data/admin";
import { judgeGenerationSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = judgeGenerationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Judge generation request is invalid." },
        { status: 400 },
      );
    }

    await verifyAdminAccess(parsed.data.accessToken);
    const judge = await createJudgeLink(parsed.data.name);

    return NextResponse.json({ judge });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the judge link.",
      },
      { status: 400 },
    );
  }
}
