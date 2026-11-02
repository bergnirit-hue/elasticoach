"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Elasticoach</h1>
        <p className="mt-1 text-sm opacity-70">ליווי תזונה ואימון</p>
      </header>

      {sent ? (
        <p className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-800">
          שלחנו קישור כניסה למייל <strong>{email}</strong>. בדקו את תיבת הדואר
          והיכנסו דרך הקישור.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            כתובת מייל
            <input
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-black/15 p-3 text-start"
              placeholder="you@example.com"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-black p-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "שולח..." : "שליחת קישור כניסה"}
          </button>
        </form>
      )}
    </main>
  );
}
