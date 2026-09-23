import { Prisma } from "@prisma/client";

/** True if `err` is a Prisma unique-constraint violation on the given field. */
export function isUniqueConstraintError(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta!.target as string[]).includes(field)
  );
}
