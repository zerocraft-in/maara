/* ───────────────────────── constants ───────────────────────── */
export const MAX_OPTIONS = 3;
export const VARIANT_LIMIT = 100;
export const MAX_TEXT = 255;
export const REQUIRED_PRICE = "Price is required.";

/* ───────────────────────── types ───────────────────────── */
export interface OptionValue {
  id: string;
  label: string;
}

/** option -> { name, position, values } */
export interface ProductOption {
  id: string;
  name: string;
  position: number;
  values: OptionValue[];
}

export interface Selection {
  optionId: string;
  valueId: string;
}

export interface VariantFields {
  price: string;
  compareAtPrice: string;
  sku: string;
  barcode: string;
  quantity: string;
}

export interface Variant extends VariantFields {
  /** stable key = sorted "optionId:valueId" parts. Survives option / value reordering */
  key: string;
  parts: string[];
  selections: Selection[];
}

export interface BuilderState {
  options: ProductOption[];
  variants: Variant[];
  /** combinations the user deleted manually – they are not re-generated */
  excluded: string[][];
}

export interface OptionErrors {
  name?: string;
  values: Record<string, string>;
}

export interface VariantErrors {
  price?: string;
  compareAtPrice?: string;
  sku?: string;
  quantity?: string;
}

/* ───────────────────────── small helpers ───────────────────────── */
export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

const norm = (s: string) => s.trim().toLowerCase();
const isBlank = (s: string) => s.trim() === "";
const partKey = (s: Selection) => `${s.optionId}:${s.valueId}`;

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function sanitizePrice(input: string) {
  const x = input.replace(/[^\d.]/g, "");
  const i = x.indexOf(".");
  if (i === -1) return x;
  return (
    x.slice(0, i + 1) +
    x
      .slice(i + 1)
      .replace(/\./g, "")
      .slice(0, 2)
  );
}
export const isValidPrice = (s: string) => /^\d+(\.\d{1,2})?$/.test(s.trim());
export const isValidQty = (s: string) => /^\d+$/.test(s.trim());

/** non-blank, de-duplicated (case-insensitive) values of an option */
export function cleanValues(option: ProductOption): OptionValue[] {
  const seen = new Set<string>();
  const out: OptionValue[] = [];
  for (const v of option.values) {
    const n = norm(v.label);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(v);
  }
  return out;
}

/** how many variants the current options would produce */
export function countCombos(options: ProductOption[]) {
  let n = 1;
  let any = false;
  for (const o of options) {
    const c = cleanValues(o).length;
    if (c > 0) {
      n *= c;
      any = true;
    }
  }
  return any ? n : 0;
}

/** value labels of a variant, in option order (optionally skipping one option) */
export function variantValueLabels(
  v: Variant,
  options: ProductOption[],
  excludeOptionId?: string,
): string[] {
  const out: string[] = [];
  for (const o of options) {
    if (o.id === excludeOptionId) continue;
    const s = v.selections.find((x) => x.optionId === o.id);
    const label =
      s && o.values.find((val) => val.id === s.valueId)?.label.trim();
    if (label) out.push(label);
  }
  return out;
}

export const variantTitle = (v: Variant, options: ProductOption[]) =>
  variantValueLabels(v, options).join(" / ");

/* ───────────────────────── variant generation ───────────────────────── */
/**
 * Re-creates the variants from the options.
 *  - Options with no value yet (the one you are still typing) are ignored,
 *    so existing variants never disappear while a new option is being edited.
 *  - Price / quantity entered earlier is carried over (also when an option is added / removed).
 *  - Order of variants always follows option order + value order.
 */
