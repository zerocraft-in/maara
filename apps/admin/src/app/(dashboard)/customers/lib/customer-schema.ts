import { z } from "zod";

export const customerFormSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name must be at most 100 characters"),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name must be at most 100 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be at most 320 characters")
    .email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(32, "Phone must be at most 32 characters")
    .optional()
    .or(z.literal(""))
    .default(""),
  note: z
    .string()
    .trim()
    .max(5000, "Note must be at most 5000 characters")
    .optional()
    .or(z.literal(""))
    .default(""),
  tags: z
    .array(z.string().trim().min(1))
    .max(100, "Too many tags")
    .default([]),
  tax_exempt: z.boolean().default(false),
  accepts_marketing: z.boolean().default(false),
  marketing_opt_in_level: z
    .enum(["unknown", "single_opt_in", "confirmed_opt_in", "unconfirmed_opt_in"])
    .default("unknown"),
  state: z
    .enum(["enabled", "disabled", "invited", "declined"])
    .default("enabled"),
  default_address: z
    .object({
      first_name: z.string().trim().optional(),
      last_name: z.string().trim().optional(),
      company: z.string().trim().optional(),
      address1: z.string().trim().optional(),
      address2: z.string().trim().optional(),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      province: z.string().trim().optional(),
      country: z.string().trim().optional(),
      zip: z.string().trim().optional(),
      phone: z.string().trim().optional(),
    })
    .nullable()
    .optional(),
  addresses: z
    .array(
      z.object({
        first_name: z.string().trim().optional(),
        last_name: z.string().trim().optional(),
        company: z.string().trim().optional(),
        address1: z.string().trim().optional(),
        address2: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        province: z.string().trim().optional(),
        country: z.string().trim().optional(),
        zip: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      })
    )
    .default([]),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
