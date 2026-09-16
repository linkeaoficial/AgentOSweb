import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) {
    return NextResponse.json({ error: "Servidor sin credenciales configuradas" }, { status: 500 });
  }
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const input = body?.password ?? "";
  const a = Buffer.from(pass);
  const b = Buffer.from(input);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}