function rebuild(
  options: ProductOption[],
  prev: Variant[],
  excluded: string[][],
): Variant[] {
  const active = options
    .map((o) => ({ id: o.id, values: cleanValues(o) }))
    .filter((o) => o.values.length > 0);
  if (active.length === 0) return [];

  let combos: Selection[][] = [[]];
  for (const o of active) {
    combos = combos
      .flatMap((c) =>
        o.values.map((v) => [...c, { optionId: o.id, valueId: v.id }]),
      )
      .slice(0, VARIANT_LIMIT);
  }

  const prevByKey = new Map(prev.map((v) => [v.key, v]));
  const out: Variant[] = [];

  for (const selections of combos) {
    const parts = selections.map(partKey);
    if (excluded.some((ex) => ex.every((p) => parts.includes(p)))) continue;

    const key = [...parts].sort().join("|");
    const exact = prevByKey.get(key);
    // option added  -> old variant parts ⊆ new parts
    // option removed -> new parts ⊆ old parts
    const src =
      exact ??
      prev.find((p) => p.parts.every((x) => parts.includes(x))) ??
      prev.find((p) => parts.every((x) => p.parts.includes(x)));

    out.push({
      key,
      parts,
      selections,
      price: src?.price ?? "",
      compareAtPrice: src?.compareAtPrice ?? "",
      quantity: src?.quantity ?? "0",
      sku: exact?.sku ?? "",
      barcode: exact?.barcode ?? "",
    });
  }
  return out;
}

/* ───────────────────────── reducer ───────────────────────── */
export const createInitialState = (): BuilderState => ({
  options: [],
  variants: [],
  excluded: [],
});

/** Convert the serializable editor value back into reducer state for edit mode. */
export function createStateFromValue(value?: VariantBuilderValue): BuilderState {
  if (!value) return createInitialState();
  const options = value.options.map((option, optionIndex) => {
    const optionId = uid();
    return {
      id: optionId,
      name: option.name,
      position: optionIndex,
      values: option.values.map((item) => ({ id: uid(), label: item.value })),
    };
  });
  const variants = value.variants.map((item) => {
    const selections = options.flatMap((option, index) => {
      const label = [item.option1, item.option2, item.option3][index];
      const selected = option.values.find((v) => v.label === label);
      return selected ? [{ optionId: option.id, valueId: selected.id }] : [];
    });
    const parts = selections.map(partKey);
    return {
      key: [...parts].sort().join("|"),
      parts,
      selections,
      price: item.price,
      compareAtPrice: item.compare_at_price ?? "",
      quantity: item.quantity,
      sku: item.sku,
      barcode: item.barcode ?? "",
    };
  });
  return { options, variants, excluded: [] };
}

/** keeps exactly one empty "Add another value" row at the end */
function ensureBlank(values: OptionValue[], id: string): OptionValue[] {
  const v = [...values];
  while (
    v.length > 1 &&
    isBlank(v[v.length - 1].label) &&
    isBlank(v[v.length - 2].label)
  ) {
    v.pop();
  }
  if (!v.length || !isBlank(v[v.length - 1].label)) v.push({ id, label: "" });
  return v;
}

export type BuilderAction =
  | { type: "ADD_OPTION"; id: string; valueId: string }
  | { type: "OPEN_OPTION"; id: string; nextId: string }
  | { type: "REMOVE_OPTION"; id: string }
  | { type: "SET_OPTION_NAME"; id: string; name: string }
  | {
      type: "SET_VALUE";
      optionId: string;
      valueId: string;
      label: string;
      nextId: string;
    }
  | { type: "REMOVE_VALUE"; optionId: string; valueId: string; nextId: string }
  | { type: "REORDER_OPTIONS"; activeId: string; overId: string }
  | {
      type: "REORDER_VALUES";
      optionId: string;
      activeId: string;
      overId: string;
    }
  | { type: "FINALIZE_OPTION"; id: string }
  | { type: "UPDATE_VARIANT"; key: string; patch: Partial<VariantFields> }
  | { type: "BULK_UPDATE"; keys: string[]; patch: Partial<VariantFields> }
  | { type: "DELETE_VARIANTS"; keys: string[] };

function commit(
  state: BuilderState,
  options: ProductOption[],
  extra: { excluded?: string[][]; variants?: Variant[] } = {},
): BuilderState {
  const positioned = options.map((o, i) => ({ ...o, position: i }));
  const excluded = extra.excluded ?? state.excluded;
  const prev = extra.variants ?? state.variants;
  return {
    options: positioned,
    excluded,
    variants: rebuild(positioned, prev, excluded),
  };
}

