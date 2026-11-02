import { describe, expect, it } from "vitest";
import {
  clientIdsOf,
  coachIdsOf,
  isClient,
  isClientOf,
  isCoach,
  isCoachOf,
  type Relationship,
} from "@/lib/roles";

// First test case from EC-10: Nirit coaches the friend, the friend coaches Nirit.
const NIRIT = "nirit";
const FRIEND = "friend";
const STRANGER = "stranger";

const mutualCoaching: Relationship[] = [
  { coach_id: NIRIT, client_id: FRIEND, status: "active" },
  { coach_id: FRIEND, client_id: NIRIT, status: "active" },
];

describe("roles — mutual coaching (EC-10 first test case)", () => {
  it("each user is both a coach and a client", () => {
    expect(isCoach(mutualCoaching, NIRIT)).toBe(true);
    expect(isClient(mutualCoaching, NIRIT)).toBe(true);
    expect(isCoach(mutualCoaching, FRIEND)).toBe(true);
    expect(isClient(mutualCoaching, FRIEND)).toBe(true);
  });

  it("directional helpers resolve the right pairing", () => {
    expect(isCoachOf(mutualCoaching, NIRIT, FRIEND)).toBe(true);
    expect(isClientOf(mutualCoaching, NIRIT, FRIEND)).toBe(true);
    expect(isCoachOf(mutualCoaching, NIRIT, STRANGER)).toBe(false);
  });

  it("lists linked counterparts", () => {
    expect(clientIdsOf(mutualCoaching, NIRIT)).toEqual([FRIEND]);
    expect(coachIdsOf(mutualCoaching, NIRIT)).toEqual([FRIEND]);
  });
});

describe("roles — status and isolation", () => {
  it("ignores non-active (invited) relationships", () => {
    const invited: Relationship[] = [
      { coach_id: NIRIT, client_id: FRIEND, status: "invited" },
    ];
    expect(isCoach(invited, NIRIT)).toBe(false);
    expect(isCoachOf(invited, NIRIT, FRIEND)).toBe(false);
    expect(clientIdsOf(invited, NIRIT)).toEqual([]);
  });

  it("a coach-only user is not a client", () => {
    const coachOnly: Relationship[] = [
      { coach_id: NIRIT, client_id: FRIEND, status: "active" },
    ];
    expect(isCoach(coachOnly, NIRIT)).toBe(true);
    expect(isClient(coachOnly, NIRIT)).toBe(false);
  });

  it("returns no roles for an unrelated user", () => {
    expect(isCoach(mutualCoaching, STRANGER)).toBe(false);
    expect(isClient(mutualCoaching, STRANGER)).toBe(false);
    expect(clientIdsOf(mutualCoaching, STRANGER)).toEqual([]);
  });
});
