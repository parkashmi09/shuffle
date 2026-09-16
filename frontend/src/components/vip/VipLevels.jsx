import Accordion from "./Accordion";
import VipBadge from "./VipBadge";
import { formatXp, groupByTier, xpNumber } from "./vipTiers";

/**
 * "VIP levels" — the whole ladder, one accordion per rank.
 *
 * Reference `VipLevels` + `VipLevelsAccordion` + `VipLevelsTable`. A section
 * is locked (and says so with a padlock) until the player has wagered enough
 * to reach its first band; inside, every level of that rank with the XP it
 * needs and whether the player has passed it.
 *
 * ── THE LOCK IS DECORATION, NOT ACCESS CONTROL ───────────────────────────
 *
 * A locked section still opens, exactly as the reference's does — `isLocked`
 * only picks the icon. The ladder is public (`GET /user/vip/levels` needs no
 * token) and a player deciding whether to keep playing is precisely the person
 * who should be able to read what the next rank costs.
 *
 * ── NINE TIERS, AND THEY ARE THE REFERENCE'S ─────────────────────────────
 *
 * Wood, Bronze, Silver, Gold, Platinum, Jade, Sapphire, Ruby, Diamond — 41
 * levels. `vipLevels.js` used to hold the legacy 75-band ladder, which reached
 * only five of those tiers and so rendered five accordions where the live page
 * renders nine. Nothing here knows the count: the sections come from whatever
 * `GET /user/vip/levels` returns.
 */
function LevelsTable({ levels, xp }) {
  return (
    <div className="Table_root">
      <table className="Table_table VipLevelsTable_table">
        <thead>
          <tr>
            <td>Level</td>
            <td>XP required</td>
            <td className="VipLevelsTable_row">Completed</td>
          </tr>
        </thead>
        <tbody className="TableBody_tbody TableBody_even">
          {levels.map((band) => {
            const done = xpNumber(band.minXp) <= xp;
            return (
              <tr key={band.level}>
                <td width="33.33%">
                  <div className="VipLevelsTable_cell">
                    <VipBadge icon={band.icon} />
                    {band.name}
                  </div>
                </td>
                <td width="33.33%">
                  <div className="VipLevelsTable_cell">{formatXp(band.minXp)}</div>
                </td>
                <td width="33.33%" className="VipLevelsTable_row">
                  <div className="VipLevelsTable_cell">
                    <img
                      src={`/icons/tick-${done ? "complete" : "incomplete"}.svg`}
                      alt={done ? "complete" : "incomplete"}
                      width="16"
                      height="16"
                    />
                    <span className={done ? "VipLevelsTable_vipLevelStatusText" : "VipLevelsTable_vipLevelStatusText VipLevelsTable_incomplete"}>
                      {done ? "Completed" : "Incomplete"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function VipLevels({ levels, vip }) {
  const xp = xpNumber(vip?.wager);
  const groups = groupByTier(levels);

  return (
    <div className="VipOverviewSectionWrapper_root">
      <div className="VipLevels_headingWrapper">
        <img src="/icons/crown.svg" height="24" width="24" alt="crown" className="VipLevels_headingIcon" />
        <span className="VipSectionTitle_root">VIP levels</span>
      </div>
      <div className="VipLevels_vipList">
        {groups.map((group) => (
          <Accordion
            key={group.card}
            showLock
            isLocked={xpNumber(group.levels[0].minXp) > xp}
            classNameContent="VipLevels_accordionContent"
            header={
              <div className="Flex_root Flex_sm5" style={{ alignItems: "center" }}>
                <VipBadge icon={group.icon} />
                <span className="VipLevelsAccordion_vipLevelsAccordionHeader">{group.label}</span>
              </div>
            }
          >
            {/* `band.name` is the API's — "Bronze 1", and plain "Wood" for the
                one tier with a single level. An earlier pass built it as
                `${tier} ${level}`, which produced "Silver 8" from an absolute
                ladder position and would have read "Wood 1" here. */}
            <LevelsTable
              xp={xp}
              levels={group.levels.map((band) => ({ ...band, icon: group.icon }))}
            />
          </Accordion>
        ))}
      </div>
    </div>
  );
}
