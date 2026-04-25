import { NextResponse } from "next/server";

import { getNextAssignment } from "@/lib/data/judge";
import { judgeTokenSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = judgeTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Judge token is missing or invalid." },
        { status: 400 },
      );
    }

    const payload = await getNextAssignment(parsed.data.token);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not fetch the next assignment.",
      },
      { status: 400 },
    );
  }
}
