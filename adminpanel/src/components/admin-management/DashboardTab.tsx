import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Chip, Grid, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip as MuiTooltip, Typography, alpha,
} from '@mui/material';
import {
  AccountBalance, AccountTree, AssessmentOutlined, CalendarToday,
  Casino, PeopleAlt, PieChartOutline, Receipt, Refresh, ShowChart,
  SportsEsports, SwapHoriz, TrendingUp, Warning,
} from '@mui/icons-material';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useTree } from '../../hooks/useTree';
import { apiFetch } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';
import * as lordsApi from '../../services/lordsApi';
import { Transfer, partyLabel } from '../../services/transfers';
import {
  C, ChartCard, CustomTooltip, StatCard, fmtInr, fmtNum, isToday,
} from '../admin-dashboard/shared';

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: '#F9F9F9',
  Admin: '#E01B4F',
  SubAdmin: '#FFC23F',
  Master: '#886CFF',
  Agent: '#0ECC68',
  SubAgent: '#7B5EF5',
  User: '#8384A5',
};

interface AgentRow {
  id: number;
  username: string;
  role: string;
  account_type: 'STAFF' | 'USER';
  /** Real INR wallet balance — no credit limit backs it. */
  balance: number;
  exposure: number;
  /** Lifetime sports P&L you made from this account (+ = you earned). */
  sports_pnl: number;
  /** Lifetime casino P&L you made from this account (+ = you earned). */
  casino_pnl: number;
  status: string;
  has_downline: boolean;
}

/**
 * `/accounts/statement` returns the same nested row as `/staff/transfers`.
 * This was declared flat and snake_case, so `created_at` was `undefined` —
 * "today" counted nothing, the recent-activity sort compared Invalid Dates,
 * and every row rendered as "— → —".
 */
type TransferRow = Transfer & { note?: string | null };

interface CurrentStaff {
  id: number;
  name: string;
  role: string;
  level: number;
  credit?: number;
}

interface TransfersSummary {
  status: string;
  total_deposit: string | number | null;
  total_withdraw: string | number | null;
}

/* Money now moves one of two ways. Legacy 'collect'/'pay' rows are settlement
   history from the retired G/T model — they still appear in the statement, so
   they get their own label rather than being miscounted as deposits. */
type TransferKind = 'deposit' | 'withdraw' | 'legacy';

const classifyKind = (r: TransferRow): TransferKind => {
  if (r.direction === 'deposit') return 'deposit';
  if (r.direction === 'withdraw') return 'withdraw';
  return 'legacy';
};

const KIND_META = {
  deposit:  { label: 'Deposit',  color: '#0ECC68' },
  withdraw: { label: 'Withdraw', color: '#E01B4F' },
  legacy:   { label: 'Legacy settlement', color: '#8384A5' },
} as const;

