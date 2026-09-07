'use strict';

const { Router } = require('express');
const { validate } = require('@ibitplay/common');

const v = require('../games.validators');
const { GamesService } = require('../games.service');
const { createControllers } = require('../controllers');

/**
 * A player's own history.
 *
 * Legacy read `?user_id=` on an unauthenticated route, so one request returned
 * any player's game history to anyone who asked. There is no id parameter here.
 */
module.exports = function userRoutes(deps) {
  const ctrl = createControllers({ service: new GamesService(deps) });
  const router = Router();

  /** @legacy GET /api/gis/games/recently-played */
  router.get('/recently-played', validate(v.recentlyPlayed), ctrl.recentlyPlayed);

  /**
   * Favourites. New — there was no store, no route and no legacy equivalent.
   *
   * ── WHY THESE HANG OFF /casino/games AND NOT /user ───────────────────
   *
   * The obvious path is `/user/favourites`, and it is wrong here. Resolving a
   * favourite means reading `gisgamesnew` and `js_games`, and those are in the
   * `casino` domain, which user-service does not load — the model registry
   * lists exactly which domains each service may touch, with the note that a
   * read crossing a boundary goes over HTTP. Putting the list in user-service
   * would mean an internal HTTP hop on every render of the favourites page to
   * fetch data the casino service already has in hand.
   *
   * So the resource lives with the catalogue it is about. `/casino/games/
   * favourites` is also where `recently-played` already sits, and the two are
   * the same kind of thing: a per-player view over the game catalogue.
   *
   * PUT rather than POST, because starring is idempotent — see `addFavourite`.
   */
  router.get('/favourites', validate(v.listFavourites), ctrl.favourites);
  router.put('/favourites/:gameRef', validate(v.favouriteParam), ctrl.addFavourite);
  router.delete('/favourites/:gameRef', validate(v.unfavouriteParam), ctrl.removeFavourite);

  return router;
};
