/**
 * EC-45 — consent invites. A coach->client link is created as `invited` and
 * grants the coach no access until the client accepts it. These are the pure,
 * side-effect-free helpers behind the client-side accept/decline flow; the
 * server action and RLS do the actual authorization.
 */

export type InviteAction = "accept" | "decline";

/**
 * Validate an untrusted action value coming from a form. Returns the action
 * only for the two allowed verbs; anything else (typos, injection, nullish,
 * non-strings) yields null so the server action can reject it.
 */
export function parseInviteAction(raw: unknown): InviteAction | null {
  return raw === "accept" || raw === "decline" ? raw : null;
}

/** A pending coach->client invite, as shown to the client. */
export interface PendingInvite {
  id: string;
  coachId: string;
  coachName: string | null;
}

/** Row shape returned by the /me invites query (coach profile joined). */
export interface InviteRow {
  id: string;
  coach_id: string;
  coach: { display_name: string | null } | null;
}

/** Shape a raw coach_client row (+ joined coach profile) into a PendingInvite. */
export function toPendingInvite(row: InviteRow): PendingInvite {
  return {
    id: row.id,
    coachId: row.coach_id,
    coachName: row.coach?.display_name ?? null,
  };
}

/** Display label for a coach whose name may be missing. */
export function coachLabel(name: string | null | undefined): string {
  return name?.trim() ? name.trim() : "מאמן/ת";
}
