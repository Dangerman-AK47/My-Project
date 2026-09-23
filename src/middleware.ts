import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * First line of defense for /admin and /api/admin routes, running on the
 * Edge runtime. This only checks the session cookie's signature and
 * expiration (no database access, since Prisma doesn't run on the Edge
 * runtime) — it exists so an unauthenticated request never even reaches
 * page or route handler code. The authoritative check, which also
 * confirms the admin account still exists and is active, happens in
 * `lib/auth/guard.ts`'s `requireAdminSession` / `getAuthorizedAdmin`,
 * called at the top of every protected page and API route.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginRoute = pathname === "/admin/login";
  const isApiRoute = pathname.startsWith("/api/admin");

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    if (isLoginRoute && (request.nextUrl.searchParams.has("clear") || request.nextUrl.searchParams.has("force"))) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    if (isLoginRoute || pathname === "/admin" || pathname === "/admin/") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // No valid session past this point.
  if (isLoginRoute) {
    return NextResponse.next();
  }

  if (isApiRoute) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
