import { useApi } from "./useResource";
import { loadSiteFeatures } from "./siteFeatures";

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

export function useSiteFeatures() {
  const { data } = useApi("site:features", () => loadSiteFeatures({ apiBase: API_ORIGIN }));
  return data ?? OPEN;
}
