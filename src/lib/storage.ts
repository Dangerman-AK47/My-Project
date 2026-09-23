import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";

/**
 * Storage abstraction for FileVault uploads.
 *
 * Supports:
 * - "database": stores file binary directly in PostgreSQL (fv_storage_blobs) - zero external setup, persists across serverless instances.
 * - "local": stores file on disk (development).
 * - "supabase": stores file in Supabase Storage bucket.
 *
 * The active driver also acts as a hybrid reader, checking database, local disk,
 * and Supabase so existing files can always be retrieved regardless of configuration changes.
 */
export interface StorageDriver {
  /** Persist a file's bytes under a generated, collision-resistant key. */
  save(input: SaveInput): Promise<SavedFile>;
  /** Read back a previously saved file's bytes. */
  read(storagePath: string): Promise<Buffer>;
  /** Permanently remove a previously saved file. */
  delete(storagePath: string): Promise<void>;
}

export interface SaveInput {
  originalFileName: string;
  buffer: Buffer;
}

export interface SavedFile {
  storedFileName: string;
  storagePath: string;
  fileSize: number;
  checksumSha256: string;
}

/** Maximum upload size in bytes, from MAX_FILE_SIZE_MB (default 100 MB). */
export function getMaxUploadBytes(): number {
  return getEnv().MAX_FILE_SIZE_MB * 1024 * 1024;
}

/** Strips directory components and unsafe characters from a filename. */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
}

/**
 * Builds a collision-resistant, unpredictable storage key, organized into
 * date subfolders so a single directory never accumulates every upload
 * ever made. The random component is generated with `crypto.randomBytes`
 * (CSPRNG), not `Math.random()` or a timestamp alone, so a key can't be
 * guessed from another key or from the upload time.
 */
export function generateStorageKey(originalFileName: string): string {
  const ext = path.extname(sanitizeFileName(originalFileName));
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const unique = randomBytes(16).toString("hex");
  return path.join(String(yyyy), mm, dd, `${Date.now()}-${unique}${ext}`);
}

