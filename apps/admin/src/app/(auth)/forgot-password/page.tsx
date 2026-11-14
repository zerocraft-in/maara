"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const supabase = createBrowserSupabaseClient();

  async function handleSubmit(values: ForgotPasswordFormValues) {
    setError(null);
    setLoading(true);

    try {
      // Always returns success to avoid account enumeration.
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(
        values.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (supabaseError) {
        // Don't reveal whether the account exists.
        setSent(true);
        return;
      }

      setSent(true);
    } catch {
      // Don't reveal whether the account exists.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex h-full w-full flex-col items-center justify-center">
        <div className="mx-auto flex max-w-[340px] flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info text-[13px] font-bold text-info-fg mb-6"
          >
            ✉
          </div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">
            Check your email
          </h2>
          <p className="mt-2 text-2xs text-meta">
            If an account exists for that email, a password reset link has been
            sent. The link works only once and expires after 1 hour.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-6 w-auto"
          >
            <a href="/login" className="text-sm">
              Back to sign in
            </a>
          </Button>
        </div>
      </div>
    );
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

        <h2 className="mb-6 text-sm font-semibold tracking-[-0.02em]">
          Reset your password
        </h2>
        <p className="mb-8 text-2xs text-meta">
          Enter your email address and we&rsquo;ll send you a link to reset your
          password.
        </p>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-2xs font-semibold text-meta">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@business.com"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-2xs text-destructive">
                {form.formState.errors.email.message}
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
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-2xs text-meta">
          Remember your password?{" "}
          <a
            href="/login"
            className="text-brand underline-offset-4 hover:underline"
          >
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
