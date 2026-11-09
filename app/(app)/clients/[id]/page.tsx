import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "../../_components/EmptyState";
import { ClipboardIcon } from "../../_components/icons";

export default async function ClientDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Confirm this user actively coaches the requested client.
  const { data: link } = await supabase
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user!.id)
    .eq("client_id", id)
    .eq("status", "active")
    .maybeSingle();

  if (!link) notFound();

  // RLS also lets a coach read linked clients' profiles.
  const { data: client } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .single();

  return (
    <section className="flex flex-col gap-3">
      <Link href="/clients" className="text-sm opacity-70 hover:underline">
        ← חזרה למתאמנים
      </Link>
      <h1 className="text-xl font-bold">
        {client?.display_name ?? "מתאמן/ת"}
      </h1>
      <div className="rounded-card border border-line bg-surface shadow-card p-4">
        <EmptyState
          icon={<ClipboardIcon className="h-6 w-6" />}
          title="עדיין אין מה להציג"
          description="כאן יופיע היום של המתאמן/ת — תפריט, דיווחים ומדדים."
        />
      </div>
    </section>
  );
}
