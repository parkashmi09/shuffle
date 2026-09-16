import { createContext, useContext } from "react";

/**
 * The popped-out game, and its accessor.
 *
 * Kept apart from the provider for the same reason `sessionContext.js` and
 * `favouritesContext.js` are: a module exporting both a component and a plain
 * function loses fast refresh.
 */
export const PoppedGameContext = createContext(null);

/**
 * The game currently docked in the corner, if any.
 *
 * Safe to call anywhere — outside the provider it answers an empty dock and a
 * `pop` that does nothing, so a page does not have to know whether the shell
 * is above it.
 */
export function usePoppedGame() {
  return useContext(PoppedGameContext) || EMPTY;
}

const EMPTY = {
  game: null,
  session: null,
  minimised: false,
  pop: () => {},
  close: () => {},
  setMinimised: () => {},
};
