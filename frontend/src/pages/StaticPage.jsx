import { useEffect, useRef } from "react";
import { navigate } from "../lib/router";
import { useSession } from "../lib/sessionContext";
import affiliateHtml from "../data/affiliate.html?raw";

/**
 * Pages the reference renders entirely on the server. The captured markup is
 * rendered as-is; accordions, internal links and the call-to-action buttons
 * are wired up after mount.
 *
 * Only the affiliate page is left on this path. `/vip-program` used to be here
 * too and is now `pages/VipPage.jsx` — it needed a second, signed-in layout
 * that reads the player's standing, which a static blob cannot have.
 */
export function HtmlPage({ html, cta = "register", onCta }) {
  const ref = useRef(null);
  // Read through a ref: the handler is bound once per `html`, and a caller that
  // passes an inline arrow would otherwise rebind it on every render.
  const cta_ref = useRef(onCta);
  useEffect(() => {
    cta_ref.current = onCta;
  }, [onCta]);
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
        // Signed in, the captured call-to-action means something else: the
        // reference sends a member to their own dashboard rather than asking
        // them to register again. `onCta` is how the page says so.
        if (cta_ref.current) cta_ref.current();
        else window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: cta }));
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

/** Reference `/affiliate`. */
export function AffiliatePage() {
  const { signedIn } = useSession();
  return (
    <div>
      <HtmlPage
        html={affiliateHtml}
        cta="register"
        onCta={signedIn ? () => navigate("/affiliate/overview") : undefined}
      />
    </div>
  );
}
