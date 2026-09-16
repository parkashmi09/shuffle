import { createContext, useContext } from "react";

/**
 * The favourites context and its accessor, kept apart from the provider for
 * the same reason `sessionContext.js` is: a module exporting both a component
 * and a plain function loses fast refresh.
 */
export const FavouritesContext = createContext(null);

/**
 * The player's starred games.
 *
 * Safe to call anywhere — outside the provider, and signed out, it answers a
 * list nobody has starred and a `toggle` that asks the visitor to sign in. So
 * a tile does not have to know whether there is a session behind it.
 */
export function useFavourites() {
  return useContext(FavouritesContext) || EMPTY;
}

const EMPTY = {
  rows: [],
  refs: new Set(),
  loading: false,
  signedIn: false,
  has: () => false,
  toggle: () => {},
  reload: () => {},
};