const mapOption = (
  options: ProductOption[],
  id: string,
  fn: (o: ProductOption) => ProductOption,
) => options.map((o) => (o.id === id ? fn(o) : o));

export function builderReducer(
  state: BuilderState,
  a: BuilderAction,
): BuilderState {
  switch (a.type) {
    case "ADD_OPTION": {
      if (state.options.length >= MAX_OPTIONS) return state;
      return commit(state, [
        ...state.options,
        {
          id: a.id,
          name: "",
          position: state.options.length,
          values: [{ id: a.valueId, label: "" }],
        },
      ]);
    }
    case "OPEN_OPTION":
      return commit(
        state,
        mapOption(state.options, a.id, (o) => ({
          ...o,
          values: ensureBlank(o.values, a.nextId),
        })),
      );
    case "REMOVE_OPTION":
      return commit(
        state,
        state.options.filter((o) => o.id !== a.id),
      );
    case "SET_OPTION_NAME":
      return commit(
        state,
        mapOption(state.options, a.id, (o) => ({ ...o, name: a.name })),
      );
    case "SET_VALUE":
      return commit(
        state,
        mapOption(state.options, a.optionId, (o) => ({
          ...o,
          values: ensureBlank(
            o.values.map((v) =>
              v.id === a.valueId ? { ...v, label: a.label } : v,
            ),
            a.nextId,
          ),
        })),
      );
    case "REMOVE_VALUE":
      return commit(
        state,
        mapOption(state.options, a.optionId, (o) => ({
          ...o,
          values: ensureBlank(
            o.values.filter((v) => v.id !== a.valueId),
            a.nextId,
          ),
        })),
      );
    case "REORDER_OPTIONS": {
      const from = state.options.findIndex((o) => o.id === a.activeId);
      const to = state.options.findIndex((o) => o.id === a.overId);
      if (from < 0 || to < 0 || from === to) return state;
      return commit(state, move(state.options, from, to));
    }
    case "REORDER_VALUES":
      return commit(
        state,
        mapOption(state.options, a.optionId, (o) => {
          const from = o.values.findIndex((v) => v.id === a.activeId);
          const to = o.values.findIndex((v) => v.id === a.overId);
          if (from < 0 || to < 0 || from === to) return o;
          const moved = move(o.values, from, to);
          // blank rows always stay at the bottom
          return {
            ...o,
            values: [
              ...moved.filter((v) => !isBlank(v.label)),
              ...moved.filter((v) => isBlank(v.label)),
            ],
          };
        }),
      );
    case "FINALIZE_OPTION":
      return commit(
        state,
        mapOption(state.options, a.id, (o) => ({
          ...o,
          name: o.name.trim(),
          values: o.values
            .filter((v) => !isBlank(v.label))
            .map((v) => ({ ...v, label: v.label.trim() })),
        })),
      );
    case "UPDATE_VARIANT":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.key === a.key ? { ...v, ...a.patch } : v,
        ),
      };
    case "BULK_UPDATE": {
      const keys = new Set(a.keys);
      return {
        ...state,
        variants: state.variants.map((v) =>
          keys.has(v.key) ? { ...v, ...a.patch } : v,
        ),
      };
    }
    case "DELETE_VARIANTS": {
      const keys = new Set(a.keys);
      const removed = state.variants.filter((v) => keys.has(v.key));
      const kept = state.variants.filter((v) => !keys.has(v.key));
      return commit(state, state.options, {
        excluded: [...state.excluded, ...removed.map((v) => v.parts)],
        variants: kept,
      });
    }
    default:
      return state;
  }
}

