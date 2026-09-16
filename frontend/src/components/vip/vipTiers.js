/**
 * The VIP ladder as the screens need it.
 *
 * `GET /user/vip/levels` returns 41 bands, each `{ level, name, minXp, maxXp,
 * card }`. `level` is an ordinal 1…41, `name` is what a player is shown
 * ("Wood", "Bronze 1"), and `card` is the tier — a *run of levels* sharing a
 * card, which is exactly the grouping the reference's accordions render: one
 * open-able section per tier with a table of its levels inside.
 *
 * `groupByTier` does that grouping and nothing else. It reads the run
 * boundaries off the data rather than off `TIERS` below, so a band added to the
 * ladder — or a tier this platform starts issuing — appears with no edit here.
 *
 * ── THE NAME COMES FROM THE API, NOT FROM ARITHMETIC ─────────────────────
 *
 * It would be tempting to build "Bronze 1" from the tier label and the band's
 * offset within its run. That breaks on Wood, which is one level in its own
 * tier and is written without a number. The backend already knows the name;
 * this side prints it.
 */

/**
 * Tier → what to show for it. The icons are the reference's own
 * `/images/vip/*.svg`, and the keys are the `card` values the API returns.
 *
 * `opal` is here without being on the ladder: the reference ships the mark and
 * names the rank, and its own VIP page filters OPAL out of the levels list, so
 * a band could start carrying it without this file changing.
 */
export const TIERS = {
  wood: { label: "Wood", icon: "/images/vip/wood.svg" },
  bronze: { label: "Bronze", icon: "/images/vip/bronze.svg" },
  silver: { label: "Silver", icon: "/images/vip/silver.svg" },
  gold: { label: "Gold", icon: "/images/vip/gold.svg" },
  platinum: { label: "Platinum", icon: "/images/vip/platinum.svg" },
  jade: { label: "Jade", icon: "/images/vip/jade.svg" },
  sapphire: { label: "Sapphire", icon: "/images/vip/sapphire.svg" },
  ruby: { label: "Ruby", icon: "/images/vip/ruby.svg" },
  opal: { label: "Opal", icon: "/images/vip/opal.svg" },
  diamond: { label: "Diamond", icon: "/images/vip/diamond.svg" },
};

/** Level 0 — signed up, has not wagered the ladder's first 500. */
export const UNRANKED = { label: "Unranked", icon: "/images/vip/unranked.svg" };

/**
 * The badge for a standing: `{ label, icon }`.
 *
 * `label` is the *rank* the player holds — "Bronze 1", not "Bronze" — because
 * that is what the reference's badge shows. The tier label alone is only used
 * as an accordion header, where the levels are listed underneath it.
 */
export function tierFor(vip) {
  if (!vip || !vip.level) return UNRANKED;
  const tier = TIERS[vip.card] || UNRANKED;
  return { label: vip.name || tier.label, icon: tier.icon };
}

/**
 * The bands as runs of one tier.
 *
 * `[{ card, label, icon, levels: [band, …] }]`, in ladder order. Consecutive
 * bands with the same card join one run; a card that reappeared later in the
 * ladder would open a second section rather than being merged into the first,
 * because the ladder's order is the thing being displayed.
 */
export function groupByTier(levels) {
  const groups = [];
  for (const band of levels || []) {
    const last = groups[groups.length - 1];
    if (last && last.card === band.card) {
      last.levels.push(band);
      continue;
    }
    const tier = TIERS[band.card] || UNRANKED;
    groups.push({ card: band.card, label: tier.label, icon: tier.icon, levels: [band] });
  }
  return groups;
}

/**
 * XP as the ladder counts it.
 *
 * The counter is lifetime wager, and the API sends it as a decimal string
 * because it can outgrow a float's exact range. Only the comparison against a
 * band's `minXp` needs a number, and at these magnitudes a double is exact
 * enough to place a level; the *displayed* figure keeps the string.
 */
export function xpNumber(value) {
  const n = Number.parseFloat(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** `1000` → `1,000`. Groups only — the ladder's thresholds are integers. */
export function formatXp(value) {
  const n = xpNumber(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** `2` → `Bronze 1`, from the ladder the API returned. Null if not found. */
export function levelName(levels, level) {
  return (levels || []).find((b) => b.level === level)?.name ?? null;
}
