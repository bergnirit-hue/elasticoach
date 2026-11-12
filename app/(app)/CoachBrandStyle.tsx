import { brandStyleCss } from "@/lib/theme/brand";

/**
 * Injects a coach's brand override (`--brand` / `--brand-2`) on `:root`.
 *
 * Server component — emits a <style> tag only when at least one color is a
 * valid hex. The CSS is built by `brandStyleCss`, which lets through nothing
 * but hex values, so `dangerouslySetInnerHTML` carries no injection risk.
 * With no valid colors it renders nothing and the globals.css defaults apply.
 */
export function CoachBrandStyle({
  brand,
  brand2,
}: {
  brand?: string | null;
  brand2?: string | null;
}) {
  const css = brandStyleCss(brand, brand2);
  if (!css) return null;
  return <style data-coach-brand dangerouslySetInnerHTML={{ __html: css }} />;
}
