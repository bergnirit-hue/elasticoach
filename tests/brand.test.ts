import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  DEFAULT_BRAND_2,
  brandStyleCss,
  isValidHexColor,
} from "@/lib/theme/brand";

describe("isValidHexColor", () => {
  it("accepts 3, 6, and 8 digit hex", () => {
    expect(isValidHexColor("#abc")).toBe(true);
    expect(isValidHexColor("#1aa39c")).toBe(true);
    expect(isValidHexColor("#1aa39cff")).toBe(true);
    expect(isValidHexColor("  #4f46e5  ")).toBe(true); // trimmed
  });

  it("rejects non-hex, wrong length, and non-strings", () => {
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("1aa39c")).toBe(false); // no #
    expect(isValidHexColor("#12")).toBe(false);
    expect(isValidHexColor("#1234")).toBe(false);
    expect(isValidHexColor("rgb(0,0,0)")).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(0x1aa39c)).toBe(false);
  });

  it("rejects CSS/HTML injection attempts", () => {
    expect(isValidHexColor("#000;} body{display:none")).toBe(false);
    expect(isValidHexColor("#fff</style><script>alert(1)</script>")).toBe(false);
    expect(isValidHexColor("red;background:url(x)")).toBe(false);
  });
});

describe("brandStyleCss", () => {
  it("emits both overrides on :root for valid colors", () => {
    expect(brandStyleCss(DEFAULT_BRAND, DEFAULT_BRAND_2)).toBe(
      `:root{--brand:${DEFAULT_BRAND};--brand-2:${DEFAULT_BRAND_2}}`,
    );
  });

  it("emits only the valid color when the other is missing or invalid", () => {
    expect(brandStyleCss("#ff5d73", undefined)).toBe(":root{--brand:#ff5d73}");
    expect(brandStyleCss(undefined, "#4f46e5")).toBe(":root{--brand-2:#4f46e5}");
    expect(brandStyleCss("not-a-color", "#4f46e5")).toBe(
      ":root{--brand-2:#4f46e5}",
    );
  });

  it("returns an empty string when nothing is valid (defaults apply)", () => {
    expect(brandStyleCss(undefined, undefined)).toBe("");
    expect(brandStyleCss("", "oops")).toBe("");
  });

  it("never lets an injection payload reach the output", () => {
    const css = brandStyleCss("#000;}body{x", "#fff</style>");
    expect(css).toBe("");
    expect(css).not.toContain("<");
    expect(css).not.toContain("}body");
  });

  it("trims whitespace around accepted values", () => {
    expect(brandStyleCss("  #abc  ", null)).toBe(":root{--brand:#abc}");
  });
});
