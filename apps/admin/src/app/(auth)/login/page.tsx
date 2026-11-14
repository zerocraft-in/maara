"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const next = searchParams.get("next") || "/overview";

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const supabase = createBrowserSupabaseClient();

  async function handleSubmit(values: LoginFormValues) {
    setError(null);
    setLoading(true);

    try {
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (supabaseError) {
        setError("Email or password is incorrect");
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Email or password is incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col items-center justify-center">
      <div className="mx-auto flex max-w-[340px] flex-col">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-brand-fg"
          >
            M
          </div>
          <p className="text-sm font-semibold tracking-[-0.02em]">Maara Merch</p>
        </div>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-2xs font-semibold text-meta">
              Email address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@business.com"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-2xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-2xs font-semibold text-meta">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-sm text-meta"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-2xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-2xs text-meta">
          Don&rsquo;t have an account?{" "}
          <a
            href="/onboarding"
            className="text-brand underline-offset-4 hover:underline"
          >
            Create your business
          </a>
        </p>
        <p className="mt-2 text-center text-2xs text-meta">
          <a
            href="/forgot-password"
            className="text-brand underline-offset-4 hover:underline"
          >
            Forgot password?
          </a>
        </p>
      </div>
    </div>
  );
}
