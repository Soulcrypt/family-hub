import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { clearActiveMember } from "@/lib/auth/active-member";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  await clearActiveMember();
  return NextResponse.redirect(new URL("/welcome", request.nextUrl.origin), { status: 303 });
}
