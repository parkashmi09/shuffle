import React from "react";

import FacetCurationPage from "./game-curation/FacetCurationPage";
import { ENDPOINTS } from "../services/endpoints";

/**
 * Per-vendor ordering, over the catalogue the site renders.
 *
 * ── THIS SCREEN USED TO ORDER A CATALOGUE NOBODY SEES ────────────────────
 *
 * It wrote to `/admin/casino/games/priority/:vendor`, which orders
 * `gisgamesnew` — the Slotegrator aggregator table, addressed by `uuid`. The
 * site lists `js_games` and opens games with `js-games/v2/launch`, which takes
 * a `game_uid` and cannot open an aggregator uuid at all. So the order an
 * operator built here was applied to rows the lobby never reads, naming games
 * it cannot launch: the screen worked, saved, and changed nothing a player
 * could see.
 *
 * It writes `js_game_curation` now, which `listGamesV1` reads on every lobby
 * request. The 1,000 lines of table, picker and reorder logic this file used
 * to hold are in `game-curation/` and shared with the other three screens.
 */
const VendorPriority: React.FC = () => (
  <FacetCurationPage
    scope="vendor"
    facetsPath={ENDPOINTS.casinoJsCuration.vendors}
    heading="Vendor Priority"
    blurb="Order a vendor's games. The ones at the top lead that vendor's lobby listing on the site."
    listTitle="Vendors"
    noun="vendor"
  />
);

export default VendorPriority;
