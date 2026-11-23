export type MediaVisibility = "public" | "private";

/** Public folders are an explicit server-side allowlist, not arbitrary input. */
export const PUBLIC_MEDIA_FOLDERS = new Set(["products", "banners", "content"]);

export function mediaVisibilityForKey(key: string): MediaVisibility {
  return key.startsWith("assets/public/") ? "public" : "private";
}

export function mediaVisibilityForFolder(folder: string): MediaVisibility {
  return PUBLIC_MEDIA_FOLDERS.has(folder.toLowerCase()) ? "public" : "private";
}

export function isPublicMediaKey(key: string): boolean {
  return /^assets\/public\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(key) && !key.includes("..");
}
