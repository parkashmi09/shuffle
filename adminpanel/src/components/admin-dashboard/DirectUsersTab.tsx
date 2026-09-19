import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Grid, Avatar, Chip, Divider, Alert,
  IconButton, Tooltip as MuiTooltip, alpha,
} from '@mui/material';
import {
  PeopleAlt, AccountBalanceWallet, TrendingUp, TrendingDown,
  ArrowUpward, ArrowDownward, Refresh, HowToReg,
  CurrencyExchange, CalendarToday, ShowChart, PieChartOutline,
  AssessmentOutlined, AccountBalance, Savings, Receipt, InfoOutlined,
} from '@mui/icons-material';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { C, CHART_COLORS, StatCard, ChartCard, CustomTooltip, fmtMoney, fmtNum, pct } from './shared';
import DrilldownModal, { DrilldownRequest } from './DrilldownModal';
import { apiFetch } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS TAB READ A PAYLOAD THE API HAS NEVER SENT
 *
 * It was written against the legacy dashboard — `totalUsers`,
 * `deposits.total`, `deposits.breakdown.crypto`, `financials.netBalance`,
 * `activeUsers30d` — and the port answers a different tree entirely:
 *
 *   GET /dashboard/            {users:{total,newToday,asOfMidnight},
 *                               deposits:{lifetime,today}, withdrawals:{…},
 *                               net:{today,lifetime}, valuation:{…}}
 *   GET /dashboard/user-stats  {total, newToday, registeredLast30Days,
 *                               registeredPrevious30Days, verified,
 *                               topCountries, registrationTrend}
 *
 * Not one of the old keys exists, so the normaliser coerced every figure to
 * zero and the screen showed ₹0.00 across the board. The two charts kept
 * working because `topCountries` and `registrationTrend` are the only names
 * the two shapes happen to share — which is exactly the pattern the screenshot
 * showed: charts with data, every number beside them zero.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** One currency's contribution to a total, already converted. */
interface CurrencyLeg { currency: string; amount: string; usd: string; count: number; }
/** Volume that reached NO total, and why — see `#convert` in the service. */
interface UnconvertedLeg { currency: string | null; amount: string; count: number; reason: string; }
interface Converted {
  usd: string; count: number; byCurrency: CurrencyLeg[]; unconverted: UnconvertedLeg[];
}
interface Movement { lifetime: Converted; today: Converted; }
interface Valuation { currency: string; note: string; ratesAsOf: string | null; knownCurrencies: number; }
interface Overview {
  users: { total: number; newToday: number; asOfMidnight: number };
  deposits: Movement;
  withdrawals: Movement;
  net: { today: string; lifetime: string };
  valuation: Valuation;
}
interface CountryItem { country: string; count: number; }
interface RegistrationTrendItem { date: string; count: number; }
interface UserStats {
  total: number; newToday: number; asOfMidnight: number;
  registeredLast30Days: number; registeredPrevious30Days: number;
  verified: number;
  topCountries: CountryItem[]; registrationTrend: RegistrationTrendItem[];
}

const str = (v: unknown, fallback = '0') => (v === null || v === undefined ? fallback : String(v));
const num = (v: unknown) => Number(v) || 0;

/**
 * A converted total, with every branch rebuilt.
 *
 * An error envelope, a day with no deposits and a gateway that omits a key all
 * arrive as the same thing here — an object with holes — and everything below
 * reads it unguarded.
 */
const convertedOf = (raw: any): Converted => ({
  usd: str(raw?.usd),
  count: num(raw?.count),
  byCurrency: Array.isArray(raw?.byCurrency)
    ? raw.byCurrency.map((r: any) => ({
        currency: str(r?.currency, '—'),
        amount: str(r?.amount),
        usd: str(r?.usd),
        count: num(r?.count),
      }))
    : [],
  unconverted: Array.isArray(raw?.unconverted)
    ? raw.unconverted.map((r: any) => ({
        currency: r?.currency ?? null,
        amount: str(r?.amount),
        count: num(r?.count),
        reason: str(r?.reason, 'unknown'),
      }))
    : [],
});

