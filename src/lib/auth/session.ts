import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

/**
 * Stateless, signed session tokens (JWT) stored in an HTTP-only cookie.
 *
 * This file only encodes/decodes tokens — it never touches cookies or the
 * database, so it can run in both the Node runtime (server actions, route
 * handlers) and the Edge runtime (middleware). Cookie I/O lives in
 * `lib/auth/guard.ts`; DB-backed authorization checks also live there.
 */

export const SESSION_COOKIE_NAME = "fv_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  /** AdminAccount.id */
  sub: string;
  username: string;
  role: string;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

/** Signs a new session token for the given admin, expiring in SESSION_TTL_SECONDS. */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(getSecretKey());
}

/**
 * Verifies a session token's signature and expiration.
 * Returns null (never throws) on any invalid, tampered, or expired token —
 * callers should treat null the same as "not logged in".
 */
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      username: payload.username,
      role: typeof payload.role === "string" ? payload.role : "ADMIN",
    };
  } catch {
    // Covers expired, malformed, and signature-mismatch tokens alike.
    return null;
  }
}
