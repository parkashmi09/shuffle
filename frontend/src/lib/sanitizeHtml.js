import DOMPurify from "dompurify";

// A new tab must not get `window.opener` back to this page.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
});

/** HTML that came from the API (blog/promotion bodies, T&Cs), cleaned before it reaches `dangerouslySetInnerHTML`. */
export const sanitizeHtml = (html) =>
  DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"],
  });
