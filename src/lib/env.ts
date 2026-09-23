import { z } from "zod";

// Validates required environment variables once at startup so a missing
// var fails fast with a clear message instead of surfacing as a confusing
// runtime error deep in an API route or server action.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters")
    .default("filevault-super-secure-production-session-secret-key-32chars"),
  // Storage config
  UPLOAD_STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  MAX_FILE_SIZE_MB: z.coerce
    .number()
    .int("MAX_FILE_SIZE_MB must be a whole number")
    .positive("MAX_FILE_SIZE_MB must be positive")
    .default(100),
  // Supabase cloud storage (for Vercel / serverless deployments)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("filevault-uploads"),
  // Sensor platform v3
  SENSOR_TOKEN_SECRET: z
    .string()
    .min(32, "SENSOR_TOKEN_SECRET must be at least 32 characters")
    .default("sensor-platform-token-secret-default-32-chars-long"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

/** Parses and caches process.env against the schema above. */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
