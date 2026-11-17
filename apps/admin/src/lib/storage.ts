/**
 * Centralized asset storage service for Maara Merch.
 *
 * This is the single source of truth for all Cloudflare R2 object operations:
 * key generation, presigned upload URLs, public URLs, metadata inspection,
 * copy/rename/delete, and folder browsing.
 *
 * All functions are server-only: R2 credentials never reach the browser, and
 * object keys are always generated server-side. Clients never supply keys or
 * public URLs.
 *
 * Object keys follow the canonical structure:
 *   assets/{folderName}/{filename}
 *
 * No organization IDs, slugs, or UUIDs appear in the path. Organization
 * isolation is enforced at the database level (public.media.organization_id
 * + RLS), not in the object key. If the requested filename already exists,
 * a readable suffix (`-2`, `-3`, etc.) is appended before the extension.
 */

import "server-only";

import {
  createR2Client,
  createUploadUrl,
  deleteFile,
  getPublicUrl,
  headObject,
  listObjectsByPrefix,
  makeAssetKey,
  renameFile,
  sanitizeFilenameForKey,
  resetR2ConfigForTesting,
  R2_OBJECT_ROOT_PREFIX,
} from "./r2";

/** Canonical asset categories (folders) under the `assets/` root prefix. */
export const ASSET_FOLDERS: Readonly<{
  uploads: "uploads";
  products: "products";
  categories: "categories";
  brands: "brands";
  fonts: "fonts";
  icons: "icons";
  banners: "banners";
  videos: "videos";
  documents: "documents";
  thumbnails: "thumbnails";
  system: "system";
}> = {
  uploads: "uploads",
  products: "products",
  categories: "categories",
  brands: "brands",
  fonts: "fonts",
  icons: "icons",
  banners: "banners",
  videos: "videos",
  documents: "documents",
  thumbnails: "thumbnails",
  system: "system",
} as const;

export type AssetFolder = (typeof ASSET_FOLDERS)[keyof typeof ASSET_FOLDERS];

/**
 * Maximum upload size per category (bytes).
 * Centralized so every upload entry point shares the same limits.
 */
export const MAX_SIZE_BYTES: Record<string, number> = {
  image: 15 * 1024 * 1024, // 15 MB
  video: 100 * 1024 * 1024, // 100 MB
  document: 20 * 1024 * 1024, // 20 MB
  font: 10 * 1024 * 1024, // 10 MB
} as const;

/**
 * Maps a file extension (lowercase, no leading dot) to a category.
 * Used for MIME type and size validation, independent of the folder path.
 */
function categoryFromExtension(ext: string): string {
  const extLower = ext.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(extLower)) {
    return "image";
  }
  if (["mp4", "webm"].includes(extLower)) {
    return "video";
  }
  if (["pdf"].includes(extLower)) {
    return "document";
  }
  if (["woff2", "woff", "ttf", "otf"].includes(extLower)) {
    return "font";
  }
  return "document"; // safest default: smallest size limit
}

/**
 * Map of folder → default category for folders whose name doesn't match
 * a category directly. All new uploads are validated by extension-derived
 * category; this map is a fallback for extensionless validation.
 */
/** MIME types permitted per category. */
export const MIME_TYPES_BY_CATEGORY: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  video: ["video/mp4", "video/webm"],
  document: ["application/pdf"],
  font: ["font/woff2", "font/woff", "font/ttf", "font/otf"],
} as const;

/** File extensions permitted per category (lowercase, no leading dot). */
export const EXTENSIONS_BY_CATEGORY: Record<string, string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "gif", "svg"],
  video: ["mp4", "webm"],
  document: ["pdf"],
  font: ["woff2", "woff", "ttf", "otf"],
} as const;

/** Result of generating an upload key + presigned URL. */
export interface InitUploadResult {
  /** Full R2 object key, e.g. `assets/maara-test/products/shirt-front.webp` */
  readonly key: string;
  /** Original sanitized file name. */
  readonly name: string;
  /** MIME type to use for the upload and metadata. */
  readonly contentType: string;
  /** File size in bytes. */
  readonly size: number;
  /** Asset folder (e.g. "products"). */
  readonly folder: string;
  /** Temporary presigned PUT URL (short-lived). */
  readonly uploadUrl: string;
  /** Permanent public CDN URL. */
  readonly publicUrl: string;
  /** Presigned URL expiration in seconds. */
  readonly expiresIn: number;
}

/** Result of inspecting an object's metadata. */
export interface AssetMetadata {
  readonly key: string;
  readonly name: string;
  readonly size: number;
  readonly contentType: string | null;
  readonly eTag: string | null;
  readonly lastModified: Date | null;
  readonly publicUrl: string;
}

/**
 * Sanitizes an asset folder name.
 */
export function sanitizeAssetFolder(name: string): string {
  const sanitized = sanitizeFilenameForKey(name);
  if (!sanitized || sanitized === "file") {
    return "uploads";
  }
  return sanitized;
}

/**
 * Sanitizes an asset filename.
 */
