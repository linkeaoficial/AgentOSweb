import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import type { D1Database } from "@cloudflare/workers-types";

export interface AuthEnv {
  DB: D1Database;
  AUTH_SECRET?: string;
  AUTH_BASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}

// Roles del SaaS: "cliente" (por defecto) y "admin" (el dueño, se marca en D1).
// Mejor Auth lo guarda como columna adicional en su tabla `user`.
const roleField = {
  role: { type: "string" as const, defaultValue: "cliente", input: false as const },
};

export function createAuth(env: AuthEnv) {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    socialProviders.apple = { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET };
  }

  const baseURL =
    env.AUTH_BASE_URL ??
    "https://agentosweb-api.linkeaoficial2025.workers.dev";

  return betterAuth({
    appName: "AgentOSweb",
    baseURL,
    basePath: "/api/auth",
    secret: env.AUTH_SECRET ?? (env.AUTH_BASE_URL?.startsWith("http://") ? "dev-auth-secret" : undefined),
    database: env.DB,
    trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000", baseURL],
    advanced: {
      trustedProxyHeaders: true,
      cookiePrefix: "aow_auth",
      useSecureCookies: false, // Fase 2E: activar en HTTPS de producción
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders,
    session: { expiresIn: 60 * 60 * 24 * 7 }, // 7 días
    user: {
      additionalFields: roleField,
    },
  });
}

// En Cloudflare Workers no hay CLI: las tablas de Mejor Auth se crean
// programáticamente con getMigrations (idempotente, IF NOT EXISTS).
// ponytail: flag por instancia; si dos fríos corren migraciones a la vez,
// IF NOT EXISTS lo tolera (D1 serializa ALTERs idempotentes en la práctica).
let migrationsDone = false;

export async function ensureAuthMigrations(env: AuthEnv): Promise<void> {
  if (migrationsDone) return;
  const auth = createAuth(env);
  const migrations = await getMigrations(auth.options, { throwOnUnsafe: false });
  await migrations.runMigrations();
  migrationsDone = true;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role?: string | null;
}

// Sesión de Better Auth resuelta desde las cookies del request (el dashboard
// reenvía `aow_auth.session_token` server-side). Devuelve null si no hay sesión.
export async function getSessionUser(env: AuthEnv, request: Request): Promise<SessionUser | null> {
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: (session.user as { image?: string | null }).image ?? null,
    role: (session.user as { role?: string | null }).role ?? null,
  };
}