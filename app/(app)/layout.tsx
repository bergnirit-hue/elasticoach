import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach, type Relationship } from "@/lib/roles";
import { resolveBrandFromEnv } from "@/lib/theme/brand";
import { CoachBrandStyle } from "./CoachBrandStyle";
import { AppNav } from "./_components/AppNav";
import { SignOutButton } from "./_components/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: relationships } = await supabase
    .from("coach_client")
    .select("coach_id, client_id, status");

  const userIsCoach = isCoach((relationships ?? []) as Relationship[], user.id);

  // White-label: override --brand / --brand-2 for this coach; derived tokens
  // in globals.css re-resolve from them. Falls back to platform defaults.
  const { brand, brand2 } = resolveBrandFromEnv();

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <CoachBrandStyle brand={brand} brand2={brand2} />
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg/90 p-4 backdrop-blur">
        <Link
          href="/me"
          className="bg-[image:var(--brand-grad)] bg-clip-text font-display text-lg text-transparent"
        >
          Elasticoach
        </Link>
        <div className="flex items-center gap-3">
          <AppNav isCoach={userIsCoach} />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 sm:pb-4">{children}</main>
    </div>
  );
}
