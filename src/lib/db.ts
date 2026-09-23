import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Prisma client singleton
//
// Development: reuse a single instance across hot-reloads to avoid exhausting
//   the connection pool (stored on globalThis).
//
// Production (Vercel serverless): do NOT share a PrismaClient across module
//   boundaries because each serverless invocation may run on a fresh isolate.
//   Creating a new client per-request is the safe pattern when the DATABASE_URL
//   already points to a PgBouncer pooler (Supabase port 6543) with:
//     ?pgbouncer=true&statement_cache_size=0&connection_limit=1
//   Those params prevent the "prepared statement s0 already exists" (42P05)
//   error that occurs when PgBouncer reuses a backend connection that already
//   has a cached prepared statement from a previous Prisma invocation.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()           // fresh client every cold-start — safe with pooler URL
    : (global._prisma ??= createPrismaClient()); // dev: reuse across hot-reloads