export function sanitizeAssetFilename(filename: string): string {
  return sanitizeFilenameForKey(filename);
}

/**
 * Generates the permanent public CDN URL for an object key.
 *
 * This is the single canonical public-URL generator. All callers (API routes,
 * server actions, React components) must use this instead of constructing URLs
 * independently.
 */
export function getAssetPublicUrl(key: string): string {
  return getPublicUrl(key);
}

/**
 * Initializes a direct-to-R2 upload.
 *
 * 1. Validates the file against the centralized policy.
 * 2. Generates a server-controlled object key under `assets/{folder}/`.
 * 3. Creates a short-lived presigned PUT URL.
 * 4. Returns the permanent public URL alongside the presigned URL.
 *
 * @param input - filename, client content type, size, folder.
 * @returns upload init result with key, uploadUrl, publicUrl.
 */
export async function initUpload({
  filename,
  clientContentType,
  size,
  folder = ASSET_FOLDERS.uploads,
}: {
  readonly filename: string;
  readonly clientContentType: string;
  readonly size: number;
  readonly folder?: AssetFolder | string;
}): Promise<InitUploadResult> {
  // Default empty folder to uploads
  const resolvedFolder = folder || ASSET_FOLDERS.uploads;
  // Validate file extension / size / MIME against the centralized policy.
  // Category is derived from the file extension (not the folder), so that
  // validation is consistent regardless of which folder the file goes into.
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    throw new Error("File must have a recognized extension.");
  }
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  const category = categoryFromExtension(ext);

  const allowedMimes = MIME_TYPES_BY_CATEGORY[category] ?? [];
  const clientType = (clientContentType ?? "").toLowerCase().trim();
  const contentType =
    allowedMimes.includes(clientType) && clientType
      ? clientType
      : allowedMimes[0] ?? "";

  const maxBytes = MAX_SIZE_BYTES[category];
  if (!Number.isFinite(size) || size < 0) {
    throw new Error("Invalid file size.");
  }
  if (size === 0) {
    throw new Error("File is empty.");
  }
  if (maxBytes && size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(
      `File is too large (max ${maxMb} MB for ${category} files).`,
    );
  }

  const safeName = sanitizeAssetFilename(filename);

  // Generate the server-controlled object key. Collisions are detected via a
  // HEAD-object check against R2 so concurrent uploads never overwrite one
  // another. UUIDs are already unique, so collisions are essentially impossible.
  const key = await makeAssetKey({
    folder: resolvedFolder,
    filename: safeName,
    checkExisting: async (candidateKey: string) => {
      const metadata = await headObject({ key: candidateKey });
      return metadata !== null;
    },
  });

  const { uploadUrl } = await createUploadUrl({
    key,
    contentType,
    expiresIn: 900, // 15 minutes
  });

  const publicUrl = getAssetPublicUrl(key);

  return {
    key,
    name: safeName,
    contentType,
    size,
    folder: resolvedFolder,
    uploadUrl,
    publicUrl,
    expiresIn: 900,
  };
}

/**
 * Deletes an object from R2.
 */
export async function deleteAsset({ key }: { readonly key: string }): Promise<void> {
  await deleteFile({ key });
}

/**
 * Copies an object to a new key (used as the first half of a rename/move).
 * Returns the destination key.
 */
export async function copyAsset({
  sourceKey,
  destKey,
}: {
  readonly sourceKey: string;
  readonly destKey: string;
}): Promise<string> {
  return renameFile({ sourceKey, destKey });
}

/**
 * Renames (moves) an object: copy → verify → delete original.
 * Returns the destination key.
 */
export async function renameAsset({
  sourceKey,
  destKey,
}: {
  readonly sourceKey: string;
  readonly destKey: string;
}): Promise<string> {
  return renameFile({ sourceKey, destKey });
}

/**
 * Verifies that an object exists in R2 and returns its metadata.
 */
export async function verifyAssetObject({
  key,
  expectedContentType,
}: {
  readonly key: string;
  readonly expectedContentType?: string;
}): Promise<AssetMetadata | null> {
  const metadata = await headObject({ key });
  if (!metadata) {
    return null;
  }
  if (
    expectedContentType &&
    metadata.contentType &&
    !metadata.contentType.startsWith(expectedContentType.split("/")[0] + "/")
  ) {
    return null;
  }
  return {
    key,
    name: key.split("/").pop() ?? key,
    size: metadata.contentLength,
    contentType: metadata.contentType,
    eTag: metadata.eTag,
    lastModified: metadata.lastModified,
    publicUrl: getAssetPublicUrl(key),
  };
}

/**
 * Lists objects under a prefix (for folder browsing).
 * The prefix should include the `assets/` root and organization slug.
 */
export async function listAssetFolder({
  prefix,
  cursor,
  limit = 50,
}: {
  readonly prefix: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}) {
  return listObjectsByPrefix({ prefix, cursor, limit });
}

export { R2_OBJECT_ROOT_PREFIX, createR2Client, resetR2ConfigForTesting };
