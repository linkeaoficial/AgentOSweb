import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "aow_session";
const MAX_AGE_SECONDS = 12 * 60 * 60;

// El login del panel es OPCIONAL: solo se activa cuando el dueño configura
// `DASHBOARD_PASSWORD`. Sin esa variable, el panel entra directo (dev / sin proteger).
export function authConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV !== "production") return "dev-session-secret";
  throw new Error("Falta SESSION_SECRET en el entorno");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(createHmac("sha256", secret()).update(payload).digest());
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}