import { Component, Suspense, lazy, useEffect } from "react";

import ExchangeLobby from "../exchange/pages/Exchange/Lobby";
import ExchangeMyBets from "../exchange/pages/Exchange/MyBets";
import ExchangeStatement from "../exchange/pages/Exchange/Statement";
import { exchangeTabOf } from "../exchange/pages/Exchange/model";
import { openSignIn } from "../exchange/components/exchange/stakeGlue";
import { BET_PLACED_EVENT } from "../exchange/services/exchange/bets";
import { USER_DATA_CHANGED } from "../exchange/services/exchange/changeFeed";
import { navigate } from "../exchange/lib/router";
import { usePath } from "../lib/router";
import { useSession } from "../lib/sessionContext";

const ExchangeMatch = lazy(() => import("../exchange/pages/Exchange/Match/index.jsx"));

/** A match page that failed to load (a stale chunk after a deploy) offers the way back. */
class MatchBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rb-exch px-4 py-16 text-center">
        <p className="text-sm text-secondary">This match could not be opened.</p>
        <button type="button" className="button button-m button-second mx-auto mt-4 inline-flex px-6" onClick={() => navigate("/sports")}>
          Back to sports
        </button>
      </div>
    );
  }
}

function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

/** My Bets / Statement need a player: signed out, the sign-in modal over the lobby. */
function AccountRoute({ page: Page }) {
  const { signedIn, restoring } = useSession();
  useEffect(() => {
    if (!signedIn && !restoring) openSignIn();
  }, [signedIn, restoring]);
  if (restoring) return null;
  return signedIn ? <Page /> : <ExchangeLobby />;
}

/**
 * `/sports*` — the owner's native sports exchange (ported from stake's `Pages/sportsPage/SportsExchange`):
 * `/sports` → lobby (`?sport=`), `/sports/live` → In-Play, `/sports/<sport>` → that sport's board,
 * `/sports/match/<sid>/<gmid>` (lazy), `/sports/my-bets`, `/sports/statement`; anything else is the lobby.
 * App only routes here when the owner's `sportsexchange` is on (`lib/gates.js`).
 */
export default function SportsPage() {
  const path = usePath().replace(/\/+$/, "") || "/";
  const { refreshBalances, signedIn } = useSession();

  // A placed bet, a cancel or a settlement moves the platform wallet the header shows.
  useEffect(() => {
    if (!signedIn) return undefined;
    const refresh = () => refreshBalances?.();
    window.addEventListener(BET_PLACED_EVENT, refresh);
    window.addEventListener(USER_DATA_CHANGED, refresh);
    return () => {
      window.removeEventListener(BET_PLACED_EVENT, refresh);
      window.removeEventListener(USER_DATA_CHANGED, refresh);
    };
  }, [signedIn, refreshBalances]);

  if (path === "/sports/live" || path === "/sports/home/live") return <Redirect to="/sports?sport=inplay" />;
  if (path === "/sports/bets") return <Redirect to="/sports/my-bets" />;
  const sport = path.match(/^\/sports\/([^/]+)$/)?.[1];
  if (sport && !["home", "my-bets", "statement"].includes(sport)) {
    return <Redirect to={`/sports?sport=${encodeURIComponent(exchangeTabOf(sport))}`} />;
  }
  const match = path.match(/^\/sports\/match\/([^/]+)\/([^/]+)$/);
  if (match) {
    return (
      <MatchBoundary key={path}>
        <Suspense fallback={null}>
          <div className="rb-exch">
            <ExchangeMatch key={path} sid={decodeURIComponent(match[1])} gmid={decodeURIComponent(match[2])} />
          </div>
        </Suspense>
      </MatchBoundary>
    );
  }
  if (path === "/sports/my-bets") return <AccountRoute page={ExchangeMyBets} />;
  if (path === "/sports/statement") return <AccountRoute page={ExchangeStatement} />;
  return <ExchangeLobby />;
}
