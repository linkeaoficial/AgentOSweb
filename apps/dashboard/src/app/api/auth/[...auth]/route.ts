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

  const res = await fetch(`${WORKER_AUTH}${path}${qs}`, {
    method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: req.headers.get("origin") ?? `http://${req.headers.get("host")}`,
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