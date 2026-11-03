import { useApi } from "./useResource";
import { loadSiteFeatures } from "./siteFeatures";
import { get } from "./api";
import { useSiteVersion } from "./siteLive";

/**
 * What this deployment offers — the operator's feature policy.
 *
 * `siteFeatures.js` beside this file is GENERATED from the shared CFZ kit
 * (`admins/frontend-kit/siteFeatures.js`), so it is not edited here and it
 * does its own `fetch` rather than going through `lib/api`. This hook is the
 * seam: it gives the rest of the app the same shape every other site-wide
 * read has — `usePublicSiteConfig` next door — without touching a file the
 * generator will overwrite.
 *
 * ── THIS DECIDES WHAT TO DRAW, NOT WHAT IS ALLOWED ──────────────────────
 *
 * Hiding the Register button on a B2B site is a courtesy, not a control. The
 * backend refuses what its policy forbids whether or not the button was
 * rendered, and it answers with a message a player can read. So nothing here
 * needs to be defensive, and a failed read must never hide a working cashier:
 * `loadSiteFeatures` never rejects, and its fallback is TODAY'S behaviour —
 * every route open.
 *
 * ── WHY `apiBase` IS NOT `lib/api`'s BASE ───────────────────────────────
 *
 * The kit builds its own `${apiBase}/api/v1/...`, where `lib/api` stores the
 * whole prefix. Passing `BASE` straight through would ask for
 * `/api/v1/api/v1/admin/features/public`, so the version suffix comes off and
 * the empty default leaves a same-origin path the dev proxy already handles.
 */
const API_ORIGIN = String(import.meta.env.VITE_API_BASE || "").replace(/\/api\/v1\/?$/, "");

/** Permissive until the read lands — see the note above about not hiding a cashier. */
const OPEN = {
  canSignUp: () => true,
  policy: () => null,
  variant: () => null,
  config: () => ({}),
  depositRoutes: () => ({ manual: true, automatic: true }),
  withdrawalRoutes: () => ({ manual: true, automatic: true }),
};

/* The kit caches its one read for the page's life, so a live owner save (`featuresUpdated`,
   lib/siteLive.js) is read here instead, into the kit's own shape (its `wrap`, kept in step). */
const DEFAULTS = { business_model: "hybrid", deposit_mode: "both", withdrawal_mode: "both" };
const routes = (mode) => ({ manual: mode === "manual" || mode === "both", automatic: mode === "automatic" || mode === "both" });
function wrap(list) {
  const byKey = new Map(list.map((f) => [f.feature, f]));
  const policy = (key) => byKey.get(key)?.variant ?? DEFAULTS[key];
  return {
    list,
    policy,
    variant: (key) => byKey.get(key)?.variant ?? null,
    config: (key) => byKey.get(key)?.config ?? {},
    canSignUp: () => policy("business_model") !== "b2b",
    depositRoutes: () => routes(policy("deposit_mode")),
    withdrawalRoutes: () => routes(policy("withdrawal_mode")),
  };
}
let fresh = null;
const loadFresh = (v) => (fresh?.v === v ? fresh : (fresh = { v, p: get("/admin/features/public", { auth: false }).then((rows) => wrap(Array.isArray(rows) ? rows : [])) })).p;

export function useSiteFeatures() {
  const v = useSiteVersion("features");
  const { data } = useApi(`site:features:${v}`, () => (v === 0 ? loadSiteFeatures({ apiBase: API_ORIGIN }) : loadFresh(v)));
  return data ?? OPEN;
}
