import { NextResponse } from "next/server";

import { verifyAdminAccess, withdrawProject } from "@/lib/data/admin";
import { adminProjectActionSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminProjectActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "The project action is invalid." },
        { status: 400 },
      );
    }

    await verifyAdminAccess(parsed.data.accessToken);
    await withdrawProject(parsed.data.projectId, parsed.data.action);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update the project.",
      },
      { status: 400 },
    );
  }
}
