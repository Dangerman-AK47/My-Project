import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session";

/**
 * Cookie + database-backed session helpers. Only usable from the Node
 * runtime (Server Actions, Route Handlers, Server Components) — never
 * import this from `middleware.ts`, which runs on the Edge runtime and
 * can only use the stateless helpers in `lib/auth/session.ts`.
 */

const isProduction = process.env.NODE_ENV === "production";

/** Issues a session token for the given admin and sets it as an HTTP-only cookie. */
export async function createSession(admin: {
  id: string;
  username: string;
  role: string;
}): Promise<void> {
  const token = await createSessionToken({
    sub: admin.id,
    username: admin.username,
    role: admin.role,
  });

  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clears the session cookie. Call from the logout action/route. */
export function clearSession(): void {
  cookies().set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Reads and verifies the session cookie's signature/expiration only (no DB read). */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export interface AuthorizedAdmin {
  id: string;
  username: string;
  role: string;
}

/**
 * Full authorization check for protected Server Components / Route Handlers:
 * verifies the token AND re-checks the account is still active in the
 * database. This is the authoritative check — `middleware.ts` only does the
 * fast, stateless signature check as a first line of defense so a request
 * with no/invalid cookie never even reaches page/route code.
 *
 * Returns null (does not redirect) so API routes can return 401 JSON instead
 * of a redirect. Page code should use `requireAdminSession` instead.
 */
export async function getAuthorizedAdmin(): Promise<AuthorizedAdmin | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;

  try {
    const account = await prisma.adminAccount.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (!account || !account.isActive) {
      try {
        clearSession();
      } catch {
        // cookies() may be read-only
      }
      return null;
    }

    return { id: account.id, username: account.username, role: account.role };
  } catch (err) {
    console.error("Failed to query authorized admin from DB:", err);
    return null;
  }
}

/** For Server Components/pages: redirects to /admin/login if not authorized. */
export async function requireAdminSession(): Promise<AuthorizedAdmin> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    try {
      clearSession();
    } catch {
      // cookies() may be read-only
    }
    redirect("/admin/login");
  }
  return admin;
}
