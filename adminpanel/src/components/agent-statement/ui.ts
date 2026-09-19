/* Shared tokens, formatters and date-range presets for the account report.
   Colours follow the panel palette in adminpanel/CLAUDE.md. */
import { format } from "date-fns";

export const C = {
  bg: "#0C0D1D",
  card: "#0E1831",
  cardHover: "#162140",
  input: "#10182E",
  border: "#1E2D55",
  text: "#F9F9F9",
  sub: "#8384A5",
  muted: "#878AA2",
  primary: "#886CFF",
  info: "#A08FFF",
  green: "#0ECC68",
  red: "#E01B4F",
  amber: "#FFC23F",
};

export const cardSx = { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 };

export const inputSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: C.input,
    color: C.text,
    "& fieldset": { borderColor: C.border },
    "&:hover fieldset": { borderColor: C.primary },
    "&.Mui-focused fieldset": { borderColor: C.primary },
  },
  "& .MuiInputLabel-root": { color: C.sub },
  "& input": { colorScheme: "dark" },
};

export const headCellSx = {
  color: C.sub,
  bgcolor: "#0B1427",
  borderBottom: `1px solid ${C.border}`,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap" as const,
};

export const bodyCellSx = {
  color: C.text,
  borderBottom: `1px solid ${C.border}`,
  fontSize: 13,
  whiteSpace: "nowrap" as const,
};

/* ─── Money ───────────────────────────────────────────────────────────────
   THE API SENDS AMOUNTS AS EXACT DECIMAL STRINGS ("1234.56000000"), never as
   numbers — the platform keeps money in minor units and will not put a float
   near a balance. So every helper here takes `Amount`, and any arithmetic in a
   component goes through `n()` first: `row.playerPnl + row.casinoPnl` on two
   strings CONCATENATES them, and the screen shows a number that never existed. */

export type Amount = number | string | null | undefined;

/** An amount as a number, for arithmetic and comparison. Junk reads as 0. */
export const n = (v: Amount): number => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Indian-format money, always 2dp. Nullish reads as an em dash. */
export const money = (v: Amount) =>
  v == null || v === "" || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Money with an explicit sign, for anything that can go either way. */
export const signed = (v: Amount) => {
  const value = n(v);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
};

export const pnlColor = (v: Amount) => {
  const value = n(v);
  return value > 0 ? C.green : value < 0 ? C.red : C.sub;
};

export const stamp = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy, HH:mm");
};

export const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : format(d, "dd MMM yyyy (EEE)");
};

/* ─── Date range presets ──────────────────────────────────────────────────
   Everything is computed in the browser's local day, which is the day the
   operator means when they say "today". */

export type Range = { from: string | null; to: string | null };

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const shift = (d: Date, days: number) => {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
};
/** Monday-based start of the week containing `d`. */
const weekStart = (d: Date) => shift(d, -((d.getDay() + 6) % 7));

export interface Preset {
  key: string;
  label: string;
  range: () => Range;
}

export const PRESETS: Preset[] = [
  { key: "today", label: "Today", range: () => ({ from: iso(new Date()), to: iso(new Date()) }) },
  {
    key: "yesterday", label: "Yesterday",
    range: () => { const y = shift(new Date(), -1); return { from: iso(y), to: iso(y) }; },
  },
  { key: "7d", label: "Last 7 days", range: () => ({ from: iso(shift(new Date(), -6)), to: iso(new Date()) }) },
  { key: "30d", label: "Last 30 days", range: () => ({ from: iso(shift(new Date(), -29)), to: iso(new Date()) }) },
  {
    key: "thisWeek", label: "This week",
    range: () => ({ from: iso(weekStart(new Date())), to: iso(new Date()) }),
  },
  {
    key: "lastWeek", label: "Last week",
    range: () => {
      const s = shift(weekStart(new Date()), -7);
      return { from: iso(s), to: iso(shift(s, 6)) };
    },
  },
  {
    key: "thisMonth", label: "This month",
    range: () => {
      const n = new Date();
      return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) };
    },
  },
  {
    key: "lastMonth", label: "Last month",
    range: () => {
      const n = new Date();
      return {
        from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        to: iso(new Date(n.getFullYear(), n.getMonth(), 0)),
      };
    },
  },
  { key: "all", label: "All time", range: () => ({ from: null, to: null }) },
];

/** Human sentence for whatever range is active — used in the report header. */
export const rangeLabel = (r: Range) => {
  if (!r.from && !r.to) return "All time";
  if (r.from && r.to && r.from === r.to) return dayLabel(r.from);
  if (r.from && r.to) return `${dayLabel(r.from)} → ${dayLabel(r.to)}`;
  if (r.from) return `${dayLabel(r.from)} → now`;
  return `Up to ${dayLabel(r.to as string)}`;
};

export const todayIso = () => iso(new Date());

/** A failed request can carry an HTML error page as its body. Dumping that into
 *  a caption is unreadable, so pull out something short and human instead. */
export const cleanError = (e: any, fallback = "Something went wrong") => {
  const raw = String(e?.message || "").trim();
  if (!raw) return fallback;
  if (/<[a-z!/]/i.test(raw)) {
    const cannotGet = raw.match(/Cannot (GET|POST) (\S+)/i);
    if (cannotGet) return `Endpoint not available: ${cannotGet[2]} — the API may need a restart.`;
    const pre = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return pre.slice(0, 160) || fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.message) return String(parsed.message);
  } catch { /* not JSON — fall through to the raw text */ }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
};
