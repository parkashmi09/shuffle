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
 * every viewer. A failed read shows the empty state, never a stand-in schedule.
 */

import { vip } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";

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
  const { data: table, error } = useApi("vip:benefits", loadTable);
  if (error || (table && !table.rows.length)) {
    return (
      <div className="Table_root">
        <div className="Table_noResult">
          <p>{error ? "The benefits could not be loaded." : "No benefits to show."}</p>
        </div>
      </div>
    );
  }
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
