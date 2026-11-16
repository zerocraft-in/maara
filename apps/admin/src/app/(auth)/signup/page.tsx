"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*[0-9])/,
        "Password must contain letters and digits",
      ),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [submitted, setSubmitted] = React.useState(false);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [resendSent, setResendSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const supabase = createBrowserSupabaseClient();

  async function handleSubmit(values: SignupFormValues) {
    setError(null);
    setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (supabaseError) {
        setError("Unable to create account. Please try again.");
        return;
      }

      // If a session was returned, the user is already authenticated.
      if (data?.session) {
        if (token) {
          router.push(`/accept-invite?token=${token}`);
        } else {
          router.push("/onboarding");
        }
        return;
      }

      // No session: email confirmation is required before accepting an invite.
      setNeedsConfirmation(true);
      setSubmitted(true);
    } catch {
      setError("Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    setError(null);
    setResending(true);
    try {
      const email = form.getValues("email");
      const { error: supabaseError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`,
        },
      });
      if (supabaseError) {
        const message = supabaseError.message?.toLowerCase() ?? "";
        if (message.includes("rate limit") || supabaseError.status === 429) {
          setError(
            "Too many confirmation emails sent. Please wait a moment before trying again."
          );
        } else {
          setError("Unable to resend confirmation email. Please try again.");
        }
        return;
      }
      setResendSent(true);
    } catch {
      setError("Unable to resend confirmation email. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (submitted && needsConfirmation) {
    return (
      <div className="mx-auto flex h-full w-full flex-col items-center justify-center">
        <div className="mx-auto flex max-w-[340px] flex-col items-center text-center">
          {resendSent ? (
            <>
              <div
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success text-[13px] font-bold text-success-fg mb-6"
              >
                ✓
              </div>
              <h2 className="text-sm font-semibold tracking-[-0.02em]">
                Confirmation email sent
              </h2>
              <p className="mt-2 text-2xs text-meta">
                A new confirmation email has been sent to{" "}
                {form.getValues("email")}. Please check your inbox.
              </p>
            </>
          ) : (
            <>
              <div
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info text-[13px] font-bold text-info-fg mb-6"
              >
                ✉
              </div>
              <h2 className="text-sm font-semibold tracking-[-0.02em]">
                Verify your email
              </h2>
              <p className="mt-2 text-2xs text-meta">
                A confirmation email has been sent to{" "}
                {form.getValues("email")}.
                Please verify your email address, then return to accept your
                invitation.
              </p>
              {token && (
                <p className="mt-2 text-2xs text-meta">
                  Your invitation token has been preserved and will be
                  available once you verify your email.
                </p>
              )}
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {error}
                </div>
              )}
              <Button render={<Link href="/login" className="text-sm">Back to login</Link>} disabled={resending} className="mt-6 w-full" />
              <Button
                type="button"
                onClick={resendConfirmation}
                disabled={resending}
                variant="outline"
                className="mt-3 w-full"
              >
                {resending ? "Sending…" : "Resend confirmation email"}
              </Button>
            </>
          )}
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
          Create your account
        </h2>
        <p className="mb-8 text-2xs text-meta">
          Join your organization using your invitation link.
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-2xs font-semibold text-meta">
                Password
              </label>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-2xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-2xs font-semibold text-meta">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-2xs text-destructive">
                {form.formState.errors.confirmPassword.message}
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
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-2xs text-meta">
          Already have an account?{" "}
          <Link
            href={token ? `/login?token=${token}` : "/login"}
            className="text-brand underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={null}>
      <SignupForm />
    </React.Suspense>
  );
}
