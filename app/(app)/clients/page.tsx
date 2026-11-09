import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "../_components/EmptyState";
import { ClientsIcon } from "../_components/icons";

export default async function ClientsPage() {
  const supabase = await createClient();

  // RLS only returns rows where the current user is the coach or the client.
  // We render the people this user coaches.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: links } = await supabase
    .from("coach_client")
    .select("client_id, status, client:profiles!coach_client_client_id_fkey(display_name)")
    .eq("coach_id", user!.id)
    .eq("status", "active");

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">המתאמנים שלי</h1>

      {!links || links.length === 0 ? (
        <EmptyState
          icon={<ClientsIcon className="h-6 w-6" />}
          title="עדיין אין לך מתאמנים משויכים"
          description="מתאמנים שישויכו אליך יופיעו כאן."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => {
            const client = link.client as unknown as {
              display_name: string | null;
            } | null;
            return (
              <li key={link.client_id}>
                <Link
                  href={`/clients/${link.client_id}`}
                  className="block rounded-card border border-line bg-surface shadow-card p-3 hover:bg-surface-2"
                >
                  {client?.display_name ?? "מתאמן/ת"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
