#!/usr/bin/env bash
# Read-only: is shuffle in sync and healthy? Prints PASS/FAIL per check and the flow that fixes a FAIL.
# Run from anywhere: bash shuffle/.claude/skills/shuffle-qa/scripts/sync-check.sh
set -u
ROOT=/Users/apple/Developer/cfz/inhouse
SITE=$ROOT/shuffle
GW=${SHUFFLE_GATEWAY:-http://127.0.0.1:4600}
fail=0
row() { printf '%-5s %-22s %s\n' "$1" "$2" "$3"; [ "$1" = FAIL ] && fail=$((fail + 1)); }

# 1. site-sync: shuffle line must be 0 down / 0 up / 0 ui files.
line=$(cd "$ROOT" && node .claude/skills/site-sync/scripts/sync.mjs status 2>&1 | grep -iE '^\s*shuffle\b' | head -1)
if [ -z "$line" ]; then row FAIL site-sync "no shuffle line in sync.mjs status"
elif echo "$line" | grep -qE '[1-9][0-9]* (files|backend files|admin/owner files)'; then row FAIL site-sync "$line  → run site-sync (down/up/ui)"
else row PASS site-sync "$line"; fi

# 2. hash-sync: baseline must be hash HEAD.
hs=$(cd "$ROOT" && node .claude/skills/hash-sync/scripts/track.mjs status shuffle 2>&1)
base=$(echo "$hs" | sed -nE 's/.*baseline: ([0-9a-f]+).*source HEAD: ([0-9a-f]+).*/\1 \2/p')
if [ -n "$base" ] && [ "${base% *}" = "${base#* }" ] && echo "$hs" | grep -q 'commits: none'; then row PASS hash-sync "baseline = hash HEAD ${base% *}"
else row FAIL hash-sync "$(echo "$hs" | grep -E 'baseline|commits' | tr '\n' ' ') → run hash-sync"; fi

# 3. main-server vs shuffle/backend must be identical.
d=$(diff -rq "$ROOT/main-server" "$SITE/backend" \
  -x .git -x node_modules -x '.env*' -x logs -x data -x .run -x storage -x uploads -x seed \
  -x ecosystem.config.cjs -x package-lock.json -x .gitignore 2>&1)
if [ -z "$d" ]; then row PASS backend-diff "main-server == shuffle/backend"
else row FAIL backend-diff "$(echo "$d" | wc -l | tr -d ' ') differences, first: $(echo "$d" | head -1) → site-sync up/down"; fi

# 4. git: clean tree, nothing unpushed.
dirty=$(git -C "$SITE" status --porcelain | wc -l | tr -d ' ')
git -C "$SITE" fetch -q 2>/dev/null
ahead=$(git -C "$SITE" rev-list --count @{u}..HEAD 2>/dev/null || echo '?')
if [ "$dirty" = 0 ] && [ "$ahead" = 0 ]; then row PASS git "clean, 0 unpushed"
else row FAIL git "$dirty uncommitted, $ahead unpushed → commit + push"; fi

# 5. gateway health: every service ok.
h=$(curl -s -m 5 "$GW/health")
bad=$(echo "$h" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.status!=="ok"?"gateway "+j.status:(j.services||[]).filter(x=>x.status!=="ok").map(x=>x.service).join(","))}catch{console.log("unparsable")}})')
if [ -n "$h" ] && [ -z "$bad" ]; then row PASS health "gateway + $(echo "$h" | grep -o '"service":' | wc -l | tr -d ' ') entries ok"
else row FAIL health "${h:-no answer from $GW/health} → restart: cd shuffle/backend && npm run dev"; fi

# 6. migrations: none pending.
m=$(cd "$SITE/backend" && npm run -s db:status 2>&1)
if echo "$m" | grep -qE '\[ \]|pending: [1-9]'; then row FAIL migrations "$(echo "$m" | grep -E '\[ \]|pending: [1-9]' | head -3 | tr '\n' ' ') → npm run db:migrate"
elif echo "$m" | grep -q '\[x\]'; then row PASS migrations "$(echo "$m" | grep -c '\[x\]') applied, 0 pending"
else row FAIL migrations "db:status gave no list: $(echo "$m" | tail -1 | head -c 160)"; fi

echo "$fail failed"
exit $((fail > 0))
