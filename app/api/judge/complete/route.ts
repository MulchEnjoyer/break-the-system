import { NextResponse } from "next/server";

import { completeAssignment } from "@/lib/data/judge";
import { completionSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = completionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Completion details are missing or invalid." },
        { status: 400 },
      );
    }

    const payload = await completeAssignment(
      parsed.data.token,
      parsed.data.assignmentId,
      parsed.data.outcome,
    );

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete the comparison.",
      },
      { status: 400 },
    );
  }
}
