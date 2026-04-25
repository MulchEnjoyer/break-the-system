import { NextResponse } from "next/server";

import { getAdminDashboardState, verifyAdminAccess } from "@/lib/data/admin";
import { adminSessionSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Admin access token is required." },
        { status: 400 },
      );
    }

    await verifyAdminAccess(parsed.data.accessToken);
    const dashboard = await getAdminDashboardState();

    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the admin dashboard.",
      },
      { status: 401 },
    );
  }
}
