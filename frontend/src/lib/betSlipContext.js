import { createContext, useContext } from "react";

/**
 * The bet slip context and its accessor, kept apart from the provider for the
 * same reason `sessionContext.js` and `favouritesContext.js` are: a module
 * exporting both a component and a plain function loses fast refresh.
 */
export const BetSlipContext = createContext(null);

/**
 * A selection's identity.
 *
 * The fixture, the market and the runner together — the market is in it because
 * "Over 2.5" is a different bet in Total Goals than in First Half Goals, and
 * without it the second pick would silently replace the first.
 *
 * Here rather than beside the provider because every odds button needs it and
 * `betSlip.jsx` exports a component: a module exporting both loses fast refresh.
 */
export const selectionId = ({ href, market, name }) =>
  `${href || "?"}|${market || "?"}|${name || "?"}`;

/** Decimal odds as a number, or 0 for anything unpriced ("Suspended", "SP", null). */
export function oddsValue(odds) {
  const n = Number.parseFloat(String(odds ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 1 ? n : 0;
}

/**
 * The selections the visitor has picked, and the actions that change them.
 *
 * Safe to call anywhere — outside the provider it answers an empty slip and
 * no-op actions, so an odds button does not have to know whether the provider
 * is above it. That matters here because the same `MatchRow` renders on the
 * sports home, a sport page and a competition page, and only the first of
 * those is certain to sit inside the shell.
 */
export function useBetSlip() {
  return useContext(BetSlipContext) || EMPTY;
}

const EMPTY = {
  selections: [],
  count: 0,
  mode: "singles",
  stakes: {},
  multiStake: "",
  totalStake: 0,
  totalReturn: 0,
  multiOdds: 0,
  has: () => false,
  toggle: () => {},
  remove: () => {},
  clear: () => {},
  setStake: () => {},
  setMultiStake: () => {},
  setMode: () => {},
};
