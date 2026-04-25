import { NextResponse } from "next/server";

import { updateEventState, verifyAdminAccess } from "@/lib/data/admin";
import { eventControlSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = eventControlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "The admin action is invalid." },
        { status: 400 },
      );
    }

    await verifyAdminAccess(parsed.data.accessToken);
    await updateEventState(parsed.data.action);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update event settings.",
      },
      { status: 400 },
    );
  }
}
