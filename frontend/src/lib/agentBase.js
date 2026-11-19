/**
 * A player an agent created uses the site under /agent. The app's routes and links stay unprefixed:
 * `appPath` strips the base when reading the address and `installAgentHistory` adds it when writing,
 * so no page has to know. Decided at load from the address; crossing the base is a full page load.
 */
export const AGENT_BASE = "/agent";

export const underAgentBase = (pathname = window.location.pathname) =>
  pathname === AGENT_BASE || pathname.startsWith(`${AGENT_BASE}/`);

/** The address as the app's routes know it: `/agent/casino/providers` is `/casino/providers`. */
export const appPath = (pathname = window.location.pathname) =>
  underAgentBase(pathname) ? pathname.slice(AGENT_BASE.length) || "/" : pathname;

const withBase = (url) =>
  typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !underAgentBase(url.split(/[?#]/)[0])
    ? `${AGENT_BASE}${url === "/" ? "" : url}`
    : url;

/** An app path for something that leaves the router (`window.open`): keeps the current side of the base. */
export const hrefInBase = (url) => (underAgentBase() ? withBase(url) : url);

/** The player's OWN capabilities decide; with none (signed out, or not answered yet) the address does. */
export const agentPlayerCaps = (caps, inside = underAgentBase()) =>
  caps ? caps.vault === false && caps.deposit === false : inside;

/** The same page on the player's own side of the base, or null when already there. */
export function agentBaseTarget({ pathname, search = "", hash = "" }, agentPlayer) {
  const inside = underAgentBase(pathname);
  if (agentPlayer && !inside) return `${AGENT_BASE}${pathname === "/" ? "" : pathname}${search}${hash}`;
  if (!agentPlayer && inside) return `${appPath(pathname)}${search}${hash}`;
  return null;
}

/** Plain links (a new tab, a middle click) leave the router, so they get the base as they are used. */
function keepLinkInside(event) {
  const link = event.target.closest?.("a[href]");
  if (!link || link.origin !== window.location.origin || !/^https?:$/.test(link.protocol)) return;
  if (link.pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(link.pathname)) return;
  link.setAttribute("href", withBase(link.pathname + link.search + link.hash));
}

/** Keeps every address inside /agent. Call once, before the first render. */
export function installAgentHistory() {
  if (!underAgentBase()) return;
  for (const method of ["pushState", "replaceState"]) {
    const write = window.history[method].bind(window.history);
    window.history[method] = (state, title, url) => write(state, title, withBase(url));
  }
  for (const type of ["click", "auxclick", "contextmenu"]) document.addEventListener(type, keepLinkInside, true);
}

/* Self-check, dev only: this frontend has no test runner. */
if (import.meta.env.DEV) {
  console.assert(underAgentBase("/agent") && underAgentBase("/agent/sports") && !underAgentBase("/agents"), "agent base match");
  console.assert(appPath("/agent") === "/" && appPath("/agent/sports/my-bets") === "/sports/my-bets" && appPath("/blog") === "/blog", "agent base strip");
  console.assert(withBase("/") === "/agent" && withBase("/blog?a=1") === "/agent/blog?a=1" && withBase("/agent/blog") === "/agent/blog" && withBase("//x.test/a") === "//x.test/a", "agent base write");
  console.assert(agentBaseTarget({ pathname: "/sports", search: "?t=1" }, true) === "/agent/sports?t=1", "agent base in");
  console.assert(agentBaseTarget({ pathname: "/agent" }, false) === "/" && agentBaseTarget({ pathname: "/agent/blog" }, true) === null && agentBaseTarget({ pathname: "/" }, false) === null, "agent base out");
  console.assert(agentPlayerCaps({ vault: false, deposit: false }, false) && !agentPlayerCaps({ vault: true, deposit: false }, true) && agentPlayerCaps(null, true) && !agentPlayerCaps(null, false), "agent player caps");
}
