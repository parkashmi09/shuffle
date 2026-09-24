import { useCallback, useEffect, useMemo, useState } from "react";

import { BetSlipContext, oddsValue, selectionId } from "./betSlipContext";

/**
 * The bet slip — every selection the visitor has picked, held once for the app.
 *
 * ── WHY THE SLIP OWNS "SELECTED", AND NOT THE BUTTONS ────────────────────
 *
 * Each odds button used to carry its own `picked` state: `FixtureCard` held an
 * index, `MatchRow` and the fixture page's `Market` each held a name. Three
 * copies of one fact, none of which outlived its own row — scrolling a virtual
 * list or collapsing a market dropped the highlight, and nothing could ever
 * read back what had been chosen.
 *
 * A selection is in the slip or it is not, so that IS the selected state.
 * `has(id)` is what the buttons ask now, which means the highlight and the slip
 * cannot disagree, and it keeps working across pages: pick a leg on the sports
 * home, open a fixture, and the leg is still lit.
 *
 * ── THE ODDS ARE CAPTURED, SO NOTHING HERE PLACES A BET ──────────────────
 *
 * `src/data/sports-*.json` holds selections as `[name, odds]` pairs. There is
 * no market id, no selection id and no price feed behind them, so the arithmetic
 * below is a preview and the panel's Place Bet button stays disabled. That is
 * also why plain `Number` is good enough here: these figures are shown, never
 * banked. The moment a real feed lands, the stake has to become a decimal
 * string end to end — `POST /api/v1/sports/bets` takes `stake_amount` and the
 * settlement maths is done on what it wrote.
 */

const STORAGE_KEY = "shuffle.betslip";

/** The slip survives a reload, the way the reference's does. Per-viewer, so `localStorage`. */
const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.selections) ? parsed : null;
  } catch {
    // Private windows, blocked site data, a half-written value from an older
    // shape: an unreadable slip is an empty slip, never a crashed shell.
    return null;
  }
};

const writeStored = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* A slip that cannot be persisted still works for this visit. */
  }
};

/** A stake box holds whatever was typed; this is what the maths reads. */
const stakeValue = (raw) => {
  const n = Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function BetSlipProvider({ children }) {
  const [stored] = useState(readStored);
  const [selections, setSelections] = useState(() => stored?.selections ?? []);
  const [mode, setMode] = useState(() => (stored?.mode === "multi" ? "multi" : "singles"));
  const [stakes, setStakes] = useState(() => stored?.stakes ?? {});
  const [multiStake, setMultiStake] = useState(() => stored?.multiStake ?? "");

  useEffect(() => {
    writeStored({ selections, mode, stakes, multiStake });
  }, [selections, mode, stakes, multiStake]);

  const ids = useMemo(() => new Set(selections.map((s) => s.id)), [selections]);

  const has = useCallback((id) => ids.has(id), [ids]);

  /**
   * Add a leg, or take it out if it is already there.
   *
   * Pressing the same odds button twice removes the leg — the reference does
   * this, and it is the only way to undo a pick without opening the panel.
   */
  const toggle = useCallback((selection) => {
    const id = selection.id || selectionId(selection);
    setSelections((current) => {
      if (current.some((s) => s.id === id)) return current.filter((s) => s.id !== id);
      return [...current, { ...selection, id }];
    });
    setStakes((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setSelections((current) => current.filter((s) => s.id !== id));
    setStakes((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelections([]);
    setStakes({});
    setMultiStake("");
  }, []);

  const setStake = useCallback((id, value) => {
    setStakes((current) => ({ ...current, [id]: value }));
  }, []);

  /**
   * A multi needs at least two legs, so the tab falls back to singles when the
   * slip is cut down to one. Derived rather than corrected in an effect — an
   * effect here would render one frame of an impossible multi first.
   */
  const effectiveMode = mode === "multi" && selections.length < 2 ? "singles" : mode;

  /** Decimal multi odds: the legs multiplied. An unpriced leg makes the whole multi unpriced. */
  const multiOdds = useMemo(() => {
    if (selections.length < 2) return 0;
    let product = 1;
    for (const s of selections) {
      const o = oddsValue(s.odds);
      if (!o) return 0;
      product *= o;
    }
    return product;
  }, [selections]);

  const { totalStake, totalReturn } = useMemo(() => {
    if (effectiveMode === "multi") {
      const stake = stakeValue(multiStake);
      return { totalStake: stake, totalReturn: stake * multiOdds };
    }
    let stake = 0;
    let ret = 0;
    for (const s of selections) {
      const v = stakeValue(stakes[s.id]);
      stake += v;
      ret += v * oddsValue(s.odds);
    }
    return { totalStake: stake, totalReturn: ret };
  }, [effectiveMode, multiStake, multiOdds, selections, stakes]);

  const value = useMemo(
    () => ({
      selections,
      count: selections.length,
      mode: effectiveMode,
      stakes,
      multiStake,
      totalStake,
      totalReturn,
      multiOdds,
      has,
      toggle,
      remove,
      clear,
      setStake,
      setMultiStake,
      setMode,
    }),
    [
      selections,
      effectiveMode,
      stakes,
      multiStake,
      totalStake,
      totalReturn,
      multiOdds,
      has,
      toggle,
      remove,
      clear,
      setStake,
    ],
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}
