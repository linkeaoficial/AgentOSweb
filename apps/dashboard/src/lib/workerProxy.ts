import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, authConfigured, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

// El navegador NUNCA conoce el token de dueño: este proxy lo inyecta server-side.
const WORKER_API = process.env.WORKER_API_BASE ?? "https://agentosweb-api.linkeaoficial2025.workers.dev/api";

export async function forwardToWorker(path: string, init?: RequestInit) {
  // Login del panel opcional: si no hay DASHBOARD_PASSWORD, el proxy no exige sesión.
  if (authConfigured()) {
    const store = await cookies();
    if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }
  const res = await fetch(`${WORKER_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OWNER_TOKEN ? { "X-Owner-Token": process.env.OWNER_TOKEN } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}