import { createClient } from "@/lib/supabase/server";

export default async function MyTrackingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, locale")
    .eq("id", user!.id)
    .single();

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">המעקב שלי</h1>
      <p className="opacity-80">
        שלום {profile?.display_name ?? user!.email}. כאן יופיע המעקב היומי שלך
        (תפריט, יומן אכילה, מים ומדדים) בהמשך.
      </p>
    </section>
  );
}
