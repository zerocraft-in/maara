/**
 * Centralized file upload policy for Maara Merch media storage.
 *
 * This is the single source of truth for which file types may be uploaded to
 * Cloudflare R2, the size limits per category, and how files are validated.
 *
 * All validation happens server-side. The browser-supplied extension, MIME
 * type and size are never trusted on their own.
 *
 * SVG files are intentionally REJECTED by default because they can contain
 * active content (scripts, event handlers). Accepting them would require a
 * dedicated sanitization step that is not part of the initial implementation.
 *
 * File categories are easy to extend: add an entry to `EXTENSIONS_BY_CATEGORY`
 * / `MIME_TYPES_BY_CATEGORY` / `MAX_SIZE_BYTES` and the corresponding magic
 * bytes in `MAGIC_BYTES_BY_EXTENSION`.
 */

import { createR2Client } from "./r2";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

/** Maximum upload size per category (bytes). */
export const MAX_SIZE_BYTES: Record<string, number> = {
  image: 15 * 1024 * 1024, // 15 MB
  video: 100 * 1024 * 1024, // 100 MB
  document: 20 * 1024 * 1024, // 20 MB
} as const;

/**
 * File extensions permitted per category. Lowercase, no leading dot.
 */
export const EXTENSIONS_BY_CATEGORY: Record<string, string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "gif"],
  video: ["mp4", "webm"],
  document: ["pdf"],
} as const;

/** MIME types permitted per category (browser-supplied values only). */
export const MIME_TYPES_BY_CATEGORY: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm"],
  document: ["application/pdf"],
} as const;

/** Map lowercase extension (no dot) to its category. */
export const EXTENSION_TO_CATEGORY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [category, extensions] of Object.entries(
    EXTENSIONS_BY_CATEGORY,
  )) {
    for (const ext of extensions) {
      map[ext] = category;
    }
  }
  return map;
})();

/** Magic-byte signatures per extension (lowercase, no dot). */
export const MAGIC_BYTES_BY_EXTENSION: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46, 0x38], // "GIF8"
  webp: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], // "RIFF....WEBP"
  mp4: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp at offset 4
  webm: [0x1a, 0x45, 0xdf, 0xa3], // EBML
  pdf: [0x25, 0x50, 0x44, 0x46], // "%PDF"
} as const;

/** Result of categorizing + validating a file. */
export interface FileValidationResult {
  readonly ok: boolean;
  readonly category?: string;
  readonly contentType?: string;
  readonly error?: string;
}

/** Validated upload request input. */
export interface UploadPolicyInput {
  readonly filename: string;
  readonly clientContentType: string;
  readonly size: number;
  readonly organizationId: string;
}

const MAX_FILENAME_LENGTH = 200;

const RESERVED_NAMES = new Set([
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

function extractExtension(filename: string): string | undefined {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === base.length - 1) {
    return undefined;
  }
  return base.slice(dotIndex + 1).toLowerCase();
}

/**
 * Sanitize a filename for safe storage: strip directory segments, collapse
 * unsafe characters, and prevent reserved device names.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const safe = base
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!safe || RESERVED_NAMES.has(safe.toLowerCase())) {
    return "file";
  }

  return safe.slice(0, MAX_FILENAME_LENGTH);
}

/**
 * Validate a file's extension, MIME type and size against the centralized
 * policy. Does NOT inspect file contents (use validateFileContentSignature
 * for that).
 */
export function validateFileMetadata(input: {
  readonly filename: string;
  readonly clientContentType: string;
  readonly size: number;
}): FileValidationResult {
  const { filename, clientContentType, size } = input;

  if (!filename || !filename.trim()) {
    return { ok: false, error: "File name is required." };
  }

  if (filename.length > MAX_FILENAME_LENGTH) {
    return {
      ok: false,
      error: `File name is too long (max ${MAX_FILENAME_LENGTH} characters).`,
    };
  }

  const extension = extractExtension(filename);
  if (!extension) {
    return {
      ok: false,
      error: "File must have a recognized extension.",
    };
  }

  const category = EXTENSION_TO_CATEGORY[extension];
  if (!category) {
    return {
      ok: false,
      error: `File type ".${extension}" is not supported.`,
    };
  }

  const allowedMimes = MIME_TYPES_BY_CATEGORY[category] ?? [];
  const clientType = (clientContentType ?? "").toLowerCase().trim();

  // Note the client MIME type but do not treat it as authoritative: the real
  // gate is the content signature checked separately. If the browser supplied
  // a MIME type that does not match the extension's category, still accept
  // based on extension so that the signature check decides.
  const contentType =
    allowedMimes.includes(clientType) && clientType
      ? clientType
      : allowedMimes[0] ?? "";

  const maxBytes = MAX_SIZE_BYTES[category];
  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, error: "Invalid file size." };
  }
  if (size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `File is too large (max ${maxMb} MB for ${category} files).`,
    };
  }

  return { ok: true, category, contentType };
}

/**
 * Verify the actual content signature (magic bytes) of a file buffer against
 * its extension. Returns true when the signature matches.
 */
export function validateFileContentSignature(
  buffer: ArrayBuffer | Buffer,
  extension: string,
): boolean {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array((buffer as ArrayBuffer).slice(0, 32));

  const sig = MAGIC_BYTES_BY_EXTENSION[extension.toLowerCase()];
  if (!sig) {
    return true; // No signature defined: cannot verify, allow.
  }
  if (bytes.length < sig.length) {
    return false;
  }
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Validate a complete upload request against the policy (extension, MIME,
 * size). The caller is responsible for content-signature verification on the
 * uploaded bytes.
 */
export function validateUpload(input: UploadPolicyInput): FileValidationResult {
  return validateFileMetadata(input);
}

/**
 * Verify that an object exists in R2 and its content type is compatible with
 * the expected type. Used after a successful direct-to-R2 upload to confirm
 * the object is present before registering metadata in Supabase.
 */
export async function verifyR2Object({
  key,
  expectedContentType,
}: {
  readonly key: string;
  readonly expectedContentType: string;
}): Promise<boolean> {
  const client = createR2Client();
  const bucket = process.env.R2_BUCKET_NAME ?? "";

  try {
    const { ContentType, ContentLength } = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    if (!ContentLength || ContentLength <= 0) {
      return false;
    }
    const actual = (ContentType ?? "").toLowerCase();
    const expected = (expectedContentType ?? "").toLowerCase();
    return (
      actual === expected ||
      actual.startsWith(expected.split("/")[0] + "/")
    );
  } catch {
    return false;
  }
}
