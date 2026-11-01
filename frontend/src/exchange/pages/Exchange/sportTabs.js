import { LOBBY_SPORTS, racingSports, sportIconOf } from './model';

/* The three fixed boards keep their old `?sport=` ids (cricket / soccer / tennis) and labels, so
   existing links still land; any other sport's id is its name as a slug ("Ice Hockey" →
   "ice-hockey"), falling back to its sid. */
export const FIXED_BY_SID = new Map(LOBBY_SPORTS.map((s) => [s.sid, s]));
const slug = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const list = (v) => (Array.isArray(v) ? v : []);

/* The pills after In-Play: every sport of the shared sports tree (the same read, and the same
   "has matches" rule, as the sidebar's Sports group) in the feed's order. Until the tree answers
   — or if it fails — the three fixed boards stand in, so the row is never empty. Racing (the
   tree's `racing` list) slots in after the first three, as the feed orders it.
   stake: moved out of Lobby/index.jsx (hash keeps it there) so the sidebar's Sports group
   (components/layout/Sidebar.jsx) lists the same sports with the same `?sport=` ids. */
export function sportTabsOf(tree) {
  const plain = list(tree?.sports).filter((s) => list(s.children).length > 0 && s.etid != null);
  const sports = [...plain.slice(0, 3), ...racingSports(tree?.racing), ...plain.slice(3)];
  if (sports.length === 0) return LOBBY_SPORTS.map((s) => ({ ...s, fallback: true }));
  const seen = new Set();
  const tabs = [];
  for (const s of sports) {
    const sid = Number(s.etid);
    const fixed = FIXED_BY_SID.get(sid);
    let id = fixed?.id ?? (slug(s.name) || String(sid));
    if (seen.has(id)) id = `${id}-${sid}`;
    if (seen.has(id)) continue;
    seen.add(id);
    tabs.push({
      id,
      sid,
      label: fixed?.label ?? s.name,
      icon: fixed?.icon ?? sportIconOf(sid, s.name),
      fallback: true,
    });
  }
  return tabs;
}
