import { useEffect, useSyncExternalStore } from "react";
import { useSiteFeatures } from "./useSiteFeatures";

/**
 * Light / dark — the owner's `theme_mode` policy (a row of `GET /admin/features/public`):
 *   dark_only  (the default) always dark, no toggle drawn;
 *   switch     the player picks in Settings → Preferences; kept in this browser, dark until chosen.
 * The colours are styles/shuffle-light.css under `:root[data-theme="light"]`.
 */
const KEY = "shuffle.theme";

function read() {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

let choice = read();
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function setChoice(next) {
  choice = next ? "light" : "dark";
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // storage blocked: the pick holds for this visit
  }
  listeners.forEach((fn) => fn());
}

/** `{ allowed, light, setLight }` — draw a toggle only when `allowed`. */
export function useThemeMode() {
  const allowed = useSiteFeatures().policy("theme_mode") === "switch";
  const picked = useSyncExternalStore(subscribe, () => choice, () => "dark");
  return { allowed, light: allowed && picked === "light", setLight: setChoice };
}

/** Mounted once in the shell: puts the theme on <html>. */
export function useApplyTheme() {
  const { light } = useThemeMode();
  useEffect(() => {
    if (light) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
  }, [light]);
}
