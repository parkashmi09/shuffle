'use strict';

// `where` is aliased because the name collides with the plain `where` objects
// this file builds everywhere; `whereExpr` says it is the function form.
const { Op, fn, col, literal, where: whereExpr } = require('sequelize');

const E = require('./games.errors');
const {
  COLLECTIONS,
  GAME_FIELDS,
  GAME_SUMMARY_FIELDS,
  MAX_COLLECTION_SIZE,
  RECENTLY_PLAYED_LIMIT,
  FAVOURITES_LIMIT,
} = require('./games.constants');

/**
 * The local game catalogue and the curation on top of it.
 *
 * Everything here reads `gisgamesnew`, which the Slotegrator sync fills. No
 * money moves through this module; the wallet callback lives in `gis`.
 *
 * ── WHAT CHANGED ─────────────────────────────────────────────────────────
 *
 * EVERY CURATION ENDPOINT WAS UNAUTHENTICATED. `POST /api/gis/admin/gis/hotgames`
 * and its four siblings, both priority setters, and `PUT /admin/gis/games/:uuid/image`
 * were mounted with no guard at all — the routes file even carries the comment
 * `// Admin (protect this)`. Anyone who could reach the server could rewrite the
 * front page of the casino and point every game tile at an image of their
 * choosing. They are admin-audience routes here, so the module loader attaches
 * staff auth and a module physically cannot forget it.
 *
 * TWO ENDPOINTS RETURNED 500 UNCONDITIONALLY.
 *   `GET /api/gis/gamesgis/provider/:provider` called a bare `getGamesgis(...)`,
 *   which is a property of the exported object and not a binding in scope —
 *   a ReferenceError on every request.
 *   `GET /api/gis/game-tags` and `GET /api/gis/games/provider` both called
 *   `pag(r.headers)`, and `pag` is not defined anywhere in the file.
 *
 * PRIORITIZED GAMES APPEARED TWICE. The priority overlay was applied only on
 * page 1, and later pages were a plain `ORDER BY name` with no exclusion — so a
 * prioritized game showed at the top of page 1 and again in its alphabetical
 * position further in. Priority is a stable ordering over the whole result set
 * here, so each game appears once.
 *
 * STATS READ A DIFFERENT CATALOGUE. `getGameStats` counted `gis_games` while
 * every other endpoint read `gisgamesnew`, and the `syncGames` that fills
 * `gis_games` truncates it first. The numbers described a table nothing served
 * from, and were zero for the length of a sync.
 */
class GamesService {
  constructor({ models, db, config, logger, clients }) {
    this.models = models;
    this.db = db;
    this.config = config;
    this.logger = logger;
    this.clients = clients;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Browsing
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @legacy GET /api/gis/gamesgis
   *
   * The lobby listing: filters, then the curated ordering for the vendor or
   * type in play, then everything else alphabetically.
   */
  async browse(query) {
    const { page, limit, ...filters } = query;
    const where = this.#filterClause(filters);
    const order = this.#order(filters.is_mobile);

    const total = await this.models.Gisgamesnew.count({ where });
    const priorityIds = await this.#priorityFor(filters);

    if (!priorityIds.length) {
      const rows = await this.models.Gisgamesnew.findAll({
        where,
        attributes: [...GAME_FIELDS],
        order,
        limit,
        offset: (page - 1) * limit,
        raw: true,
      });
      return { rows, total, prioritizedApplied: false };
    }

    return {
      rows: await this.#pageWithPriority({ where, order, priorityIds, page, limit }),
      total,
      prioritizedApplied: true,
    };
  }

  /**
   * One game, by its catalogue uuid.
   *
   * The game screen's own read. Nothing else could answer it: `browse` pages a
   * filtered list and `search` matches a NAME, so a page opened from a link —
   * or reloaded, or shared — had no way to turn the uuid in its URL back into
   * a game, and the only alternative was to carry the row through client-side
   * navigation state and show nothing to anyone who arrived directly.
   *
   * `GAME_FIELDS` and not a narrower projection: this is the same row the
   * lobby tile was built from, so the screen behind the tile can render the
   * artwork and the provider without a second read.
   */
  async byUuid(uuid) {
    const row = await this.models.Gisgamesnew.findOne({
      where: { uuid },
      attributes: [...GAME_FIELDS],
      raw: true,
    });
    if (!row) throw E.NOT_FOUND({ uuid });
    return row;
  }

  /**
   * @legacy GET /api/gis/gamesgis/provider/:provider — 500 on every request.
   */
  async browseByProvider({ provider, ...query }) {
    const result = await this.browse({ ...query, provider });
    if (!result.total) throw E.PROVIDER_NOT_FOUND({ provider });
    return result;
  }

  /**
   * A page of the result set with the curated games ordered first.
   *
   * Two disjoint sets — prioritized-and-matching, and everything else — walked
   * as if they were one list. That keeps the ordering stable across pages,
   * which the SQL version only managed for page 1.
   */
  async #pageWithPriority({ where, order, priorityIds, page, limit }) {
    const offset = (page - 1) * limit;

    // Only the curated games that survive the current filters count towards
    // the priority block; a game hidden by `?technology=` must not hold a slot.
    const promoted = await this.models.Gisgamesnew.findAll({
      where: { ...where, uuid: { [Op.in]: priorityIds } },
      attributes: [...GAME_FIELDS],
      raw: true,
    });

    const rank = new Map(priorityIds.map((uuid, index) => [uuid, index]));
    promoted.sort((a, b) => rank.get(a.uuid) - rank.get(b.uuid));

    const rows = promoted.slice(offset, offset + limit);
    if (rows.length === limit) return rows;

    const rest = await this.models.Gisgamesnew.findAll({
      where: { ...where, uuid: { [Op.notIn]: priorityIds } },
      attributes: [...GAME_FIELDS],
      order,
      limit: limit - rows.length,
      offset: Math.max(0, offset - promoted.length),
      raw: true,
    });

    return [...rows, ...rest];
  }

