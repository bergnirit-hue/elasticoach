import { describe, expect, it } from "vitest";
import {
  BEFORE_PHOTOS_BUCKET,
  MAX_PHOTO_BYTES,
  beforePhotoPath,
  validatePhotoFile,
} from "@/app/(app)/me/photo";

describe("validatePhotoFile", () => {
  it("accepts a normal jpg/png/webp under the limit", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1024 }).ok).toBe(true);
    expect(validatePhotoFile({ type: "image/png", size: 1024 }).ok).toBe(true);
    expect(validatePhotoFile({ type: "image/webp", size: 1024 }).ok).toBe(true);
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES }).ok).toBe(
      true,
    );
  });

  it("rejects non-image and disallowed image types with a Hebrew error", () => {
    const pdf = validatePhotoFile({ type: "application/pdf", size: 1024 });
    expect(pdf.ok).toBe(false);
    if (!pdf.ok) expect(pdf.error).toContain("תמונה");

    expect(validatePhotoFile({ type: "image/gif", size: 1024 }).ok).toBe(false);
    expect(validatePhotoFile({ type: "image/svg+xml", size: 1024 }).ok).toBe(false);
    expect(validatePhotoFile({ type: "", size: 1024 }).ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 0 }).ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const r = validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("5MB");
  });
});

describe("beforePhotoPath", () => {
  const uid = "11111111-1111-1111-1111-111111111111";

  it("puts the uid first (so Storage RLS matches auth.uid()) and keeps date + ext", () => {
    const p = beforePhotoPath(uid, "2026-11-03", "image/jpeg", "abcd");
    expect(p).toBe(`${uid}/2026-11-03-abcd.jpg`);
    // The first folder segment is the owner's uid — the RLS check.
    expect(p.split("/")[0]).toBe(uid);
  });

  it("maps each allowed type to its extension", () => {
    expect(beforePhotoPath(uid, "2026-11-03", "image/png", "r")).toMatch(/\.png$/);
    expect(beforePhotoPath(uid, "2026-11-03", "image/webp", "r")).toMatch(/\.webp$/);
    expect(beforePhotoPath(uid, "2026-11-03", "image/jpeg", "r")).toMatch(/\.jpg$/);
  });

  it("gives unique paths for different random tokens", () => {
    const a = beforePhotoPath(uid, "2026-11-03", "image/jpeg", "aaa");
    const b = beforePhotoPath(uid, "2026-11-03", "image/jpeg", "bbb");
    expect(a).not.toBe(b);
  });

  it("throws on an unsupported type", () => {
    expect(() => beforePhotoPath(uid, "2026-11-03", "image/gif", "r")).toThrow();
  });
});

describe("constants", () => {
  it("bucket is the private before-photos bucket", () => {
    expect(BEFORE_PHOTOS_BUCKET).toBe("before-photos");
  });
});