export default function DashboardTab() {
  const { metrics, analytics, loading: treeLoading } = useTree();
  const [me, setMe] = useState<CurrentStaff | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [allTransfers, setAllTransfers] = useState<TransferRow[]>([]);
  const [summary, setSummary] = useState<TransfersSummary | null>(null);
  const [extraLoading, setExtraLoading] = useState(true);

  const fetchExtras = useCallback(async () => {
    setExtraLoading(true);
    try {
      const [meR, agR, allR, sumR] = await Promise.allSettled([
        lordsApi.updateCurrent(),
        lordsApi.getAllDetails({ page: 1, limit: 100 }),
        lordsApi.getTransferStatement({ page: 1, limit: 100 }),
        apiFetch<TransfersSummary>(ENDPOINTS.staff.transfersSummary),
      ]);
      // `updateCurrent` is an alias for `getAllDetails` — a paged LIST, not
      // the caller's own record — so `me` was always the first page's array.
      if (meR.status === 'fulfilled') {
        const rows = meR.value?.data ?? [];
        const myId = Number(localStorage.getItem('currentUserId'));
        setMe((rows.find((r: any) => Number(r?.id) === myId) ?? null) as CurrentStaff);
      }
      if (agR.status === 'fulfilled') setAgents(agR.value?.data || []);
      if (allR.status === 'fulfilled') setAllTransfers(allR.value?.data || []);
      if (sumR.status === 'fulfilled') setSummary(sumR.value || null);
    } catch (e) { /* silent */ }
    setExtraLoading(false);
  }, []);

  useEffect(() => {
    fetchExtras();
    const i = setInterval(fetchExtras, 300000);
    return () => clearInterval(i);
  }, [fetchExtras]);

  const loading = treeLoading || extraLoading;

  /* ─── Derived metrics ─── */
  const staffAgg = useMemo(() => {
    const staff = agents.filter(a => a.account_type === 'STAFF');
    const totalDownlineBalance = agents.reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalExposure = agents.reduce((s, a) => s + Number(a.exposure || 0), 0);
    // Lifetime P&L across the direct tree. Only USER rows are summed — a staff
    // row already carries the roll-up of everyone beneath it, so adding both
    // would count the same players twice.
    const users = agents.filter(a => a.account_type === 'USER');
    const sportsPnl = users.reduce((s, a) => s + Number(a.sports_pnl || 0), 0);
    const casinoPnl = users.reduce((s, a) => s + Number(a.casino_pnl || 0), 0);
    const activeStaff = staff.filter(s => s.status === 'active').length;
    const activeUsers = users.filter(u => u.status === 'active').length;

    const roleMap: Record<string, number> = {};
    const roleBalance: Record<string, number> = {};
    for (const a of agents) {
      roleMap[a.role] = (roleMap[a.role] || 0) + 1;
      roleBalance[a.role] = (roleBalance[a.role] || 0) + Number(a.balance || 0);
    }

    return {
      staffCount: staff.length,
      userCount: users.length,
      activeStaff,
      activeUsers,
      totalDownlineBalance,
      totalExposure,
      sportsPnl,
      casinoPnl,
      roleMap,
      roleBalance,
    };
  }, [agents]);

  const classified = useMemo(
    () => allTransfers.map(t => ({ ...t, kind: classifyKind(t) })),
    [allTransfers]
  );

  const transferAgg = useMemo(() => {
    const sumOf = (rows: typeof classified) =>
      rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const todayOf = (rows: typeof classified) =>
      rows.filter(r => isToday(r.createdAt ?? ''));

    const deposits = classified.filter(r => r.kind === 'deposit');
    const withdrawals = classified.filter(r => r.kind === 'withdraw');

    return {
      totalDeposited: sumOf(deposits),
      totalWithdrawn: sumOf(withdrawals),
      todayDeposited: sumOf(todayOf(deposits)),
      todayWithdrawn: sumOf(todayOf(withdrawals)),
      todayCount: todayOf(classified).length,
      depositCount: deposits.length,
      withdrawCount: withdrawals.length,
    };
  }, [classified]);

  const recentActivity = useMemo(
    () => [...classified]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 10),
    [classified]
  );

  const topStaff = useMemo(
    () => agents
      .filter(a => a.account_type === 'STAFF')
      .slice()
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 6),
    [agents]
  );

  const roleDistribution = useMemo(
    () => Object.entries(staffAgg.roleMap).map(([role, count]) => ({
      name: role, value: count, fill: ROLE_COLORS[role] || '#8384A5',
    })),
    [staffAgg]
  );

  const staffTrendData = useMemo(() => {
    if (!analytics?.staffTrend) return [];
    return analytics.staffTrend.map(d => ({
      day: new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' }),
      count: d.count,
    }));
  }, [analytics]);

  const playerTrendData = useMemo(() => {
    if (!analytics?.playerTrend) return [];
    return analytics.playerTrend.map(d => ({
      day: new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' }),
      count: d.count,
    }));
  }, [analytics]);

  const newStaffToday = analytics?.staffTrend?.find(d => isToday(d.day))?.count ?? 0;
  const newPlayersToday = analytics?.playerTrend?.find(d => isToday(d.day))?.count ?? 0;
  const ownBalance = Number(metrics?.bank ?? me?.credit ?? 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: { xs: '1.3rem', sm: '1.5rem' }, lineHeight: 1.2 }}>
            Management Overview
          </Typography>
          <Typography sx={{ color: C.textMuted, fontSize: '0.78rem', mt: 0.25 }}>
            {me ? `${me.name} · ${me.role}` : 'Your downline at a glance'}
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
            <IconButton onClick={fetchExtras} size="small"
              sx={{ color: C.textSecondary, bgcolor: C.cardLight, border: `1px solid ${C.border}`, '&:hover': { bgcolor: C.cardHover, borderColor: C.primary } }}>
              <Refresh fontSize="small" />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* Row 1: Downline KPIs */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AccountTree />} iconBg={C.primaryLight}
            title="Staff in Downline" value={fmtNum(metrics?.staff_cnt ?? staffAgg.staffCount)}
            subtitle={`Active now: ${fmtNum(staffAgg.activeStaff)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<PeopleAlt />} iconBg={C.info}
            title="Players Under You" value={fmtNum(metrics?.player_cnt ?? staffAgg.userCount)}
            subtitle={`New today: ${fmtNum(newPlayersToday)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AccountBalance />} iconBg={C.warning}
            title="Your Balance" value={fmtInr(ownBalance)}
            subtitle="Own staff_balances.inr" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AccountBalance />} iconBg="#7B5EF5"
            title="Direct Tree Balance" value={fmtInr(staffAgg.totalDownlineBalance)}
            subtitle="Real funds held by your direct downline" />
        </Grid>
      </Grid>

      {/* Row 2: Transfer & settlement activity */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SwapHoriz />} iconBg={C.success}
            title="Deposited" value={fmtInr(transferAgg.totalDeposited)}
            subtitle={`${fmtNum(transferAgg.depositCount)} deposits · today ${fmtInr(transferAgg.todayDeposited)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SwapHoriz />} iconBg={C.error}
            title="Withdrawn" value={fmtInr(transferAgg.totalWithdrawn)}
            subtitle={`${fmtNum(transferAgg.withdrawCount)} withdrawals · today ${fmtInr(transferAgg.todayWithdrawn)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Receipt />} iconBg={C.warning}
            title="Today's Activity" value={fmtNum(transferAgg.todayCount)}
            subtitle={`Net today: ${fmtInr(transferAgg.todayDeposited - transferAgg.todayWithdrawn)}`} />
        </Grid>
      </Grid>

      {/* Row 3: lifetime P&L + new registrations */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SportsEsports />}
            iconBg={staffAgg.sportsPnl >= 0 ? C.success : C.error}
            title="Sports P&L" value={fmtInr(staffAgg.sportsPnl)}
            subtitle={staffAgg.sportsPnl >= 0 ? 'You are up, lifetime' : 'You are down, lifetime'} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Casino />}
            iconBg={staffAgg.casinoPnl >= 0 ? C.success : C.error}
            title="Casino P&L" value={fmtInr(staffAgg.casinoPnl)}
            subtitle={staffAgg.casinoPnl >= 0 ? 'You are up, lifetime' : 'You are down, lifetime'} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Warning />} iconBg={C.error}
            title="Net Exposure" value={fmtInr(staffAgg.totalExposure)}
            subtitle="Live across downline" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<PeopleAlt />} iconBg={C.info}
            title="New Staff Today" value={fmtNum(newStaffToday)}
            subtitle={`New players today: ${fmtNum(newPlayersToday)}`} />
        </Grid>
      </Grid>

      {/* Row 4: Trend charts */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={6}>
          <ChartCard title="Staff Registrations · Last 7 days" icon={<ShowChart sx={{ fontSize: 18 }} />} height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={staffTrendData}>
                <defs>
                  <linearGradient id="mmStaffGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="day" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="New Staff"
                  stroke={C.primary} strokeWidth={2.5}
                  fill="url(#mmStaffGrad)" dot={false}
                  activeDot={{ r: 5, fill: C.primary, stroke: C.text, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={6}>
          <ChartCard title="Player Registrations · Last 7 days" icon={<ShowChart sx={{ fontSize: 18 }} />} height={260}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={playerTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="day" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="New Players" fill={C.success} radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Row 5: Role distribution + top downline staff */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={5}>
          <ChartCard title="Downline Role Distribution" icon={<PieChartOutline sx={{ fontSize: 18 }} />} height={280}>
            <Box sx={{ display: 'flex', height: '100%' }}>
              <Box sx={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleDistribution} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={85} paddingAngle={3}
                      dataKey="value" stroke="none">
                      {roleDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.75, minWidth: 130 }}>
                {roleDistribution.map(r => (
                  <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.fill }} />
                    <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', flex: 1 }}>{r.name}</Typography>
                    <Typography sx={{ color: C.text, fontSize: '0.75rem', fontWeight: 700 }}>{r.value}</Typography>
                  </Box>
                ))}
                {roleDistribution.length === 0 && (
                  <Typography sx={{ color: C.textMuted, fontSize: '0.75rem' }}>No downline</Typography>
                )}
              </Box>
            </Box>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: alpha(C.success, 0.12), color: C.success, width: 32, height: 32 }}>
                <AccountTree sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Top Downline Staff</Typography>
            </Box>
            {topStaff.length === 0 ? (
              <Typography sx={{ color: C.textMuted, fontSize: 13, textAlign: 'center', py: 4 }}>
                {loading ? 'Loading…' : 'No staff under you yet'}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {topStaff.map((s, i) => (
                  <Box key={s.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    bgcolor: C.cardHover, borderRadius: 2, p: 1.25, border: `1px solid ${C.border}`,
                  }}>
                    <Avatar sx={{
                      width: 30, height: 30,
                      bgcolor: alpha(ROLE_COLORS[s.role] || C.primary, 0.15),
                      color: ROLE_COLORS[s.role] || C.primary,
                      fontSize: 12, fontWeight: 800,
                    }}>
                      {i + 1}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: C.text, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.username}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
                        <Chip label={s.role} size="small"
                          sx={{ bgcolor: alpha(ROLE_COLORS[s.role] || '#8384A5', 0.12), color: ROLE_COLORS[s.role] || '#8384A5', fontWeight: 600, fontSize: 10, height: 18 }} />
                        <Chip label={s.status === 'active' ? 'Active' : 'Inactive'} size="small"
                          sx={{
                            bgcolor: alpha(s.status === 'active' ? C.success : C.error, 0.12),
                            color: s.status === 'active' ? C.success : C.error,
                            fontWeight: 600, fontSize: 10, height: 18,
                          }} />
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ color: C.text, fontWeight: 800, fontSize: 13 }}>
                        {fmtInr(s.balance)}
                      </Typography>
                      <Typography sx={{ color: Number(s.sports_pnl) >= 0 ? C.success : C.error, fontSize: 10 }}>
                        Sports P&L: {fmtInr(s.sports_pnl)}
                      </Typography>
                      <Typography sx={{ color: Number(s.casino_pnl) >= 0 ? C.success : C.error, fontSize: 10 }}>
                        Casino P&L: {fmtInr(s.casino_pnl)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Row 6: Role balance bars + recent activity */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={5}>
          <ChartCard title="Balance by Role" icon={<AssessmentOutlined sx={{ fontSize: 18 }} />} height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.entries(staffAgg.roleBalance)
                  .map(([role, bal]) => ({ role, balance: bal, fill: ROLE_COLORS[role] || '#8384A5' }))
                  .sort((a, b) => b.balance - a.balance)}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="role" type="category" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="balance" name="Balance" radius={[0, 6, 6, 0]} barSize={16}>
                  {Object.entries(staffAgg.roleBalance).map(([role], i) => (
                    <Cell key={i} fill={ROLE_COLORS[role] || '#8384A5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: alpha(C.info, 0.12), color: C.info, width: 32, height: 32 }}>
                <SwapHoriz sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Recent Activity</Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Time', 'Category', 'From → To', 'Amount'].map(h => (
                      <TableCell key={h} sx={{ color: C.textMuted, fontWeight: 600, fontSize: 12, bgcolor: C.card, borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentActivity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: C.textMuted, py: 3, borderBottom: `1px solid ${C.border}` }}>
                        {loading ? 'Loading…' : 'No activity yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentActivity.map(t => {
                      const meta = KIND_META[t.kind];
                      return (
                        <TableRow key={t.id} hover>
                          <TableCell sx={{ color: C.textMuted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                            {t.createdAt ? new Date(t.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </TableCell>
                          <TableCell sx={{ borderBottom: `1px solid ${C.border}` }}>
                            <Chip label={meta.label} size="small"
                              sx={{ bgcolor: alpha(meta.color, 0.15), color: meta.color, fontWeight: 700, fontSize: 11 }} />
                          </TableCell>
                          <TableCell sx={{ color: C.text, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                            {partyLabel(t.from).name} → {partyLabel(t.to).name}
                          </TableCell>
                          <TableCell sx={{ color: C.text, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                            {fmtInr(Number(t.amount))}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