function resolveLocalStorageRoot(): string {
  const configured = getEnv().UPLOAD_DIR;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

// ---------------------------------------------------------------------------
// 1. Local Filesystem Driver
// ---------------------------------------------------------------------------
export class LocalStorageDriver implements StorageDriver {
  async save({ originalFileName, buffer }: SaveInput): Promise<SavedFile> {
    const maxBytes = getMaxUploadBytes();
    if (buffer.byteLength > maxBytes) {
      throw new Error(
        `File exceeds maximum allowed size of ${maxBytes / (1024 * 1024)} MB`
      );
    }

    const storagePath = generateStorageKey(originalFileName);
    const absolutePath = this.resolveWithinRoot(storagePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storedFileName: path.basename(storagePath),
      storagePath,
      fileSize: buffer.byteLength,
      checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const absolutePath = this.resolveWithinRoot(storagePath);
    await stat(absolutePath);
    return readFile(absolutePath);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const absolutePath = this.resolveWithinRoot(storagePath);
      await rm(absolutePath, { force: true });
    } catch {
      // ignore
    }
  }

  private resolveWithinRoot(storagePath: string): string {
    const root = resolveLocalStorageRoot();
    const resolved = path.resolve(root, storagePath);
    const rootWithSep = path.resolve(root) + path.sep;
    if (!resolved.startsWith(rootWithSep) && resolved !== root) {
      throw new Error("Invalid storage path");
    }
    return resolved;
  }
}

// ---------------------------------------------------------------------------
// 2. PostgreSQL Database Driver (Zero external dependencies, serverless safe)
// ---------------------------------------------------------------------------
export class DatabaseStorageDriver implements StorageDriver {
  async save({ originalFileName, buffer }: SaveInput): Promise<SavedFile> {
    const maxBytes = getMaxUploadBytes();
    if (buffer.byteLength > maxBytes) {
      throw new Error(
        `File exceeds maximum allowed size of ${maxBytes / (1024 * 1024)} MB`
      );
    }

    const storagePath = generateStorageKey(originalFileName).replace(/\\/g, "/");
    const checksumSha256 = createHash("sha256").update(buffer).digest("hex");

    await prisma.storageBlob.upsert({
      where: { storageKey: storagePath },
      create: {
        storageKey: storagePath,
        data: buffer,
        byteSize: buffer.byteLength,
      },
      update: {
        data: buffer,
        byteSize: buffer.byteLength,
      },
    });

    return {
      storedFileName: path.basename(storagePath),
      storagePath,
      fileSize: buffer.byteLength,
      checksumSha256,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const normalized = storagePath.replace(/\\/g, "/");
    const blob = await prisma.storageBlob.findUnique({
      where: { storageKey: normalized },
    });

    if (!blob) {
      throw new Error(`Blob not found in database: ${storagePath}`);
    }

    return Buffer.from(blob.data);
  }

  async delete(storagePath: string): Promise<void> {
    const normalized = storagePath.replace(/\\/g, "/");
    await prisma.storageBlob
      .deleteMany({
        where: { storageKey: normalized },
      })
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 3. Supabase Cloud Storage Driver
// ---------------------------------------------------------------------------
export class SupabaseStorageDriver implements StorageDriver {
  private url: string;
  private serviceKey: string;
  private bucket: string;

  constructor(url: string, serviceKey: string, bucket?: string) {
    this.url = url.replace(/\/+$/, "");
    this.serviceKey = serviceKey;
    this.bucket = bucket || "filevault-uploads";
  }

  async save({ originalFileName, buffer }: SaveInput): Promise<SavedFile> {
    const maxBytes = getMaxUploadBytes();
    if (buffer.byteLength > maxBytes) {
      throw new Error(
        `File exceeds maximum allowed size of ${maxBytes / (1024 * 1024)} MB`
      );
    }

    const storagePath = generateStorageKey(originalFileName).replace(/\\/g, "/");
    const endpoint = `${this.url}/storage/v1/object/${this.bucket}/${storagePath}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errText}`);
    }

    return {
      storedFileName: path.basename(storagePath),
      storagePath,
      fileSize: buffer.byteLength,
      checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const normalized = storagePath.replace(/\\/g, "/");
    const endpoint = `${this.url}/storage/v1/object/authenticated/${this.bucket}/${normalized}`;

    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to read file from Supabase Storage (${res.status})`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async delete(storagePath: string): Promise<void> {
    const normalized = storagePath.replace(/\\/g, "/");
    const endpoint = `${this.url}/storage/v1/object/${this.bucket}/${normalized}`;

    await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
      },
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Helper: Resolve Supabase URL from env or DATABASE_URL
// ---------------------------------------------------------------------------
function resolveSupabaseConfig(): { url?: string; serviceKey?: string; bucket?: string } {
  let url = process.env.SUPABASE_URL;
  if (!url) {
    const dbUrl = process.env.DATABASE_URL || "";
    // e.g. postgresql://postgres.kbfwfoscztpmtcyfbmnm:...
    const match = dbUrl.match(/postgres\.([a-z0-9_-]+):/i);
    if (match && match[1]) {
      url = `https://${match[1]}.supabase.co`;
    }
  }

  return {
    url,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "filevault-uploads",
  };
}

// ---------------------------------------------------------------------------
// 4. Resilient Hybrid Driver (Seamless fallback across DB, Local, and Supabase)
// ---------------------------------------------------------------------------
class ResilientStorageDriver implements StorageDriver {
  private dbDriver = new DatabaseStorageDriver();
  private localDriver = new LocalStorageDriver();
  private supabaseDriver?: SupabaseStorageDriver;

  constructor() {
    const supa = resolveSupabaseConfig();
    if (supa.url && supa.serviceKey) {
      this.supabaseDriver = new SupabaseStorageDriver(supa.url, supa.serviceKey, supa.bucket);
    }
  }

  async save(input: SaveInput): Promise<SavedFile> {
    const provider = getEnv().UPLOAD_STORAGE_PROVIDER;

    // 1. If Supabase is selected and credentials exist, try Supabase Storage
    if (provider === "supabase" && this.supabaseDriver) {
      try {
        return await this.supabaseDriver.save(input);
      } catch (err: any) {
        console.warn(
          "[Storage] Supabase Storage upload failed, falling back to PostgreSQL Database storage:",
          err?.message || err
        );
        // Fall back to database
        return await this.dbDriver.save(input);
      }
    }

    // 2. If provider is "local" and NOT running on Vercel/serverless
    if (provider === "local" && !process.env.VERCEL && process.env.NODE_ENV !== "production") {
      try {
        return await this.localDriver.save(input);
      } catch (err) {
        console.warn("[Storage] Local disk write failed, falling back to database storage:", err);
        return await this.dbDriver.save(input);
      }
    }

    // 3. Default: Database Storage Driver (PostgreSQL bytea)
    return await this.dbDriver.save(input);
  }

  async read(storagePath: string): Promise<Buffer> {
    // 1. Try reading from PostgreSQL Database
    try {
      return await this.dbDriver.read(storagePath);
    } catch {
      // not in db, check other sources
    }

    // 2. Try reading from Local disk
    try {
      return await this.localDriver.read(storagePath);
    } catch {
      // not on disk
    }

    // 3. Try reading from Supabase Storage if configured
    if (this.supabaseDriver) {
      try {
        return await this.supabaseDriver.read(storagePath);
      } catch {
        // not in supabase
      }
    }

    throw new Error(`File not found: ${storagePath}`);
  }

  async delete(storagePath: string): Promise<void> {
    await Promise.allSettled([
      this.dbDriver.delete(storagePath),
      this.localDriver.delete(storagePath),
      this.supabaseDriver ? this.supabaseDriver.delete(storagePath) : Promise.resolve(),
    ]);
  }
}

let cachedDriver: StorageDriver | undefined;

/**
 * Returns the active storage driver.
 * Uses a resilient hybrid driver that handles database, local disk, and Supabase Storage
 * seamlessly without failing when external credentials are not set.
 */
export function getStorageDriver(): StorageDriver {
  if (cachedDriver) return cachedDriver;
  cachedDriver = new ResilientStorageDriver();
  return cachedDriver;
}
