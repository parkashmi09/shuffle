/**
 * Shuffle Wise — the data behind `/shuffle-wise/*`.
 *
 * ── WHY THIS IS A LOCAL STORE ────────────────────────────────────────────
 *
 * The reference serves both tabs from GraphQL: `getActiveSelfExclusions`,
 * `updateAndReturnResponsibleLimits`, `enableResponsibleLimit` and
 * `initiateResponsibleLimitRemoval`. This backend has no responsible-gambling
 * module at all — `backend/services/user/src/modules` has no route that stores
 * a limit or a break, and nothing in the casino service consults one before
 * settling a bet.
 *
 * So this file keeps what the player sets in `localStorage`, which makes the
 * two tabs behave correctly and persist across reloads. Be clear about what
 * that is and is not:
 *
 *   • It is the reference's UI, with its real states — active cooldown,
 *     finished cooldown, an extension, a limit, a limit awaiting removal.
 *   • It is NOT enforcement. A cooldown here stops nothing: the bet endpoints
 *     never see it, and clearing site data clears it. A platform self-exclusion
 *     signs this browser out, and signing back in works.
 *
 * When the module arrives, every function below becomes a call and the shape
 * it returns is already the reference's: `selfExclusionType`, `createdAt`,
 * `selfExclusionUntilAt`, `selfExclusionCooldownUntilAt` for a break, and
 * `type`, `usdAmount`, `periodUnit`, `progressAmount`, `expiredAt` for a limit.
 */

const KEY = "shuffle.shuffle-wise";

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

const EMPTY = { selfExclusions: [], limits: [] };

function read() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    // A private window throws rather than answering null.
    return { ...EMPTY };
  }
}

function write(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Nothing to do — the change still holds for this page.
  }
  return next;
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

export function activeSelfExclusions() {
  return read().selfExclusions;
}

/**
 * Step 1 — the fixed 24 hour cooldown. It carries
 * `selfExclusionCooldownUntilAt`, which is what marks a row as the cooldown
 * rather than the self-exclusion that may follow it.
 */
export function createCooldown({ selfExclusionType }) {
  const now = new Date().toISOString();
  const until = endOf("1 day");
  const store = read();
  const row = {
    id: id(),
    selfExclusionType,
    createdAt: now,
    selfExclusionUntilAt: until,
    selfExclusionCooldownUntilAt: until,
  };
  // Starting a cooldown replaces the one before it — the confirmation
  // checkbox says as much.
  write({ ...store, selfExclusions: [row, ...store.selfExclusions.filter((r) => !r.selfExclusionCooldownUntilAt)] });
  return row;
}

/** Step 2 — the break itself, which has no cooldown stamp. */
export function createSelfExclusion({ selfExclusionType, breakPeriod }) {
  const now = new Date().toISOString();
  const store = read();
  const row = {
    id: id(),
    selfExclusionType,
    createdAt: now,
    selfExclusionUntilAt: endOf(breakPeriod),
    selfExclusionCooldownUntilAt: null,
  };
  write({ ...store, selfExclusions: [row, ...store.selfExclusions] });
  return row;
}

/* ── Gambling limits ─────────────────────────────────────────────────── */

export function responsibleLimits() {
  // A promise, not the array: the reference's tab renders its skeleton while
  // this is in flight, and keeping the shape a fetch will have means the
  // component does not change when one arrives.
  return Promise.resolve(pruneExpiredLimits());
}

export function enableLimit({ type, usdAmount, periodUnit }) {
  const store = read();
  const row = {
    id: id(),
    type,
    usdAmount: String(usdAmount),
    periodUnit,
    period: 1,
    progressAmount: "0",
    createdAt: new Date().toISOString(),
    expiredAt: null,
  };
  write({ ...store, limits: [row, ...store.limits] });
  return row;
}

/**
 * Removal is not immediate on the reference — it stamps `expiredAt` twelve
 * hours out and the row stays in the table, greyed, until then.
 */
export function initiateLimitRemoval(limitId) {
  const store = read();
  const expiredAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  const limits = store.limits.map((row) => (row.id === limitId ? { ...row, expiredAt } : row));
  write({ ...store, limits });
  return limits.find((row) => row.id === limitId);
}

/** Rows whose twelve hours have passed are gone; the tab drops them on read. */
export function pruneExpiredLimits() {
  const store = read();
  const now = Date.now();
  const limits = store.limits.filter((row) => !row.expiredAt || new Date(row.expiredAt) > now);
  if (limits.length !== store.limits.length) write({ ...store, limits });
  return limits;
}
