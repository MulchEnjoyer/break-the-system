import { NextResponse } from "next/server";

import { generateJudgeLinks, verifyAdminAccess } from "@/lib/data/admin";
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
    const judges = await generateJudgeLinks(parsed.data.count, parsed.data.prefix);

    return NextResponse.json({ judges });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate judge links.",
      },
      { status: 400 },
    );
  }
}
