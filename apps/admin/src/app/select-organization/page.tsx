import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectActiveOrganization } from "@/app/(dashboard)/organization/actions";

export default async function SelectOrganizationPage() {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, organizations ( name )")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!memberships?.length) redirect("/onboarding");
  if (memberships.length === 1) redirect("/");

  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-6">
      <section className="w-full space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Choose an organization</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the organization you want to manage.
          </p>
        </div>
        <div className="space-y-2">
          {memberships.map((membership) => {
            const organization = membership.organizations as unknown as { name: string } | null;
            return (
              <form
                key={membership.organization_id}
                action={async () => {
                  "use server";
                  const result = await selectActiveOrganization(membership.organization_id);
                  if (result.ok) redirect("/");
                }}
              >
                <button type="submit" className="w-full rounded-lg border px-4 py-3 text-left hover:bg-muted">
                  {organization?.name ?? "Organization"}
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
