"use client";

import * as React from "react";
import { useForm, useFormState, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { updateBusinessDetails } from "@/app/(dashboard)/settings/actions";
import { Building2, Search, X, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const PHONE_COUNTRIES = [
  { value: "IN", label: "India (+91)", dial: "+91", flag: "🇮🇳" },
  { value: "US", label: "United States (+1)", dial: "+1", flag: "🇺🇸" },
  { value: "GB", label: "United Kingdom (+44)", dial: "+44", flag: "🇬🇧" },
  { value: "AE", label: "UAE (+971)", dial: "+971", flag: "🇦🇪" },
  { value: "SG", label: "Singapore (+65)", dial: "+65", flag: "🇸🇬" },
];

const BUSINESS_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "private_limited", label: "Private Limited" },
  { value: "partnership", label: "Partnership" },
  { value: "llp", label: "LLP" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
];

const NATIONALITIES = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "SG", label: "Singapore" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
];

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const COUNTRY_FLAGS: Record<string, string> = {
  IN: "🇮🇳",
  US: "🇺🇸",
  GB: "🇬🇧",
  AE: "🇦🇪",
  SG: "🇸🇬",
  CA: "🇨🇦",
  AU: "🇦🇺",
};

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────────────────────────────────────

const schema = z.object({
  country: z.string().min(1),
  businessType: z.string().min(1, "Select a business type"),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dobMonth: z.string().min(1, "Month is required"),
  dobDay: z.string().min(1, "Day is required"),
  dobYear: z.string().min(1, "Year is required"),
  nationality: z.string().min(1, "Select a nationality"),
  email: z.string().email("Enter a valid email").max(254),
  residentialAddress: z.string().trim().min(1, "Address is required"),
  apartment: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "Select a state"),
  pinCode: z.string().trim().min(1, "PIN code is required").max(10),
  legalBusinessName: z.string().trim().optional().or(z.literal("")),
  businessAddress: z.string().trim().optional().or(z.literal("")),
  businessApartment: z.string().trim().optional().or(z.literal("")),
  businessCity: z.string().trim().optional().or(z.literal("")),
  businessState: z.string().trim().optional().or(z.literal("")),
  businessPinCode: z.string().trim().optional().or(z.literal("")),
  businessPhoneCountry: z.string().optional(),
  businessPhone: z.string().trim().optional().or(z.literal("")),
  showOptional: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type AddressValue = {
  raw?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type AboutYourBusinessDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    address: Record<string, unknown> | null;
    country: string | null;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Atomic sub-components (no custom hex — only semantic Tailwind / shadcn tokens)
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-normal text-foreground mb-1.5 leading-none"
    >
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 text-xs text-destructive"
    >
      {message}
    </motion.p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground leading-5">
      {children}
    </h2>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// Reusable input class helper
function inputCls(hasError?: boolean) {
  return cn(
    "h-9 px-3 text-sm border-input rounded-lg bg-background",
    "placeholder:text-muted-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
    hasError && "border-destructive focus-visible:ring-destructive/40",
  );
}

function selectTriggerCls(hasError?: boolean) {
  return cn(
    "h-9 px-3 text-sm border-input w-full rounded-lg bg-background",
    "focus:ring-2 focus:ring-ring focus:ring-offset-0",
    hasError && "border-destructive focus:ring-destructive/40",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function AboutYourBusinessDrawer({
  open,
  onOpenChange,
  org,
}: AboutYourBusinessDrawerProps) {
  const address = (org.address ?? {}) as AddressValue;
  const nameParts = (org.name ?? "").trim().split(/\s+/);
  const defaultFirst = nameParts[0] ?? "";
  const defaultLast = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // ── Form ─────────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    // "onTouched" — validate on blur, then on every change after first touch
    mode: "onTouched",
    defaultValues: {
      country: org.country ?? "IN",
      businessType: "sole_proprietorship",
      firstName: defaultFirst,
      lastName: defaultLast,
      dobMonth: "",
      dobDay: "",
      dobYear: "",
      nationality: org.country === "IN" ? "IN" : "",
      email: org.email ?? "",
      residentialAddress: address.street ?? address.raw ?? "",
      apartment: "",
      city: address.city ?? "",
      state: address.state ?? "",
      pinCode: address.zip ?? "",
      legalBusinessName: "",
      businessAddress: "",
      businessApartment: "",
      businessCity: "",
      businessState: "",
      businessPinCode: "",
      businessPhoneCountry: "IN",
      businessPhone: "",
      showOptional: false,
    },
  });

  // !! KEY FIX: useFormState creates a stable subscription to isDirty + errors
  // so the component ACTUALLY re-renders when dirty state changes !!
  const { isDirty, errors, isSubmitting } = useFormState({
    control: form.control,
  });

  // ── Local state ───────────────────────────────────────────────────────────

  const [saving, setSaving] = React.useState(false);
  const [showDiscard, setShowDiscard] = React.useState(false);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const hasErrors = Object.keys(errors).length > 0;
  const isBusy = saving || isSubmitting;
  const canSave = isDirty && !hasErrors && !isBusy;

  // watched values needed for rendering
  const selectedCountry = form.watch("country");
  const showOptional = form.watch("showOptional") ?? false;
  const businessPhoneCountry = form.watch("businessPhoneCountry") ?? "IN";
  const phoneCountryObj = PHONE_COUNTRIES.find(
    (c) => c.value === businessPhoneCountry,
  );

  // ── Reset form when drawer re-opens ──────────────────────────────────────

  React.useEffect(() => {
    if (open) {
      // Re-seed default values whenever org data changes on open
      form.reset({
        country: org.country ?? "IN",
        businessType: "sole_proprietorship",
        firstName: defaultFirst,
        lastName: defaultLast,
        dobMonth: "",
        dobDay: "",
        dobYear: "",
        nationality: org.country === "IN" ? "IN" : "",
        email: org.email ?? "",
        residentialAddress: address.street ?? address.raw ?? "",
        apartment: "",
        city: address.city ?? "",
        state: address.state ?? "",
        pinCode: address.zip ?? "",
        legalBusinessName: "",
        businessAddress: "",
        businessApartment: "",
        businessCity: "",
        businessState: "",
        businessPinCode: "",
        businessPhoneCountry: "IN",
        businessPhone: "",
        showOptional: false,
      });
      setSubmitAttempted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Close / discard logic ─────────────────────────────────────────────────

  function requestClose() {
    if (isBusy) return;
    if (isDirty) {
      setShowDiscard(true);
    } else {
      onOpenChange(false);
    }
  }

  function handleDiscardConfirm() {
    form.reset();
    setSubmitAttempted(false);
    setShowDiscard(false);
    onOpenChange(false);
  }

  // Block Radix outside-click + escape when dirty
  function handleInteractOutside(e: Event) {
    e.preventDefault();
    if (isDirty) setShowDiscard(true);
  }

  function handleEscapeKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    requestClose();
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onValid(values: FormValues) {
    setSaving(true);
    try {
      const dob = new Date(
        Number(values.dobYear),
        Number(values.dobMonth) - 1,
        Number(values.dobDay),
      );
      if (isNaN(dob.getTime()) || dob.getDate() !== Number(values.dobDay)) {
        toast.error("Enter a valid date of birth.");
        return;
      }

      const result = await updateBusinessDetails({
        organizationId: org.id,
        name: `${values.firstName} ${values.lastName}`.trim(),
        email: values.email,
        phone: values.businessPhone ?? "",
        address: {
          street: values.residentialAddress,
          apartment: values.apartment || undefined,
          city: values.city,
          state: values.state,
          zip: values.pinCode,
        },
        businessType: values.businessType,
        nationality: values.nationality,
        dateOfBirth: dob.toISOString(),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Unable to save.");
        return;
      }

      toast.success("Business details saved.");
      setSubmitAttempted(false);
      form.reset(values); // mark as clean without closing
      onOpenChange(false);
    } catch {
      toast.error("Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveClick() {
    setSubmitAttempted(true);
    form.handleSubmit(onValid)();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          Full-screen sheet — using raw Radix Dialog so we control every pixel
      ════════════════════════════════════════════════════════════════════ */}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogPrimitive.Portal>
          {/* Backdrop */}
          <AnimatePresence>
            {open && (
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  key="overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-50 bg-black/30"
                />
              </DialogPrimitive.Overlay>
            )}
          </AnimatePresence>

          {/* Sheet panel — full viewport */}
          <AnimatePresence>
            {open && (
              <DialogPrimitive.Content
                forceMount
                onInteractOutside={handleInteractOutside}
                onEscapeKeyDown={handleEscapeKeyDown}
                asChild
                aria-describedby={undefined}
              >
                <motion.div
                  key="sheet"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.25,
                    ease: "easeInOut",
                  }}
                  className={cn(
                    // ── Position: covers full viewport ──
                    "fixed inset-0 z-50",
                    // ── Layout ──
                    "flex flex-col",
                    // ── Surface ──
                    "bg-muted", // Shopify uses a subtle off-white page bg
                    "border-l border-border",
                    "shadow-2xl",
                    "outline-none",
                  )}
                >
                  {/* ══════════════════════════════════════════
                      STICKY HEADER
                  ══════════════════════════════════════════ */}
                  <header className="shrink-0 flex items-center justify-between gap-4 px-4 h-12 bg-background border-b border-border z-10">
                    {/* Left — icon + name + badge */}
                    <div className="flex items-center gap-2 min-w-0 shrink-0">
                      <Building2 className="size-5 text-muted-foreground shrink-0" />
                      <span className="text-[13px] font-medium text-foreground truncate leading-none">
                        {org.name ?? "Your business"}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-[18px] px-2 text-[11px] font-medium border-green-300 bg-green-50 text-green-700 rounded-full shrink-0 leading-none"
                      >
                        Active
                      </Badge>
                    </div>

                    {/* Center — unsaved changes pill (framer-motion show/hide) */}
                    <AnimatePresence>
                      {isDirty && (
                        <motion.div
                          key="unsaved-pill"
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.88 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 28,
                          }}
                          className="absolute left-1/2 -translate-x-1/2 flex items-center h-8 pl-3.5 pr-1 gap-0.5 bg-zinc-900 rounded-full shadow-lg"
                        >
                          <span className="text-[12px] text-zinc-400 font-normal whitespace-nowrap pr-1.5 leading-none">
                            Unsaved changes
                          </span>

                          <button
                            type="button"
                            onClick={() => setShowDiscard(true)}
                            disabled={isBusy}
                            className={cn(
                              "h-[26px] px-2.5 rounded-full",
                              "text-[12px] font-medium text-white",
                              "hover:bg-zinc-700 active:bg-zinc-600",
                              "transition-colors duration-100 disabled:opacity-40",
                            )}
                          >
                            Discard
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={!canSave}
                            className={cn(
                              "h-[26px] px-3 rounded-full",
                              "text-[12px] font-medium text-zinc-900",
                              "bg-white hover:bg-zinc-100 active:bg-zinc-200",
                              "transition-colors duration-100 disabled:opacity-40",
                            )}
                          >
                            {isBusy ? "Saving…" : "Save"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Right — close */}
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        onClick={requestClose}
                        aria-label="Close"
                        className={cn(
                          "shrink-0 flex items-center justify-center",
                          "size-7 rounded-full",
                          "text-muted-foreground hover:text-foreground hover:bg-accent",
                          "transition-colors duration-100",
                        )}
                      >
                        <X className="size-3.5" />
                      </button>
                    </DialogPrimitive.Close>

                    <DialogPrimitive.Title className="sr-only">
                      Business settings — {org.name ?? "Settings"}
                    </DialogPrimitive.Title>
                  </header>

                  {/* ══════════════════════════════════════════
                      ERROR BANNER
                  ══════════════════════════════════════════ */}
                  <AnimatePresence>
                    {submitAttempted && hasErrors && (
                      <motion.div
                        key="error-banner"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="shrink-0 overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-destructive/8 border-b border-destructive/20">
                          <AlertCircle className="size-4 text-destructive shrink-0" />
                          <p className="text-sm">
                            <span className="font-semibold text-destructive">
                              Couldn&apos;t save changes
                            </span>
                            <span className="text-destructive/80 ml-2 font-normal">
                              Fix the errors highlighted in the form
                            </span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ══════════════════════════════════════════
                      SCROLLABLE BODY
                  ══════════════════════════════════════════ */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="max-w-[800px] w-full mx-auto px-8 py-7 space-y-6">
                      <form onSubmit={form.handleSubmit(onValid)} noValidate>
                        {/* ────────────────────────────────────────
                            SECTION 1 — About your business
                        ──────────────────────────────────────── */}
                        <div className="space-y-6">
                          <section className="space-y-3">
                            <SectionTitle>About your business</SectionTitle>

                            <SectionCard>
                              {/* Business type row */}
                              <div>
                                <FieldLabel>
                                  What type of business do you have?
                                </FieldLabel>
                                <div className="flex gap-2">
                                  {/* Country flag selector */}
                                  <Controller
                                    control={form.control}
                                    name="country"
                                    render={({ field, fieldState }) => (
                                      <Select
                                        value={field.value || "IN"}
                                        onValueChange={field.onChange}
                                      >
                                        <SelectTrigger
                                          className={cn(
                                            selectTriggerCls(),
                                            "h-9 w-[58px] shrink-0 px-2",
                                            fieldState.error &&
                                              "border-destructive",
                                          )}
                                          aria-label="Select country"
                                        >
                                          <SelectValue>
                                            {COUNTRY_FLAGS[
                                              field.value || "IN"
                                            ] ?? "🌐"}
                                          </SelectValue>
                                        </SelectTrigger>

                                        <SelectContent
                                          position="popper"
                                          align="start"
                                          sideOffset={4}
                                          className="min-w-[150px]"
                                        >
                                          {Object.entries(COUNTRY_FLAGS).map(
                                            ([code, flag]) => (
                                              <SelectItem
                                                key={code}
                                                value={code}
                                                className="text-sm"
                                              >
                                                <span className="flex items-center gap-2">
                                                  <span>{flag}</span>
                                                  <span>{code}</span>
                                                </span>
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />

                                  {/* Business type */}
                                  <Controller
                                    control={form.control}
                                    name="businessType"
                                    render={({ field }) => (
                                      <Select
                                        value={field.value}
                                        onValueChange={(v) => {
                                          field.onChange(v);
                                        }}
                                      >
                                        <SelectTrigger
                                          className={cn(
                                            selectTriggerCls(
                                              !!errors.businessType,
                                            ),
                                            "flex-1 w-full",
                                          )}
                                        >
                                          <SelectValue placeholder="Select business type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {BUSINESS_TYPES.map((t) => (
                                            <SelectItem
                                              key={t.value}
                                              value={t.value}
                                              className="text-sm"
                                            >
                                              {t.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />
                                </div>
                                <FieldError
                                  message={errors.businessType?.message}
                                />
                              </div>

                              {/* First / Last name */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <FieldLabel>First name</FieldLabel>
                                  <Input
                                    {...form.register("firstName")}
                                    className={inputCls(!!errors.firstName)}
                                    autoComplete="given-name"
                                  />
                                  <FieldError
                                    message={errors.firstName?.message}
                                  />
                                </div>
                                <div>
                                  <FieldLabel>Last name</FieldLabel>
                                  <Input
                                    {...form.register("lastName")}
                                    className={inputCls(!!errors.lastName)}
                                    autoComplete="family-name"
                                  />
                                  <FieldError
                                    message={errors.lastName?.message}
                                  />
                                </div>
                              </div>

                              {/* Date of birth */}
                              <div>
                                <FieldLabel>Date of birth</FieldLabel>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Controller
                                      control={form.control}
                                      name="dobMonth"
                                      render={({ field }) => (
                                        <Select
                                          value={field.value}
                                          onValueChange={(v) => {
                                            field.onChange(v);
                                          }}
                                        >
                                          <SelectTrigger
                                            className={selectTriggerCls(
                                              !!errors.dobMonth,
                                            )}
                                          >
                                            <SelectValue placeholder="Month" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {MONTHS.map((m) => (
                                              <SelectItem
                                                key={m.value}
                                                value={m.value}
                                                className="text-sm"
                                              >
                                                {m.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    />
                                    <FieldError
                                      message={errors.dobMonth?.message}
                                    />
                                  </div>
                                  <div>
                                    <Input
                                      {...form.register("dobDay")}
                                      placeholder="DD"
                                      maxLength={2}
                                      inputMode="numeric"
                                      className={cn(
                                        inputCls(!!errors.dobDay),
                                        "text-center",
                                      )}
                                    />
                                    <FieldError
                                      message={errors.dobDay?.message}
                                    />
                                  </div>
                                  <div>
                                    <Input
                                      {...form.register("dobYear")}
                                      placeholder="YYYY"
                                      maxLength={4}
                                      inputMode="numeric"
                                      className={cn(
                                        inputCls(!!errors.dobYear),
                                        "text-center",
                                      )}
                                    />
                                    <FieldError
                                      message={errors.dobYear?.message}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Nationality */}
                              <div>
                                <FieldLabel>Nationality</FieldLabel>
                                <Controller
                                  control={form.control}
                                  name="nationality"
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onValueChange={(v) => {
                                        field.onChange(v);
                                      }}
                                    >
                                      <SelectTrigger
                                        className={selectTriggerCls(
                                          !!errors.nationality,
                                        )}
                                      >
                                        <SelectValue placeholder="Select nationality" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {NATIONALITIES.map((n) => (
                                          <SelectItem
                                            key={n.value}
                                            value={n.value}
                                            className="text-sm"
                                          >
                                            {n.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                <FieldError
                                  message={errors.nationality?.message}
                                />
                              </div>

                              {/* Email */}
                              <div>
                                <FieldLabel>Email</FieldLabel>
                                <Input
                                  {...form.register("email")}
                                  type="email"
                                  autoComplete="email"
                                  className={inputCls(!!errors.email)}
                                />
                                <FieldError message={errors.email?.message} />
                              </div>

                              {/* Residential address */}
                              <div>
                                <FieldLabel>Residential address</FieldLabel>
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                  <Input
                                    {...form.register("residentialAddress")}
                                    placeholder="House number, street name"
                                    className={cn(
                                      inputCls(!!errors.residentialAddress),
                                      "pl-8",
                                    )}
                                  />
                                </div>
                                <FieldError
                                  message={errors.residentialAddress?.message}
                                />
                              </div>

                              {/* Apartment — always visible */}
                              <div>
                                <FieldLabel>Apartment, suite, etc</FieldLabel>
                                <Input
                                  {...form.register("apartment")}
                                  placeholder="Apartment, suite, etc"
                                  className={inputCls()}
                                />
                              </div>

                              {/* City / State / PIN */}
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <FieldLabel>City</FieldLabel>
                                  <Input
                                    {...form.register("city")}
                                    placeholder="City"
                                    className={inputCls(!!errors.city)}
                                  />
                                  <FieldError message={errors.city?.message} />
                                </div>
                                <div>
                                  <FieldLabel>State</FieldLabel>
                                  <Controller
                                    control={form.control}
                                    name="state"
                                    render={({ field }) => (
                                      <Select
                                        value={field.value}
                                        onValueChange={(v) => {
                                          field.onChange(v);
                                        }}
                                      >
                                        <SelectTrigger
                                          className={selectTriggerCls(
                                            !!errors.state,
                                          )}
                                        >
                                          <SelectValue placeholder="Select a state" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {INDIAN_STATES.map((s) => (
                                            <SelectItem
                                              key={s}
                                              value={s}
                                              className="text-sm"
                                            >
                                              {s}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />
                                  <FieldError message={errors.state?.message} />
                                </div>
                                <div>
                                  <FieldLabel>PIN code</FieldLabel>
                                  <Input
                                    {...form.register("pinCode")}
                                    placeholder="PIN code"
                                    maxLength={10}
                                    inputMode="numeric"
                                    className={inputCls(!!errors.pinCode)}
                                  />
                                  <FieldError
                                    message={errors.pinCode?.message}
                                  />
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                These details are used for financial products,
                                markets, apps, and taxes in this shop.
                              </p>
                            </SectionCard>
                          </section>

                          {/* ────────────────────────────────────────
                              SECTION 2 — Business verification details
                          ──────────────────────────────────────── */}
                          <section className="space-y-3">
                            <SectionTitle>
                              Business verification details
                            </SectionTitle>

                            <SectionCard>
                              {/* Add business info button */}
                              <div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="rounded-full h-8 px-4 text-sm font-medium"
                                >
                                  Add business information
                                </Button>
                              </div>

                              {/* Legal name */}
                              <div>
                                <FieldLabel>
                                  Registered legal business name
                                </FieldLabel>
                                <Input
                                  {...form.register("legalBusinessName")}
                                  className={inputCls()}
                                />
                              </div>

                              {/* Business address */}
                              <div>
                                <FieldLabel>Business address</FieldLabel>
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                  <Input
                                    {...form.register("businessAddress")}
                                    className={cn(inputCls(), "pl-8")}
                                  />
                                </div>
                              </div>

                              {/* Business apartment */}
                              <div>
                                <FieldLabel>Apartment, suite, etc</FieldLabel>
                                <Input
                                  {...form.register("businessApartment")}
                                  className={inputCls()}
                                />
                              </div>

                              {/* Business city / state / PIN */}
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <FieldLabel>City</FieldLabel>
                                  <Input
                                    {...form.register("businessCity")}
                                    placeholder="City"
                                    className={inputCls()}
                                  />
                                </div>
                                <div>
                                  <FieldLabel>State</FieldLabel>
                                  <Controller
                                    control={form.control}
                                    name="businessState"
                                    render={({ field }) => (
                                      <Select
                                        value={field.value ?? ""}
                                        onValueChange={(v) => {
                                          field.onChange(v);
                                        }}
                                      >
                                        <SelectTrigger
                                          className={selectTriggerCls()}
                                        >
                                          <SelectValue placeholder="Select a state" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {INDIAN_STATES.map((s) => (
                                            <SelectItem
                                              key={s}
                                              value={s}
                                              className="text-sm"
                                            >
                                              {s}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />
                                </div>
                                <div>
                                  <FieldLabel>PIN code</FieldLabel>
                                  <Input
                                    {...form.register("businessPinCode")}
                                    maxLength={10}
                                    inputMode="numeric"
                                    className={inputCls()}
                                  />
                                </div>
                              </div>

                              {/* Phone number */}
                              <div>
                                <FieldLabel>Phone number</FieldLabel>
                                <div className="flex gap-2">
                                  <Controller
                                    control={form.control}
                                    name="businessPhoneCountry"
                                    render={({ field }) => (
                                      <Select
                                        value={field.value ?? "IN"}
                                        onValueChange={(v) => {
                                          field.onChange(v);
                                        }}
                                      >
                                        <SelectTrigger
                                          className={cn(
                                            selectTriggerCls(),
                                            "w-[130px] shrink-0",
                                          )}
                                        >
                                          <SelectValue>
                                            <span className="text-sm truncate">
                                              {phoneCountryObj
                                                ? `${phoneCountryObj.flag} ${phoneCountryObj.dial}`
                                                : "🇮🇳 +91"}
                                            </span>
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PHONE_COUNTRIES.map((c) => (
                                            <SelectItem
                                              key={c.value}
                                              value={c.value}
                                              className="text-sm"
                                            >
                                              {c.flag} {c.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />
                                  <Input
                                    {...form.register("businessPhone")}
                                    inputMode="tel"
                                    className={cn(inputCls(), "flex-1")}
                                  />
                                </div>
                              </div>
                            </SectionCard>
                          </section>

                          {/* ────────────────────────────────────────
                              SECTION 3 — Business verification documents
                          ──────────────────────────────────────── */}
                          <section className="space-y-3">
                            <div>
                              <SectionTitle>
                                Business verification documents
                              </SectionTitle>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Documents must be clear, complete, and uncropped
                              </p>
                            </div>

                            <SectionCard>
                              {/* Upload tile */}
                              <div
                                className={cn(
                                  "w-[196px] rounded-xl overflow-hidden",
                                  "border border-border",
                                  "cursor-pointer",
                                  "hover:border-foreground/30",
                                  "transition-all duration-150",
                                  "group",
                                )}
                              >
                                <div className="h-[112px] bg-muted flex items-center justify-center group-hover:bg-muted/70 transition-colors">
                                  <Plus className="size-5 text-muted-foreground" />
                                </div>
                                <div className="px-3 py-2.5 bg-card border-t border-border">
                                  <p className="text-sm font-medium text-foreground leading-5">
                                    Add document
                                  </p>
                                  <button
                                    type="button"
                                    className="text-sm text-primary hover:underline leading-5"
                                  >
                                    Select document type
                                  </button>
                                </div>
                              </div>
                            </SectionCard>

                            {/* Show optional fields toggle — outside card */}
                            <div className="flex items-center gap-2.5 pt-1">
                              <Switch
                                id="show-optional"
                                checked={showOptional}
                                onCheckedChange={(checked) =>
                                  form.setValue("showOptional", checked, {
                                    shouldDirty: false,
                                  })
                                }
                              />
                              <label
                                htmlFor="show-optional"
                                className="text-sm text-foreground cursor-pointer select-none"
                              >
                                Show optional fields
                              </label>
                            </div>
                          </section>
                        </div>

                        {/* bottom spacer */}
                        <div className="h-12" />
                      </form>
                    </div>
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            )}
          </AnimatePresence>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ════════════════════════════════════════════════════════════════════
          DISCARD CONFIRMATION — rendered at root level to avoid z-index issues
          AlertDialog uses its own Portal so it always renders above the sheet
      ════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent className="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now, your changes will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscard(false)}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
