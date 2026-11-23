import { useEffect } from "react";
import { useSiteFeatures } from "./useSiteFeatures";

/**
 * The owner's Google tag (`analytics` feature, `GET /admin/features/public`):
 *   gtm   `config.containerId`   loads the GTM container;
 *   gtag  `config.measurementId` loads gtag.js with that GA4 id.
 * Off (no row) loads nothing. The ids are checked against the backend's own patterns before
 * they go into a script URL. Loaded once per page; an owner switching it off takes a reload.
 */
const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;
const GA_ID = /^G-[A-Z0-9]{4,12}$/;

let loaded = false;

function addScript(src) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function loadTag(variant, config) {
  if (loaded || typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (variant === "gtm" && GTM_ID.test(config?.containerId ?? "")) {
    loaded = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${config.containerId}`);
  } else if (variant === "gtag" && GA_ID.test(config?.measurementId ?? "")) {
    loaded = true;
    window.gtag = function gtag() {
      window.dataLayer.push(arguments); // gtag.js reads an `arguments` object, not an array
    };
    window.gtag("js", new Date());
    window.gtag("config", config.measurementId);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`);
  }
}

/** Mounted once in the shell. */
export function useAnalytics() {
  const features = useSiteFeatures();
  const variant = features.variant("analytics");
  const config = features.config("analytics");
  const id = config?.containerId || config?.measurementId || "";
  useEffect(() => {
    loadTag(variant, { containerId: id, measurementId: id });
  }, [variant, id]);
}
