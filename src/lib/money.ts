/**
 * The only place rupees become paise and back.
 *
 * The Advance Balance stores integer paise; the rest of the codebase stores rupees. That mismatch
 * produces a x100 bug the moment two components each do their own conversion, so every
 * conversion in the Advance Balance goes through here and every paise-valued variable carries the
 * `Paise` suffix — a reviewer must be able to see the unit without opening another file.
 */

/** Rupees to paise. Rounds, because floating-point rupees do not divide cleanly. */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new Error("Cannot convert a non-finite amount to paise");
  }
  // Math.round, not truncation: 12.345 * 100 is 1234.4999999999998 in binary floating
  // point, and truncating would silently lose a paisa on perfectly ordinary input.
  return Math.round(rupees * 100);
}

/** Paise to rupees. The API edge calls this; components never see paise. */
export function toRupees(paise: number): number {
  if (!Number.isInteger(paise)) {
    throw new Error(`Paise must be a whole number, received ${paise}`);
  }
  return paise / 100;
}

/**
 * Validates an amount arriving from a client before it is allowed near a balance.
 *
 * Returns paise on success and throws otherwise, so a caller cannot accidentally proceed
 * with an unvalidated number — a boolean return would let one forgotten `if` write a
 * negative debit.
 */
export function parseAmountToPaise(
  value: unknown,
  { min = 1, max = Number.MAX_SAFE_INTEGER, label = "Amount" }: {
    min?: number;
    max?: number;
    label?: string;
  } = {}
): number {
  const rupees = typeof value === "string" ? Number(value) : value;

  if (typeof rupees !== "number" || !Number.isFinite(rupees)) {
    throw new Error(`${label} must be a number`);
  }
  if (rupees <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }

  const paise = toPaise(rupees);

  if (paise < min) {
    throw new Error(`${label} must be at least ${formatPaise(min)}`);
  }
  if (paise > max) {
    throw new Error(`${label} cannot exceed ${formatPaise(max)}`);
  }
  return paise;
}

/**
 * Formats paise as Indian-locale rupees for display and for error messages.
 *
 * Uses en-IN so grouping is lakh/crore (1,20,000) rather than thousands (120,000) — the
 * wrong grouping makes a number readable but subtly foreign on an Indian invoice.
 */
export function formatPaise(paise: number, { withSymbol = true } = {}): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toRupees(paise));

  return withSymbol ? `₹${formatted}` : formatted;
}

/**
 * Signed display for a ledger row.
 *
 * Uses a real minus sign (U+2212), not a hyphen: at the small sizes a passbook uses, a
 * hyphen reads as a dash or as part of the description.
 */
export function formatSignedPaise(paise: number, direction: "credit" | "debit"): string {
  return `${direction === "credit" ? "+" : "−"}${formatPaise(Math.abs(paise))}`;
}
