import { useCallback, useMemo, useState } from "react";
import { PoppedGameContext } from "./poppedGameContext";
import { useSession } from "./sessionContext";

/**
 * The popped-out game — the "pop up" control in a game's footer.
 *
 * ── WHY THIS IS APP STATE AND NOT THE PAGE'S ─────────────────────────────
 *
 * Popping a game out does NOT open a browser window. It lifts the game into a
 * small player docked in the corner and sends the player back to the lobby, so
 * the game keeps running while they browse. That only works if the dock
 * outlives the page: held in `GamePage`, it would unmount on the very
 * navigation that is supposed to follow it.
 *
 * `window.open` was the first attempt and was wrong twice over — it is the
 * wrong behaviour, and it is silently swallowed by a popup blocker, which is
 * why the control looked like it did nothing at all.
 *
 * ── ONE AT A TIME ────────────────────────────────────────────────────────
 *
 * The reference docks several and shows them as a strip of tabs. One is held
 * here: a second `pop` replaces the first. The launch is a real money session
 * against a real balance, and quietly keeping several open — each able to take
 * a stake — is not a thing to build before anyone has asked for it.
 *
 * ── THE SESSION IS THE ACCOUNT'S ─────────────────────────────────────────
 *
 * The dock is cleared on sign-out, derived rather than cleared in an effect,
 * the same way `GamePage` derives its own live session: the provider settles
 * the round against the wallet that opened it, so it must not survive into
 * another visitor's browsing.
 */
export function PoppedGameProvider({ children }) {
  const { signedIn } = useSession();
  const [held, setHeld] = useState(null); // { game, session }
  const [minimised, setMinimised] = useState(false);

  const pop = useCallback((game, session) => {
    if (!game || !session) return;
    setHeld({ game, session });
    setMinimised(false);
  }, []);

  const close = useCallback(() => {
    setHeld(null);
    setMinimised(false);
  }, []);

  const value = useMemo(() => {
    const live = signedIn ? held : null;
    return {
      game: live?.game ?? null,
      session: live?.session ?? null,
      minimised,
      pop,
      close,
      setMinimised,
    };
  }, [signedIn, held, minimised, pop, close]);

  return <PoppedGameContext.Provider value={value}>{children}</PoppedGameContext.Provider>;
}
