import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "aow_auth.session_token";
const PUBLIC_PATHS = ["/login", "/api/auth", "/imagen", "/_next"];

// Fase 2B: redirige a /login sin tocar la base de datos — solo mira la cookie de
// sesión de Better Auth. AuthGate (client) valida la sesión real contra el worker.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};