import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, setAuthLostHandler, tokens } from "./api";
import { auth as authApi, rates as ratesApi, wallet as walletApi } from "./endpoints";
import { primaryBalance } from "./adapters";
import { SessionContext } from "./sessionContext";

/**
 * Who is signed in, and what their wallet says.
 *
 * One provider at the root of the shell. Everything that needs the player —
 * the header, the auth modal, the board's "My Bets" tab — reads it from here
 * rather than lifting state through `AppShell`.
 *
 * ── ON TOKEN STORAGE ─────────────────────────────────────────────────────
 *
 * Both tokens sit in `localStorage`, which means script on this origin can
 * read them. The better arrangement is the refresh token in an httpOnly cookie
 * — but `POST /user/auth/login` returns it in the JSON body today, so that is a
 * backend change and not something to fake here. It is written down in
 * `docs/FRONTEND-BACKEND-INTEGRATION.md` §7 rather than quietly worked around.
 */

/** `status` distinguishes "still checking a stored token" from "definitely signed out". */
const SIGNED_OUT = { user: null, balances: null, status: "anonymous" };

/** Which wallet the header spends from. Per-viewer, so `localStorage` is the right home. */
const CURRENCY_KEY = "shuffle.currency";

/**
 * The fiat currency the header's figure is written in.
 *
 * The live bar shows `₹0.00` beside an ETH mark — the coin names the wallet,
 * the number is its worth in the player's display currency. The backend has no
 * column for that choice (`userconfig` carries theme, language and two
 * notification flags, nothing else), so it lives here. INR is the default
 * because it is what the reference shows and what this platform's own site
 * config is oriented around.
 */
const DISPLAY_KEY = "shuffle.displayCurrency";
const DEFAULT_DISPLAY = "INR";

const readStored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export function SessionProvider({ children }) {
  const [state, setState] = useState(() => ({
    user: null,
    balances: null,
    // A stored token means a session may exist; the shell must not flash the
    // signed-out header before `/auth/me` has answered.
    status: tokens.access() ? "restoring" : "anonymous",
  }));

  /**
   * The currency in the header.
   *
   * Remembered per browser, but never trusted blindly — a stored code the
   * wallet no longer returns would render a pill with no balance behind it, so
   * `currency` below falls back to the account's own biggest holding whenever
   * the stored one is not in the response.
   */
  const [preferred, setPreferred] = useState(() => readStored(CURRENCY_KEY));
  const [displayCurrency, setDisplayCurrency] = useState(
    () => readStored(DISPLAY_KEY) || DEFAULT_DISPLAY
  );

  /** USD-per-unit for every currency the platform prices. Public, so read once at mount. */
  const [rates, setRates] = useState(null);

  const chooseCurrency = useCallback((code) => {
    setPreferred(code);
    try {
      localStorage.setItem(CURRENCY_KEY, code);
    } catch {
      /* private mode — the choice lasts for this page only */
    }
  }, []);

  const chooseDisplayCurrency = useCallback((code) => {
    setDisplayCurrency(code);
    try {
      localStorage.setItem(DISPLAY_KEY, code);
    } catch {
      /* private mode — the choice lasts for this page only */
    }
  }, []);

  const signOutLocal = useCallback(() => {
    tokens.clear();
    setState(SIGNED_OUT);
  }, []);

  // A refresh that fails is the end of the session, and it can happen inside
  // any request. The api layer calls this when that happens.
  useEffect(() => {
    setAuthLostHandler(signOutLocal);
    return () => setAuthLostHandler(() => {});
  }, [signOutLocal]);

  const loadBalances = useCallback(async () => {
    try {
      const balances = await walletApi.balances();
      setState((s) => (s.user ? { ...s, balances } : s));
      return balances;
    } catch {
      // A wallet read failing must not sign anybody out — the header just shows
      // nothing where the balance goes.
      return null;
    }
  }, []);

  /** Restore from a stored token on first paint. */
  useEffect(() => {
    if (state.status !== "restoring") return undefined;
    let cancelled = false;

    (async () => {
      try {
        const user = await authApi.me();
        if (cancelled) return;
        setState({ user, balances: null, status: "authenticated" });
      } catch (error) {
        if (cancelled) return;
        // 401 means the stored token is spent and the refresh (already tried by
        // the api layer) did not save it. Anything else — the gateway being
        // down, say — is not proof the session is invalid, but there is no user
        // object to render either way.
        if (!(error instanceof ApiError) || error.status === 401) tokens.clear();
        setState(SIGNED_OUT);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.status]);

  /**
   * The price table.
   *
   * A public route, and the same table for everybody, so it is read once when
   * the provider mounts rather than per signed-in session. A failure leaves
   * `rates` null and the header falls back to the coin's own amount.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await ratesApi.all();
        if (!cancelled) setRates(list);
      } catch {
        /* no price table — `displayFiat` falls back on its own */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Pull the wallet once a user is known. Later refreshes go through `refreshBalances`. */
  useEffect(() => {
    if (state.status !== "authenticated" || state.balances) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const balances = await walletApi.balances();
        if (!cancelled) setState((s) => (s.user ? { ...s, balances } : s));
      } catch {
        // A wallet read failing must not sign anybody out — the header just
        // shows its zero state where the balance goes.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.status, state.balances]);

  const login = useCallback(async (identifier, password, extra) => {
    const session = await authApi.login(identifier, password, extra);
    tokens.set(session);
    setState({ user: session.user, balances: null, status: "authenticated" });
    return session;
  }, []);

  /**
   * Register, then sign in.
   *
   * `POST /auth/register` deliberately does not open a session — it answers
   * `{id, name, email}` and no token, and the backend's own comment says the
   * client calls `login` next. That second call is made here so the user is not
   * asked to type the password they just typed.
   */
  const register = useCallback(
    async (body) => {
      const created = await authApi.register(body);
      await login(body.username, body.password);
      return created;
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout(tokens.refresh());
    } catch {
      // The server-side revoke failing does not keep the user signed in here.
    }
    signOutLocal();
  }, [signOutLocal]);

  const value = useMemo(() => {
    const balances = state.balances;
    // A stored preference wins only if the wallet still carries that code;
    // otherwise fall back to whatever the account actually holds most of.
    const currency =
      preferred && balances && preferred in balances ? preferred : primaryBalance(balances).currency;

    return {
      user: state.user,
      balances,
      status: state.status,
      signedIn: state.status === "authenticated" && Boolean(state.user),
      /** True only while a stored token is still being checked. */
      restoring: state.status === "restoring",
      /** True while the wallet read for a known user is still in flight. */
      loadingBalances: state.status === "authenticated" && !balances,
      currency,
      setCurrency: chooseCurrency,
      displayCurrency,
      setDisplayCurrency: chooseDisplayCurrency,
      rates,
      login,
      register,
      logout,
      refreshBalances: loadBalances,
    };
  }, [state, preferred, chooseCurrency, displayCurrency, chooseDisplayCurrency, rates, login, register, logout, loadBalances]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
