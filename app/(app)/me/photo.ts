/**
 * EC-41: "before" photo upload — validation and storage-path helpers.
 *
 * Pure logic only (no Supabase / server deps) so it is unit-testable. The
 * limits here MUST stay in sync with the bucket limits in the migration
 * supabase/migrations/0008_ec41_before_photos_bucket.sql.
 */

/** Private bucket id (public = false). Read only via signed URLs. */
export const BEFORE_PHOTOS_BUCKET = "before-photos";

/** 5 MB, matching the bucket's file_size_limit. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Allowed image MIME types → file extension, matching the bucket's allowed_mime_types. */
export const PHOTO_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MB = (n: number) => `${Math.round(n / (1024 * 1024))}MB`;

export type PhotoMeta = { type: string; size: number };

/**
 * Validate a chosen file: image-only (jpg/png/webp) and ≤ 5MB. Returns a
 * Hebrew error message on failure.
 */
export function validatePhotoFile(
  file: PhotoMeta,
): { ok: true } | { ok: false; error: string } {
  if (!PHOTO_EXT_BY_TYPE[file.type]) {
    return { ok: false, error: "אפשר להעלות רק תמונה (JPG, PNG או WEBP)" };
  }
  if (file.size <= 0) {
    return { ok: false, error: "הקובץ ריק" };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: `התמונה גדולה מדי (מקסימום ${MB(MAX_PHOTO_BYTES)})` };
  }
  return { ok: true };
}

/**
 * Storage path for a user's "before" photo on a given date:
 *   `{userId}/{date}-{rand}.{ext}`
 * The first segment is the owner's uid, which the Storage RLS policies match
 * against auth.uid(). `rand` keeps paths unique per upload (avoids stale-cache
 * and collisions when a photo is replaced). Caller passes a random token
 * (e.g. crypto.randomUUID()).
 */
export function beforePhotoPath(
  userId: string,
  date: string,
  type: string,
  rand: string,
): string {
  const ext = PHOTO_EXT_BY_TYPE[type];
  if (!ext) throw new Error(`unsupported photo type: ${type}`);
  return `${userId}/${date}-${rand}.${ext}`;
}
