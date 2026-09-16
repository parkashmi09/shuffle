/**
 * "The benefits" — which perks each rank carries.
 *
 * Both halves of the VIP page render this: the signed-out marketing page under
 * an `<h2>`, and the signed-in page under the rocket heading. Same table, one
 * component.
 *
 * ── THIS IS A PUBLISHED SCHEDULE, NOT LIVE DATA ──────────────────────────
 *
 * The reference ships it as a literal in the page bundle, and so does this —
 * it describes what the *programme* offers at each rank, which is a policy
 * statement, not a reading of the player's account. Nothing here is fetched
 * and nothing here varies by who is looking.
 *
 * The rows are the reference's own, in its order, with its ticks. The first
 * label is the one place the capture and the bundle disagree: the data key is
 * `lblDailyBonus`, and the string that key resolves to is "Instant Rakeback".
 * The rendered page is what a player sees, so the rendered label is used.
 */

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

export default function VipBenefitsTable() {
  return (
    <div className="Table_root">
      <table className="Table_table VipBenefitsTable_table">
        <thead>
          <tr>
            <td style={{ minWidth: 210 }}>VIP Rank</td>
            {RANKS.map((rank) => (
              <td key={rank} style={{ minWidth: 100 }}>
                {rank}
              </td>
            ))}
          </tr>
        </thead>
        <tbody className="TableBody_tbody TableBody_even">
          {BENEFITS.map((benefit) => {
            const first = RANKS.indexOf(benefit.from);
            return (
              <tr key={benefit.label}>
                <td>{benefit.label}</td>
                {RANKS.map((rank, i) => (
                  <td key={rank}>{i >= first ? <img src="/icons/green-tick.svg" alt="tick" /> : null}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
