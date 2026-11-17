/**
 * Cloudflare R2 storage client.
 *
 * R2 is S3-compatible, so we use the AWS SDK v3 S3 client pointed at the
 * R2 endpoint. This module is server-only: it never runs in the browser and
 * never exposes R2 secret credentials to the client.
 *
 * Files are organized under a readable root prefix:
 *   `assets/{organizationSlug}/{folderName}/{filename}`
 *
 * Public URLs are served through the configured R2 custom domain
 * (e.g. https://cdn.maara.co.in/assets/{key}).
 */

import "server-only";

import {
  S3Client,
  type S3ClientConfig,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2File {
  /** Full object key, e.g. `org_123/a1b2c3d4-image.jpg` */
  readonly key: string;
  /** Original file name (last segment of the key) */
  readonly name: string;
  readonly size: number;
  readonly contentType: string | null;
  readonly lastModified: Date | null;
  /** Public URL reachable via the R2 custom domain */
  readonly url: string;
  readonly organizationId: string;
}

interface R2Config {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly customDomain: string;
}

let cachedConfig: R2Config | null = null;

function loadConfig(): R2Config {
  if (cachedConfig) return cachedConfig;

  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`R2 config missing: ${name} is not configured`);
    }
    return value;
  };

  cachedConfig = {
    accountId: required("R2_ACCOUNT_ID"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    bucket: required("R2_BUCKET_NAME"),
    customDomain: process.env.R2_CUSTOM_DOMAIN ?? "",
  };

  return cachedConfig;
}

/** Resets the cached config. Used by tests. */
export function resetR2ConfigForTesting(): void {
  cachedConfig = null;
}

export function getR2Config(): R2Config {
  return loadConfig();
}

export function createR2Client(configOverrides?: Partial<S3ClientConfig>) {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...configOverrides,
  });
}

