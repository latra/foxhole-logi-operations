/* ── Stack ↔ crate conversion for catalog items ────────────────────── */
/*
 * An item's raw quantity can be held either as loose stacks (up to
 * stack_size units each) or packed into crates (crate_size units each) —
 * the two numbers are independent per-item catalog facts (CatalogItem).
 * These helpers convert a quantity between the two forms via the common
 * raw-unit count, so any future UI (e.g. a stack/crate toggle on a slot)
 * can plug straight in without re-deriving the math.
 */

export type ItemForm = "STACK" | "CRATE";

export interface ItemPackaging {
  stack_size: number;
  crate_size: number;
}

function unitsPerForm(item: ItemPackaging, form: ItemForm): number {
  return form === "CRATE" ? item.crate_size : item.stack_size;
}

/** Total raw item count represented by `quantity` units of the given form. */
export function toRawUnits(quantity: number, form: ItemForm, item: ItemPackaging): number {
  return quantity * unitsPerForm(item, form);
}

/**
 * Converts a quantity from one packaging form to the other, preserving the
 * total raw unit count. The result may be fractional when the two sizes
 * don't divide evenly (e.g. converting a partial stack into whole crates).
 */
export function convertItemForm(
  quantity: number,
  from: ItemForm,
  to: ItemForm,
  item: ItemPackaging,
): number {
  if (from === to) return quantity;
  return toRawUnits(quantity, from, item) / unitsPerForm(item, to);
}
