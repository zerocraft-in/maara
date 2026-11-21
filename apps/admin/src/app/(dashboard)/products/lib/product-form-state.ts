"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Paise } from "@/lib/money";
import type { PickedMedia } from "@/components/media-picker/media-picker";
import type {
  ProductOptionInput,
  VariantInput,
} from "./product-schema";
import { generateVariants, buildVariantInputs } from "./variant-generator";
import { formatMoneyInput } from "./product-schema";

/**
 * Shared product form state.
 *
 * Holds cross-section state that spans multiple form cards:
 * - The generated variant matrix
 * - Product options (source of truth for variant generation)
 * - Selected media (pending upload)
 * - UI flags (which collapsible sections are open)
 *
 * React Hook Form remains the validation/submission layer for scalar fields.
 * This store is the source of truth for the variant matrix and media.
 */
interface ProductFormState {
  // ── Options & Variants ──────────────────────────────────────────────
  options: ProductOptionInput[];
  variants: VariantInput[];
  setOptions: (options: ProductOptionInput[]) => void;
  addOption: () => void;
  removeOption: (index: number) => void;
  updateOptionName: (index: number, name: string) => void;
  updateOptionValue: (optionIndex: number, valueIndex: number, value: string) => void;
  addOptionValue: (optionIndex: number) => void;
  removeOptionValue: (optionIndex: number, valueIndex: number) => void;
  regenerateVariants: () => void;
  setVariantField: (
    variantIndex: number,
    field: keyof VariantInput,
    value: string | boolean | null,
  ) => void;
  removeVariant: (index: number) => void;
  setVariantDefaults: (defaults: Partial<VariantInput>) => void;

  // ── Media ───────────────────────────────────────────────────────────
  selectedMedia: PickedMedia[];
  setSelectedMedia: (media: PickedMedia[]) => void;
  addSelectedMedia: (media: PickedMedia[]) => void;
  removeSelectedMedia: (id: string) => void;
  clearSelectedMedia: () => void;

  // ── UI section state ────────────────────────────────────────────────
  inventoryOpen: boolean;
  setInventoryOpen: (open: boolean) => void;
  shippingOpen: boolean;
  setShippingOpen: (open: boolean) => void;
  seoOpen: boolean;
  setSeoOpen: (open: boolean) => void;
  priceOpen: boolean;
  setPriceOpen: (open: boolean) => void;
  unitPriceOpen: boolean;
  setUnitPriceOpen: (open: boolean) => void;

  // ── Reset ───────────────────────────────────────────────────────────
  reset: () => void;
}

const DEFAULT_VARIANT_DEFAULTS: Partial<VariantInput> = {
  price: "",
  cost_per_item: "",
  quantity: "0",
  track_quantity: true,
  continue_selling_when_out_of_stock: false,
  weight_unit: "g",
  requires_shipping: true,
  is_active: true,
};

