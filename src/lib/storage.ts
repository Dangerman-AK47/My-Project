import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { getEnv } from "@/lib/env";

/**
 * Storage abstraction for FileVault uploads.
 *
 * Every driver implements this same interface. Only `LocalStorageDriver` is
 * implemented so far, since it's what local development needs. A future S3
 * / Cloudflare R2 / MinIO driver is a drop-in: implement `StorageDriver`
 * against that provider's SDK and swap it in `getStorageDriver()` below —
 * no other application code changes, since routes and services only ever
 * depend on this interface.
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
function generateStorageKey(originalFileName: string): string {
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

class LocalStorageDriver implements StorageDriver {
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
    await stat(absolutePath); // throws a clear ENOENT if missing
    return readFile(absolutePath);
  }

  async delete(storagePath: string): Promise<void> {
    const absolutePath = this.resolveWithinRoot(storagePath);
    await rm(absolutePath, { force: true });
  }

  /** Resolves a stored key to an absolute path, rejecting any traversal outside the storage root. */
  private resolveWithinRoot(storagePath: string): string {
    const root = resolveLocalStorageRoot();
    const resolved = path.resolve(root, storagePath);
    const rootWithSep = path.resolve(root) + path.sep;
    if (!resolved.startsWith(rootWithSep)) {
      throw new Error("Invalid storage path");
    }
    return resolved;
  }
}

class SupabaseStorageDriver implements StorageDriver {
  private url: string;
  private serviceKey: string;
  private bucket: string;

  constructor() {
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Supabase storage provider selected, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
      );
    }
    this.url = env.SUPABASE_URL.replace(/\/+$/, "");
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = env.SUPABASE_STORAGE_BUCKET || "filevault-uploads";
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

let cachedDriver: StorageDriver | undefined;

/**
 * Returns the active storage driver, chosen by UPLOAD_STORAGE_PROVIDER.
 * Supports "local" (default for development) and "supabase" (for Vercel/cloud hosting).
 */
export function getStorageDriver(): StorageDriver {
  if (cachedDriver) return cachedDriver;

  const provider = getEnv().UPLOAD_STORAGE_PROVIDER;
  if (provider === "supabase") {
    cachedDriver = new SupabaseStorageDriver();
    return cachedDriver;
  }

  if (provider !== "local") {
    throw new Error(
      `Storage provider "${provider}" is not supported. Use "local" or "supabase".`
    );
  }

  cachedDriver = new LocalStorageDriver();
  return cachedDriver;
}
