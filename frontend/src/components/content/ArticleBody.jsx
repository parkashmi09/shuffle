import { useEffect, useRef, useState } from "react";
import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { GameCard } from "../casino/GameCarousel";
import { UserCell } from "../casino/PromoWidgets";
import { cx, useCarousel } from "../../lib/carousel";
import { navigate } from "../../lib/router";

const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

function Leaderboard({ board }) {
  const [page, setPage] = useState(1);
  const total = board.pages || 1;
  const lo = Math.max(1, page - 2);
  const hi = Math.min(total, page + 2);
  const items = [];
  if (lo > 1) {
    items.push(1);
    if (lo > 2) items.push("…");
  }
  for (let i = lo; i <= hi; i++) items.push(i);
  if (hi < total) {
    if (hi < total - 1) items.push("…");
    items.push(total);
  }
  const ranked = board.columns[0] === "Rank";
  return (
    <div className="Flex_root Flex_column Flex_md2">
      <div className="Table_root">
        <table className="Table_table">
          <thead>
            <tr>
              {board.columns.map((c, i) => (
                <td key={c} width={board.widths[i]}>
                  {c}
                </td>
              ))}
            </tr>
          </thead>
          <tbody className={cx("TableBody_tbody TableBody_even", ranked && "TableBody_withClick")} data-testid="table-body">
            {board.rows.map((row, i) => (
              <tr key={i} {...(ranked ? { role: "button", "aria-label": "View detail", tabIndex: 0 } : {})}>
                {ranked && (
                  <td>
                    <p>{ordinal(row.rank)}</p>
                  </td>
                )}
                <td>
                  <UserCell user={row.user} />
                </td>
                <td>
                  <span className="TournamentInfoLeaderboard_tableCell">
                    {board.kind === "multiplier" ? (
                      <span className="MultiplierCell_root">
                        <img alt="increase" height="16" src="/icons/multi-increase.svg" width="16" />
                        <span>{row.score}</span>
                      </span>
                    ) : board.kind === "payout" || board.kind === "wager" ? (
                      <div className="FormattedUsdAmountWithTooltip_flex">
                        <img alt="USD" height="16" src="/icons/fiat/USD.svg" width="16" />
                        <span className="Tooltip_trigger">{row.score}</span>
                      </div>
                    ) : (
                      <span className="Tooltip_trigger">
                        <p className="FormattedTournamentScores_tableDate">{row.score}</p>
                      </span>
                    )}
                  </span>
                </td>
                <td>
                  <span className="TournamentInfoLeaderboard_tableCell TournamentInfoLeaderboard_tablePrize">
                    <span className="IconValue_root FormattedAmount_root">
                      <img alt="USD" height="16" src="/icons/fiat/USD.svg" width="16" />
                      {row.prize}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="Pagination_root">
        {page > 1 && (
          <li className="Pagination_item">
            <button type="button" aria-label="previous page" onClick={() => setPage(page - 1)}>
              <img alt="arrow right" className="Pagination_left" src="/icons/chevron.svg" />
            </button>
          </li>
        )}
        {items.map((it, i) =>
          it === "…" ? (
            <li key={`e${i}`} className="Pagination_item">
              ...
            </li>
          ) : (
            <li key={it} className="Pagination_item">
              <button className={it === page ? "Pagination_active" : ""} type="button" onClick={() => setPage(it)}>
                {it}
              </button>
            </li>
          )
        )}
        {page < total && (
          <li className="Pagination_item">
            <button type="button" aria-label="next page" onClick={() => setPage(page + 1)}>
              <img alt="arrow right" className="Pagination_right" src="/icons/chevron.svg" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function TournamentPanel({ panel }) {
  const target = panel.endsAt ? Date.parse(panel.endsAt) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(target)) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const left = Math.max(0, Math.floor((target - now) / 1000));
  const parts = Number.isNaN(target)
    ? []
    : [
        [Math.floor(left / 86400), "Days"],
        [Math.floor((left % 86400) / 3600), "Hours"],
        [Math.floor((left % 3600) / 60), "Minutes"],
        [left % 60, "Seconds"],
      ];
  const rows = [
    ["Ends", panel.ends],
    ["Prize Pool", panel.prizePool],
    ["Prize Split", panel.prizeSplit],
  ].filter((r) => r[1]);
  return (
    <>
      {parts.length > 0 && (
        <div className="TournamentCounter_root">
          <div className="TournamentCounter_countDown">
            {parts.map(([value, label]) => (
              <div key={label} className="TournamentCounter_countDownItem">
                <span>{value}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="ModalListContainer_root">
          {rows.map(([label, value]) => (
            <div key={label} className="ModalListContainer_item">
              <span className="ModalListContainer_label">{label}</span>
              <span className="ModalListContainer_value">{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function QualifyingGames({ games = [], viewAll }) {
  const { trackRef, carousel } = useCarousel();
  const list = Array.isArray(games) ? games : [];
  if (!list.length) return null;
  return (
    <section className="CasinoTournamentContent_carousel">
      <CarouselHeader className="CasinoTournamentContent_carouselHeader" href={viewAll} carousel={carousel}>
        <a
          className="TextLink_root"
          href={viewAll || "#"}
          onClick={(e) => {
            if (!viewAll) return;
            e.preventDefault();
            navigate(viewAll);
          }}
        >
          Qualifying Games
        </a>
      </CarouselHeader>
      <SwipeTrack trackRef={trackRef} carousel={carousel} className="CasinoTournamentContent_carouselContent">
        {list.map((g, i) => (
          <GameCard key={g.href + i} game={g} index={i} indicator={g.indicator} />
        ))}
      </SwipeTrack>
    </section>
  );
}

/**
 * Shuffle blog / promotion article HTML — accordions, in-app links, optional tournament embeds.
 */
export default function ArticleBody({ html, board, panel }) {
  const ref = useRef(null);
  const slotRef = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e) => {
      const btn = e.target.closest(".Accordion_accordionHeader");
      if (btn && root.contains(btn)) {
        const acc = btn.closest(".Accordion_root");
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        btn.querySelector(".Accordion_accordionHeaderLeft")?.classList.toggle("Accordion_headingOpen", !open);
        btn.querySelector(".Accordion_chevronWrapper")?.classList.toggle("Accordion_open", !open);
        acc.querySelectorAll(".Accordion_contentHeight .Accordion_content").forEach((c) =>
          c.classList.toggle("Accordion_openContent", !open)
        );
        return;
      }
      const a = e.target.closest("a[href]");
      if (!a || !root.contains(a)) return;
      const href = a.getAttribute("href");
      if (href.startsWith("/")) {
        e.preventDefault();
      if (/^\/(sports\/)?promotions\/|^\/blog(\/|\?)|^\/sports\/|^\/games\/|^\/casino\//.test(href)) navigate(href);
      } else if (href.startsWith("https://shuffle.com/")) {
        e.preventDefault();
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [html]);

  const [head, tail] = html.split('<div class="Flex_root Flex_column Flex_md2"></div>');
  return (
    <>
      <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: head }} />
      {tail !== undefined && panel && <TournamentPanel panel={panel} />}
      {board && tail !== undefined && <Leaderboard board={board} />}
      {tail !== undefined && <div ref={slotRef} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: tail }} />}
    </>
  );
}
