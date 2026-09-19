/* ─────────────────────────────────────────────────────────────────
   Shared types for the js-games curation screens.

   ── ONE CATALOGUE, ONE SHAPE ───────────────────────────────────
   These are `js_games` rows, not aggregator rows: the identifier is
   `game_uid` (what the launcher takes), the title is `game_name`, and the
   tile is `game_icon`. The four curation screens all speak this shape,
   which is why it lives here rather than being re-declared in each of them
   with small differences — the old screens each had their own `Game`
   interface keyed on `uuid`, and they had drifted apart.
   ───────────────────────────────────────────────────────────────── */

export interface JsGame {
  id: number;
  game_uid: string;
  game_name: string;
  game_type: string;
  game_icon: string | null;
  vendor: string | null;
  is_active: boolean;
}

/** What kind of curated list. Matches the backend's `js_game_curation.scope`. */
export type CurationScope = 'vendor' | 'type' | 'collection';

/** One curated list as the API returns it. */
export interface Curation {
  scope: CurationScope;
  key: string;
  /** False when nobody has ever saved this list — different from "saved empty". */
  curated: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  games: JsGame[];
}

/** A row in the vendor / type pickers on the left of those two screens. */
export interface Facet {
  name: string;
  games: number;
  curated: boolean;
  prioritized: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** A row in the collection list. */
export interface CollectionSummary {
  key: string;
  label: string;
  games: number;
  curated: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}
