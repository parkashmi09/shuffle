import { useState } from "react";
import { GameCard } from "./GameCarousel";
import { navigate } from "../../lib/router";

const PAGE = 28;

/** Category tab view — reference `CardGrid`: heading, responsive grid, "Show More" footer. */
export default function CategoryGrid({ title, icon, href, games, total }) {
  const [count, setCount] = useState(PAGE);
  const visible = games.slice(0, count);
  const all = total ?? games.length;

  return (
    <div>
      <div className="CardGrid_cardGridWrapper">
        <h3 className="Heading_root Heading_h3">
          <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}>
            <div className="Flex_root Flex_sm4" style={{ alignItems: "center", justifyContent: "center" }}>
              <img alt={title} height="24" src={icon} width="24" />
              {title}
            </div>
          </a>
        </h3>

        <div className="CardGrid_cardGridElement">
          {visible.map((g, i) => (
            <GameCard key={g.href + i} game={g} index={i % 7} />
          ))}
        </div>

        <p className="CardGrid_cardGridDisplayingText CardGrid_padding" style={{ textAlign: "center" }}>
          Displaying {visible.length} of {all} games
        </p>

        {count < games.length && (
          <button className="ShowMoreBackground_root CardGrid_background" type="button" onClick={() => setCount((c) => c + PAGE)}>
            <div className="ShowMore_button">
              <div className="CircularLoadingIndicator_rotatingAnimationWrapper">
                <svg width="16" height="16" version="1.1" viewBox="0 0 200 200">
                  <title>loading</title>
                  <circle r="80" cx="100" cy="100" fill="transparent" strokeDasharray="502.64" strokeDashoffset="0" />
                  <circle className="CircularLoadingIndicator_bar" r="80" cx="100" cy="100" fill="transparent" strokeDasharray="502.64" strokeDashoffset="0" />
                </svg>
              </div>
              <p>Show More</p>
              <img alt="arrow down" src="/icons/chevron.svg" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
