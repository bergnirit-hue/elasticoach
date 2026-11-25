/**
 * Postgres / PostgREST "column does not exist" detector — specifically for
 * `menu.client_id`, which exists only once migration 0010 is applied. Shared by
 * the server action (write fallback) and the edit loader (read fallback) so the
 * detection logic lives in one place. Plain module (no "use server") so it can
 * be imported by both.
 */
export function isMissingClientColumn(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  // Undefined column (Postgres 42703) / schema-cache miss (PostgREST PGRST204).
  if (error.code === "42703" || error.code === "PGRST204") return true;
  // Fall back to a message that is specifically about the client_id column being
  // absent — not any message that merely mentions client_id.
  const msg = error.message ?? "";
  return /client_id/.test(msg) && /(column|does not exist|schema cache)/i.test(msg);
}