const movementOf = (raw: any): Movement => ({
  lifetime: convertedOf(raw?.lifetime),
  today: convertedOf(raw?.today),
});

const normalizeOverview = (raw: any): Overview => ({
  users: {
    total: num(raw?.users?.total),
    newToday: num(raw?.users?.newToday),
    asOfMidnight: num(raw?.users?.asOfMidnight),
  },
  deposits: movementOf(raw?.deposits),
  withdrawals: movementOf(raw?.withdrawals),
  net: { today: str(raw?.net?.today), lifetime: str(raw?.net?.lifetime) },
  valuation: {
    // The dashboard converts everything through `exchangerate.usd_rate`; the
    // symbol comes from the payload rather than being assumed.
    currency: str(raw?.valuation?.currency, 'USD'),
    note: str(raw?.valuation?.note, ''),
    ratesAsOf: raw?.valuation?.ratesAsOf ?? null,
    knownCurrencies: num(raw?.valuation?.knownCurrencies),
  },
});

const normalizeStats = (raw: any): UserStats => ({
  total: num(raw?.total),
  newToday: num(raw?.newToday),
  asOfMidnight: num(raw?.asOfMidnight),
  registeredLast30Days: num(raw?.registeredLast30Days),
  registeredPrevious30Days: num(raw?.registeredPrevious30Days),
  verified: num(raw?.verified),
  topCountries: Array.isArray(raw?.topCountries)
    ? raw.topCountries.map((c: any) => ({ country: str(c?.country, '—'), count: num(c?.count) }))
    : [],
  registrationTrend: Array.isArray(raw?.registrationTrend)
    ? raw.registrationTrend.map((r: any) => ({ date: str(r?.date, ''), count: num(r?.count) }))
    : [],
});

/** `byCurrency` → pie slices, dropping the zero legs that render as nothing. */
const toSlices = (legs: CurrencyLeg[]) =>
  legs
    .map((leg) => ({ name: leg.currency, value: parseFloat(leg.usd) || 0 }))
    .filter((slice) => slice.value > 0);

const DirectUsersTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<Overview>(() => normalizeOverview(null));
  const [userStats, setUserStats] = useState<UserStats>(() => normalizeStats(null));
  /**
   * Which card was opened, and on which window.
   *
   * The card carries its own scope through, so clicking "Today's Deposits"
   * opens the modal already filtered to today rather than to all time — the
   * drill-down starts on the number that was clicked.
   */
  const [drilldown, setDrilldown] = useState<DrilldownRequest | null>(null);
  const open = (request: DrilldownRequest) => () => setDrilldown(request);

  const fetchAll = async () => {
    setLoading(true);
    const [dashRes, statsRes] = await Promise.allSettled([
      apiFetch<Overview>(ENDPOINTS.dashboard.summary),
      apiFetch<UserStats>(ENDPOINTS.dashboard.userStats),
    ]);

    if (dashRes.status === 'fulfilled') setOverview(normalizeOverview(dashRes.value));
    if (statsRes.status === 'fulfilled') setUserStats(normalizeStats(statsRes.value));

    /**
     * A failed fetch used to be swallowed, so "the API is down" and "the
     * platform took nothing today" both rendered as zeros. They are not the
     * same thing and the screen now says which.
     */
    const failure = [dashRes, statsRes].find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    setError(failure ? failure.reason?.message || 'Could not load dashboard data' : '');

    setLoading(false);
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 300000); return () => clearInterval(i); }, []);

  const cur = overview.valuation.currency;
  const money = (v: string | number | null | undefined) => fmtMoney(v, cur);

  const depositSlices = useMemo(() => toSlices(overview.deposits.lifetime.byCurrency), [overview]);
  const withdrawSlices = useMemo(() => toSlices(overview.withdrawals.lifetime.byCurrency), [overview]);

  const trendData = useMemo(() =>
    userStats.registrationTrend.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      users: item.count,
    })),
    [userStats]
  );

  const countryData = useMemo(() => userStats.topCountries.slice(0, 8), [userStats]);
  const netBal = parseFloat(overview.net.lifetime);
  const todayNet = parseFloat(overview.net.today);

  /**
   * Volume that reached no total. The service reports it deliberately — a
   * deposit in a currency with no `exchangerate` row is missing from the
   * headline figure, and legacy's INNER JOIN dropped it in silence.
   */
  const unconverted = useMemo(() => [
    ...overview.deposits.lifetime.unconverted,
    ...overview.withdrawals.lifetime.unconverted,
  ], [overview]);

  const verifiedPct = userStats.total > 0
    ? ((userStats.verified / userStats.total) * 100).toFixed(1)
    : '0';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: { xs: '1.3rem', sm: '1.5rem' }, lineHeight: 1.2 }}>
            Direct Users Overview
          </Typography>
          <Typography sx={{ color: C.textMuted, fontSize: '0.78rem', mt: 0.25 }}>
            Registrations, deposits &amp; withdrawals for direct platform users
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<CalendarToday sx={{ fontSize: 14 }} />}
            label={new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            size="small"
            sx={{ bgcolor: C.cardLight, color: C.textMuted, border: `1px solid ${C.border}`, fontWeight: 500, '& .MuiChip-icon': { color: C.textSecondary } }}
          />
          <MuiTooltip title="Refresh data">
            <IconButton onClick={fetchAll} size="small" sx={{ color: C.textSecondary, bgcolor: C.cardLight, border: `1px solid ${C.border}`, '&:hover': { bgcolor: C.cardHover, borderColor: C.primary } }}>
              <Refresh fontSize="small" />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, bgcolor: alpha(C.error, 0.1), color: C.text, border: `1px solid ${alpha(C.error, 0.3)}` }}>
          {error}
        </Alert>
      )}

      {/* The headline figures are INCOMPLETE by the amounts listed. */}
      {unconverted.length > 0 && (
        <Alert
          severity="warning"
          icon={<InfoOutlined fontSize="small" />}
          sx={{ mb: 2.5, bgcolor: alpha(C.warning, 0.1), color: C.text, border: `1px solid ${alpha(C.warning, 0.3)}` }}
        >
          Totals exclude{' '}
          {unconverted.map((u, i) => (
            <span key={`${u.currency}-${i}`}>
              {i > 0 ? ', ' : ''}
              <strong>{u.amount} {u.currency ?? 'unknown coin'}</strong> ({u.reason})
            </span>
          ))}
          .
        </Alert>
      )}

      {/* Row 1: Main Stats */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<PeopleAlt />} iconBg={C.primaryLight}
            title="Total Users" value={fmtNum(overview.users.total)}
            subtitle={`New today: ${fmtNum(overview.users.newToday)}`}
            // `asOfMidnight` is the count before today's signups — so this is
            // today's growth, which is the only comparison the API carries.
            change={pct(overview.users.total, overview.users.asOfMidnight)}
            onClick={open({ kind: 'users', title: 'All registered players', scope: 'overall' })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          {/* No previous-period figure exists for money, so no change chip —
              the old one was a hardcoded +0.0% on every card. */}
          <StatCard
            loading={loading} icon={<Savings />} iconBg={C.success}
            title="Total Deposits" value={money(overview.deposits.lifetime.usd)}
            subtitle={`Today: ${money(overview.deposits.today.usd)}`}
            onClick={open({ kind: 'deposits', title: 'All deposits', scope: 'overall' })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<AccountBalanceWallet />} iconBg={C.error}
            title="Total Withdrawals" value={money(overview.withdrawals.lifetime.usd)}
            subtitle={`Today: ${money(overview.withdrawals.today.usd)}`}
            onClick={open({ kind: 'withdrawals', title: 'All withdrawals', scope: 'overall' })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<CurrencyExchange />} iconBg="#7B5EF5"
            title="Net Balance" value={money(overview.net.lifetime)}
            subtitle={`Today: ${money(overview.net.today)}`}
            // Net is deposits minus withdrawals, so it drills into both sides.
            onClick={open({ kind: 'both', title: 'All money movements', scope: 'overall' })}
          />
        </Grid>
      </Grid>

      {/* Row 2: Secondary Stats */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          {/*
            NOT "Active Users". The API renamed this field because the query
            behind it counts REGISTRATIONS in the window — `created` is the
            signup date, so a player who joined two years ago and bet this
            morning was never in it. The platform has no session table to
            derive real activity from; the label matches the number.
          */}
          <StatCard
            loading={loading} icon={<HowToReg />} iconBg={C.info}
            title="Registered (30d)" value={fmtNum(userStats.registeredLast30Days)}
            subtitle={`Previous 30d: ${fmtNum(userStats.registeredPrevious30Days)}`}
            change={pct(userStats.registeredLast30Days, userStats.registeredPrevious30Days)}
            // Opens on a custom window the operator can move; the modal
            // defaults it to today and they widen from there.
            onClick={open({ kind: 'users', title: 'Registrations in range', scope: 'custom' })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<ArrowUpward />} iconBg={C.success}
            title="Today's Deposits" value={money(overview.deposits.today.usd)}
            subtitle={`${fmtNum(overview.deposits.today.count)} transactions`}
            onClick={open({ kind: 'deposits', title: "Today's deposits", scope: 'today' })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<ArrowDownward />} iconBg={C.error}
            title="Today's Withdrawals" value={money(overview.withdrawals.today.usd)}
            subtitle={`${fmtNum(overview.withdrawals.today.count)} transactions`}
            onClick={open({ kind: 'withdrawals', title: "Today's withdrawals", scope: 'today' })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<Receipt />} iconBg={C.warning}
            title="Verified Users" value={fmtNum(userStats.verified)}
            subtitle={`KYC: ${verifiedPct}% of ${fmtNum(userStats.total)}`}
            onClick={open({ kind: 'users', title: 'Players and their KYC status', scope: 'overall' })}
          />
        </Grid>
      </Grid>

      {/* Row 3: Charts */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={8}>
          <ChartCard title="User Registration Trend" icon={<ShowChart sx={{ fontSize: 18 }} />} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="users" name="New Users" stroke={C.primary} strokeWidth={2.5} fill="url(#colorUsers)" dot={false} activeDot={{ r: 5, fill: C.primary, stroke: C.text, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <ChartCard title="Top Countries" icon={<AssessmentOutlined sx={{ fontSize: 18 }} />} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="country" type="category" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Users" radius={[0, 6, 6, 0]} barSize={18}>
                  {countryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/*
        Row 4: split BY CURRENCY, which is the only split the API has.
        The old pies were hardcoded Crypto/Fiat against keys the payload does
        not carry, so both were permanently empty.
      */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { title: 'Deposits by Currency', slices: depositSlices, legs: overview.deposits.lifetime.byCurrency },
          { title: 'Withdrawals by Currency', slices: withdrawSlices, legs: overview.withdrawals.lifetime.byCurrency },
        ].map((panel) => (
          <Grid item xs={12} md={6} key={panel.title}>
            <ChartCard title={panel.title} icon={<PieChartOutline sx={{ fontSize: 18 }} />} height={240}>
              {panel.slices.length === 0 ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: C.textMuted, fontSize: '0.8rem' }}>No settled volume yet</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', height: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={panel.slices} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                          {panel.slices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, minWidth: 150, maxHeight: '100%', overflowY: 'auto' }}>
                    {panel.legs.map((leg, i) => (
                      <Box key={leg.currency} sx={{ bgcolor: C.cardHover, borderRadius: 2, p: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>{leg.currency}</Typography>
                        </Box>
                        <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem' }}>{money(leg.usd)}</Typography>
                        <Typography sx={{ color: C.textSecondary, fontSize: '0.65rem' }}>
                          {leg.amount} {leg.currency} · {fmtNum(leg.count)} txns
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </ChartCard>
          </Grid>
        ))}
      </Grid>

      {/* Row 5: Today's Activity */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: alpha(C.info, 0.12), color: C.info, width: 32, height: 32 }}>
                <AssessmentOutlined sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Today's Activity</Typography>
            </Box>
            <Grid container spacing={2}>
              {[
                { label: 'Deposits', tone: C.success, side: overview.deposits.today },
                { label: 'Withdrawals', tone: C.error, side: overview.withdrawals.today },
              ].map(({ label, tone, side }) => (
                <Grid item xs={12} md={6} key={label}>
                  <Box sx={{ bgcolor: C.cardHover, borderRadius: 2, p: 2, border: `1px solid ${alpha(tone, 0.2)}`, height: '100%' }}>
                    <Typography sx={{ color: tone, fontWeight: 700, fontSize: '0.85rem', mb: 1.5 }}>{label}</Typography>
                    {side.byCurrency.length === 0 ? (
                      <Typography sx={{ color: C.textMuted, fontSize: '0.75rem' }}>Nothing settled today</Typography>
                    ) : (
                      <Grid container spacing={1.5}>
                        {side.byCurrency.map((leg) => (
                          <Grid item xs={6} key={leg.currency}>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>{leg.currency}</Typography>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.9rem' }}>{money(leg.usd)}</Typography>
                            <Typography sx={{ color: C.textSecondary, fontSize: '0.65rem' }}>{fmtNum(leg.count)} txns</Typography>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                    <Divider sx={{ my: 1.5, borderColor: C.border }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>
                        Total · {fmtNum(side.count)} txns
                      </Typography>
                      <Typography sx={{ color: tone, fontWeight: 800, fontSize: '0.9rem' }}>{money(side.usd)}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: alpha('#7B5EF5', 0.12), color: '#7B5EF5', width: 32, height: 32 }}>
                <AccountBalance sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Financial Summary</Typography>
            </Box>
            <Box sx={{ bgcolor: C.cardHover, borderRadius: 2, p: 2, mb: 1.5, border: `1px solid ${C.border}` }}>
              <Typography sx={{ color: C.textMuted, fontSize: '0.7rem', mb: 0.5 }}>All-time Net Balance</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: netBal >= 0 ? C.success : C.error, fontWeight: 800, fontSize: '1.3rem' }}>
                  {money(overview.net.lifetime)}
                </Typography>
                {netBal >= 0 ? <TrendingUp sx={{ color: C.success, fontSize: 28 }} /> : <TrendingDown sx={{ color: C.error, fontSize: 28 }} />}
              </Box>
            </Box>
            <Box sx={{ bgcolor: C.cardHover, borderRadius: 2, p: 2, border: `1px solid ${C.border}` }}>
              <Typography sx={{ color: C.textMuted, fontSize: '0.7rem', mb: 0.5 }}>Today's Net Balance</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: todayNet >= 0 ? C.success : C.error, fontWeight: 800, fontSize: '1.3rem' }}>
                  {money(overview.net.today)}
                </Typography>
                {todayNet >= 0 ? <TrendingUp sx={{ color: C.success, fontSize: 28 }} /> : <TrendingDown sx={{ color: C.error, fontSize: 28 }} />}
              </Box>
            </Box>
            {/*
              The health warning the API ships on every payload: lifetime
              totals are marked to TODAY's rates, so they move when rates do.
            */}
            {overview.valuation.note && (
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5 }}>
                <InfoOutlined sx={{ color: C.textSecondary, fontSize: 14, mt: '2px', flexShrink: 0 }} />
                <Typography sx={{ color: C.textSecondary, fontSize: '0.65rem', lineHeight: 1.5 }}>
                  {overview.valuation.note}
                  {overview.valuation.ratesAsOf
                    ? ` Rates as of ${new Date(overview.valuation.ratesAsOf).toLocaleString()}.`
                    : ''}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <DrilldownModal request={drilldown} onClose={() => setDrilldown(null)} />
    </Box>
  );
};

export default DirectUsersTab;
