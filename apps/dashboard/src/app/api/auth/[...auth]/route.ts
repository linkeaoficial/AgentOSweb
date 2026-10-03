import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Proxy de autenticación: las rutas /api/auth/* del panel delegan al worker,
// que es quien tiene el binding a D1 y corre Mejor Auth. Las cookies de sesión
// (aow_auth.*) que emite el worker se reenvían tal cual al navegador del panel.
const WORKER_AUTH = "https://agentosweb-api.linkeaoficial2025.workers.dev/api/auth";

async function forward(req: NextRequest, method: string) {
  const path = req.nextUrl.pathname.replace(/^\/api\/auth/, "");
  const qs = req.nextUrl.search;
  const cookie = req.headers.get("cookie") ?? "";
  const body = req.body ? await req.text() : undefined;

  // Rate limit de login por IP: el worker solo ve el fetch() de este proxy, así
  // que su `cf-connecting-ip` es nuestra IP de salida, no la del visitante. La
  // IP real se lee acá (en el borde, antes de perderla) y viaja en una cabecera
  // propia. Sin esto Better Auth no resuelve IP y mete a todos los usuarios en
  // un cubo compartido de 3 intentos/10s: un atacante puede dejar sin login a
  // todo el SaaS.
  //
  // SOLO cf-connecting-ip: es la única que Cloudflare sobrescribe por su cuenta,
  // así que quien llama al proxy no puede forzarla. `x-real-ip` y
  // `x-forwarded-for` sí las puede mandar cualquiera, y con ellas bastaba rotar
  // la cabecera para estrenar cubo nuevo y saltarse el límite — verificado en
  // vivo el 01-oct-2026: con XFF el 429 se evadía con una IP falsa nueva.
  //
  // La cabecera va firmada con OWNER_TOKEN porque el worker es público: sin
  // firma, quien pegue directo al worker podría mandar una IP distinta en cada
  // POST y evadir el límite. El token sale del server (el navegador nunca lo
  // ve) y es el mismo que ya valida `isOwnerAuthorized`.
  //
  // ponytail: sin IP no se manda cabecera y el worker cae al cubo compartido —
  // más tosco pero nunca evadible. Si el panel se despliega fuera de Cloudflare
  // (p. ej. Vercel, que no setea cf-connecting-ip) hay que leer el header que
  // ponga ese edge, uno que este obligado a sobrescribir.
  const clientIp = req.headers.get("cf-connecting-ip");
  const ownerToken = process.env.OWNER_TOKEN;

  const res = await fetch(`${WORKER_AUTH}${path}${qs}`, {
    method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(req.headers.get("user-agent") ? { "User-Agent": req.headers.get("user-agent")! } : {}),
      Origin: req.headers.get("origin") ?? `http://${req.headers.get("host")}`,
      ...(clientIp && ownerToken ? { "x-client-ip": clientIp, "X-Owner-Token": ownerToken } : {}),
    },
    body,
    redirect: "manual",
  });

  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.has("Set-Cookie") ? [res.headers.get("Set-Cookie")!] : []);
  const resHeaders = new Headers({
    "Content-Type": res.headers.get("content-type") ?? "application/json",
  });
  for (const c of setCookies) resHeaders.append("Set-Cookie", c);

  return new Response(res.body, { status: res.status, headers: resHeaders });
}

export async function GET(req: NextRequest) {
  return forward(req, "GET");
}

export async function POST(req: NextRequest) {
  return forward(req, "POST");
}