import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// El navegador NUNCA conoce el token de dueño. Fase 2C: ahora se reenvía la cookie
// de sesión `aow_auth.session_token` → el worker resuelve `user_id` con Better Auth.
// El token solo se inyecta como superadmin si no hay sesión (transición / scripts).
const WORKER_API = process.env.WORKER_API_BASE ?? "https://agentosweb-api.linkeaoficial2025.workers.dev/api";

export async function forwardToWorker(path: string, init?: RequestInit) {
  const store = await cookies();
  // La sesión de Better Auth es la única autorización: se reenvía al worker, que
  // resuelve el `user_id` y el `role` desde la base. Nunca se suplanta al dueño.
  const sessionCookie = store.get("aow_auth.session_token")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const res = await fetch(`${WORKER_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `aow_auth.session_token=${sessionCookie}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  // El worker siempre responde JSON. Si llega otra cosa (HTML, texto vacío),
  // no lo reenviamos como 200: el cliente debe ver el fallo.
  if (data === null) {
    return NextResponse.json({ error: "Respuesta inválida del servidor" }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.status });
}