import { redirect } from "next/navigation";

export default function Home() {
  // Authenticated users land on their own tracking view; middleware handles
  // sending unauthenticated users to /login.
  redirect("/me");
}
