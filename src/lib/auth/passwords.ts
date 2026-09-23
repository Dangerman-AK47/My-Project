import bcrypt from "bcryptjs";

// Cost factor 12 — a reasonable balance of hashing time vs. brute-force
// resistance for an admin-only login (few accounts, high value target).
const BCRYPT_COST_FACTOR = 12;

/** Hashes a plain-text password. Never store the input to this anywhere. */
export function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, BCRYPT_COST_FACTOR);
}

/** Compares a plain-text password against a stored bcrypt hash. */
export function verifyPassword(
  plainTextPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}

// A real bcrypt hash (of an unguessable, unused value) computed once at
// module load. Login compares against this when a username isn't found, so
// "no such user" and "wrong password" take the same amount of time instead
// of the missing-user case returning early and leaking timing information.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  `no-such-account-${Math.random().toString(36)}`,
  BCRYPT_COST_FACTOR
);