/** Public URL for an object key, served via the R2 custom domain. */
export function getPublicUrl(key: string): string {
  const { customDomain } = getR2Config();
  if (customDomain) {
    return `${customDomain.replace(/\/$/, "")}/${key}`;
  }

  const { accountId, bucket } = getR2Config();
  return `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Generates a unique object key for an upload (legacy format).
 *
 * Keys are prefixed by organization so each org's files can be listed and
 * scoped independently. Filename unsafe characters are replaced.
 *
 * @deprecated Use `makeAssetKey` for new uploads. This format embeds the
 * organization ID in the path, which is undesirable for public URLs. It is
 * kept so existing media records with legacy keys continue to work for
 * rename/delete operations.
 */
export function makeFileKey(organizationId: string, filename: string): string {
  const safe = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "x";
  return `${organizationId}/${id}-${safe}`;
}

/** Root object-key prefix for all readable media paths. */
export const R2_OBJECT_ROOT_PREFIX = "assets";

/** Reserved device names that must not be used as folder or file names. */
const RESERVED_OBJECT_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  ".",
  "..",
]);

/**
 * Sanitizes a filename for use in an R2 object key.
 *
 * - Strips directory segments (no path traversal).
 * - Collapses unsafe characters to underscores.
 * - Trims leading/trailing underscores.
 * - Prevents reserved device names and empty names.
 */
export function sanitizeFilenameForKey(filename: string): string {
  const base = filename.trim().split(/[\\/]/).pop() ?? "";
  const safe = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!safe || RESERVED_OBJECT_NAMES.has(safe.toLowerCase())) {
    return "file";
  }

  return safe.slice(0, 200);
}

/**
 * Generates a unique, server-controlled object key.
 *
 * Format: `assets/{folderName}/{filename}`
 *
 * No organization IDs, slugs, or UUIDs appear in the path. Organization
 * isolation is enforced at the database level (public.media.organization_id
 * + RLS), not in the object key. If the requested filename already exists,
 * a readable suffix (`-2`, `-3`, etc.) is appended before the extension.
 *
 * @param folder - canonical asset folder (e.g. "products", "uploads", "fonts").
 * @param filename - original sanitized file name.
 * @param checkExisting - optional HEAD-object check to avoid collisions.
 * @returns the generated object key.
 */
export async function makeAssetKey({
  folder,
  filename,
  checkExisting,
}: {
  readonly folder: string;
  readonly filename: string;
  readonly checkExisting?: (key: string) => Promise<boolean>;
}): Promise<string> {
  const safeFolder = folder ? sanitizeFilenameForKey(folder) : "uploads";
  const safeFilename = sanitizeFilenameForKey(filename);

  // Split filename into base and extension for suffix insertion.
  const dotIndex = safeFilename.lastIndexOf(".");
  let base = safeFilename;
  let ext = "";
  if (dotIndex > 0 && dotIndex < safeFilename.length - 1) {
    base = safeFilename.slice(0, dotIndex);
    ext = safeFilename.slice(dotIndex);
  }

  let counter = 1;
  let key = `${R2_OBJECT_ROOT_PREFIX}/${safeFolder}/${safeFilename}`;

  while (true) {
    const exists = checkExisting ? await checkExisting(key) : false;
    if (!exists) {
      return key;
    }
    counter += 1;
    key = `${R2_OBJECT_ROOT_PREFIX}/${safeFolder}/${base}-${counter}${ext}`;
  }
}

/** Last path segment of a key — the original file name. */
export function keyToName(key: string): string {
  return key.split("/").pop() ?? key;
}

/** Best-effort content type from file extension. */
export function contentTypeFromName(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * Lists objects under a prefix (folder). Returns up to `limit` files and a
 * `cursor` (continuation token) for the next page when there are more results.
 *
 * Organization isolation is enforced at the database layer
 * (public.media.organization_id + RLS), not in the object key path.
 */
export async function listFiles({
  prefix,
  cursor,
  limit = 50,
}: {
  readonly prefix?: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}): Promise<{ files: R2File[]; cursor: string | null; isTruncated: boolean }> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  const { Contents, IsTruncated, NextContinuationToken } =
    await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: cursor ?? undefined,
        MaxKeys: limit,
      }),
    );

  const files: R2File[] = (Contents ?? []).map((object) => {
    const key = object.Key ?? "";
    // Skip the "folder" placeholder object itself (prefix with no filename).
    const name = keyToName(key);
    return {
      key,
      name,
      size: object.Size ?? 0,
      contentType: contentTypeFromName(name),
      lastModified: object.LastModified ?? null,
      url: getPublicUrl(key),
      organizationId: "",
    };
  });

  return {
    files,
    cursor: NextContinuationToken ?? null,
    isTruncated: IsTruncated === true,
  };
}

/** Returns a presigned PUT URL the client can PUT the file bytes to directly. */
export async function createUploadUrl({
  key,
  contentType,
  expiresIn = 900, // 15 minutes
}: {
  readonly key: string;
  readonly contentType: string;
  readonly expiresIn?: number;
}): Promise<{ uploadUrl: string }> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn,
  });

  return { uploadUrl };
}

/** Deletes an object from R2. */
export async function deleteFile({ key }: { readonly key: string }): Promise<void> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

/**
 * Renames an object by copying it to a new key and deleting the original.
 * Returns the new key.
 */
export async function renameFile({
  sourceKey,
  destKey,
}: {
  readonly sourceKey: string;
  readonly destKey: string;
}): Promise<string> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
      MetadataDirective: "COPY",
    }),
  );

  await deleteFile({ key: sourceKey });
  return destKey;
}

/** Returns a presigned GET URL for temporary private access to an object. */
export async function getObjectUrl({
  key,
  expiresIn = 300,
}: {
  readonly key: string;
  readonly expiresIn?: number;
}): Promise<string> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/** Returns object metadata (size, content type, ETag, last modified). */
export async function headObject({
  key,
}: {
  readonly key: string;
}): Promise<{
  readonly contentLength: number;
  readonly contentType: string | null;
  readonly eTag: string | null;
  readonly lastModified: Date | null;
} | null> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  try {
    const {
      ContentLength,
      ContentType,
      ETag,
      LastModified,
    } = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return {
      contentLength: ContentLength ?? 0,
      contentType: ContentType ?? null,
      eTag: ETag ?? null,
      lastModified: LastModified ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Lists objects under an arbitrary prefix (not org-scoped).
 * Used for folder browsing and asset discovery.
 */
export async function listObjectsByPrefix({
  prefix,
  cursor,
  limit = 50,
}: {
  readonly prefix: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}): Promise<{
  files: R2File[];
  cursor: string | null;
  isTruncated: boolean;
}> {
  const client = createR2Client();
  const { bucket } = getR2Config();

  const { Contents, IsTruncated, NextContinuationToken } =
    await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: cursor ?? undefined,
        MaxKeys: limit,
      }),
    );

  const files: R2File[] = (Contents ?? []).map((object) => {
    const key = object.Key ?? "";
    const name = keyToName(key);
    return {
      key,
      name,
      size: object.Size ?? 0,
      contentType: contentTypeFromName(name),
      lastModified: object.LastModified ?? null,
      url: getPublicUrl(key),
      organizationId: "",
    };
  });

  return {
    files,
    cursor: NextContinuationToken ?? null,
    isTruncated: IsTruncated === true,
  };
}
