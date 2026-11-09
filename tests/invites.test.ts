import { describe, expect, it } from "vitest";
import {
  coachLabel,
  parseInviteAction,
  toPendingInvite,
  type InviteRow,
} from "@/lib/invites";
import {
  clientIdsOf,
  isClient,
  isClientOf,
  isCoach,
  isCoachOf,
  type Relationship,
} from "@/lib/roles";

const COACH = "coach-1";
const CLIENT = "client-1";

describe("EC-45 — parseInviteAction (server-action authorization guard)", () => {
  it("accepts the two allowed verbs", () => {
    expect(parseInviteAction("accept")).toBe("accept");
    expect(parseInviteAction("decline")).toBe("decline");
  });

  it("rejects anything else so the action can bail out", () => {
    for (const bad of [
      "",
      "ACCEPT",
      "approve",
      "delete",
      " accept",
      null,
      undefined,
      0,
      1,
      {},
      ["accept"],
    ]) {
      expect(parseInviteAction(bad)).toBeNull();
    }
  });
});

describe("EC-45 — coachLabel", () => {
  it("uses the coach name when present", () => {
    expect(coachLabel("נירית")).toBe("נירית");
    expect(coachLabel("  נירית  ")).toBe("נירית");
  });

  it("falls back to a generic Hebrew label when missing/blank", () => {
    expect(coachLabel(null)).toBe("מאמן/ת");
    expect(coachLabel(undefined)).toBe("מאמן/ת");
    expect(coachLabel("   ")).toBe("מאמן/ת");
  });
});

describe("EC-45 — toPendingInvite", () => {
  it("flattens the joined coach profile", () => {
    const row: InviteRow = {
      id: "cc-1",
      coach_id: COACH,
      coach: { display_name: "נירית" },
    };
    expect(toPendingInvite(row)).toEqual({
      id: "cc-1",
      coachId: COACH,
      coachName: "נירית",
    });
  });

  it("tolerates a missing/null coach profile (RLS may hide it)", () => {
    const row: InviteRow = { id: "cc-2", coach_id: COACH, coach: null };
    expect(toPendingInvite(row).coachName).toBeNull();
  });
});

describe("EC-45 — an invited link grants the coach no access (role layer)", () => {
  const invited: Relationship[] = [
    { coach_id: COACH, client_id: CLIENT, status: "invited" },
  ];
  const active: Relationship[] = [
    { coach_id: COACH, client_id: CLIENT, status: "active" },
  ];

  it("invited: coach is not treated as coaching the client", () => {
    expect(isCoachOf(invited, COACH, CLIENT)).toBe(false);
    expect(isCoach(invited, COACH)).toBe(false);
    expect(clientIdsOf(invited, COACH)).toEqual([]);
    expect(isClientOf(invited, CLIENT, COACH)).toBe(false);
    expect(isClient(invited, CLIENT)).toBe(false);
  });

  it("active: access is granted only once accepted", () => {
    expect(isCoachOf(active, COACH, CLIENT)).toBe(true);
    expect(isCoach(active, COACH)).toBe(true);
    expect(clientIdsOf(active, COACH)).toEqual([CLIENT]);
    expect(isClientOf(active, CLIENT, COACH)).toBe(true);
  });
});
