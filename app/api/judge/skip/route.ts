import { NextResponse } from "next/server";

import { skipAssignment } from "@/lib/data/judge";
import { assignmentActionSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = assignmentActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Assignment details are missing or invalid." },
        { status: 400 },
      );
    }

    const payload = await skipAssignment(
      parsed.data.token,
      parsed.data.assignmentId,
    );

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not skip assignment.",
      },
      { status: 400 },
    );
  }
}
