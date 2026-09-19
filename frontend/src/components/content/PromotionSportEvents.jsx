import { navigate } from "../../lib/router";

/**
 * Qualifying sports sections on tournament promotions (links to competitions).
 */
export default function PromotionSportEvents({ events, heading = "Qualifying Sports" }) {
  const list = Array.isArray(events) ? events.filter((e) => e?.href && e?.label) : [];
  if (!list.length) return null;

  return (
    <>
      <h3 className="Heading_root Heading_h3">{heading}</h3>
      <div className="ModalListContainer_root">
        {list.map((ev) => (
          <a
            key={ev.href + ev.label}
            className="ModalListContainer_item ModalListContainer_itemLink sportsTournamentMultiRulesContent_sportsGroupRuleSection"
            href={ev.href}
            onClick={(e) => {
              e.preventDefault();
              navigate(ev.href);
            }}
          >
            <div className="sportsTournamentMultiRulesContent_header">
              {ev.icon ? <img alt={ev.sportAlt || ""} height="16" src={ev.icon} width="16" /> : null}
              {ev.label}
            </div>
            <div className="sportsTournamentMultiRulesContent_header">
              <img alt="arrow right" className="sportsTournamentMultiRulesContent_rightChevron" height="16" src="/icons/chevron.svg" width="16" />
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
