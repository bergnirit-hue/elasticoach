"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  const num = (key: string) => {
    const v = str(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  await supabase
    .from("profiles")
    .update({ display_name: str("display_name") })
    .eq("id", user.id);

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    goal_title: str("goal_title"),
    start_weight: num("start_weight"),
    goal_weight: num("goal_weight"),
    start_date: str("start_date"),
    water_goal_ml: num("water_goal_ml") ?? 2000,
    weekly_workout_goal: num("weekly_workout_goal") ?? 3,
    step_goal: num("step_goal") ?? 8000,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/settings");
  revalidatePath("/me");
  redirect("/me");
}
