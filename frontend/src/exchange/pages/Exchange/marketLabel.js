// stake: hash's `marketLabel` (pages/Wallet/BetHistory/sportsBets.js); stake has no such wallet pane.
/* A real value, not empty and not the stored "NULL". */
const present = (v) => {
  const s = String(v ?? '').trim();
  return s && s.toUpperCase() !== 'NULL' ? s : '';
};

/* MATCH_ODDS → "Match Odds", OVER_UNDER_15 → "Over/Under 1.5". */
export const marketLabel = (type) => {
  const ou = /^OVER_UNDER_(\d)(\d)$/i.exec(present(type));
  if (ou) return `Over/Under ${ou[1]}.${ou[2]}`;
  return present(type)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
};
