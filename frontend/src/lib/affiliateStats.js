/** Sum decimal strings for display aggregation (rewards history rows). */
export function sumAmounts(values) {
  const total = values.reduce((sum, v) => sum + (Number.parseFloat(v) || 0), 0);
  return String(total);
}

/**
 * Merge team members with per-member wager and commission from `rewards` rows.
 * Wager comes from `referredAmount`; commission from `amount`.
 */
export function enrichReferredMembers(members, rewardRows, campaignLabel) {
  const byMember = new Map();
  for (const row of rewardRows ?? []) {
    const name = row.member;
    if (!name) continue;
    const cur = byMember.get(name) ?? { wagered: [], commission: [] };
    cur.wagered.push(row.referredAmount ?? "0");
    cur.commission.push(row.amount ?? "0");
    byMember.set(name, cur);
  }

  return (members ?? []).map((m) => {
    const stats = byMember.get(m.name);
    const wagerFromTeam = m.wager != null && m.wager !== "" ? String(m.wager) : null;
    return {
      ...m,
      campaign: m.campaign || campaignLabel,
      wagered: wagerFromTeam ?? (stats ? sumAmounts(stats.wagered) : "0"),
      commission: stats ? sumAmounts(stats.commission) : "0",
    };
  });
}

export function totalReferredWager(rewardRows) {
  return sumAmounts((rewardRows ?? []).map((r) => r.referredAmount ?? "0"));
}
