/* =========================================================================
   transfers.ts – the shape `GET /admin/staff/transfers` actually returns.

   Deposit, Withdraw and Account Statement each carried their own copy of this
   interface, and all three copies described the LEGACY row: flat snake_case
   (`from_type`, `to_id`, `created_at`) with `amount` as a number. The service
   returns nested `from`/`to` objects, camelCase `createdAt`, and `amount` as a
   decimal STRING — so every field the three pages read came back `undefined`.

   One definition here, imported by all three, so a future change to the API
   breaks one file instead of silently emptying three screens.
   ========================================================================= */

export type TargetType = "staff" | "user";

/** One side of a transfer. `name` is null for an account since deleted. */
export interface TransferParty {
  type: TargetType;
  id: number;
  name: string | null;
}

/**
 * `direction` is NOT a closed set. The column is nullable and production rows
 * carry `collect`, `pay` and `down` alongside `deposit`/`withdraw` — a union
 * of the two the validator accepts would be a lie the compiler enforces.
 */
export interface Transfer {
  id: number;
  from: TransferParty;
  to: TransferParty;
  /** Decimal string, e.g. "500.00000000" — never a number. See money.js. */
  amount: string;
  direction: string | null;
  transferType: string | null;
  createdAt: string | null;
}

/** Money arrives as a decimal string; every comparison and sum needs this. */
export const amountOf = (t: Transfer): number => Number(t.amount) || 0;

/** `₹ 1,500.00` — grouped, two places, from the decimal string. */
export const formatAmount = (t: Transfer): string =>
  `₹ ${amountOf(t).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * `YYYY-MM-DD` for date-range filters, without going through `Date`.
 *
 * The old code called `.slice(0, 10)` straight on the field, which threw the
 * moment the field was absent.
 */
export const dayOf = (t: Transfer): string => (t.createdAt ? t.createdAt.slice(0, 10) : "");

/** A party as "Name" + "Staff #12", with a fallback when the row is orphaned. */
export const partyLabel = (p: TransferParty | undefined) => ({
  name: p?.name ?? "(unknown)",
  ref: p ? `${p.type === "staff" ? "Staff" : "User"} #${p.id}` : "—",
});
