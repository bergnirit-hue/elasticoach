"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for the settings form. Reads the parent form's pending state
 * via useFormStatus, so it shows "שומר…" and disables itself while the server
 * action runs. Presentational only — the action still redirects on success.
 */
export function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="btn-brand self-start px-5 py-2.5"
    >
      {pending ? "שומר…" : "שמירה"}
    </button>
  );
}
