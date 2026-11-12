import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach, type Relationship } from "@/lib/roles";
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b border-black/10 p-4">
        <nav className="flex gap-4 text-sm">
          <Link href="/me" className="font-medium hover:underline">
            המעקב שלי
          </Link>
          {userIsCoach && (
            <Link href="/clients" className="font-medium hover:underline">
              המתאמנים שלי
            </Link>
          )}
          {userIsCoach && (
            <Link href="/menus" className="font-medium hover:underline">
              תפריטים
            </Link>
          )}
          <Link href="/calendar" className="font-medium hover:underline">
            לוח שנה
          </Link>
          <Link href="/settings" className="font-medium hover:underline">
            הגדרות
          </Link>
        </nav>
        <SignOutButton />
      </header>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
