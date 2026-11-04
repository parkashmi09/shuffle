// Builds src/i18n/<code>.json for every language in lib/i18n.js: rainbet's translation of each of
// shuffle's strings (scripts/i18n-strings.json) where rainbet has one, else scripts/i18n-new-<code>.json.
// Fails on any string left untranslated. Run from frontend/: node scripts/i18n-build.mjs
import fs from "fs";

const CODES = ["ar", "es", "fr", "ja", "pt", "ru", "tr", "zh"];
const RAINBET = "../../rainbet-main/frontend/src/i18n";
const strings = JSON.parse(fs.readFileSync("scripts/i18n-strings.json", "utf8"));
const read = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});

fs.mkdirSync("src/i18n", { recursive: true });
let failed = false;
for (const code of CODES) {
  const theirs = read(`${RAINBET}/${code}.json`);
  const ours = Object.assign({}, read(`scripts/i18n-new-${code}.json`), ...[1, 2, 3, 4].map((n) => read(`scripts/i18n-new-${code}-${n}.json`)));
  const out = {};
  const missing = [];
  for (const s of strings) {
    const t = Object.hasOwn(ours, s) ? ours[s] : theirs[s];
    if (typeof t === "string" && t.trim()) out[s] = t;
    else missing.push(s);
  }
  if (missing.length) {
    failed = true;
    console.error(`${code}: ${missing.length} untranslated, e.g. ${missing.slice(0, 3).join(" | ")}`);
    continue;
  }
  fs.writeFileSync(`src/i18n/${code}.json`, `${JSON.stringify(out, null, 0).replace(/","/g, '",\n"')}\n`);
  console.log(`${code}: ${Object.keys(out).length} strings`);
}
process.exit(failed ? 1 : 0);
