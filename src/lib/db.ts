import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Prisma Client Singleton with Automatic PgBouncer Parameter Sanitization
//
// When connecting to Supabase's transaction pooler (port 6543), Prisma must:
//   1. Append `pgbouncer=true` to disable named prepared statements (prevents 42P05 error)
//   2. Set `statement_cache_size=0` to ensure no prepared statement caching across pooled conns
//   3. Set `connection_limit=10` to allow parallel queries (e.g. Promise.all on dashboard)
//
// By sanitizing the URL programmatically here, we guarantee that these critical
// parameters are ALWAYS applied, even if someone enters a raw pooler URL in Vercel.
//
// We also maintain the singleton pattern on globalThis in both dev and prod warm
// containers to avoid the 300-800ms TCP/TLS handshake latency on every request.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function getSanitizedDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Detect Supabase Transaction Pooler (port 6543 or pooler.supabase.com)
  if (url.includes("pooler.supabase.com") || url.includes(":6543")) {
    const separator = url.includes("?") ? "&" : "?";
    const paramsToAdd: string[] = [];

    if (!url.includes("pgbouncer=")) {
      paramsToAdd.push("pgbouncer=true");
    }
    if (!url.includes("statement_cache_size=")) {
      paramsToAdd.push("statement_cache_size=0");
    }
    if (!url.includes("connection_limit=")) {
      paramsToAdd.push("connection_limit=10");
    }

    if (paramsToAdd.length > 0) {
      url = `${url}${separator}${paramsToAdd.join("&")}`;
    }
  }

  return url;
}

function createPrismaClient(): PrismaClient {
  const sanitizedUrl = getSanitizedDatabaseUrl();

  return new PrismaClient({
    datasources: sanitizedUrl
      ? {
          db: {
            url: sanitizedUrl,
          },
        }
      : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = (global._prisma ??= createPrismaClient());
