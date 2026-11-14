"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { acceptInvitation } from "./actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;

export default function AcceptInvitePage() {
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  const supabase = createBrowserSupabaseClient();

  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const token = searchParams.get("token") ?? "";

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token: "" },
  });

  React.useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      setIsAuthenticated(!!data?.user);
      setAuthChecked(true);
    }
    checkAuth();
  }, [supabase]);

  // Prefill the token from the URL query parameter when arriving from an
  // invitation email link. Only set on mount when the field is still pristine
  // so a user-edited value is never overwritten. The token is never logged.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken && !form.formState.isDirty) {
      form.setValue("token", urlToken);
    }
    // Intentional: run once on mount.
  }, [form]);

  async function handleSubmit(values: AcceptInviteFormValues) {
    setError(null);
    setLoading(true);

    try {
      const result = await acceptInvitation(values.token);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Unable to accept invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex h-full w-full flex-col items-center justify-center">
        <div className="mx-auto flex max-w-[340px] flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success text-[13px] font-bold text-success-fg mb-6"
          >
            ✓
          </div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">
            Invitation accepted
          </h2>
          <p className="mt-2 text-2xs text-meta">
            You are now a member of the organization.
          </p>
          <Button
            asChild
            className="mt-6 w-auto"
          >
            <a href="/overview" className="text-sm">
              Go to dashboard
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
          Accept invitation
        </h2>
        <p className="mb-8 text-2xs text-meta">
          Enter the invitation token from your email to join the organization.
        </p>

        {authChecked && !isAuthenticated && token ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-input bg-background p-4">
              <p className="text-sm font-semibold text-body">
                You need an account to accept this invitation.
              </p>
              <p className="mt-1 text-2xs text-meta">
                Create an account using the same email address that received
                the invitation.
              </p>
              <Button asChild className="w-full">
                <a href={`/signup?token=${token}`} className="text-sm">
                  Create account
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="token" className="text-2xs font-semibold text-meta">
                  Invitation token
                </label>
                <input
                  id="token"
                  type="text"
                  autoComplete="off"
                  placeholder="Enter token"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  {...form.register("token")}
                />
                {form.formState.errors.token && (
                  <p className="text-2xs text-destructive">
                    {form.formState.errors.token.message}
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

              <p className="text-2xs text-meta">
                Tokens are single-use, expire after 72 hours, and are bound to your
                verified email address.
              </p>

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? "Accepting…" : "Accept invitation"}
              </Button>
            </form>

            {authChecked && !isAuthenticated && !token ? (
              <div className="mt-6 text-center text-2xs text-meta">
                You need an account to accept an invitation.{" "}
                <Button asChild className="inline-flex">
                  <a href="/signup" className="text-brand underline-offset-4 hover:underline">
                    Create account
                  </a>
                </Button>
              </div>
            ) : null}
          </>
        )}
        <p className="mt-6 text-center text-2xs text-meta">
          Don&rsquo;t have an invitation?{" "}
          <a
            href="/onboarding"
            className="text-brand underline-offset-4 hover:underline"
          >
            Create your business
          </a>
        </p>
      </div>
    </div>
  );
}