export const useProductFormState = create<ProductFormState>()(
  persist(
    (set, get) => ({
      // ── Options & Variants ──────────────────────────────────────────
      options: [],
      variants: [],

      setOptions: (options) => {
        set({ options });
        get().regenerateVariants();
      },

      addOption: () => {
        const options = get().options;
        if (options.length >= 3) return;
        set({
          options: [...options, { name: "", values: [""] }],
        });
        get().regenerateVariants();
      },

      removeOption: (index) => {
        const options = get().options.filter((_, i) => i !== index);
        set({ options });
        get().regenerateVariants();
      },

      updateOptionName: (index, name) => {
        const options = [...get().options];
        options[index] = { ...options[index], name };
        set({ options });
        get().regenerateVariants();
      },

      updateOptionValue: (optionIndex, valueIndex, value) => {
        const options = [...get().options];
        const values = [...(options[optionIndex].values ?? [])];
        values[valueIndex] = value;
        options[optionIndex] = { ...options[optionIndex], values };
        set({ options });
        get().regenerateVariants();
      },

      addOptionValue: (optionIndex) => {
        const options = [...get().options];
        options[optionIndex] = {
          ...options[optionIndex],
          values: [...(options[optionIndex].values ?? []), ""],
        };
        set({ options });
        get().regenerateVariants();
      },

      removeOptionValue: (optionIndex, valueIndex) => {
        const options = [...get().options];
        options[optionIndex] = {
          ...options[optionIndex],
          values: (options[optionIndex].values ?? []).filter(
            (_, i) => i !== valueIndex,
          ),
        };
        set({ options });
        get().regenerateVariants();
      },

      regenerateVariants: () => {
        const { options } = get();
        const combinations = generateVariants(options);
        if (combinations.length === 0) {
          set({ variants: [] });
          return;
        }
        const variants = buildVariantInputs(combinations, {
          ...DEFAULT_VARIANT_DEFAULTS,
          ...get().variants[0], // inherit defaults from first variant if any
        });
        set({ variants });
      },

      setVariantField: (variantIndex, field, value) => {
        const variants = [...get().variants];
        variants[variantIndex] = {
          ...variants[variantIndex],
          [field]: value,
        };
        set({ variants });
      },

      removeVariant: (index) => {
        set({ variants: get().variants.filter((_, i) => i !== index) });
      },

      setVariantDefaults: (defaults) => {
        const variants = get().variants.map((v) => ({
          ...v,
          ...defaults,
        }));
        set({ variants });
      },

      // ── Media ───────────────────────────────────────────────────────
      selectedMedia: [],

      setSelectedMedia: (media) => set({ selectedMedia: media }),
      addSelectedMedia: (media) =>
        set((state) => {
          const existingIds = new Set(state.selectedMedia.map((m) => m.id));
          const newMedia = media.filter((m) => !existingIds.has(m.id));
          return {
            selectedMedia: [...state.selectedMedia, ...newMedia],
          };
        }),
      removeSelectedMedia: (id) =>
        set((state) => ({
          selectedMedia: state.selectedMedia.filter((m) => m.id !== id),
        })),
      clearSelectedMedia: () => set({ selectedMedia: [] }),

      // ── UI section state ────────────────────────────────────────────
      inventoryOpen: false,
      setInventoryOpen: (open) => set({ inventoryOpen: open }),
      shippingOpen: false,
      setShippingOpen: (open) => set({ shippingOpen: open }),
      seoOpen: false,
      setSeoOpen: (open) => set({ seoOpen: open }),
      priceOpen: false,
      setPriceOpen: (open) => set({ priceOpen: open }),
      unitPriceOpen: false,
      setUnitPriceOpen: (open) => set({ unitPriceOpen: open }),

      // ── Reset ───────────────────────────────────────────────────────
      reset: () =>
        set({
          options: [],
          variants: [],
          selectedMedia: [],
          inventoryOpen: false,
          shippingOpen: false,
          seoOpen: false,
          priceOpen: false,
          unitPriceOpen: false,
        }),
    }),
    {
      name: "product-form-draft",
      // Only persist options/variants, not media or UI flags.
      partialize: (state) => ({ options: state.options, variants: state.variants }),
    },
  ),
);

/**
 * Hook: derive formatted money strings from variant inputs for display.
 */
export function useVariantMoney(variant: VariantInput) {
  const priceDisplay = formatMoneyInput(
    variant.price ? (Number(variant.price) * 100) as unknown as Paise : null,
  );
  const costDisplay = formatMoneyInput(
    variant.cost_per_item
      ? (Number(variant.cost_per_item) * 100) as unknown as Paise
      : null,
  );
  const compareAtDisplay = variant.compare_at_price
    ? formatMoneyInput(
        (Number(variant.compare_at_price) * 100) as unknown as Paise,
      )
    : null;
  return { priceDisplay, costDisplay, compareAtDisplay };
}
