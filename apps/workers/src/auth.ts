import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export interface AuthEnv {
  DB: D1Database;
  AGENT_CACHE: KVNamespace;
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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    // Rate limit de /api/auth/*. El default de Better Auth es
    // `enabled: options.rateLimit?.enabled ?? isProduction`, e `isProduction`
    // sale de NODE_ENV — que en un Worker nunca está seteado (wrangler.toml
    // declara ENVIRONMENT, no NODE_ENV). O sea: apagado salvo que lo pidas
    // explícitamente. Verificado en vivo el 01-oct-2026: 6 sign-in seguidos
    // dieron 6×401 y ningún 429.
    //
    // Reglas por defecto de Better Auth: /sign-in, /sign-up, /change-password
    // y /change-email → 3 intentos cada 10 s.
    //
    // ponytail: storage "memory" (el default sin secondaryStorage) es por
    // instancia: un atacante que reparta requests entre isolates ve el límite
    // multiplicado. El salto a D1 exige la tabla `rateLimit`, que NO está en
    // el schema de Better Auth (getMigrations no la crea) — hay que
    // crearla a mano en una migración (la libre más cercana: 0017) y setear
    // storage: "database".
    rateLimit: { enabled: true },
    advanced: {
      trustedProxyHeaders: true,
      cookiePrefix: "aow_auth",
        // FASE 2E: la cookie de sesión viaja con `Secure` (solo se envía por
        // HTTPS). Better Auth lo infiere de `baseURL` (https) igual, pero va
        // explícito para que nadie lo "limpie" sin saber. Los navegadores
        // aceptan cookies Secure en http://localhost (origen trustworthy por
        // spec), así que el dev en localhost sigue funcionando; solo se rompe
        // si se prueba el panel desde una IP de red (LAN) por HTTP.
        useSecureCookies: true,
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
      // La IP que importa es la del visitante, pero el worker nunca la ve
      // directo: el login llega por el proxy del panel (Next.js), así que
      // `cf-connecting-ip` en el Worker es la IP de salida del proxy.
      // El proxy la reenvía en `x-client-ip` (cabecera propia: Cloudflare
      // pisa las suyas al entrar en su red) y es lo único que leemos.
      // Sin este bloque, Better Auth cae en su bucket compartido por path
      // ("no-trusted-ip"): todos los usuarios del SaaS comparten 3 intentos
      // cada 10 s, así que un atacante puede dejar sin login a todo el mundo.
      // XFF queda fuera a propósito: `getIPFromHeader` devuelve null si el
      // header trae más de un salto y no hay `trustedProxies` configurado.
      ipAddress: { ipAddressHeaders: ["x-client-ip"] },
    },
    socialProviders,
    session: { expiresIn: 60 * 60 * 24 * 7 }, // 7 días
    user: {
      additionalFields: roleField,
      // "Eliminar cuenta" del panel (POST /api/auth/delete-user). Better Auth
      // solo borra sus tablas (user/session/account); los datos de la app viven
      // en otras y se cascadian acá antes de borrar la identidad: borrar la
      // fila `users` dispara el CASCADE de la FK → agents → leads /
      // conversaciones → messages / faq_hits / stats / usage_history, y
      // plan_events va aparte (no tiene FK). support_tickets queda a propósito:
      // su user_id es libre para que el soporte conserve el hilo de todas forms.
      // Si beforeDelete falla, el endpoint devuelve 500 y la cuenta NO se
      // borra (reintentable; nada queda a medias en las tablas de la app).
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          const agents = await env.DB.prepare("SELECT id FROM agents WHERE user_id = ?").bind(user.id).all<{ id: string }>();
          const kvKeys = agents.results.flatMap((a) => [`agent:${a.id}`, `faqvec:${a.id}`]);
          kvKeys.push(`quota:${user.id}`);
          await Promise.all(kvKeys.map((k) => env.AGENT_CACHE.delete(k)));
          await env.DB.batch([
            env.DB.prepare("DELETE FROM plan_events WHERE user_id = ?").bind(user.id),
            env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
          ]);
        },
      },
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
  // Un token de sesión vencido o corrupto hace lanzar a Better Auth; sin este
  // catch el worker responde 500 y el panel ve HTML en vez de JSON.
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: (session.user as { image?: string | null }).image ?? null,
    role: (session.user as { role?: string | null }).role ?? null,
  };
}