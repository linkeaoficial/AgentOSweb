import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// El navegador NUNCA conoce el token de dueño. Fase 2C: ahora se reenvía la cookie
// de sesión → el worker resuelve `user_id` con Better Auth.
// El token solo se inyecta como superadmin si no hay sesión (transición / scripts).
//
// FASE 2E (cookie `Secure`): Better Auth corre con `useSecureCookies`, así que el
// nombre real lleva el prefijo `__Secure-`. Se acepta también el nombre viejo para
// no tirar la vista en frío, pero si solo existe la vieja el worker ya no la valida
// (403) y toca loguearse de nuevo para obtener la nueva.
const SECURE_SESSION_COOKIE = "__Secure-aow_auth.session_token";
const LEGACY_SESSION_COOKIE = "aow_auth.session_token";
const WORKER_API = process.env.WORKER_API_BASE ?? "https://agentosweb-api.linkeaoficial2025.workers.dev/api";

export async function forwardToWorker(path: string, init?: RequestInit) {
  const store = await cookies();
  // La sesión de Better Auth es la única autorización: se reenvía al worker, que
  // resuelve el `user_id` y el `role` desde la base. Nunca se suplanta al dueño.
  const secureValue = store.get(SECURE_SESSION_COOKIE)?.value;
  const sessionCookie = secureValue ?? store.get(LEGACY_SESSION_COOKIE)?.value;
  const cookieName = secureValue ? SECURE_SESSION_COOKIE : LEGACY_SESSION_COOKIE;
  if (!sessionCookie) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const res = await fetch(`${WORKER_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `${cookieName}=${sessionCookie}`,
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