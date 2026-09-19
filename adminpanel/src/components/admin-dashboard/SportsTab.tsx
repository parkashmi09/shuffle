import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Avatar, Chip, Divider,
  IconButton, Tooltip as MuiTooltip, alpha,
} from '@mui/material';
import {
  SportsCricket, ListAlt, Timeline, Warning, Refresh, CalendarToday,
  ShowChart, Equalizer, AssessmentOutlined, AccountBalance,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { C, CHART_COLORS, StatCard, ChartCard, CustomTooltip, fmtCurrency, fmtNum } from './shared';
import { apiFetch, apiFetchPage } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  WHAT THIS TAB CAN AND CANNOT SHOW
 * ══════════════════════════════════════════════════════════════════════════
 *
 * It was written against the monolith and asked for three things that
 * sports-service does not serve:
 *
 *   1. `GET /bet-admin/bets?type=current&page=…` — neither `type` nor `page`
 *      is in the query schema. `status` and `limit`/`offset` are, so "open
 *      bets" was actually EVERY bet, first page, every time.
 *
 *   2. `POST /bet-admin/reports/game` with `{event, fromDate, toDate}` — the
 *      body is `.strict()` and takes `{gameType, username, from, to, limit,
 *      offset}`. The three wrong keys made every call a 422, so both settled
 *      panels were empty and every derived figure was zero.
 *
 *   3. Per-bet settled MONEY — `profit`, `loss`, `commission`, `netamount`,
 *      `settled_at`. Those live in `credits_ledger`, which no staff sports
 *      endpoint exposes. The game report answers COUNTS and STAKE per market
 *      (`bets`, `staked`, `won`, `lost`), and that is the honest ceiling on
 *      what this tab can report.
 *
 * So the GGR / player-profit / commission cards and the daily GGR trend are
 * gone rather than showing a confident zero, and turnover, settle counts and
 * live exposure — all of which the API genuinely provides — stay.
 */

/** One open bet, as `/bet-admin/bets` shapes it. Money is a decimal string. */
interface BetRow {
  id: number;
  userId: number;
  username: string | null;
  matchId: string;
  matchTitle: string;
  gameType: string;
  selection: string;
  side: string;
  odds: string;
  stake: string;
  liability: string;
  status: string;
  resultStatus: string | null;
  createdAt: string;
}

/** One market's settled totals, as `/bet-admin/reports/game` shapes it. */
interface ReportRow {
  gameType: string;
  matchId: string;
  matchTitle: string;
  bets: number;
  staked: string;
  won: number;
  lost: number;
}

const GAME_TYPE_NAME: Record<string, string> = {
  MO: 'Match Odds',
  BM: 'Bookmaker',
  FAN: 'Fancy',
};

const isoNDaysAgo = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const SportsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [openBets, setOpenBets] = useState<BetRow[]>([]);
  const [settledToday, setSettledToday] = useState<ReportRow[]>([]);
  const [settled7d, setSettled7d] = useState<ReportRow[]>([]);

  const num = (v: unknown) => Number(v) || 0;

  const fetchAll = async () => {
    setLoading(true);

    const dayStart = (iso: string) => new Date(`${iso}T00:00:00`).toISOString();
    const dayEnd = (iso: string) => new Date(`${iso}T23:59:59`).toISOString();
    const today = new Date().toISOString().split('T')[0];

    const gameReport = (from: string, to: string, limit: number) =>
      apiFetch<ReportRow[]>(ENDPOINTS.sportsBetAdmin.gameReport, {
        method: 'POST',
        body: { from: dayStart(from), to: dayEnd(to), limit, offset: 0 },
      });

    const [openRes, todayRes, weekRes] = await Promise.allSettled([
      apiFetchPage<BetRow>(ENDPOINTS.sportsBetAdmin.bets, {
        query: { status: 'open', limit: 200, offset: 0 },
      }),
      gameReport(today, today, 500),
      gameReport(isoNDaysAgo(6), today, 500),
    ]);

    if (openRes.status === 'fulfilled') setOpenBets(openRes.value.data);
    if (todayRes.status === 'fulfilled') setSettledToday(todayRes.value ?? []);
    if (weekRes.status === 'fulfilled') setSettled7d(weekRes.value ?? []);

    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 60000); return () => clearInterval(i); }, []);

  /* ── Live exposure, from the open bets ── */
  const totals = useMemo(() => {
    const sum = (rows: ReportRow[]) => rows.reduce((t, r) => t + num(r.staked), 0);

    return {
      openCount: openBets.length,
      totalLiability: openBets.reduce((t, b) => t + num(b.liability), 0),
      totalStakeOpen: openBets.reduce((t, b) => t + num(b.stake), 0),
      totalUsersOpen: new Set(openBets.map((b) => b.userId)).size,

      stakeToday: sum(settledToday),
      betsToday: settledToday.reduce((t, r) => t + r.bets, 0),
      wonToday: settledToday.reduce((t, r) => t + r.won, 0),
      lostToday: settledToday.reduce((t, r) => t + r.lost, 0),

      stake7d: sum(settled7d),
      bets7d: settled7d.reduce((t, r) => t + r.bets, 0),
    };
  }, [openBets, settledToday, settled7d]);

  /**
   * Settled turnover per market over the week.
   *
   * The report groups by match, not by day, so a DAILY trend is not derivable
   * from it — the busiest markets are, and that is what this chart shows.
   */
  const turnoverByMatch = useMemo(
    () =>
      [...settled7d]
        .map((r) => ({
          date: (r.matchTitle || r.matchId || 'Unknown').slice(0, 22),
          turnover: Number(num(r.staked).toFixed(2)),
          bets: r.bets,
        }))
        .sort((a, b) => b.turnover - a.turnover)
        .slice(0, 8),
    [settled7d]
  );

  /* ── Open stake by market kind ── */
  const sportData = useMemo(() => {
    const map: Record<string, number> = {};
    openBets.forEach((b) => {
      const name = GAME_TYPE_NAME[b.gameType] || b.gameType || 'Other';
      map[name] = (map[name] || 0) + num(b.stake);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [openBets]);

  /* ── Top users by live liability ── */
  const topUsers = useMemo(() => {
    const map: Record<string, { name: string; liability: number; bets: number }> = {};
    openBets.forEach((b) => {
      const k = String(b.userId);
      if (!map[k]) map[k] = { name: b.username || `#${b.userId}`, liability: 0, bets: 0 };
      map[k].liability += num(b.liability);
      map[k].bets += 1;
    });
    return Object.values(map).sort((a, b) => b.liability - a.liability).slice(0, 6);
  }, [openBets]);

  /* ── Top market kinds by 7-day settled turnover ── */
  const topSports = useMemo(() => {
    const map: Record<string, { stake: number; bets: number; won: number }> = {};
    settled7d.forEach((r) => {
      const key = GAME_TYPE_NAME[r.gameType] || r.gameType || 'Other';
      if (!map[key]) map[key] = { stake: 0, bets: 0, won: 0 };
      map[key].stake += num(r.staked);
      map[key].bets += r.bets;
      map[key].won += r.won;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.stake - a.stake)
      .slice(0, 5);
  }, [settled7d]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: { xs: '1.3rem', sm: '1.5rem' }, lineHeight: 1.2 }}>
            Sports Overview
          </Typography>
          <Typography sx={{ color: C.textMuted, fontSize: '0.78rem', mt: 0.25 }}>
            Live exposure and settled turnover
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<CalendarToday sx={{ fontSize: 14 }} />}
            label={new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            size="small"
            sx={{ bgcolor: C.cardLight, color: C.textMuted, border: `1px solid ${C.border}`, fontWeight: 500, '& .MuiChip-icon': { color: C.textSecondary } }}
          />
          <MuiTooltip title="Refresh">
            <IconButton onClick={fetchAll} size="small" sx={{ color: C.textSecondary, bgcolor: C.cardLight, border: `1px solid ${C.border}`, '&:hover': { bgcolor: C.cardHover, borderColor: C.primary } }}>
              <Refresh fontSize="small" />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* Row 1: Live exposure */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<ListAlt />} iconBg={C.primaryLight} title="Open Bets" value={fmtNum(totals.openCount)} subtitle={`Users in play: ${fmtNum(totals.totalUsersOpen)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Warning />} iconBg={C.warning} title="Live Liability" value={fmtCurrency(totals.totalLiability)} subtitle="Sum across all open positions" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Timeline />} iconBg={C.info} title="Open Stake" value={fmtCurrency(totals.totalStakeOpen)} subtitle="Stake locked in open bets" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AccountBalance />} iconBg={C.primary} title="Settled Turnover Today" value={fmtCurrency(totals.stakeToday)} subtitle={`${fmtNum(totals.betsToday)} bets settled`} />
        </Grid>
      </Grid>

      {/* Row 2: Settled today summary */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SportsCricket />} iconBg={C.success} title="Bets Won Today" value={fmtNum(totals.wonToday)} subtitle={`Across ${fmtNum(settledToday.length)} markets`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Equalizer />} iconBg={C.error} title="Bets Lost Today" value={fmtNum(totals.lostToday)} subtitle="Settled against the player" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AssessmentOutlined />} iconBg="#7B5EF5" title="Markets Settled Today" value={fmtNum(settledToday.length)} subtitle="Distinct match + market pairs" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<ShowChart />} iconBg={C.primary} title="7d Turnover" value={fmtCurrency(totals.stake7d)} subtitle={`${fmtNum(totals.bets7d)} bets settled`} />
        </Grid>
      </Grid>

      {/* Row 3: Charts */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={8}>
          {/*
              Turnover by MARKET, not by day.

              The game report groups by match — there is no per-day bucket in
              the response, so the daily GGR/turnover area chart it replaced was
              plotting seven empty buckets.
          */}
          <ChartCard title="Settled Turnover by Market (last 7 days)" icon={<ShowChart sx={{ fontSize: 18 }} />} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoverByMatch} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="date" type="category" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={150} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="turnover" name="Turnover" radius={[0, 6, 6, 0]} barSize={16}>
                  {turnoverByMatch.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <ChartCard title="Open Stake by Market Kind" icon={<AssessmentOutlined sx={{ fontSize: 18 }} />} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sportData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Stake" radius={[0, 6, 6, 0]} barSize={18}>
                  {sportData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Row 4: Top users + top sports */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: alpha(C.warning, 0.12), color: C.warning, width: 32, height: 32 }}>
                <Warning sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Top Users by Live Liability</Typography>
            </Box>
            {topUsers.length === 0 ? (
              <Typography sx={{ color: C.textMuted, fontSize: '0.85rem', textAlign: 'center', py: 4 }}>
                No open exposure
              </Typography>
            ) : (
              topUsers.map((u, i) => (
                <Box key={`${u.name}-${i}`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Avatar sx={{ bgcolor: alpha(C.primary, 0.15), color: C.primary, width: 30, height: 30, fontSize: '0.8rem', fontWeight: 700 }}>
                        {String(i + 1)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 600 }}>{u.name}</Typography>
                        <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>{u.bets} open bets</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ color: C.warning, fontWeight: 800, fontSize: '0.9rem' }}>{fmtCurrency(u.liability)}</Typography>
                  </Box>
                  {i < topUsers.length - 1 && <Divider sx={{ borderColor: C.border }} />}
                </Box>
              ))
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: alpha(C.info, 0.12), color: C.info, width: 32, height: 32 }}>
                <SportsCricket sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Top Markets (7d Turnover)</Typography>
            </Box>
            {topSports.length === 0 ? (
              <Typography sx={{ color: C.textMuted, fontSize: '0.85rem', textAlign: 'center', py: 4 }}>
                No settled bets in the last 7 days
              </Typography>
            ) : (
              topSports.map((s, i) => (
                <Box key={`${s.name}-${i}`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box sx={{ width: 8, height: 32, borderRadius: 1, bgcolor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <Box>
                        <Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 600 }}>{s.name}</Typography>
                        <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>{s.bets} bets · {s.won} won</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '0.9rem' }}>{fmtCurrency(s.stake)}</Typography>
                  </Box>
                  {i < topSports.length - 1 && <Divider sx={{ borderColor: C.border }} />}
                </Box>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SportsTab;
