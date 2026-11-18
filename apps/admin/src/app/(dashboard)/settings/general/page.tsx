import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SettingsRow } from "./settings-row";
import { BusinessDetailsRow } from "./business-details-row";

type OrganizationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  currency: string | null;
  timezone: string | null;
  country: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: Record<string, unknown> | null;
  logo_path: string | null;
  invoice_prefix: string | null;
  invoice_next_number: number | null;
  tax_inclusive_pricing: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

async function getOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      slug,
      currency,
      timezone,
      country,
      gstin,
      phone,
      email,
      address,
      logo_path,
      invoice_prefix,
      invoice_next_number,
      tax_inclusive_pricing,
      created_at,
      updated_at
    `,
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("Organization lookup failed.", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Unable to load organization details");
  }
  return (data ?? null) as OrganizationRow | null;
}

async function requireOrganizationOrRedirect() {
  try {
    return await requireOrganization();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === NO_ACTIVE_MEMBERSHIP_ERROR
    ) {
      redirect("/onboarding");
    }
    throw error;
  }
}

export default async function GeneralPage() {
  const context = await requireOrganizationOrRedirect();

  const supabase: SupabaseClient = await createServerSupabaseClient();

  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  if (!context.permissions.has("settings.view")) {
    redirect("/overview");
  }

  const org = await getOrganization(supabase, organizationId);
  if (!org) {
    redirect("/overview");
  }

  const address = org.address as
    | {
        raw?: string;
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
      }
    | null
    | undefined;

  const addressLines: string[] = [];
  if (address) {
    if (address.street) addressLines.push(address.street);
    if (address.city) addressLines.push(address.city);
    if (address.state) addressLines.push(address.state);
    if (address.zip) addressLines.push(address.zip);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      {/* Business details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Business details</CardTitle>
          <CardDescription>
            Business entity used for financial products, markets, apps, and
            taxes in this shop
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessDetailsRow org={org} />
          <p className="mt-3 text-xs text-muted-foreground">
            Manage entities in{" "}
            <Link href="/settings/organization-details">
              Organization settings
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Store contact details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Store contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsRow
            icon="Mail"
            label={org.email ?? "maranpicz@gmail.com"}
            description="No phone number"
            href="/settings/organization-details"
          />
          <SettingsRow
            icon="MapPin"
            label="Store address"
            description={
              addressLines.length > 0 ? addressLines.join(", ") : "India"
            }
            href="/settings/organization-details"
          />
        </CardContent>
      </Card>

      {/* Store defaults */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Store defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsRow
            icon="DollarSign"
            label="Currency display"
            description="To manage the currencies customers see, go to Markets"
            badge={<Badge variant="outline">Indian Rupee (INR ₹)</Badge>}
          />
          <SettingsRow icon="Globe" label="Backup Region" description="India" />
          <div className="grid grid-cols-2 gap-4 pt-3">
            <SettingsRow
              icon="Scale"
              label="Unit system"
              description="Metric system"
            />
            <SettingsRow
              icon="Scale"
              label="Default weight unit"
              description="Kilogram (kg)"
            />
          </div>
          <SettingsRow
            icon="Clock"
            label="Time zone"
            description="(GMT+05:00) Eastern Time (US & Canada)"
            badge={
              <Badge variant="outline">
                (GMT+05:00) Eastern Time (US &amp; Canada)
              </Badge>
            }
          />
          <p className="mt-3 text-xs text-muted-foreground">
            To change your user level time zone and language visit your{" "}
            <Link href="/settings/organization-details">account settings</Link>
          </p>
        </CardContent>
      </Card>

      {/* Order ID format */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order ID format</CardTitle>
          <CardDescription>
            Shown on the order page, customer pages, and customer order
            notifications to identify order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Prefix
              </label>
              <input
                type="text"
                value="#"
                readOnly
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground">
                Suffix
              </label>
              <input
                type="text"
                value=""
                readOnly
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Your order ID will appear as #1001, #1002, #1003. …
          </p>
        </CardContent>
      </Card>

      {/* Order processing */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-foreground">
              After an order has been paid
            </p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" name="fulfillment" defaultChecked />
                <span>Automatically fulfill the order's line items</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" name="fulfillment" />
                <span>
                  Automatically fulfill only the gift cards of the order
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" name="fulfillment" defaultChecked />
                <span>
                  Don't fulfill any of the order's line items automatically
                </span>
              </label>
            </div>
          </div>
          <div className="pt-2">
            <p className="text-xs font-medium text-foreground">
              After an order has been fulfilled and paid, or when all items have
              been refunded
            </p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" name="archive" defaultChecked />
                <span>Automatically archive the order</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  The order will be removed from your list of open orders.
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store assets */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Store assets</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsRow
            icon="Folder"
            label="Metafields"
            description="Available in themes and configurable for Storefront API"
            href="/settings/metafields-and-metaobjects"
          />
          <SettingsRow
            icon="Sparkles"
            label="Brand"
            description="Integrate brand assets across sales channels, themes and apps"
          />
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsRow icon="BookOpen" label="Change log" href="/audit-logs" />
          <SettingsRow icon="Headphones" label="Shopify Help Center" href="#" />
          <SettingsRow icon="Code" label="Hire a Shopify Partner" href="#" />
          <Separator className="my-3" />
          <SettingsRow icon="Activity" label="Keyboard shortcuts" href="#" />
          <SettingsRow
            icon="Activity"
            label="Store activity log"
            href="/audit-logs"
          />
        </CardContent>
      </Card>

      {/* Transfer store */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-xs text-muted-foreground">
                Move this store into an organization or transfer to an external
                owner.
              </p>
              <Link
                href="#"
                className="text-xs text-primary underline underline-offset-4 hover:underline"
              >
                Learn more
              </Link>
            </div>
            <Button size="sm">Manage</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
