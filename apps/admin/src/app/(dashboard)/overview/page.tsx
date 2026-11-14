import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function OverviewPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0 flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-brand-fg"
          >
            M
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold tracking-[-0.02em]">
              Maara Merch
            </p>
            <p className="hidden text-2xs text-meta sm:block">
              Retail management
            </p>
          </div>
        </div>
        <Badge variant="outline">Authenticated</Badge>
      </div>

      <Separator className="mt-4 mb-8" />

      <h2 className="text-2xs font-semibold tracking-[0.14em] text-brand-text uppercase">
        Overview
      </h2>
      <h1 className="mt-2 max-w-2xl text-3xl leading-[1.15] font-semibold tracking-[-0.03em] text-balance">
        Dashboard
      </h1>
      <p className="mt-3 max-w-2xl text-base text-body">
        Select a module from the sidebar to begin. Business data and KPIs will
        appear here once the Phase 4 modules are implemented.
      </p>

      <div className="mt-9 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Module status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center justify-between text-sm">
                <span className="text-body">Authentication &amp; onboarding</span>
                <Badge variant="success">Phase 2 — implemented</Badge>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-body">Dashboard shell</span>
                <Badge variant="success">Phase 2 — implemented</Badge>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-body">Products, inventory, purchases</span>
                <Badge variant="outline">Phase 4 — planned</Badge>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-body">Sales, returns, customers</span>
                <Badge variant="outline">Phase 4 — planned</Badge>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-body">Suppliers, expenses, finance</span>
                <Badge variant="outline">Phase 4 — planned</Badge>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-body">Analytics, reports, settings</span>
                <Badge variant="outline">Phase 5–6 — planned</Badge>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-body">
              <li className="flex gap-2">
                <span className="mt-0.5 size-3.5 shrink-0 text-success">
                  ✓
                </span>
                <span>Sign in and create your organization</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 size-3.5 shrink-0 text-meta">
                  ○
                </span>
                <span>Apply Phase 2 migrations (pending approval)</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 size-3.5 shrink-0 text-meta">
                  ○
                </span>
                <span>Invite teammates and assign roles</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
