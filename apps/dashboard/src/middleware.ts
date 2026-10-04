import { NextResponse, type NextRequest } from "next/server";

// /widget.js y /w/ son PÚBLICOS a propósito: son el script que el cliente
// pega en su web. Con el login (Fase 2B) no estaban en la lista y el middleware
// redirigía a /login, así que el visitante recibía HTML en vez de JavaScript y el
// widget no aparecía en ninguna página de ningún cliente.
// FASE 2E: con `useSecureCookies` Better Auth emite `__Secure-aow_auth.session_token`;
// el nombre viejo queda como fallback para no tirar sesiones pre-cambio.
const SESSION_COOKIES = ["__Secure-aow_auth.session_token", "aow_auth.session_token"];
const PUBLIC_PATHS = ["/login", "/api/auth", "/imagen", "/_next", "/widget.js", "/w", "/docs", "/terminos", "/privacidad", "/cookies"];

// Fase 2B: redirige a /login sin tocar la base de datos — solo mira la cookie de
// sesión de Better Auth. AuthGate (client) valida la sesión real contra el worker.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    // Las APIs devuelven 401, nunca una redirección: un fetch() del navegador
    // sigue el 307 y recibe HTML con status 200, rompiendo el parseo JSON.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};