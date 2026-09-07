import { useEffect, useRef } from "react";
import { navigate } from "../lib/router";
import vipHtml from "../data/vip.html?raw";
import affiliateHtml from "../data/affiliate.html?raw";

/**
 * Pages the reference renders entirely on the server (VIP program, affiliate
 * program). The captured markup is rendered as-is; accordions, internal links
 * and the call-to-action buttons are wired up after mount.
 */
export function HtmlPage({ html, cta = "register" }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e) => {
      const btn = e.target.closest(".Accordion_accordionHeader");
      if (btn && root.contains(btn)) {
        const acc = btn.closest(".Accordion_root");
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        btn.querySelector(".Accordion_accordionHeaderLeft")?.classList.toggle("Accordion_headingOpen", !open);
        btn.querySelector(".Accordion_chevronWrapper")?.classList.toggle("Accordion_open", !open);
        acc.querySelectorAll(".Accordion_contentHeight .Accordion_content").forEach((c) => c.classList.toggle("Accordion_openContent", !open));
        return;
      }
      const cta_ = e.target.closest("button.ButtonVariants_root");
      if (cta_ && root.contains(cta_) && !cta_.closest("a")) {
        window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: cta }));
        return;
      }
      const a = e.target.closest("a[href]");
      if (!a || !root.contains(a)) return;
      const href = a.getAttribute("href");
      if (href.startsWith("/")) {
        e.preventDefault();
        navigate(href);
      } else if (href.startsWith("https://shuffle.com/")) {
        e.preventDefault();
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [html, cta]);
  return <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Reference `/vip-program`. */
export function VipPage() {
  return (
    <div>
      <HtmlPage html={vipHtml} cta="register" />
    </div>
  );
}

/** Reference `/affiliate`. */
export function AffiliatePage() {
  return (
    <div>
      <HtmlPage html={affiliateHtml} cta="register" />
    </div>
  );
}
