import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Paper, Typography, ToggleButton, ToggleButtonGroup, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, IconButton, Tooltip as MuiTooltip, Chip, alpha,
  Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  PeopleAltOutlined, SavingsOutlined, ShowChartOutlined, GroupsOutlined,
  Refresh, PieChartOutline, TrendingUpOutlined, EmojiEventsOutlined,
  RepeatOutlined, Close,
} from '@mui/icons-material';
import { C, CHART_COLORS, StatCard, ChartCard, CustomTooltip, fmtNum } from '../admin-dashboard/shared';
import {
  fetchSignups, fetchDeposits, fetchRetention, fetchTopAgents,
  SignupsResponse, DepositsResponse, RetentionResponse, TopAgentsResponse, Range,
  CustomerQuery,
} from '../../services/marketingApi';
import CustomerTable from './CustomerTable';

/* Analytics are normalised to USD server-side, so format as USD — the shared
   fmtCurrency helper is INR and would mislabel these figures. */
const fmtUsd = (v: number) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RANGE_PRESETS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '1y', label: '1 year', days: 365 },
];

const toRange = (days: number): Range => {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
};

const prettyDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const MarketingDashboard: React.FC = () => {
  const [rangeKey, setRangeKey] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down modal opened from a stat card. `filter` is the customer query
  // that reproduces exactly the population the card counted.
  const [drill, setDrill] = useState<
    { title: string; caption: string; filter: Omit<CustomerQuery, 'page' | 'search' | 'sort'> } | null
  >(null);

  const [signups, setSignups] = useState<SignupsResponse | null>(null);
  const [deposits, setDeposits] = useState<DepositsResponse | null>(null);
  const [retention, setRetention] = useState<RetentionResponse | null>(null);
  const [topAgents, setTopAgents] = useState<TopAgentsResponse | null>(null);

  const range = useMemo(
    () => toRange(RANGE_PRESETS.find((r) => r.key === rangeKey)?.days ?? 30),
    [rangeKey]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetched together so a slow endpoint doesn't stagger the layout, but
      // settled individually so one failure doesn't blank the whole page.
      const [s, d, r, a] = await Promise.allSettled([
        fetchSignups(range), fetchDeposits(range), fetchRetention(range), fetchTopAgents(range),
      ]);

      if (s.status === 'fulfilled') setSignups(s.value);
      if (d.status === 'fulfilled') setDeposits(d.value);
      if (r.status === 'fulfilled') setRetention(r.value);
      if (a.status === 'fulfilled') setTopAgents(a.value);

      const failed = [s, d, r, a].filter((x) => x.status === 'rejected');
      if (failed.length === 4) setError('Could not load analytics. Please try again.');
      else if (failed.length) setError('Some panels could not be loaded.');
    } catch (e: any) {
      setError(e?.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const channelPie = useMemo(() => ([
    { name: 'Online', value: signups?.byChannel.online ?? 0 },
    { name: 'Agent', value: signups?.byChannel.agent ?? 0 },
  ]), [signups]);

  const signupSeries = useMemo(
    () => (signups?.series ?? []).map((p) => ({ ...p, date: prettyDate(p.date) })),
    [signups]
  );
  const depositSeries = useMemo(
    () => (deposits?.series ?? []).map((p) => ({ ...p, date: prettyDate(p.date) })),
    [deposits]
  );
  const retentionSeries = useMemo(
    () => (retention?.series ?? []).map((p) => ({ ...p, date: prettyDate(p.date) })),
    [retention]
  );

  const online = deposits?.byChannel.online;
  const agent = deposits?.byChannel.agent;
  const blendedConversion = useMemo(() => {
    const cohort = (online?.cohortSize ?? 0) + (agent?.cohortSize ?? 0);
    const conv = (online?.converted ?? 0) + (agent?.converted ?? 0);
    return cohort ? (conv / cohort) * 100 : 0;
  }, [online, agent]);

  const axis = { stroke: C.textMuted, fontSize: 11 };

  return (
    <Box>
      {/* ── header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.3rem' }}>
            Acquisition &amp; Deposits
          </Typography>
          <Typography sx={{ color: C.textSecondary, fontSize: '0.8rem' }}>
            {range.from} → {range.to} · all amounts in USD
          </Typography>
        </Box>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={rangeKey}
          onChange={(_, v) => v && setRangeKey(v)}
          sx={{
            '& .MuiToggleButton-root': {
              color: C.textSecondary, borderColor: C.border, textTransform: 'none',
              fontWeight: 600, fontSize: '0.78rem', px: 1.6,
              '&.Mui-selected': {
                bgcolor: alpha(C.primary, 0.18), color: C.primaryLight,
                '&:hover': { bgcolor: alpha(C.primary, 0.24) },
              },
            },
          }}
        >
          {RANGE_PRESETS.map((r) => (
            <ToggleButton key={r.key} value={r.key}>{r.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <MuiTooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading} sx={{ color: C.textSecondary }}>
              <Refresh />
            </IconButton>
          </span>
        </MuiTooltip>
      </Box>

      {error && (
        <Alert
          severity="warning"
          sx={{
            mb: 2.5, borderRadius: 2, bgcolor: alpha(C.warning, 0.12),
            color: C.text, border: `1px solid ${alpha(C.warning, 0.35)}`,
            '& .MuiAlert-icon': { color: C.warning },
          }}
        >
          {error}
        </Alert>
      )}


      {/* ── stat row ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<PeopleAltOutlined />} iconBg={C.primary}
            title="New customers"
            value={fmtNum(signups?.total ?? 0)}
            subtitle={`${fmtNum(signups?.byChannel.online ?? 0)} online · ${fmtNum(signups?.byChannel.agent ?? 0)} agent`}
            onClick={() => setDrill({
              title: 'New customers',
              caption: `Registered between ${range.from} and ${range.to}`,
              filter: { newOnly: true, from: range.from, to: range.to },
            })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<SavingsOutlined />} iconBg={C.success}
            title="Deposit volume"
            value={fmtUsd(deposits?.totals.volume ?? 0)}
            subtitle={`${fmtNum(deposits?.totals.count ?? 0)} deposits`}
            onClick={() => setDrill({
              title: 'Depositing customers',
              caption: 'Every customer with at least one successful deposit, highest first',
              filter: { depositors: true },
            })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<ShowChartOutlined />} iconBg={C.info}
            title="Average deposit"
            value={fmtUsd(deposits?.totals.average ?? 0)}
            subtitle="per transaction"
            onClick={() => setDrill({
              title: 'Deposits by customer',
              caption: 'The deposits this average is calculated from',
              filter: { depositors: true },
            })}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            loading={loading} icon={<TrendingUpOutlined />} iconBg={C.warning}
            title="Deposit conversion"
            value={`${blendedConversion.toFixed(1)}%`}
            subtitle="of new signups deposited"
            onClick={() => setDrill({
              title: 'Converted customers',
              caption: `Registered in this period and deposited at least once`,
              filter: { newOnly: true, depositors: true, from: range.from, to: range.to },
            })}
          />
        </Grid>
      </Grid>

      {/* ── charts ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <ChartCard title="Signups — online vs agent" icon={<PeopleAltOutlined fontSize="small" />}>
            {loading ? (
              <Skeleton variant="rectangular" height="100%" sx={{ bgcolor: C.cardHover, borderRadius: 2 }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signupSeries}>
                  <defs>
                    <linearGradient id="gOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.primary} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={C.primary} stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="gAgent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.success} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={C.success} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="date" {...axis} tickLine={false} axisLine={false} />
                  <YAxis {...axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.textSecondary }} />
                  <Area type="monotone" dataKey="online" name="Online" stroke={C.primary} fill="url(#gOnline)" strokeWidth={2} />
                  <Area type="monotone" dataKey="agent" name="Agent" stroke={C.success} fill="url(#gAgent)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <ChartCard title="Acquisition channel" icon={<PieChartOutline fontSize="small" />}>
            {loading ? (
              <Skeleton variant="rectangular" height="100%" sx={{ bgcolor: C.cardHover, borderRadius: 2 }} />
            ) : (signups?.total ?? 0) === 0 ? (
              <EmptyState text="No signups in this period" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channelPie} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {channelPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.textSecondary }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <ChartCard title="Deposit volume by channel (USD)" icon={<SavingsOutlined fontSize="small" />}>
            {loading ? (
              <Skeleton variant="rectangular" height="100%" sx={{ bgcolor: C.cardHover, borderRadius: 2 }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={depositSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="date" {...axis} tickLine={false} axisLine={false} />
                  <YAxis {...axis} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.textSecondary }} />
                  <Bar dataKey="online" name="Online" fill={C.primary} radius={[4, 4, 0, 0]} stackId="v" />
                  <Bar dataKey="agent" name="Agent" fill={C.success} radius={[4, 4, 0, 0]} stackId="v" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <ChartCard title="Active depositors per day" icon={<RepeatOutlined fontSize="small" />}>
            {loading ? (
              <Skeleton variant="rectangular" height="100%" sx={{ bgcolor: C.cardHover, borderRadius: 2 }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={retentionSeries}>
                  <defs>
                    <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.info} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.info} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="date" {...axis} tickLine={false} axisLine={false} />
                  <YAxis {...axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="activeDepositors" name="Depositors" stroke={C.info} fill="url(#gActive)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── channel comparison ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {([['Online', online, retention?.byChannel.online], ['Agent', agent, retention?.byChannel.agent]] as const).map(
          ([label, dep, ret]) => (
            <Grid item xs={12} md={6} key={label}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
                <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem', mb: 2 }}>
                  {label} customers
                </Typography>
                <Grid container spacing={2}>
                  <Metric label="Deposit volume" value={fmtUsd(dep?.volume ?? 0)} />
                  <Metric label="Average deposit" value={fmtUsd(dep?.average ?? 0)} />
                  <Metric label="Depositors" value={fmtNum(dep?.depositors ?? 0)} />
                  <Metric label="Deposits" value={fmtNum(dep?.count ?? 0)} />
                  <Metric label="Signup → deposit" value={`${(dep?.conversionRate ?? 0).toFixed(1)}%`} />
                  <Metric label="Repeat rate" value={`${(ret?.repeatRate ?? 0).toFixed(1)}%`} />
                </Grid>
              </Paper>
            </Grid>
          )
        )}
      </Grid>

      {/* ── top agents ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2.5, borderBottom: `1px solid ${C.border}` }}>
          <EmojiEventsOutlined sx={{ color: C.warning }} />
          <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>
            Top agents by acquisition
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ p: 2.5 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} sx={{ bgcolor: C.cardHover, mb: 1 }} />
            ))}
          </Box>
        ) : !topAgents?.agents.length ? (
          <Box sx={{ p: 4 }}><EmptyState text="No agent-acquired customers in this period" /></Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['#', 'Agent', 'Code', 'Role', 'Customers', 'Deposits', 'Volume (USD)'].map((h, i) => (
                    <TableCell
                      key={h}
                      align={i >= 4 ? 'right' : 'left'}
                      sx={{ color: C.textMuted, borderColor: C.border, fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {topAgents.agents.map((a, i) => (
                  <TableRow key={a.agentId} hover sx={{ '&:hover': { bgcolor: C.cardHover } }}>
                    <TableCell sx={{ color: C.textMuted, borderColor: C.border }}>{i + 1}</TableCell>
                    <TableCell sx={{ color: C.text, borderColor: C.border, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {a.agentName}
                    </TableCell>
                    <TableCell sx={{ borderColor: C.border }}>
                      <Chip size="small" label={a.agentCode || '—'}
                        sx={{ bgcolor: alpha(C.primary, 0.12), color: C.primaryLight, fontWeight: 700, fontSize: '0.68rem' }} />
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, borderColor: C.border }}>{a.role || '—'}</TableCell>
                    <TableCell align="right" sx={{ color: C.text, borderColor: C.border, fontWeight: 700 }}>
                      {fmtNum(a.customers)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: C.textSecondary, borderColor: C.border }}>
                      {fmtNum(a.depositCount)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: C.success, borderColor: C.border, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {fmtUsd(a.depositVolume)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', mt: 2.5 }}>
        “Online” means a customer who registered directly; “agent” means one onboarded under an agent
        referral code. Active depositors counts customers who deposited that day, not sign-ins.
      </Typography>

      {/* ── stat-card drill-down ── */}
      <Dialog
        open={drill !== null}
        onClose={() => setDrill(null)}
        fullWidth
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 3, backgroundImage: 'none' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, pb: 1.5 }}>
          <Box sx={{ mr: 'auto' }}>
            <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.05rem' }}>
              {drill?.title}
            </Typography>
            <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>
              {drill?.caption}
            </Typography>
          </Box>
          <IconButton onClick={() => setDrill(null)} size="small" sx={{ color: C.textMuted }} aria-label="Close">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          {/* Mounted only while open so it fetches on demand, and remounts per
              card rather than reusing a stale filter. */}
          {drill && <CustomerTable query={drill.filter} showAgent dense pageSize={25} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Grid item xs={6} sm={4}>
    <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', mb: 0.3 }}>{label}</Typography>
    <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '1rem' }}>{value}</Typography>
  </Grid>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
    <GroupsOutlined sx={{ color: C.textMuted, fontSize: 34, opacity: 0.5 }} />
    <Typography sx={{ color: C.textMuted, fontSize: '0.82rem' }}>{text}</Typography>
  </Box>
);

export default MarketingDashboard;
