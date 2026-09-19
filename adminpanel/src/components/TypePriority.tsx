import React from "react";

import FacetCurationPage from "./game-curation/FacetCurationPage";
import { ENDPOINTS } from "../services/endpoints";

/**
 * Per-type ordering, over the catalogue the site renders.
 *
 * Same change as `VendorPriority`: this wrote `/admin/casino/games/type-priority/:type`
 * against the aggregator catalogue, which the site does not list and cannot
 * launch. See the note there.
 */
const TypePriority: React.FC = () => (
  <FacetCurationPage
    scope="type"
    facetsPath={ENDPOINTS.casinoJsCuration.types}
    heading="Type Priority"
    blurb="Order the games within a game type — Slot Game, CasinoLive, Crash and the rest, as the provider labels them."
    listTitle="Game types"
    noun="type"
  />
);

export default TypePriority;
