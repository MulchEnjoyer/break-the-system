"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { SectionCard, SectionHeading } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [supabase] = useState(() =>
    typeof window === "undefined" ? null : getBrowserSupabaseClient(),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SectionCard className="mx-auto w-full max-w-lg">
      <SectionHeading
        eyebrow="Admin login"
        title="Sign in with your Supabase admin account."
        description="Create the auth user in Supabase first, then whitelist the email in the admin_users table from the included SQL migration or dashboard."
      />

      <form
        className="mt-8 grid gap-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);

          const form = new FormData(event.currentTarget);
          const email = String(form.get("email") ?? "");
          const password = String(form.get("password") ?? "");

          if (!supabase) {
            setError("Supabase is not configured in this browser session.");
            setPending(false);
            return;
          }

          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            setError(signInError.message);
            setPending(false);
            return;
          }

          router.push("/admin");
          router.refresh();
        }}
      >
        <div>
          <label className="text-sm font-semibold text-stone-900">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            placeholder="organizer@example.com"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-stone-900">Password</label>
          <input
            name="password"
            type="password"
            required
            className="mt-2 min-h-13 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-14 items-center justify-center rounded-full bg-stone-950 px-6 text-sm font-semibold uppercase tracking-[0.2em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
          Sign in
        </button>
      </form>
    </SectionCard>
  );
}
