'use strict';

const { z } = require('@ibitplay/common');

const { COLLECTION_SLUGS, MAX_COLLECTION_SIZE, FAVOURITES_LIMIT } = require('./games.constants');

/** A Slotegrator game uuid. Stored as text, so bounded rather than parsed. */
const gameUuid = z.string().trim().min(1).max(190);

const paging = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
};

/**
 * A tri-state boolean from a query string.
 *
 * `?has_lobby=true` means "only those", `=false` means "only those without",
 * and absent means "do not filter". `z.coerce.boolean()` cannot express that:
 * it maps the ABSENT case and the string `"false"` both to a value, and every
 * non-empty string — including `"false"` — to `true`.
 */
const triBool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const browse = {
  query: z
    .object({
      ...paging,
      provider: z.string().trim().max(120).optional(),
      type: z.string().trim().max(120).optional(),
      search: z.string().trim().max(120).optional(),
      technology: z.string().trim().max(60).optional(),
      has_lobby: triBool,
      has_freespins: triBool,
      /**
       * Not a filter — a sort preference. `true` floats mobile games to the
       * top, `false` sinks them. Legacy documented it as a filter in one branch
       * and implemented it as a sort in the other; the sort is what shipped.
       */
      is_mobile: triBool,
    })
    .strict(),
};

const byProvider = {
  params: z.object({ provider: z.string().trim().min(1).max(120) }),
  query: browse.query.omit({ provider: true }),
};

const collectionSlug = z.enum(COLLECTION_SLUGS);

const readCollection = {
  params: z.object({ collection: collectionSlug }),
  query: z
    .object({
      page: paging.page,
      // A curated list is short by design, but an admin picker wants it whole.
      limit: z.coerce.number().int().min(1).max(MAX_COLLECTION_SIZE).default(20),
    })
    .strict(),
};

/**
 * Setting a collection.
 *
 * Legacy accepted either a `uuids` array or a `uuidsCSV` string and quietly
 * ignored anything else, so a typo in the field name saved an empty list over a
 * curated one. One field, required, and `.strict()` refuses the typo.
 */
const writeCollection = {
  params: z.object({ collection: collectionSlug }),
  body: z
    .object({
      uuids: z.array(gameUuid).max(MAX_COLLECTION_SIZE),
    })
    .strict(),
};

const vendorParam = { params: z.object({ vendor: z.string().trim().min(1).max(120) }) };
const typeParam = { params: z.object({ type: z.string().trim().min(1).max(120) }) };

const setVendorPriority = {
  ...vendorParam,
  body: z.object({ uuids: z.array(gameUuid).max(MAX_COLLECTION_SIZE) }).strict(),
};

const setTypePriority = {
  ...typeParam,
  body: z.object({ uuids: z.array(gameUuid).max(MAX_COLLECTION_SIZE) }).strict(),
};

const searchGames = {
  query: z
    .object({
      q: z.string().trim().max(120).default(''),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
    .strict(),
};

const searchWithinVendor = {
  query: searchGames.query.extend({ vendor: z.string().trim().min(1).max(120) }),
};

const searchWithinType = {
  query: searchGames.query.extend({ type: z.string().trim().min(1).max(120) }),
};

const updateImage = {
  params: z.object({ uuid: gameUuid }),
  body: z.object({ image: z.string().trim().min(1).max(2048) }).strict(),
};

const listProviders = {
  query: z.object({ search: z.string().trim().max(120).optional() }).strict(),
};

/**
 * Enabling and disabling upstream providers.
 *
 * `transactionPassword` is carried through because disabling a provider takes
 * its games out of every lobby, and legacy gated it behind the same second
 * factor as a payout. That judgement is kept.
 */
const setProviders = {
  body: z
    .object({
      updates: z
        .array(z.object({ name: z.string().trim().min(1).max(190), enabled: z.boolean() }).strict())
        .min(1)
        .max(500),
      transactionPassword: z.string().min(1).max(200),
    })
    .strict(),
};

/** No `user_id`. Legacy read it from the query, so anyone could read anyone's. */
const recentlyPlayed = {
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(15) }).strict(),
};

/**
 * A favourite's game reference.
 *
 * Bounded, not parsed — the same treatment `gameUuid` above gets and for a
 * stronger reason: this one may be an aggregator uuid, an in-house `game_uid`
 * or the client's own slug, so there is no single format to validate against.
 * 190 is the column. The characters are restricted to what a game identifier
 * can plausibly be, which keeps a path segment from carrying a slash or a
 * space into the store.
 */
const gameRef = z
  .string()
  .trim()
  .min(1)
  .max(190)
  .regex(/^[A-Za-z0-9._:-]+$/, 'A game reference may contain letters, digits and . _ : - only');

const listFavourites = {
  query: z
    .object({ limit: z.coerce.number().int().min(1).max(FAVOURITES_LIMIT).default(40) })
    .strict(),
};

const favouriteParam = {
  params: z.object({ gameRef }),
  /**
   * `source` is what the client BELIEVED it was naming, and it is optional
   * because the read does not depend on it — both catalogues are asked either
   * way. It is stored so that a later migration onto real foreign keys has
   * something to work from instead of guessing.
   */
  body: z
    .object({ source: z.enum(['aggregator', 'in-house', 'unknown']).optional() })
    .strict()
    .optional(),
};

const unfavouriteParam = { params: z.object({ gameRef }) };

module.exports = {
  browse,
  byProvider,
  readCollection,
  writeCollection,
  vendorParam,
  typeParam,
  setVendorPriority,
  setTypePriority,
  searchGames,
  searchWithinVendor,
  searchWithinType,
  updateImage,
  listProviders,
  setProviders,
  recentlyPlayed,
  listFavourites,
  favouriteParam,
  unfavouriteParam,
};
