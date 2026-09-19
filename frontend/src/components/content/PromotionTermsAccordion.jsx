import { useEffect, useRef } from "react";

/** Optional promotion T&amp;Cs — same accordion pattern as reference promotion articles. */
export default function PromotionTermsAccordion({ html }) {
  const rootRef = useRef(null);
  const body = String(html || "").trim();

  useEffect(() => {
    if (!body) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;

    const onClick = (e) => {
      const btn = e.target.closest(".Accordion_accordionHeader");
      if (!btn || !root.contains(btn)) return;
      const acc = btn.closest(".Accordion_root");
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      btn.querySelector(".Accordion_accordionHeaderLeft")?.classList.toggle("Accordion_headingOpen", !open);
      btn.querySelector(".Accordion_chevronWrapper")?.classList.toggle("Accordion_open", !open);
      acc?.querySelectorAll(".Accordion_contentHeight .Accordion_content").forEach((c) =>
        c.classList.toggle("Accordion_openContent", !open)
      );
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [body]);

  if (!body) return null;

  return (
    <div ref={rootRef} className="Accordion_root">
      <div>
        <button aria-expanded="false" className="Accordion_accordionHeader" data-testid="modal-accordion" type="button">
          <div className="Accordion_accordionHeaderLeft">
            <strong>Terms and Conditions</strong>
          </div>
          <div className="Accordion_chevronWrapper">
            <img alt="arrow" src="/icons/chevron.svg" />
          </div>
        </button>
      </div>
      <div className="Accordion_contentHeight" style={{ transition: "0.2s height ease-out", height: "auto" }}>
        <div>
          <div className="Accordion_content">
            <div className="RichText_richTextBlock" dangerouslySetInnerHTML={{ __html: body }} />
          </div>
        </div>
      </div>
    </div>
  );
}
