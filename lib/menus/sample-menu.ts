/**
 * ONE small sample menu, in the `MenuImport` shape, used to exercise the schema
 * and the import path in dev/tests.
 *
 * THIS IS NOT REAL DATA. The real content is the "17 existing menus" from
 * Nirit's artifact export (CLAUDE.md > EC-37) and must be provided by her — do
 * not hand-type it. Menus/recipes also need permission to share with the friend
 * (EC-4). See lib/menus/import.ts for the import contract.
 */

import type { MenuImport } from "@/lib/menus/import";

export const SAMPLE_MENU: MenuImport = {
  version: 1,
  menus: [
    {
      name: "תפריט לדוגמה — שבוע 1",
      publishDate: "2026-11-02",
      meals: [
        {
          type: "breakfast",
          text: "חביתת 2 ביצים + פרוסת לחם מלא + ירקות",
          proteinG: 18,
          carbG: 20,
          fatG: 14,
        },
        {
          type: "lunch-carb",
          text: "אורז מלא עם ירקות מוקפצים",
          carbG: 55,
        },
        {
          type: "lunch-protein",
          text: "חזה עוף בגריל",
          proteinG: 35,
          fatG: 6,
        },
        {
          type: "dinner",
          text: "סלט גדול עם טונה וגבינה בולגרית",
          proteinG: 25,
          carbG: 12,
          fatG: 15,
        },
        {
          type: "snack",
          text: "יוגורט יווני עם פרי",
          proteinG: 12,
          carbG: 18,
        },
      ],
    },
  ],
};
