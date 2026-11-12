import { UploadIcon } from "../_components/icons";

/**
 * Designed entry point for PDF menu import (CLAUDE.md feature 2 / Phase 1.5
 * brain ingestion: upload a PDF → AI drafts meals → coach approves → into the
 * library). The extraction pipeline (AI + storage) is NOT built yet, so this is
 * an honest "coming soon" affordance — it shows the place the flow will live
 * without pretending to work. Coaches add meals manually below in the meantime.
 */
export function PdfImportCard() {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface-2/50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-soft text-brand">
          <UploadIcon className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">ייבוא תפריט מ-PDF</h2>
            <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs text-ink-soft">
              בקרוב
            </span>
          </div>
          <p className="text-sm text-ink-soft">
            מעלים PDF של תפריט קיים, והמערכת מחלצת ממנו מנות להצעה ולאישורכם —
            ואז הן נכנסות למאגר. בבנייה; בינתיים אפשר להוסיף מנות ידנית למטה.
          </p>
        </div>
      </div>
    </div>
  );
}
