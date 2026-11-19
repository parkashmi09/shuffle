/**
 * The wallets a game launches in. `POST /casino/games/launch` takes INR, PKR and USDT (hash's three;
 * its `USD` is no wallet here) and the Original Games aggregator INR and USDT. A JSGames V2 row
 * narrows that with its own `launchCurrencies` (INR only, backend `games.service.js`).
 */
export const LOBBY_LAUNCH_CURRENCIES = Object.freeze(["INR", "PKR", "USDT"]);
export const ORIGINAL_LAUNCH_CURRENCIES = Object.freeze(["INR", "USDT"]);

/** The route's set, narrowed by the game row's own `launchCurrencies`. */
export function launchCurrencies(game, route = LOBBY_LAUNCH_CURRENCIES) {
  const own = Array.isArray(game?.launchCurrencies) ? game.launchCurrencies.map((c) => String(c).toUpperCase()) : null;
  return own ? route.filter((code) => own.includes(code)) : [...route];
}

/** The code the selected wallet launches this game in, or null: no launch, the page asks for another. */
export function launchCurrency(game, currency, route = LOBBY_LAUNCH_CURRENCIES) {
  const code = String(currency ?? "").toUpperCase();
  return launchCurrencies(game, route).includes(code) ? code : null;
}

if (import.meta.env.DEV) {
  console.assert(launchCurrency({}, "pkr") === "PKR" && launchCurrency({}, "BTC") === null, "launch currency: route set");
  console.assert(launchCurrencies({ launchCurrencies: ["inr"] }).join() === "INR" && launchCurrency({ launchCurrencies: ["INR"] }, "USDT") === null, "launch currency: row's own set");
  console.assert(launchCurrency(null, "PKR", ORIGINAL_LAUNCH_CURRENCIES) === null && launchCurrency(null, "USDT", ORIGINAL_LAUNCH_CURRENCIES) === "USDT", "launch currency: originals");
}
