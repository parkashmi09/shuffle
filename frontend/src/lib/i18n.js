import { useEffect, useSyncExternalStore } from "react";
import { usePublicSiteConfig } from "./usePublicSiteConfig";

/**
 * The player site's language — rainbet's layer (rainbet-main/frontend/src/lib/i18n.js).
 *
 * Screens are written in English and stay that way: this swaps text in the page by exact match
 * against `src/i18n/<code>.json` (keys from `scripts/i18n-strings.mjs`), so anything not in the
 * file (player names, game titles, backend messages, SEO / legal prose) stays as it is. React still
 * owns the nodes: a text it rewrites is picked up by the observer and translated again.
 *
 * Only languages with a dictionary are offered. The owner's site config (`languages`, backend
 * codes) narrows them further; until it answers, all of these show.
 */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "ja", label: "日本語" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "tr", label: "Türkçe" },
  { code: "zh", label: "中文" },
];
const ENGLISH = "en";
const KEY = "shuffle.language";
const FILES = import.meta.glob("../i18n/*.json");
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const BRAND = /\bShuffle\b/g; // the reference brand in captured copy and in the dictionaries
const SKIP = "script,style,textarea,.notranslate";

let current = ENGLISH;
let dictionary = null;
let siteName = null; // the owner's site name; replaces BRAND after translation, so dictionary keys still match
let observer = null;
const listeners = new Set();
const texts = new WeakMap(); // text node → { source, shown }
const attrs = new WeakMap(); // element → { [attribute]: { source, shown } }

const translated = (source) => {
  const key = source.trim();
  const hit = key && dictionary && Object.hasOwn(dictionary, key) ? dictionary[key] : null;
  const out = hit ? source.replace(key, () => hit) : source;
  return siteName ? out.replace(BRAND, () => siteName) : out;
};

function doText(node) {
  if (node.parentElement?.closest(SKIP)) return;
  const value = node.nodeValue;
  const seen = texts.get(node);
  const source = seen && seen.shown === value ? seen.source : value;
  const shown = translated(source);
  if (shown !== value) node.nodeValue = shown;
  texts.set(node, { source, shown });
}

function doAttr(el, name) {
  const value = el.getAttribute(name);
  if (value === null || el.closest(SKIP)) return;
  const all = attrs.get(el) ?? {};
  const source = all[name] && all[name].shown === value ? all[name].source : value;
  const shown = translated(source);
  if (shown !== value) el.setAttribute(name, shown);
  all[name] = { source, shown };
  attrs.set(el, all);
}

function doTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  ATTRS.forEach((name) => doAttr(root, name));
  root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => ATTRS.forEach((name) => doAttr(el, name)));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) doText(walker.currentNode);
}

function observe() {
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") doText(r.target);
      else if (r.type === "attributes") doAttr(r.target, r.attributeName);
      else r.addedNodes.forEach(doTree);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

async function apply(code) {
  current = code;
  document.documentElement.lang = code;
  listeners.forEach((fn) => fn());
  let next = null;
  try {
    next = code === ENGLISH ? null : (await FILES[`../i18n/${code}.json`]?.())?.default ?? null;
  } catch {
    /* the file did not load: English, until the next pick */
  }
  if (code !== current) return; // a newer pick won while this one loaded
  dictionary = next;
  refresh();
}

function refresh() {
  doTree(document.body);
  // Unbranded English has nothing to swap, so it pays for no observer on the live feeds.
  const needed = Boolean(dictionary || siteName);
  if (needed && !observer) observe();
  if (!needed && observer) {
    observer.disconnect();
    observer = null;
  }
}

/** The owner's site name (null = unbranded, the copy keeps "Shuffle"); set by applyBranding. */
export function setSiteName(name) {
  if ((name || null) === siteName) return;
  siteName = name || null;
  refresh();
}

const known = (code) => LANGUAGES.some((l) => l.code === code);

function saved() {
  try {
    const code = window.localStorage.getItem(KEY);
    if (known(code)) return code;
  } catch {
    /* storage unavailable */
  }
  return ENGLISH;
}

/** Called once before the first render, so a returning player's choice applies straight away. */
export function startI18n() {
  const code = saved();
  if (code !== ENGLISH) apply(code);
}

/** Pick a language (a code from LANGUAGES). Unknown codes — the account's old choice of a language
    with no dictionary — are ignored. */
export function setLanguage(code) {
  if (!known(code)) return;
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    /* storage unavailable: it still applies for this visit */
  }
  if (code !== current) apply(code);
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The current language code. */
export function useLanguage() {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

const allowedOf = (codes) => (Array.isArray(codes) ? LANGUAGES.filter((l) => codes.includes(l.code)) : LANGUAGES);

/** The languages the picker may show: the owner's list ∩ the ones with a dictionary. */
export function useAllowedLanguages() {
  return allowedOf(usePublicSiteConfig().languages);
}

/**
 * Moves the page off a language the owner switched off (to English, else the first allowed).
 * The saved choice is kept, so switching it back on returns the player to it.
 */
export function useLanguageGuard() {
  const { languages } = usePublicSiteConfig();
  useEffect(() => {
    if (!Array.isArray(languages)) return;
    const allowed = allowedOf(languages);
    const want = saved();
    const fallback = allowed.length === 0 || allowed.some((l) => l.code === ENGLISH) ? ENGLISH : allowed[0].code;
    const target = allowed.some((l) => l.code === want) ? want : fallback;
    if (target !== current) apply(target);
  }, [languages]);
}
