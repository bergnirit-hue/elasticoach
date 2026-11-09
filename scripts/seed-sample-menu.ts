/**
 * Seed ONE small sample menu for a coach, to exercise the EC-11 schema end to
 * end against a real Supabase project. Uses the same idempotent importer the
 * real 17-menu import will use, so running it twice does not duplicate rows.
 *
 * Usage (needs the service-role key — this writes as a specific coach and
 * bypasses RLS):
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... COACH_ID=<uuid> \
 *     npx tsx scripts/seed-sample-menu.ts
 *
 * NOTE: this is a dev/seed helper, not part of the app build. The REAL data is
 * Nirit's artifact export — see lib/menus/sample-menu.ts.
 */

import { createClient } from "@supabase/supabase-js";
import { importMenus, type MinimalSupabase } from "@/lib/menus/import";
import { SAMPLE_MENU } from "@/lib/menus/sample-menu";

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const coachId = process.env.COACH_ID;

  if (!url || !serviceKey || !coachId) {
    throw new Error(
      "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and COACH_ID (coach uuid).",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const summary = await importMenus(
    supabase as unknown as MinimalSupabase,
    coachId,
    SAMPLE_MENU,
  );
  console.log("Seeded sample menu:", summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
