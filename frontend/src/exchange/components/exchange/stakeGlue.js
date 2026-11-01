/* shuffle (from stake): the non-component glue the ported exchange (hash-game-exchange, via rainbet) imports in
   place of react-router-dom, the hash toast, the media-query hook and the sign-in route. */
import { useMemo } from 'react';
import { navigate, usePath, useSearch } from '../../lib/router';
import { alertError, alertSuccess } from '../../lib/alerts';
import useMediaQuery from '../../lib/useMediaQuery';

/** The sports prefix (hash serves the exchange at `/sports` too). */
export const SPORTS_BASE = '/sports';

export const toast = { success: alertSuccess, error: alertError };

/** `navigate(to, { replace })`, as react-router's. */
export const useNavigate = () => navigate;

export function useLocation() {
  return { pathname: usePath(), search: useSearch() };
}

/** `[URLSearchParams, set(next, { replace })]`, as react-router's; a set keeps the scroll. */
export function useSearchParams() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = (next, { replace = false } = {}) => {
    const q = new URLSearchParams(next).toString();
    navigate(`${window.location.pathname}${q ? `?${q}` : ''}`, { replace, scroll: false });
  };
  return [params, set];
}

/** hash's `useIsDesktop` (lg = 1024px). */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/* shuffle: hash navigates to `/login/signin`; shuffle opens its sign-in modal (AppShell's `shuffle:auth`). */
export const openSignIn = () => window.dispatchEvent(new CustomEvent('shuffle:auth', { detail: 'login' }));
