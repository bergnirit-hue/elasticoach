import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LinkClientForm } from "./LinkClientForm";

type LinkRow = {
  client_id: string;
  status: "invited" | "active";
  client: { display_name: string | null } | null;
};

export default async function ClientsPage() {
  const supabase = await createClient();

  // RLS only returns rows where the current user is the coach or the client.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("coach_client")
    .select(
      "client_id, status, client:profiles!coach_client_client_id_fkey(display_name)",
    )
    .eq("coach_id", user!.id);

  const links = (data ?? []) as unknown as LinkRow[];
  const active = links.filter((l) => l.status === "active");
  const invited = links.filter((l) => l.status === "invited");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold">המתאמנים שלי</h1>
        {/* Cheap "switch to my tracking" affordance inside the coach area. */}
        <Link href="/me" className="text-sm opacity-70 hover:underline">
          למעקב שלי ←
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="opacity-70">עדיין אין לך מתאמנים משויכים.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((link) => (
            <li key={link.client_id}>
              <Link
                href={`/clients/${link.client_id}`}
                className="block rounded-lg border border-black/10 p-3 hover:bg-black/5"
              >
                {link.client?.display_name ?? "מתאמן/ת"}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {invited.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium opacity-70">ממתינים לאישור</h2>
          <ul className="flex flex-col gap-2">
            {invited.map((link) => (
              <li
                key={link.client_id}
                className="rounded-lg border border-dashed border-black/15 p-3 text-sm opacity-70"
              >
                {link.client?.display_name ?? "מתאמן/ת"} · הזמנה נשלחה
              </li>
            ))}
          </ul>
        </div>
      )}

      <LinkClientForm />
    </section>
  );
}
