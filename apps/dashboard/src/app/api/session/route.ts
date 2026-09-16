import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, authConfigured, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  if (!authConfigured()) return NextResponse.json({ ok: true });
  const store = await cookies();
  return NextResponse.json({ ok: verifySessionToken(store.get(SESSION_COOKIE)?.value) });
}