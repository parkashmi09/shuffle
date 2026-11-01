/*
 * shuffle: the exchange's navigate over shuffle's own history router (lib/router.js). A push or
 * replace is announced as `popstate`, which shuffle's `usePath`/`useSearch` already listen to, so
 * App and the exchange views re-read together. Every `/sports...` path renders the same page in
 * App, so moving between exchange screens never remounts the shell.
 */
export { usePath, useSearch } from '../../lib/router';

export function navigate(to, { replace = false, scroll = true } = {}) {
  const url = new URL(to, window.location.origin);
  const next = url.pathname + url.search;
  if (window.location.pathname + window.location.search === next) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (scroll) document.querySelector('#pageContent')?.scrollTo(0, 0);
}
