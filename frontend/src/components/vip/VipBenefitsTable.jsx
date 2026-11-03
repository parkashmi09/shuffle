/**
 * "The benefits" — which perks each rank carries.
 *
 * Both halves of the VIP page render this: the signed-out marketing page under
 * an `<h2>`, and the signed-in page under the rocket heading. Same table, one
 * component.
 *
 * ── LIVE: THE SITE ADMIN'S PERKS ─────────────────────────────────────────
 *
 * Rows are `GET /admin/vip-branding/perks` (each perk with the cards that carry
 * it) and columns are the ladder's cards in order (`vip.levels`). Same for
 * every viewer. The literal below is the reference's schedule, drawn only when
 * those reads fail.
 *
 * The fallback rows are the reference's own, in its order, with its ticks. The first
 * label is the one place the capture and the bundle disagree: the data key is
 * `lblDailyBonus`, and the string that key resolves to is "Instant Rakeback".
 * The rendered page is what a player sees, so the rendered label is used.
 */

import { vip } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";

const RANKS = ["Bronze", "Silver", "Gold", "Platinum", "Jade", "Sapphire", "Ruby", "Diamond"];

/**
 * `from` is the first rank that gets the benefit; every rank after it does
 * too. The reference stores eight booleans per row, which is the same fact
 * written eight times — and could disagree with itself.
 */
const BENEFITS = [
  { label: "Instant Rakeback", from: "Bronze" },
  { label: "Weekly Bonus", from: "Bronze" },
  { label: "Level-Up Bonus", from: "Bronze" },
  { label: "Rank Up Bonus", from: "Bronze" },
  { label: "Monthly Bonus", from: "Silver" },
  { label: "Bonus Increase", from: "Silver" },
  { label: "VIP Host", from: "Sapphire" },
  { label: "Invitation to Shuffle Events", from: "Ruby" },
];

/** The reference schedule in the live shape: `ranks` are columns, each row ticks a set of rank keys. */
const FALLBACK = {
  ranks: RANKS.map((rank) => ({ key: rank, label: rank })),
  rows: BENEFITS.map((b) => ({ label: b.label, has: new Set(RANKS.slice(RANKS.indexOf(b.from))) })),
};

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function loadTable() {
  const [perkData, levels] = await Promise.all([vip.perks(), vip.levels()]);
  const cards = [...new Set(levels.map((l) => l.card).filter(Boolean))];
  if (!cards.length) throw new Error("no VIP ladder");
  return {
    ranks: cards.map((card) => ({ key: card, label: titleCase(card) })),
    rows: (perkData?.perks ?? []).map((p) => ({ label: p.label, has: new Set(p.cards) })),
  };
}

export default function VipBenefitsTable() {
  const { data, error } = useApi("vip:benefits", loadTable);
  const table = data ?? (error ? FALLBACK : null);
  if (!table) return <div className="Table_root" />;
  return (
    <div className="Table_root">
      <table className="Table_table VipBenefitsTable_table">
        <thead>
          <tr>
            <td style={{ minWidth: 210 }}>VIP Rank</td>
            {table.ranks.map((rank) => (
              <td key={rank.key} style={{ minWidth: 100 }}>
                {rank.label}
              </td>
            ))}
          </tr>
        </thead>
        <tbody className="TableBody_tbody TableBody_even">
          {table.rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {table.ranks.map((rank) => (
                <td key={rank.key}>{row.has.has(rank.key) ? <img src="/icons/green-tick.svg" alt="tick" /> : null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
