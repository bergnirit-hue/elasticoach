/**
 * White-label brand engine (code side of the token system in globals.css).
 *
 * A coach overrides ONLY `--brand` and `--brand-2`. Every other token
 * (`--brand-soft`, `--brand-grad`, `--brand-strong`, …) is defined in
 * globals.css as a `color-mix()` of `var(--brand)` / `var(--brand-2)` on
 * `:root`, so re-declaring just these two on `:root` makes all the derived
 * tokens — in light AND dark mode — re-resolve automatically. Text and
 * surface tokens stay neutral, so AA contrast holds for any coach brand.
 *
 * Only values that pass `isValidHexColor` are ever emitted, so the generated
 * CSS is safe to inject into a <style> tag (no CSS/HTML injection surface).
 */

/** The platform default brand, matching the `:root` values in globals.css. */
export const DEFAULT_BRAND = "#1aa39c";
export const DEFAULT_BRAND_2 = "#4f46e5";

// #rgb, #rrggbb, or #rrggbbaa — nothing else gets through.
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** True only for a syntactically valid hex color string. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value.trim());
}

/**
 * Build the scoped CSS that overrides the brand tokens on `:root`.
 * Returns "" when neither color is a valid hex, so the caller can render
 * nothing and fall back to the platform defaults from globals.css.
 */
export function brandStyleCss(
  brand?: string | null,
  brand2?: string | null,
): string {
  const decls: string[] = [];
  if (isValidHexColor(brand)) decls.push(`--brand:${brand.trim()}`);
  if (isValidHexColor(brand2)) decls.push(`--brand-2:${brand2.trim()}`);
  return decls.length > 0 ? `:root{${decls.join(";")}}` : "";
}

/**
 * Resolve the active coach brand for the current deployment.
 *
 * MVP (single coach — Nirit + friend): read optional overrides from the
 * environment. Multi-coach (white-label) will instead pass the viewing
 * client's coach brand colors from a `coach_branding` row into
 * `brandStyleCss` at the layout. Invalid/absent values yield the defaults.
 */
export function resolveBrandFromEnv(): { brand?: string; brand2?: string } {
  const brand = process.env.NEXT_PUBLIC_COACH_BRAND;
  const brand2 = process.env.NEXT_PUBLIC_COACH_BRAND_2;
  return {
    brand: isValidHexColor(brand) ? brand : undefined,
    brand2: isValidHexColor(brand2) ? brand2 : undefined,
  };
}
