import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { coachIdsOf, type Relationship } from "@/lib/roles";
import {
  effectivePolicy,
  type AvailabilityMenu,
} from "@/lib/menus/availability";
import { buildDailyPlan, type DailyPlan, type MenuPicks } from "@/lib/menus/daily";
import type { Meal, MealType, MenuPolicy } from "@/lib/menus/types";
import { MEAL_TYPES } from "@/lib/menus/types";

/** An empty plan (no coach / no menu) with the right shape for a policy. */
const emptyPlan = (policy: MenuPolicy): DailyPlan =>
  buildDailyPlan({ policy, menus: [], meals: [], date: "1970-01-01" });

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface DailyPlanLoad {
  /** Whether the client has at least one active coach. */
  hasCoach: boolean;
  /** The coach whose menus are shown (the first active coach), if any. */
  coachId: string | null;
  policy: MenuPolicy;
  /** The built plan. `slots` is empty when no menu is available for the date. */
  plan: DailyPlan;
}

/** Keep only well-formed `type → mealId` entries from the stored jsonb. */
function toPicks(raw: unknown): MenuPicks {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: MenuPicks = {};
  for (const t of MEAL_TYPES) {
    if (typeof src[t] === "string") out[t] = src[t] as string;
  }
  return out;
}

interface MenuRow {
  id: string;
  publish_date: string;
  menu_meal:
    | {
        meal_id: string;
        meal_library:
          | {
              id: string;
              type: MealType;
              text: string;
              recipe_url: string | null;
            }
          | null;
      }[]
    | null;
}

/**
 * Load everything the daily plan needs for `userId` on `date` and build it.
 *
 * All availability/swap logic lives in `buildDailyPlan` (EC-13) on top of the
 * EC-12 engine; this function only fetches. RLS already restricts the client to
 * menus/meals a coach who actively coaches them has published on/before today,
 * and to their own picks — so the result is safe to render and to validate a
 * swap against.
 */
export async function loadDailyPlan(
  supabase: Supabase,
  userId: string,
  date: string,
): Promise<DailyPlanLoad> {
  // 1. The client's first active coach.
  const { data: rels } = await supabase
    .from("coach_client")
    .select("coach_id, client_id, status");
  const coachId = coachIdsOf((rels ?? []) as Relationship[], userId)[0] ?? null;

  if (!coachId) {
    return { hasCoach: false, coachId: null, policy: "fixed", plan: emptyPlan("fixed") };
  }

  // 2. Policy, menus (+meals), and saved picks — in parallel.
  const [{ data: coachPol }, { data: clientPol }, { data: menuRows }, { data: dayRow }] =
    await Promise.all([
      supabase.from("coach_menu_policy").select("policy").eq("coach_id", coachId).maybeSingle(),
      supabase
        .from("client_menu_policy")
        .select("policy")
        .eq("coach_id", coachId)
        .eq("client_id", userId)
        .maybeSingle(),
      supabase
        .from("menu")
        .select("id, publish_date, menu_meal(meal_id, meal_library(id, type, text, recipe_url))")
        .eq("coach_id", coachId),
      supabase
        .from("days")
        .select("menu_picks")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle(),
    ]);

  const policy = effectivePolicy(
    (coachPol?.policy ?? null) as MenuPolicy | null,
    (clientPol?.policy ?? null) as MenuPolicy | null,
  );

  // 3. Shape the DB rows into the engine's inputs.
  const mealById = new Map<string, Meal>();
  const menus: AvailabilityMenu[] = ((menuRows ?? []) as unknown as MenuRow[]).map((m) => {
    const links = m.menu_meal ?? [];
    for (const link of links) {
      const lib = link.meal_library;
      if (lib && !mealById.has(lib.id)) {
        mealById.set(lib.id, {
          id: lib.id,
          type: lib.type,
          text: lib.text,
          recipeUrl: lib.recipe_url,
        });
      }
    }
    return {
      id: m.id,
      publishDate: m.publish_date,
      mealIds: links.map((l) => l.meal_id),
    };
  });

  const plan = buildDailyPlan({
    policy,
    menus,
    meals: [...mealById.values()],
    date,
    picks: toPicks(dayRow?.menu_picks),
  });

  return { hasCoach: true, coachId, policy, plan };
}
