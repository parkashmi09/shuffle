/**
 * Turn admin-authored HTML (or plain text) into the markup Shuffle blog articles use.
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoryToTag(category) {
  const raw = String(category || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("casino")) return "casino";
  if (raw.includes("sport")) return "sports";
  if (raw.includes("crypto") || raw.includes("token")) return "crypto";
  if (raw.includes("how")) return "howTo";
  if (raw.includes("shuffle") || raw.includes("news")) return "shuffleNews";
  return raw.replace(/\s+/g, "-");
}

function tagsMarkup(category) {
  const tag = categoryToTag(category);
  if (!tag) return "";
  return `<div class="BlogAndPromotionArticle_tags"><a href="/blog?tag=${encodeURIComponent(tag)}"><div class="BlogAndPromotionArticle_tag">${escapeHtml(tag)}</div></a></div>`;
}

function upgradeElement(el) {
  if (!el || el.nodeType !== 1) return;
  const tag = el.tagName.toLowerCase();

  if (tag === "p" && !el.classList.contains("RichText_paragraph")) {
    el.classList.add("RichText_paragraph");
  }
  if (tag === "h1") {
    el.className = "Heading_root Heading_h2";
  }
  if (tag === "h2") {
    el.className = "Heading_root Heading_h2";
  }
  if (tag === "h3") {
    el.className = "Heading_root Heading_h3";
  }
  if (tag === "h4") {
    el.className = "Heading_root Heading_h4";
  }
  if ((tag === "b" || tag === "strong") && !el.classList.contains("RichText_bold")) {
    el.className = "RichText_bold";
  }
  if (tag === "em" || tag === "i") {
    el.className = "RichText_italic";
  }
  if (tag === "a" && !el.classList.contains("RichText_link")) {
    el.className = "TextLink_root RichText_link";
  }
  if (tag === "li") {
    const p = el.querySelector(":scope > p");
    if (p && !p.classList.contains("RichText_paragraph")) {
      p.classList.add("RichText_paragraph");
    }
  }

  [...el.children].forEach(upgradeElement);
}

function plainTextToHtml(text) {
  const blocks = String(text)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split(/\n/).map((l) => escapeHtml(l.trim())).filter(Boolean);
      if (lines.length === 1) {
        return `<p class="RichText_paragraph">${lines[0]}</p>`;
      }
      return `<p class="RichText_paragraph">${lines.join("<br/>")}</p>`;
    })
    .join("");
}

/**
 * @param {string} raw  Post body from the API.
 * @param {{ category?: string, subheading?: string }} opts
 */
export function normalizeBlogHtml(raw, { category, subheading } = {}) {
  let text = String(raw || "").trim();
  if (!text && !subheading) return tagsMarkup(category);

  const alreadyShuffle = /RichText_richTextBlock|RichText_paragraph/.test(text);

  if (alreadyShuffle) {
    let inner = text;
    if (!inner.includes("BlogAndPromotionArticle_tags")) inner += tagsMarkup(category);
    return inner;
  }

  if (!/<[a-z][\s\S]*>/i.test(text)) {
    text = plainTextToHtml(text);
  } else if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(text, "text/html");
    upgradeElement(doc.body);
    text = doc.body.innerHTML;
  }

  if (subheading) {
    const lead = `<p class="RichText_paragraph"><b class="RichText_bold">${escapeHtml(subheading)}</b></p>`;
    text = lead + text;
  }

  let inner = text.includes("RichText_richTextBlock")
    ? text
    : `<div class="RichText_richTextBlock">${text}</div>`;

  if (!inner.includes("BlogAndPromotionArticle_tags")) {
    inner += tagsMarkup(category);
  }

  return inner;
}
