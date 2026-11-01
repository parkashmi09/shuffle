/*
 * Browser crawl for the shuffle admin (3140) or player site (5174). Run with the
 * chrome-devtools MCP on YOUR signed-in page:
 *
 *   evaluate_script({ function: "() => { window.__qaPaths = ['/dashboard', '/users'] }" })
 *   evaluate_script({ sourcePath: '<this file>' })            // starts, returns at once
 *   evaluate_script({ function: "() => ({ done: window.__qaDone, n: window.__qaOut.length })" })  // poll
 *   evaluate_script({ function: "() => window.__qaOut" })     // the rows
 *
 * Each path loads in one same-origin popup window named `qa` (the admin sends
 * X-Frame-Options, so an iframe is refused); the MCP lists it as a new page —
 * close it when done. A row has: the final
 * path (a redirect to /login or /403 shows here), the API responses >= 400
 * (Resource Timing `responseStatus`), uncaught errors + console.error, an
 * error-text match, the text length (0 = blank page), and then every
 * enabled `[role=tab]` clicked in turn with the same checks per tab.
 * alert/confirm/prompt are stubbed to return false, so nothing opens a dialog
 * and nothing destructive is confirmed. Tabs only — no buttons or switches.
 */
async () => {
  const paths = window.__qaPaths ?? [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = (window.__qaOut = []);
  window.__qaDone = false;
  const ERR = /(Something went wrong|Application error|Unhandled Runtime Error|Not in your plan|could not be found|Failed to (load|fetch)|Internal Server Error|Too many requests)[^\n]{0,80}/i;
  const win = window.open('about:blank', 'qa', 'width=1440,height=900');
  if (!win) return { error: 'popup blocked' };
  const open = async (path) => {
    win.__qaOld = true;
    win.location.href = path;
    for (const end = Date.now() + 20000; Date.now() < end; ) {
      await sleep(200);
      try {
        if (!win.__qaOld && win.document.readyState === 'complete') return win;
      } catch {
        /* mid-navigation */
      }
    }
    throw new Error('load timeout');
  };

  const entries = (w) => w.performance.getEntriesByType('resource');
  const idle = async (w, max) => {
    let n = -1;
    let stable = 0;
    for (const end = Date.now() + max; Date.now() < end; ) {
      await sleep(400);
      const c = entries(w).length;
      if (c === n && ++stable >= 3) return;
      if (c !== n) (stable = 0), (n = c);
    }
  };
  const bad = (w, from) =>
    entries(w)
      .slice(from)
      .filter((e) => e.responseStatus >= 400)
      .map((e) => `${e.responseStatus} ${e.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`);
  const errText = (d) => (d.body?.innerText.match(ERR) || [])[0] ?? null;

  const run = async () => {
    for (const path of paths) {
      const errors = [];
      try {
        const w = await open(path);
        w.alert = w.confirm = w.prompt = () => false;
        w.addEventListener('error', (e) => errors.push(String(e.message).slice(0, 160)));
        w.addEventListener('unhandledrejection', (e) => errors.push(`rejection: ${String(e.reason?.message ?? e.reason).slice(0, 160)}`));
        const ce = w.console.error;
        w.console.error = (...a) => {
          errors.push(a.map(String).join(' ').slice(0, 160));
          ce.apply(w.console, a);
        };
        await idle(w, 12000);
        const row = { path, final: w.location.pathname, bad: bad(w, 0), text: errText(w.document), chars: w.document.body?.innerText.length ?? 0, tabs: [] };
        const count = w.document.querySelectorAll('[role=tab]').length;
        for (let i = 0; i < Math.min(count, 15); i++) {
          const t = w.document.querySelectorAll('[role=tab]')[i];
          if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') continue;
          const from = entries(w).length;
          t.click();
          await idle(w, 6000);
          row.tabs.push({ tab: (t.innerText || t.getAttribute('aria-label') || `#${i}`).trim().slice(0, 30), bad: bad(w, from), text: errText(w.document) });
        }
        row.errors = errors;
        out.push(row);
      } catch (e) {
        out.push({ path, crash: String(e.message), errors });
      }
    }
    window.__qaDone = true;
  };
  run();
  return { started: paths.length };
};
