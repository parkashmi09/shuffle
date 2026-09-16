import { createContext, useContext } from "react";

/**
 * The session context and its accessor, kept apart from the provider.
 *
 * A module that exports both a component and a plain function loses fast
 * refresh — the runtime cannot tell which half changed, so it reloads the page
 * and drops the session it was about to show. Splitting them is the fix.
 */
export const SessionContext = createContext(null);

/** The signed-in player, their wallet, and the actions that change either. */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
