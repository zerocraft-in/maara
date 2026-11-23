export type MediaVisibility = "public" | "private";

/** Canonical folders accepted by server-side upload initialization. */
export const CANONICAL_MEDIA_FOLDERS = [
  "products",
  "banners",
  "content",
  "uploads",
  "customers",
  "documents",
  "internal",
  "categories",
  "brands",
  "fonts",
  "icons",
  "videos",
  "thumbnails",
  "system",
] as const;

export type CanonicalMediaFolder = (typeof CANONICAL_MEDIA_FOLDERS)[number];

/** Public folders are an explicit server-side allowlist, not arbitrary input. */
export const PUBLIC_MEDIA_FOLDERS = new Set<CanonicalMediaFolder>([
  "products",
  "banners",
  "content",
]);

const CANONICAL_MEDIA_FOLDER_SET = new Set<string>(CANONICAL_MEDIA_FOLDERS);

/** Returns true only for exact, normalized canonical folder names. */
export function isCanonicalMediaFolder(value: unknown): value is CanonicalMediaFolder {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.normalize("NFC") &&
    /^[a-z][a-z0-9-]*$/.test(value) &&
    CANONICAL_MEDIA_FOLDER_SET.has(value)
  );
}

/** Validates a folder at the server boundary; invalid input never gets sanitized. */
export function canonicalMediaFolder(value: unknown): CanonicalMediaFolder {
  if (!isCanonicalMediaFolder(value)) {
    throw new Error("Invalid media folder.");
  }
  return value;
}

export function mediaVisibilityForKey(key: string): MediaVisibility {
  return key.startsWith("assets/public/") ? "public" : "private";
}

export function mediaVisibilityForFolder(folder: CanonicalMediaFolder): MediaVisibility {
  return PUBLIC_MEDIA_FOLDERS.has(folder) ? "public" : "private";
}

export function isPublicMediaKey(key: string): boolean {
  return /^assets\/public\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(key) && !key.includes("..");
}
