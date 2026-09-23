import { z } from "zod";

export const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

export const semverSchema = z
  .string()
  .trim()
  .regex(SEMVER_REGEX, "Version must be in valid semver format (e.g. 1.0.0)");

export function isValidSemver(version: unknown): version is string {
  return typeof version === "string" && SEMVER_REGEX.test(version.trim());
}

export function parseSemver(version: string): [number, number, number] {
  const parts = version.trim().split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((p) => isNaN(p) || p === undefined)) {
    throw new Error(`Invalid semver string: ${version}`);
  }
  return [parts[0] as number, parts[1] as number, parts[2] as number];
}

export function compareSemver(a: string, b: string): number {
  const [majA, minA, patA] = parseSemver(a);
  const [majB, minB, patB] = parseSemver(b);

  if (majA !== majB) return majA > majB ? 1 : -1;
  if (minA !== minB) return minA > minB ? 1 : -1;
  if (patA !== patB) return patA > patB ? 1 : -1;
  return 0;
}

export function semverGt(a: string, b: string): boolean {
  return compareSemver(a, b) > 0;
}
