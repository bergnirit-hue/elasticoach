/**
 * Roles are defined per relationship, not per user (see CLAUDE.md).
 * A single user can be a coach to some people and a client of others.
 * These helpers derive a user's roles from the `coach_client` rows they can see.
 */

export type RelationshipStatus = "invited" | "active";

export interface Relationship {
  coach_id: string;
  client_id: string;
  status: RelationshipStatus;
}

/** True if `userId` coaches `clientId` with an active relationship. */
export function isCoachOf(
  relationships: Relationship[],
  userId: string,
  clientId: string,
): boolean {
  return relationships.some(
    (r) =>
      r.coach_id === userId &&
      r.client_id === clientId &&
      r.status === "active",
  );
}

/** True if `userId` is an active client of `coachId`. */
export function isClientOf(
  relationships: Relationship[],
  userId: string,
  coachId: string,
): boolean {
  return relationships.some(
    (r) =>
      r.client_id === userId &&
      r.coach_id === coachId &&
      r.status === "active",
  );
}

/** True if the user is an active coach of at least one person. */
export function isCoach(relationships: Relationship[], userId: string): boolean {
  return relationships.some(
    (r) => r.coach_id === userId && r.status === "active",
  );
}

/** True if the user is an active client of at least one person. */
export function isClient(
  relationships: Relationship[],
  userId: string,
): boolean {
  return relationships.some(
    (r) => r.client_id === userId && r.status === "active",
  );
}

/** Client ids the user actively coaches. */
export function clientIdsOf(
  relationships: Relationship[],
  userId: string,
): string[] {
  return relationships
    .filter((r) => r.coach_id === userId && r.status === "active")
    .map((r) => r.client_id);
}

/** Coach ids the user is an active client of. */
export function coachIdsOf(
  relationships: Relationship[],
  userId: string,
): string[] {
  return relationships
    .filter((r) => r.client_id === userId && r.status === "active")
    .map((r) => r.coach_id);
}