  /**
   * Which curated ordering applies, if any.
   *
   * A type filter wins over a provider filter — legacy's precedence, kept
   * because the type lists were added later and deliberately override.
   */
  async #priorityFor({ type, provider }) {
    if (type) {
      const row = await this.#findPriority(this.models.GisPrioritizedTypes, 'type', type);
      const ids = this.#splitIds(row?.game_ids);
      if (ids.length) return ids;
    }

    if (provider) {
      const row = await this.#findPriority(this.models.GisPrioritizedGames, 'vendor', provider);
      return this.#splitIds(row?.game_ids);
    }

    return [];
  }

  #filterClause({ provider, type, category, search, technology, has_lobby: hasLobby, has_freespins: hasFreespins }) {
    const where = {};

    // Case-insensitive equality, as legacy's `LOWER(x) = LOWER(?)` was — a
    // vendor saved as "Evolution" must match a filter of "evolution".
    if (provider) where.provider = { [Op.iLike]: provider };
    if (type) where.type = { [Op.iLike]: type };

    /**
     * `category` is the NORMALISED type, and `type` is the provider's own.
     *
     * ── WHY BOTH EXIST ───────────────────────────────────────────────────
     *
     * `type` is an exact match against whatever the provider wrote, and this
     * catalogue's providers wrote five different words for one thing:
     * `Slot Game`, `Slots`, `Slot`, `slot`, `Video Slot`. So `?type=slots`
     * matches 310 rows out of 1,362 that are slots, and no single value
     * matches them all — which is why the browse pages could not be filtered
     * by a category at all and fell back to captured lists.
     *
     * The import writes one normalised word per row into `tags` (see seeder
     * 004): `slots`, `live`, `table`, `crash`, `arcade`, `fishing`, `lottery`,
     * `lobby`, `other`. `category` matches THAT, so `?category=slots` is all
     * 1,362 of them.
     *
     * `type` is left exactly as it was: an operator filtering on a provider's
     * own word is a different question, and the admin pickers ask it.
     */
    if (category) where.tags = { [Op.contains]: [String(category).toLowerCase()] };
    if (technology) where.technology = { [Op.iLike]: technology };
    if (search) where.name = { [Op.iLike]: `%${search}%` };
    if (hasLobby !== undefined) where.has_lobby = hasLobby;
    if (hasFreespins !== undefined) where.has_freespins = hasFreespins;

    return where;
  }

  /** `is_mobile` sorts, it does not filter. */
  #order(isMobile) {
    const byName = ['name', 'ASC'];
    if (isMobile === undefined) return [byName];
    return [['is_mobile', isMobile ? 'DESC' : 'ASC'], byName];
  }

  /**
   * @legacy GET /api/gis/gamesgis/stats
   *
   * Read from `gisgamesnew`, which is what the lobby serves. Legacy counted
   * `gis_games`, a second catalogue filled by a different sync that truncates
   * before it repopulates.
   */
  async stats() {
    const [totals] = await this.models.Gisgamesnew.findAll({
      attributes: [
        [fn('COUNT', col('id')), 'total_games'],
        [fn('COUNT', fn('DISTINCT', col('provider'))), 'total_providers'],
        [fn('COUNT', fn('DISTINCT', col('type'))), 'total_types'],
        // Aggregate filters have no `fn()` form, so they are written out. The
        // text is fixed — no request value reaches it.
        [literal('COUNT(*) FILTER (WHERE has_lobby)'), 'games_with_lobby'],
        [literal('COUNT(*) FILTER (WHERE is_mobile)'), 'mobile_games'],
        [literal('COUNT(*) FILTER (WHERE has_freespins)'), 'games_with_freespins'],
      ],
      raw: true,
    });

    const grouped = async (column, limit) =>
      this.models.Gisgamesnew.findAll({
        attributes: [[col(column), column], [fn('COUNT', col('id')), 'game_count']],
        where: { [column]: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
        group: [column],
        order: [[fn('COUNT', col('id')), 'DESC']],
        ...(limit ? { limit } : {}),
        raw: true,
      });

    return {
      stats: this.#numeric(totals),
      topProviders: await grouped('provider', 10),
      gameTypes: await grouped('type'),
    };
  }

  /** Postgres returns COUNT as a string; the shape says these are numbers. */
  #numeric(row) {
    return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v)]));
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Curated collections
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @legacy GET /api/gis/hotgames, /livecasino, /popularslots, /crashgames,
   *         /indiangames
   */
  async collection({ collection, page, limit }) {
    const { model, key } = this.#collection(collection);

    const row = await this.models[model].findOne({ where: { key }, raw: true });
    const ids = this.#splitIds(row?.game_uuids);
    if (!ids.length) return { rows: [], total: 0 };

    const games = await this.models.Gisgamesnew.findAll({
      where: { uuid: { [Op.in]: ids } },
      attributes: [...GAME_FIELDS],
      raw: true,
    });

    // Curated ORDER is the point of a collection, so it is restored here rather
    // than left to whatever the database returns.
    const rank = new Map(ids.map((uuid, index) => [uuid, index]));
    games.sort((a, b) => rank.get(a.uuid) - rank.get(b.uuid));

    const offset = (page - 1) * limit;
    return { rows: games.slice(offset, offset + limit), total: games.length };
  }

  /**
   * @legacy POST /api/gis/admin/gis/hotgames and its four siblings —
   *         all unauthenticated.
   */
  async setCollection({ collection, uuids, actor }) {
    const { model, key, label } = this.#collection(collection);
    const clean = await this.#verifiedIds(uuids);

    await this.models[model].upsert({ key, game_uuids: clean.join(',') || null });

    this.logger?.info(
      { collection, count: clean.length, staffId: actor?.id },
      'Lobby collection replaced'
    );

    return { collection, label, count: clean.length, uuids: clean };
  }

  #collection(slug) {
    const found = COLLECTIONS[slug];
    if (!found) throw E.UNKNOWN_COLLECTION({ collection: slug });
    return found;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Per-vendor and per-type priority
  // ══════════════════════════════════════════════════════════════════════

  /** @legacy GET /api/gis/admin/gis/vendors */
  async vendorList() {
    const [counts, configured] = await Promise.all([
      this.models.Gisgamesnew.findAll({
        attributes: [['provider', 'vendor'], [fn('COUNT', col('id')), 'total']],
        where: { provider: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
        group: ['provider'],
        order: [['provider', 'ASC']],
        raw: true,
      }),
      this.models.GisPrioritizedGames.findAll({ attributes: ['vendor', 'updated_at'], raw: true }),
    ]);

    const byVendor = new Map(configured.map((r) => [String(r.vendor).toLowerCase(), r]));

    return counts.map((row) => {
      const match = byVendor.get(String(row.vendor).toLowerCase());
      return {
        vendor: row.vendor,
        total: Number(row.total),
        has_priority: Boolean(match),
        priority_updated_at: match?.updated_at ?? null,
      };
    });
  }

  /** @legacy GET /api/gis/admin/gis/types */
  async typeList() {
    const [counts, configured] = await Promise.all([
      this.models.Gisgamesnew.findAll({
        attributes: ['type', [fn('COUNT', col('id')), 'total']],
        where: { type: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
        group: ['type'],
        order: [['type', 'ASC']],
        raw: true,
      }),
      this.models.GisPrioritizedTypes.findAll({ attributes: ['type', 'updated_at'], raw: true }),
    ]);

    const byType = new Map(configured.map((r) => [String(r.type).trim().toLowerCase(), r]));

    return counts.map((row) => {
      const match = byType.get(String(row.type).trim().toLowerCase());
      return {
        type: String(row.type).trim(),
        total: Number(row.total),
        has_priority: Boolean(match),
        priority_updated_at: match?.updated_at ?? null,
      };
    });
  }

  /** @legacy GET /api/gis/admin/gis/priority/:vendor */
  async vendorPriority({ vendor }) {
    return this.#readPriority(this.models.GisPrioritizedGames, 'vendor', vendor);
  }

  /** @legacy GET /api/gis/admin/gis/type-priority/:type */
  async typePriority({ type }) {
    return this.#readPriority(this.models.GisPrioritizedTypes, 'type', type);
  }

  /** @legacy POST /api/gis/admin/gis/priority/:vendor — unauthenticated. */
  async setVendorPriority({ vendor, uuids, actor }) {
    return this.#writePriority(this.models.GisPrioritizedGames, 'vendor', vendor, uuids, actor);
  }

  /** @legacy POST /api/gis/admin/gis/type-priority/:type — unauthenticated. */
  async setTypePriority({ type, uuids, actor }) {
    return this.#writePriority(this.models.GisPrioritizedTypes, 'type', type, uuids, actor);
  }

  async #readPriority(model, column, value) {
    const row = await this.#findPriority(model, column, value);
    const ids = this.#splitIds(row?.game_ids);

    if (!ids.length) return { [column]: value, updated_at: null, games: [] };

    const games = await this.models.Gisgamesnew.findAll({
      where: { uuid: { [Op.in]: ids } },
      attributes: [...GAME_SUMMARY_FIELDS],
      raw: true,
    });

    const rank = new Map(ids.map((uuid, index) => [uuid, index]));
    games.sort((a, b) => rank.get(a.uuid) - rank.get(b.uuid));

    return { [column]: row[column], updated_at: row.updated_at, games };
  }

  /**
   * Replace a priority list.
   *
   * A single upsert against the unique key added by migration 016. Legacy ran
   * `UPDATE ... WHERE LOWER(vendor) = LOWER($1)` and inserted when it touched
   * zero rows — so two admins saving the same vendor together both updated
   * nothing and both inserted, and from then on which list applied depended on
   * an `ORDER BY updated_at DESC LIMIT 1` between two rows.
   */
  async #writePriority(model, column, value, uuids, actor) {
    const clean = await this.#verifiedIds(uuids);
    const key = String(value).trim();

    await this.db.transaction(async (transaction) => {
      const existing = await this.#findPriority(model, column, key, transaction);

      if (existing) {
        await model.update(
          { game_ids: clean.join(','), updated_at: new Date() },
          { where: { id: existing.id }, transaction }
        );
      } else {
        await model.create({ [column]: key, game_ids: clean.join(',') }, { transaction });
      }
    });

    this.logger?.info({ [column]: key, count: clean.length, staffId: actor?.id }, 'Game priority replaced');

    return { [column]: key, count: clean.length, uuids: clean };
  }

  /**
   * The stored row for a vendor or type, matched case- and whitespace-
   * insensitively — which is how it was written, and how the unique index
   * added by migration 016 keys it.
   */
  #findPriority(model, column, value, transaction) {
    return model.findOne({
      where: whereExpr(fn('LOWER', fn('BTRIM', col(column))), String(value).trim().toLowerCase()),
      order: [['updated_at', 'DESC']],
      raw: true,
      ...(transaction ? { transaction } : {}),
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Search
  // ══════════════════════════════════════════════════════════════════════

  /** @legacy GET /api/gis/admin/gis/games/search */
  async search({ q, limit }) {
    return this.#rankedSearch({ q, limit, where: {} });
  }

  /** @legacy GET /api/gis/admin/gis/vendor-search */
  async searchWithinVendor({ vendor, q, limit }) {
    return this.#rankedSearch({ q, limit, where: { provider: { [Op.iLike]: vendor } } });
  }

  /** @legacy GET /api/gis/admin/gis/type-search */
  async searchWithinType({ type, q, limit }) {
    return this.#rankedSearch({ q, limit, where: { type: { [Op.iLike]: type.trim() } } });
  }

  /**
   * Name-or-uuid search, exact match first, then prefix, then anywhere.
   *
   * Legacy expressed the ranking as a SQL CASE. It is done in JavaScript over
   * a bounded result set instead: the ordering is the same, and it does not
   * need the query text interpolated into an ORDER BY.
   */
  async #rankedSearch({ q, limit, where: scope }) {
    const term = String(q ?? '').trim();
    if (!term) return [];

    const rows = await this.models.Gisgamesnew.findAll({
      where: {
        ...scope,
        [Op.or]: [{ name: { [Op.iLike]: `%${term}%` } }, { uuid: { [Op.iLike]: `%${term}%` } }],
      },
      attributes: [...GAME_SUMMARY_FIELDS],
      // Fetch a little more than asked so the ranking has something to reorder,
      // then cut. Bounded, so a broad term cannot pull the whole catalogue.
      limit: Math.min(limit * 5, 500),
      order: [['name', 'ASC']],
      raw: true,
    });

    const lower = term.toLowerCase();
    const rank = (row) => {
      const name = String(row.name ?? '').toLowerCase();
      const uuid = String(row.uuid ?? '').toLowerCase();
      if (name === lower) return 0;
      if (name.startsWith(lower)) return 1;
      if (uuid.startsWith(lower)) return 2;
      return 3;
    };

    return rows
      .sort((a, b) => rank(a) - rank(b) || String(a.name ?? '').localeCompare(String(b.name ?? '')))
      .slice(0, limit);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Providers
  // ══════════════════════════════════════════════════════════════════════

  /** @legacy GET /api/gis/providersgis */
  async listProviders({ search }) {
    const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};
    const rows = await this.models.GisProviders.findAll({ where, order: [['name', 'ASC']], raw: true });
    return { rows, total: rows.length };
  }

  /** @legacy GET /api/gis/admin/providers */
  async upstreamProviders() {
    return this.models.GisProvidersNew.findAll({
      attributes: ['name', 'enabled'],
      order: [['name', 'ASC']],
      raw: true,
    });
  }

  /**
   * @legacy PUT /api/gis/admin/providers
   *
   * Enable or disable upstream providers. The second factor is verified by
   * admin-service, which owns staff credentials — casino-service must not read
   * a password hash it does not own.
   */
  async setUpstreamProviders({ updates, transactionPassword, actor }) {
    await this.clients.admin.post('/internal/admin/staff-directory/verify-transaction-password', {
      staffId: actor.id,
      transactionPassword,
    });

    await this.db.transaction(async (transaction) => {
      for (const update of updates) {
        await this.models.GisProvidersNew.update(
          { enabled: update.enabled },
          { where: { name: update.name }, transaction }
        );
      }
    });

    this.logger?.warn(
      { staffId: actor.id, updates: updates.map((u) => `${u.name}=${u.enabled}`) },
      'Upstream game providers toggled'
    );

    return this.upstreamProviders();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Editing
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @legacy PUT /api/gis/admin/gis/games/:uuid/image — unauthenticated.
   *
   * The URL is rendered in every player's lobby, so an unchecked value here is
   * stored content injection. It must be an absolute http(s) URL; legacy
   * accepted any non-empty string, including `javascript:` and `data:`.
   */
  async updateImage({ uuid, image, actor }) {
    const url = String(image).trim();
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw E.IMAGE_URL_INVALID({ image: url.slice(0, 120) });

    const [changed] = await this.models.Gisgamesnew.update({ image: url }, { where: { uuid } });
    if (!changed) throw E.NOT_FOUND({ uuid });

    this.logger?.info({ uuid, staffId: actor?.id }, 'Game image replaced');

    return this.models.Gisgamesnew.findOne({
      where: { uuid },
      attributes: ['uuid', 'name', 'image'],
      raw: true,
    });
  }

  /**
   * Resolve opaque game references against BOTH catalogues.
   *
   * Extracted from `favourites`, which was the first caller; `recentlyPlayed`
   * is the second, and that is the rule this codebase already follows. Neither
   * list has a foreign key — a reference is whatever string named the game
   * when it was stored — so a row that matches neither catalogue resolves to
   * `null` and its caller keeps the row anyway. Legacy's LEFT JOIN did the
   * same, and it is what stops a provider retiring a game from silently
   * emptying somebody's list.
   *
   * Two catalogues, two keys, one query each. Both are indexed on the column
   * being matched, and neither list is long enough to want a union.
   */
  async #resolveGames(refs) {
    const byRef = new Map();
    if (!refs.length) return byRef;

    const [aggregator, inHouse] = await Promise.all([
      this.models.Gisgamesnew.findAll({
        where: { uuid: { [Op.in]: refs } },
        attributes: [...GAME_FIELDS],
        raw: true,
      }),
      this.models.JsGames.findAll({
        where: { game_uid: { [Op.in]: refs } },
        raw: true,
      }),
    ]);

    // In-house first, aggregator second: if one reference somehow named a game
    // in both, the aggregator row is the richer one and wins.
    for (const g of inHouse) {
      byRef.set(g.game_uid, {
        uuid: g.game_uid,
        name: g.game_name,
        provider: g.vendor,
        type: g.game_type,
        image: g.game_icon,
      });
    }
    for (const g of aggregator) byRef.set(g.uuid, g);

    return byRef;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Recently played
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @legacy GET /api/gis/games/recently-played?user_id=
   *
   * The id came from the query string on an unauthenticated route, so any
   * player's history was one request away. It comes from the token now.
   */
  async recentlyPlayed({ userId, limit }) {
    const recent = await this.models.GisRecentlyPlayed.findAll({
      where: { user_id: userId },
      order: [['played_at', 'DESC']],
      limit: Math.min(limit, RECENTLY_PLAYED_LIMIT),
      raw: true,
    });

    if (!recent.length) return [];

    /**
     * BOTH CATALOGUES, not just the aggregator's.
     *
     * This read matched `Gisgamesnew` alone, which was right while only the
     * GIS launch path wrote the table. The in-house launch writes it now, and
     * an in-house `game_uid` is not a GIS `uuid` — so every house game would
     * have come back as a row with `game: null`, present in the list and
     * unnamed. Same resolver the favourites list uses, for the same reason.
     *
     * A game removed from the catalogue since it was played still belongs in
     * the list — legacy's LEFT JOIN kept it too, with every column null.
     */
    const byRef = await this.#resolveGames(recent.map((r) => r.game_uuid));

    return recent.map((r) => ({
      game_uuid: r.game_uuid,
      played_at: r.played_at,
      game: byRef.get(r.game_uuid) ?? null,
    }));
  }

  /**
   * Record a play and trim the list to its cap.
   *
   * Called by the launch path, not by a route. The trim is a single delete of
   * everything older than the cap, which is what the legacy `DELETE ... WHERE
   * id NOT IN (SELECT ... LIMIT 15)` expressed.
   */
  async recordPlay({ userId, gameUuid }) {
    await this.models.GisRecentlyPlayed.upsert({
      user_id: userId,
      game_uuid: gameUuid,
      played_at: new Date(),
    });

    const keep = await this.models.GisRecentlyPlayed.findAll({
      where: { user_id: userId },
      attributes: ['id'],
      order: [['played_at', 'DESC']],
      limit: RECENTLY_PLAYED_LIMIT,
      raw: true,
    });

    if (keep.length < RECENTLY_PLAYED_LIMIT) return;

    await this.models.GisRecentlyPlayed.destroy({
      where: { user_id: userId, id: { [Op.notIn]: keep.map((r) => r.id) } },
    });
  }

  /**
   * The three writes an in-house bet must perform beyond moving the money.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * THE AGGREGATOR PATH DID ALL OF THIS AND THE HOUSE GAMES DID NONE OF IT
   *
   * `gis.service.js` calls `recordPlay` on launch and the aggregator keeps the
   * wager counters moving. The in-house engine wrote its `bets` row and
   * stopped, so three separate features read zero for a player who only ever
   * played house games:
   *
   *   `gis_recently_played` — `/recent` and the home and casino pages'
   *     Continue Playing tab were empty for everybody (gap 2).
   *   `userwager`           — `GET /user/wager/progress` reported
   *     `wagered: 0`, so a wagering requirement could never be met by playing
   *     the platform's own games (gap 19).
   *   `users.games_played`  — `profile.gamesPlayed` stayed 0, and Statistics
   *     printed bets and wins but no amount wagered.
   *
   * ── IT LIVES HERE, NOT IN THE CALLERS ─────────────────────────────────
   *
   * Two paths settle a house bet — `in-house/engine/gameEngine.js`, which is
   * the socket games the platform actually runs, and `js-games`, which is the
   * huidu provider (unconfigured, so it cannot be exercised today). Both need
   * the identical three writes, and `recordPlay` with its trim already lives
   * on this service. A second copy is how two lists drift apart.
   *
   * ── WHY IT IS BEST-EFFORT ─────────────────────────────────────────────
   *
   * The money movement is the contract: it is transactional, and for js-games
   * idempotent on `serial_number` with a provider timeout on the other end.
   * These three are bookkeeping ABOUT that movement. A failed counter must
   * never turn a settled bet into an error the caller retries — that would
   * double a payout to fix a statistic. So each is caught and logged.
   *
   * `increment` rather than read-modify-write: two settlements for one player
   * can land together, and `SET wager = wager + x` in the database is the only
   * version of this that is correct under that.
   */
  async recordActivity({ userId, gameRef, wagered }) {
    try {
      if (gameRef) await this.recordPlay({ userId, gameUuid: gameRef });
    } catch (error) {
      this.logger?.warn({ err: error, userId: String(userId), gameRef }, 'recordPlay failed');
    }

    const amount = wagered == null ? null : String(wagered);
    if (!amount || Number(amount) <= 0) return;

    /**
     * `userwager.wager` IS A `text` COLUMN, so this cannot be an `increment`.
     *
     * Sequelize's `increment` emits `SET wager = wager + 10`, and Postgres
     * answers `operator does not exist: text + unknown` — the same shape of
     * defect as the varchar/bigint comparison that made `timed-rounds` throw
     * (Part 4b.3). It is caught and logged rather than raised, so the failure
     * was SILENT: the first bet created the row and every bet after it left
     * the total untouched. Found by asserting on a second bet rather than a
     * first, which is the only way it shows.
     *
     * `(wager::numeric + n)::text` does the arithmetic in the database, so two
     * settlements landing together still both count — a read-modify-write here
     * would lose one. Interpolated rather than bound because `literal` takes no
     * parameters; `amount` is `money.toDecimalString`'s output and is checked
     * against a decimal pattern below before it goes anywhere near SQL, which
     * is the same guard `gameEngine`'s own debit literal relies on.
     *
     * `uid` is a bigint here, unlike `bets_30s.uid` — no stringification, and
     * the row is created on first use because `userwager` has no row until a
     * player's first bet.
     */
    if (!/^\d+(\.\d+)?$/.test(amount)) {
      this.logger?.warn({ userId: String(userId), amount }, 'refusing a non-decimal wager amount');
      return;
    }

    let previous = '0';
    let next = amount;

    try {
      const [row, created] = await this.models.Userwager.findOrCreate({
        where: { uid: userId },
        defaults: { uid: userId, wager: amount },
      });

      /**
       * `userwager_history` is `(uid, previous_wager, new_wager, updated_at)` —
       * a designed audit trail with no writer anywhere in the delivery, the
       * same shape as `gis_recently_played` before this change. It is written
       * here because this is now the only thing that moves `userwager`, and a
       * rollover page that can show WHEN progress was made is worth the row.
       *
       * Best-effort like everything else in this method: an audit row must
       * never be the reason a settled bet errors.
       */
      previous = created ? '0' : String(row?.wager ?? '0');
      next = created
        ? amount
        : String(Number(String(previous).replace(/,/g, '')) + Number(amount));

      try {
        await this.models.UserwagerHistory.create({
          uid: userId,
          previous_wager: previous,
          new_wager: next,
          updated_at: new Date(),
        });
      } catch (error) {
        this.logger?.warn({ err: error, userId: String(userId) }, 'userwager_history write failed');
      }

      if (!created) {
        /**
         * `replace(…, ',', '')` IS NOT DEFENSIVE PADDING.
         *
         * Legacy stored this column with THOUSANDS SEPARATORS — "1,234,567.89"
         * — and `bonus.service.js`'s `#wagerAmount` exists solely to undo that,
         * with a comment saying a missed `replace` silently makes every player
         * VIP 0. `'1,234'::numeric` does not parse, so without this a single
         * legacy-formatted row would make every later bet by that player throw
         * — and the throw is caught and logged, so their wager would simply
         * stop moving.
         *
         * Rows written here carry no separators, which is the better format and
         * what `#wagerAmount` prefers; this only has to survive meeting an old
         * one.
         */
        await this.models.Userwager.update(
          {
            wager: literal(
              `(COALESCE(replace("wager", ',', ''), '0')::numeric + ${amount})::text`
            ),
          },
          { where: { uid: userId } }
        );
      }
    } catch (error) {
      this.logger?.warn({ err: error, userId: String(userId) }, 'userwager update failed');
      return;
    }

    try {
      await this.models.Users.increment({ games_played: 1 }, { where: { id: userId } });
    } catch (error) {
      this.logger?.warn({ err: error, userId: String(userId) }, 'games_played update failed');
    }

    /**
     * VIP rate sync + level/rank-up credits live on user-service. Best-effort:
     * a loyalty side-effect must never fail a settled bet.
     */
    try {
      if (this.clients?.user) {
        await this.clients.user.post('/internal/user/vip/on-wager', {
          userId,
          previousWager: String(previous).replace(/,/g, ''),
          newWager: String(next).replace(/,/g, ''),
        });
      }
    } catch (error) {
      this.logger?.warn({ err: error, userId: String(userId) }, 'VIP on-wager sync failed');
    }

    try {
      if (this.clients?.user) {
        await this.clients.user.post('/internal/user/affiliate/on-wager', {
          userId,
          previousWager: String(previous).replace(/,/g, ''),
          newWager: String(next).replace(/,/g, ''),
        });
      }
    } catch (error) {
      this.logger?.warn({ err: error, userId: String(userId) }, 'Affiliate on-wager sync failed');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Favourites
  // ══════════════════════════════════════════════════════════════════════

  /**
   * The games this player has starred, newest first.
   *
   * ── THE REFERENCE IS RESOLVED, NOT JOINED ────────────────────────────
   *
   * A favourite is stored as whatever string the client used to name the game
   * (migration 038 argues why), and there are three such strings in play: the
   * aggregator's `gisgamesnew.uuid`, the in-house `js_games.game_uid`, and the
   * client's own slug. So both catalogues are asked, in that order, and a
   * reference that matches neither comes back as `game: null`.
   *
   * `game: null` is a real answer here, not a failure. `recentlyPlayed` one
   * method up does the same for a game that has left the catalogue, and legacy's
   * LEFT JOIN did before either of them. On this delivery it is also the COMMON
   * case: the aggregator catalogue is unsynced and only the twenty in-house
   * games exist, so a player starring anything else gets their reference back
   * and the client draws the tile from its own artwork. Refusing to store those
   * would leave the page as empty as it was before this feature existed.
   */
  async favourites({ userId, limit }) {
    const rows = await this.models.UserFavouriteGames.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: Math.min(limit, FAVOURITES_LIMIT),
      raw: true,
    });

    if (!rows.length) return [];

    const byRef = await this.#resolveGames(rows.map((r) => r.game_ref));

    return rows.map((r) => ({
      game_ref: r.game_ref,
      source: r.source,
      created_at: r.created_at,
      game: byRef.get(r.game_ref) ?? null,
    }));
  }

  /**
   * Star a game.
   *
   * Idempotent by the unique index on `(user_id, game_ref)`: pressing the star
   * twice is the same fact stated twice, not a duplicate row and not a 409 the
   * client has to special-case. The `created_at` is left alone on a repeat, so
   * re-starring does not reorder somebody's list.
   *
   * The cap is checked BEFORE the upsert and only when the row would be new —
   * otherwise a player at the limit could not re-press a star they already have.
   */
  async addFavourite({ userId, gameRef, source }) {
    const existing = await this.models.UserFavouriteGames.findOne({
      where: { user_id: userId, game_ref: gameRef },
      raw: true,
    });
    if (existing) return { game_ref: gameRef, favourite: true };

    const held = await this.models.UserFavouriteGames.count({ where: { user_id: userId } });
    if (held >= FAVOURITES_LIMIT) throw E.TOO_MANY_FAVOURITES({ limit: FAVOURITES_LIMIT });

    await this.models.UserFavouriteGames.create({
      user_id: userId,
      game_ref: gameRef,
      source: source || 'unknown',
      created_at: new Date(),
    });

    return { game_ref: gameRef, favourite: true };
  }

  /**
   * Un-star a game.
   *
   * Removing one that is not there answers the same success. The caller asked
   * for a state, not for an event, and 404 here would make the client handle a
   * race it cannot avoid — two tabs, one star.
   */
  async removeFavourite({ userId, gameRef }) {
    await this.models.UserFavouriteGames.destroy({
      where: { user_id: userId, game_ref: gameRef },
    });
    return { game_ref: gameRef, favourite: false };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Shared
  // ══════════════════════════════════════════════════════════════════════

  /** A stored CSV of uuids → an ordered, de-duplicated array. */
  #splitIds(csv) {
    if (!csv || !String(csv).trim()) return [];

    const seen = new Set();
    const out = [];
    for (const part of String(csv).split(',')) {
      const value = part.trim();
      if (value && !seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
    return out;
  }

  /**
   * De-duplicate, then confirm every uuid is a real game.
   *
   * Legacy stored whatever it was handed. A typo'd uuid was accepted, saved,
   * and then silently dropped by the JOIN that read it back — the list looked
   * saved and came back one game short with nothing to explain it.
   */
  async #verifiedIds(uuids) {
    const seen = new Set();
    const clean = [];
    for (const value of uuids ?? []) {
      const uuid = String(value ?? '').trim();
      if (uuid && !seen.has(uuid)) {
        seen.add(uuid);
        clean.push(uuid);
      }
    }

    if (clean.length > MAX_COLLECTION_SIZE) throw E.COLLECTION_TOO_LARGE({ count: clean.length });
    if (!clean.length) return clean;

    const found = await this.models.Gisgamesnew.findAll({
      where: { uuid: { [Op.in]: clean } },
      attributes: ['uuid'],
      raw: true,
    });

    if (found.length !== clean.length) {
      const known = new Set(found.map((g) => g.uuid));
      throw E.UNKNOWN_GAMES({ unknown: clean.filter((u) => !known.has(u)).slice(0, 20) });
    }

    return clean;
  }
}

module.exports = { GamesService };
