import { z } from "zod";

// Used on both the client (inline form validation) and server (API routes,
// services) so the exact same rules apply everywhere. No server-only or
// Node-specific imports — safe to bundle into client code.

export const DEVICE_ID_MIN_LENGTH = 3;
export const DEVICE_ID_MAX_LENGTH = 100;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Trims whitespace, enforces length + character rules, then normalizes to
 * uppercase — so "dev-1001", "Dev-1001", and "DEV-1001" all resolve to the
 * same registered device.
 */
export const deviceIdSchema = z
  .string()
  .trim()
  .min(DEVICE_ID_MIN_LENGTH, `Device ID must be at least ${DEVICE_ID_MIN_LENGTH} characters.`)
  .max(DEVICE_ID_MAX_LENGTH, `Device ID must be at most ${DEVICE_ID_MAX_LENGTH} characters.`)
  .regex(
    DEVICE_ID_PATTERN,
    "Device ID can only contain letters, numbers, hyphens, underscores, and periods."
  )
  .transform((value) => value.toUpperCase());

export type DeviceId = z.infer<typeof deviceIdSchema>;

export type ParseDeviceIdResult =
  | { success: true; value: string }
  | { success: false; error: string };

/** Validates and normalizes a device ID, returning a friendly error message on failure. */
export function parseDeviceId(input: string): ParseDeviceIdResult {
  const result = deviceIdSchema.safeParse(input);
  if (result.success) {
    return { success: true, value: result.data };
  }
  return {
    success: false,
    error: result.error.issues[0]?.message ?? "Please enter a valid Device ID.",
  };
}
