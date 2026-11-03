/**
 * Shuffle Wise — the data behind `/shuffle-wise/*`: a player's own breaks and
 * loss / wager limits.
 *
 * Served by the user-service `responsible-gambling` module and ENFORCED there:
 * the wallet refuses a stake while a break covers it or a limit would be
 * passed, and a PLATFORM break refuses sign-in. Rows come back in the
 * reference's shape — `selfExclusionType`, `createdAt`, `selfExclusionUntilAt`,
 * `selfExclusionCooldownUntilAt` for a break; `type`, `usdAmount`, `periodUnit`,
 * `progressAmount`, `expiredAt` for a limit.
 *
 * The backend lists only rows still in force, so a cooldown that has run out
 * drops off the list rather than staying as a "finished" row.
 */
import { responsibleGambling as api } from "./endpoints";

/** The three things a break can cover. `PLATFORM` is the whole account. */
export const EXCLUSION_TYPES = { CASINO: "CASINO", SPORTS: "SPORTS", PLATFORM: "PLATFORM" };

/** Loss or wager — a player may hold one of each, never two of a kind. */
export const LIMIT_TYPES = { LOSS_LIMIT: "Loss Limit", WAGER_LIMIT: "Wager Limit" };

/** The three windows a limit resets over. */
export const PERIOD_UNITS = { DAYS: "Daily", WEEKS: "Weekly", MONTHS: "Monthly" };

/**
 * The break lengths step 2 offers, in the reference's order, each with the
 * `{ period, periodUnit }` its mutation takes.
 */
export const BREAK_PERIODS = [
  { value: "1 day", label: "24 Hours", period: 1, unit: "DAYS" },
  { value: "1 week", label: "1 Week", period: 1, unit: "WEEKS" },
  { value: "1 month", label: "1 Month", period: 1, unit: "MONTHS" },
  { value: "6 months", label: "6 Months", period: 6, unit: "MONTHS" },
  { value: "1 year", label: "1 Year", period: 1, unit: "YEARS" },
  { value: "2 years", label: "2 Years", period: 2, unit: "YEARS" },
  { value: "3 years", label: "3 Years", period: 3, unit: "YEARS" },
  { value: "5 years", label: "5 Years", period: 5, unit: "YEARS" },
  { value: "10 years", label: "10 Years", period: 10, unit: "YEARS" },
  { value: "permanent", label: "Permanent", period: null, unit: "PERMANENT" },
];

/** The end of a break that starts now, as an ISO string. */
export function endOf(periodValue, from = Date.now()) {
  const spec = BREAK_PERIODS.find((p) => p.value === periodValue) || BREAK_PERIODS[0];
  const at = new Date(from);
  switch (spec.unit) {
    case "DAYS": at.setDate(at.getDate() + spec.period); break;
    case "WEEKS": at.setDate(at.getDate() + spec.period * 7); break;
    case "MONTHS": at.setMonth(at.getMonth() + spec.period); break;
    case "YEARS": at.setFullYear(at.getFullYear() + spec.period); break;
    // The reference has no "forever" column either — it writes a date so far
    // out that `diff(start, "year") > 100` reads as permanent.
    default: at.setFullYear(at.getFullYear() + 999); break;
  }
  return at.toISOString();
}

/** More than a century long is what the reference calls permanent. */
export function isPermanent({ startDate, endDate }) {
  const years = (new Date(endDate) - new Date(startDate)) / (365.25 * 24 * 3600 * 1000);
  return years > 100;
}

/**
 * `Every 24hrs at 2:00 PM`, and its weekly and monthly forms — reference
 * `getLimitReset`.
 */
export function limitReset(periodUnit, from) {
  const at = new Date(from);
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (periodUnit === "DAYS") return `Every 24hrs at ${time}`;
  if (periodUnit === "WEEKS") return `Every ${at.toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
  return `Every ${at.getDate()} of the month at ${time}`;
}

/* ── Self-exclusion ──────────────────────────────────────────────────── */

export async function activeSelfExclusions() {
  return (await api.overview())?.selfExclusions ?? [];
}

/**
 * Step 1 — the fixed 24 hour cooldown. It carries
 * `selfExclusionCooldownUntilAt`, which is what marks a row as the cooldown
 * rather than the self-exclusion that may follow it.
 */
export const createCooldown = ({ selfExclusionType }) => api.cooldown(selfExclusionType);

/** Step 2 — the break itself; the backend refuses it (`RESPONSIBLE_COOLDOWN_REQUIRED`) without a cooldown first. */
export const createSelfExclusion = ({ selfExclusionType, breakPeriod }) => api.selfExclude(selfExclusionType, breakPeriod);

/* ── Gambling limits ─────────────────────────────────────────────────── */

export async function responsibleLimits() {
  return (await api.overview())?.limits ?? [];
}

/** One live limit of each type; a second answers 409 `RESPONSIBLE_LIMIT_EXISTS`. */
export const enableLimit = ({ type, usdAmount, periodUnit }) => api.createLimit({ type, usdAmount, periodUnit });

/**
 * Removal is not immediate — the backend stamps `expiredAt` twelve hours out
 * and the limit keeps applying, greyed in the table, until then.
 */
export const initiateLimitRemoval = (limitId) => api.removeLimit(limitId);