/* ───────────────────────── validation ───────────────────────── */
export function validateOption(
  option: ProductOption,
  all: ProductOption[],
): OptionErrors {
  const e: OptionErrors = { values: {} };
  const name = option.name.trim();

  if (!name) e.name = "Option name is required.";
  else if (name.length > MAX_TEXT)
    e.name = `Option name must be ${MAX_TEXT} characters or less.`;
  else if (all.some((o) => o.id !== option.id && norm(o.name) === norm(name)))
    e.name = "This option name is already used.";

  const seen = new Set<string>();
  let filled = 0;
  for (const v of option.values) {
    const n = norm(v.label);
    if (!n) continue;
    filled++;
    if (v.label.trim().length > MAX_TEXT)
      e.values[v.id] = `Must be ${MAX_TEXT} characters or less.`;
    else if (seen.has(n)) e.values[v.id] = "Duplicate value.";
    seen.add(n);
  }
  if (filled === 0 && option.values[0])
    e.values[option.values[0].id] = "Option value is required.";
  return e;
}

export const optionHasErrors = (e: OptionErrors) =>
  !!e.name || Object.keys(e.values).length > 0;

export function validateVariant(
  v: VariantFields,
  duplicateSku: boolean,
): VariantErrors {
  const e: VariantErrors = {};
  const price = v.price.trim();
  if (!price) e.price = REQUIRED_PRICE;
  else if (!isValidPrice(price)) e.price = "Enter a valid price.";

  const cmp = v.compareAtPrice.trim();
  if (cmp) {
    if (!isValidPrice(cmp)) e.compareAtPrice = "Enter a valid price.";
    else if (isValidPrice(price) && Number(cmp) <= Number(price))
      e.compareAtPrice = "Must be greater than price.";
  }

  if (!isValidQty(v.quantity.trim() || "0"))
    e.quantity = "Enter a whole number.";
  if (v.sku.trim() && duplicateSku) e.sku = "SKU must be unique.";
  return e;
}

/** key -> errors (only variants with errors are present) */
export function validateVariants(
  variants: Variant[],
): Record<string, VariantErrors> {
  const counts = new Map<string, number>();
  for (const v of variants) {
    const s = norm(v.sku);
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const out: Record<string, VariantErrors> = {};
  for (const v of variants) {
    const errs = validateVariant(v, (counts.get(norm(v.sku)) ?? 0) > 1);
    if (Object.keys(errs).length) out[v.key] = errs;
  }
  return out;
}

/* ───────────────────────── output payload ───────────────────────── */
export interface VariantBuilderValue {
  options: {
    name: string;
    position: number;
    values: { value: string; position: number }[];
  }[];
  variants: {
    position: number;
    title: string;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    price: string;
    compare_at_price: string | null;
    sku: string;
    barcode: string | null;
    quantity: string;
  }[];
  isValid: boolean;
}

export function toPayload(state: BuilderState): VariantBuilderValue {
  const options = state.options
    .filter((o) => cleanValues(o).length > 0)
    .map((o, i) => ({
      name: o.name.trim(),
      position: i,
      values: cleanValues(o).map((v, j) => ({
        value: v.label.trim(),
        position: j,
      })),
    }));

  const variants = state.variants.map((v, i) => {
    const labels = variantValueLabels(v, state.options);
    return {
      position: i,
      title: labels.join(" / "),
      option1: labels[0] ?? null,
      option2: labels[1] ?? null,
      option3: labels[2] ?? null,
      price: v.price.trim(),
      compare_at_price: v.compareAtPrice.trim() || null,
      sku: v.sku.trim(),
      barcode: v.barcode.trim() || null,
      quantity: v.quantity.trim() || "0",
    };
  });

  const optionsValid = state.options.every((o) => {
    // an option that was never filled in does not block (it is ignored), a half filled one does
    const touched = o.name.trim() || o.values.some((v) => !isBlank(v.label));
    return !touched || !optionHasErrors(validateOption(o, state.options));
  });
  const isValid =
    optionsValid &&
    variants.length > 0 &&
    countCombos(state.options) <= VARIANT_LIMIT &&
    Object.keys(validateVariants(state.variants)).length === 0;

  return { options, variants, isValid };
}
