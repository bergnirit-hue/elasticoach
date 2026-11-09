"use client";

import { useActionState } from "react";
import { coachLabel, type PendingInvite } from "@/lib/invites";
import { respondToInvite, type InviteActionState } from "./inviteActions";

/**
 * EC-45 — pending coach invites on the client's home. Until the client accepts,
 * the coach sees nothing; accepting grants the coach read access to the tracking.
 */
export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return null;

  return (
    <div
      style={{ boxShadow: "var(--shadow-card)" }}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <div>
        <h2 className="font-display text-lg">הזמנות ליווי</h2>
        <p className="text-sm text-ink-soft">
          מאמן/ת מבקש/ת ללוות אותך. רק לאחר אישורך הוא/היא יוכל/תוכל לראות את
          הנתונים שלך.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
      </ul>
    </div>
  );
}

function InviteRow({ invite }: { invite: PendingInvite }) {
  const [state, action, pending] = useActionState<InviteActionState, FormData>(
    respondToInvite,
    null,
  );

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <span className="font-medium">
        {coachLabel(invite.coachName)} מבקש/ת ללוות אותך
      </span>
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={invite.id} />
        <button
          type="submit"
          name="action"
          value="accept"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "רגע…" : "אישור"}
        </button>
        <button
          type="submit"
          name="action"
          value="decline"
          disabled={pending}
          className="rounded-lg border border-black/15 px-4 py-2 font-medium disabled:opacity-50"
        >
          דחייה
        </button>
      </form>
      {state && !state.ok && (
        <p role="status" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
    </li>
  );
}
