import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Paper, Typography, Avatar, Chip, IconButton, Tooltip as MuiTooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, alpha,
} from '@mui/material';
import {
  PeopleAlt, AccountTree, SwapHoriz, SportsEsports, Casino,
  CalendarToday, Refresh, AssessmentOutlined,
  PieChartOutline, ShowChart, Receipt, AccountBalance, Warning,
  TrendingUp, TrendingDown, ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import * as lordsApi from '../../services/lordsApi';
import {
  C, StatCard, ChartCard, CustomTooltip, fmtInr, fmtNum, isToday,
} from './shared';

interface AgentNode {
  id: number;
  username: string;
  role: string;
  account_type: 'STAFF' | 'USER';
  /** Real INR wallet balance. No credit limit backs it. */
  balance: number;
  exposure: number;
  percentage: number;
  status: string;
  bet_status: string;
  /** Lifetime sports P&L you made from this account (+ = you earned).
   *  On a staff row, summed over its whole downline. */
  sports_pnl: number;
  /** Lifetime casino P&L you made from this account (+ = you earned). */
  casino_pnl: number;
  has_downline: boolean;
}

interface TransferRow {
  id: number;
  from_type: string;
  from_id: number;
  to_type: string;
  to_id: number;
  amount: string | number;
  direction: 'deposit' | 'withdraw' | 'collect' | 'pay' | string;
  transfer_type?: string | null;
  created_at: string;
  from_name?: string;
  to_name?: string;
}

/* Money moves one of two ways now. 'legacy' covers the retired G/T settlement
   rows (direction 'collect'/'pay') that still sit in staff_transfers history. */
type TxKind = 'deposit' | 'withdraw' | 'legacy';

interface ClassifiedTx extends TransferRow {
  kind: TxKind;
}

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: '#F9F9F9',
  Admin: '#E01B4F',
  SubAdmin: '#FFC23F',
  Master: '#886CFF',
  Agent: '#0ECC68',
  SubAgent: '#7B5EF5',
  User: '#8384A5',
};

const KIND_META: Record<TxKind, { label: string; color: string }> = {
  deposit:  { label: 'Deposit',  color: '#0ECC68' },
  withdraw: { label: 'Withdraw', color: '#E01B4F' },
  legacy:   { label: 'Legacy settlement', color: '#8384A5' },
};

/* Direction is the definitive signal. Deposits and withdrawals write
   'deposit'/'withdraw'. Rows with 'collect'/'pay' are G/T settlements from the
   retired credit model; rows with NULL are pre-direction staff-creation top-ups,
   which were always deposits. */
const classify = (r: TransferRow): TxKind => {
  if (r.direction === 'withdraw') return 'withdraw';
  if (r.direction === 'deposit' || !r.direction) return 'deposit';
  return 'legacy';
};

const MINI_CARD = (label: string, value: string, tone: string) => (
  <Box sx={{ bgcolor: C.cardHover, borderRadius: 2, p: 1.5, border: `1px solid ${C.border}`, flex: 1, minWidth: 140 }}>
    <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>{label}</Typography>
    <Typography sx={{ color: tone, fontWeight: 800, fontSize: '1rem' }}>{value}</Typography>
  </Box>
);

const AgentSystemTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [allTransfers, setAllTransfers] = useState<TransferRow[]>([]);
  const [totalPagesAll, setTotalPagesAll] = useState(0);
  const [myStaffId, setMyStaffId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailsRes, allRes, meRes] = await Promise.allSettled([
        lordsApi.getAllDetails({ page: 1, limit: 100 }),
        lordsApi.getTransferStatement({ page: 1, limit: 100 }),
        lordsApi.updateCurrent(),
      ]);
      // `apiFetchPage` answers `{data, pagination, meta}` — `.users` and a
      // top-level `.totalPages` are legacy keys that never arrive.
      if (detailsRes.status === 'fulfilled') setAgents(detailsRes.value?.data || []);
      if (allRes.status === 'fulfilled') {
        setAllTransfers(allRes.value?.data || []);
        setTotalPagesAll(allRes.value?.pagination?.totalPages || 0);
      }
      // `updateCurrent` is `getAllDetails` — a LIST. There is no `.data.id` on
      // it, so this set `myStaffId` to null on every load.
      if (meRes.status === 'fulfilled') {
        setMyStaffId(Number(localStorage.getItem('currentUserId')) || null);
      }
    } catch (e) { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 300000); return () => clearInterval(i); }, [fetchAll]);

  const classified = useMemo<ClassifiedTx[]>(
    () => allTransfers.map(r => ({ ...r, kind: classify(r) })),
    [allTransfers]
  );

  const byKind = useMemo(() => {
    const deposit: ClassifiedTx[] = [];
    const withdraw: ClassifiedTx[] = [];
    const legacy: ClassifiedTx[] = [];
    for (const t of classified) {
      if (t.kind === 'deposit') deposit.push(t);
      else if (t.kind === 'withdraw') withdraw.push(t);
      else legacy.push(t);
    }
    return { deposit, withdraw, legacy, live: [...deposit, ...withdraw] };
  }, [classified]);

  const amountSum = (rows: ClassifiedTx[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const todayOf = (rows: ClassifiedTx[]) => rows.filter(r => isToday(r.created_at));

  /* Money in/out from the current staff's perspective.
     deposit  => sending money downward (outgoing)
     withdraw => pulling money up from a child (incoming)
     NULL direction rows are pre-direction staff-creation top-ups; attribute
     them by from_id/to_id against the current staff id. */
  const balanceSplit = useMemo(() => {
    const isOut = (r: ClassifiedTx) =>
      r.direction === 'deposit' ||
      (!r.direction && myStaffId != null && r.from_type === 'staff' && r.from_id === myStaffId);
    const isIn = (r: ClassifiedTx) =>
      r.direction === 'withdraw' ||
      (!r.direction && myStaffId != null && r.to_type === 'staff' && r.to_id === myStaffId);
    const out = byKind.live.filter(isOut);
    const inc = byKind.live.filter(isIn);
    const uncategorized = byKind.live.filter(r => !isOut(r) && !isIn(r));
    return {
      sent: amountSum(out),
      sentCount: out.length,
      received: amountSum(inc),
      receivedCount: inc.length,
      todaySent: amountSum(todayOf(out)),
      todayReceived: amountSum(todayOf(inc)),
      uncategorizedTotal: amountSum(uncategorized),
      uncategorizedTodayTotal: amountSum(todayOf(uncategorized)),
    };
  }, [byKind, myStaffId]);

  /* Retired G/T settlement rows, kept visible so the history still adds up. */
  const legacyAgg = useMemo(() => ({
    total: amountSum(byKind.legacy),
    count: byKind.legacy.length,
    today: amountSum(todayOf(byKind.legacy)),
  }), [byKind]);

  /* Downline aggregations */
  const agg = useMemo(() => {
    const staff = agents.filter(a => a.account_type === 'STAFF');
    const users = agents.filter(a => a.account_type === 'USER');
    const totalBalance = agents.reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalExposure = agents.reduce((s, a) => s + Number(a.exposure || 0), 0);
    // Only USER rows are summed: a staff row already carries the roll-up of
    // everyone beneath it, so including both would double-count the players.
    const sportsPnl = users.reduce((s, a) => s + Number(a.sports_pnl || 0), 0);
    const casinoPnl = users.reduce((s, a) => s + Number(a.casino_pnl || 0), 0);
    const activeUsers = users.filter(u => u.status === 'active').length;

    const byRole: Record<string, { count: number; credit: number; sportsPnl: number; casinoPnl: number; exposure: number }> = {};
    for (const a of agents) {
      const key = a.role || 'Unknown';
      if (!byRole[key]) byRole[key] = { count: 0, credit: 0, sportsPnl: 0, casinoPnl: 0, exposure: 0 };
      byRole[key].count += 1;
      byRole[key].credit += Number(a.balance || 0);
      byRole[key].sportsPnl += Number(a.sports_pnl || 0);
      byRole[key].casinoPnl += Number(a.casino_pnl || 0);
      byRole[key].exposure += Number(a.exposure || 0);
    }

    return {
      staffCount: staff.length,
      userCount: users.length,
      activeUsers,
      totalBalance,
      totalExposure,
      sportsPnl,
      casinoPnl,
      byRole,
    };
  }, [agents]);

  const roleDistribution = useMemo(
    () => Object.entries(agg.byRole).map(([role, v]) => ({
      name: role, value: v.count, fill: ROLE_COLORS[role] || '#8384A5',
    })),
    [agg]
  );

  const transferVolumeChart = useMemo(() => ([
    { name: 'Deposits', total: amountSum(byKind.deposit), today: amountSum(todayOf(byKind.deposit)) },
    { name: 'Withdrawals', total: amountSum(byKind.withdraw), today: amountSum(todayOf(byKind.withdraw)) },
    { name: 'Legacy settlements', total: legacyAgg.total, today: legacyAgg.today },
  ]), [byKind, legacyAgg]);

  const todayTransfers = useMemo(
    () => classified.filter(t => isToday(t.created_at))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [classified]
  );

  const recentTransfers = useMemo(
    () => [...classified].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 15),
    [classified]
  );

  const topAgents = useMemo(
    () => [...agents]
      .filter(a => a.account_type === 'STAFF')
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 8),
    [agents]
  );

  /* Direction label per row, from the perspective of current staff. */
  const labelDirection = (t: ClassifiedTx): { label: string; color: string; icon: React.ReactNode } => {
    if (t.kind !== 'legacy') {
      const outgoing = t.direction === 'deposit' ||
        (!t.direction && myStaffId != null && t.from_type === 'staff' && t.from_id === myStaffId);
      const incoming = t.direction === 'withdraw' ||
        (!t.direction && myStaffId != null && t.to_type === 'staff' && t.to_id === myStaffId);
      if (outgoing) return { label: 'Deposited', color: C.error, icon: <ArrowUpward sx={{ fontSize: 12 }} /> };
      if (incoming) return { label: 'Withdrawn', color: C.success, icon: <ArrowDownward sx={{ fontSize: 12 }} /> };
      return { label: 'Transfer', color: C.info, icon: <SwapHoriz sx={{ fontSize: 12 }} /> };
    }
    // Retired G/T settlement rows, kept for history.
    if (t.direction === 'collect') return { label: 'Collected (legacy)', color: C.success, icon: <ArrowDownward sx={{ fontSize: 12 }} /> };
    if (t.direction === 'pay') return { label: 'Paid (legacy)', color: C.error, icon: <ArrowUpward sx={{ fontSize: 12 }} /> };
    return { label: t.direction || '—', color: C.textMuted, icon: null };
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: { xs: '1.3rem', sm: '1.5rem' }, lineHeight: 1.2 }}>
            Agent System Report
          </Typography>
          <Typography sx={{ color: C.textMuted, fontSize: '0.78rem', mt: 0.25 }}>
            Downline tree, deposits &amp; withdrawals, and lifetime P&amp;L in your hierarchy
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

      {/* Row 1: Downline KPIs */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AccountTree />} iconBg={C.primaryLight}
            title="Direct Staff" value={fmtNum(agg.staffCount)}
            subtitle="Immediate children in your tree" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<PeopleAlt />} iconBg={C.info}
            title="Users Registered Under You" value={fmtNum(agg.userCount)}
            subtitle={`Active: ${fmtNum(agg.activeUsers)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<AccountBalance />} iconBg="#7B5EF5"
            title="Balance in Direct Tree" value={fmtInr(agg.totalBalance)}
            subtitle="Real funds held by your direct downline" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Warning />} iconBg={C.warning}
            title="Net Exposure" value={fmtInr(agg.totalExposure)}
            subtitle="Active across downline" />
        </Grid>
      </Grid>

      {/* Row 2: deposit / withdraw KPIs */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SwapHoriz />} iconBg={C.success}
            title="Deposited Down" value={fmtInr(balanceSplit.sent)}
            subtitle={`${fmtNum(balanceSplit.sentCount)} deposits to descendants`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<ArrowDownward />} iconBg={C.info}
            title="Withdrawn Up" value={fmtInr(balanceSplit.received)}
            subtitle={`${fmtNum(balanceSplit.receivedCount)} withdrawals from descendants`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Receipt />} iconBg={C.warning}
            title="Deposited Today" value={fmtInr(balanceSplit.todaySent + balanceSplit.uncategorizedTodayTotal)}
            subtitle={`Withdrawn today: ${fmtInr(balanceSplit.todayReceived)}`} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SwapHoriz />} iconBg={C.primary}
            title="Total Movement" value={fmtInr(balanceSplit.sent + balanceSplit.received + balanceSplit.uncategorizedTotal)}
            subtitle={`${fmtNum(byKind.live.length)} transactions${totalPagesAll > 1 ? ` (page 1/${totalPagesAll})` : ''}`} />
        </Grid>
      </Grid>

      {/* Row 3: lifetime P&L across the downline (read-only — nothing to settle) */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<SportsEsports />} iconBg={agg.sportsPnl >= 0 ? C.success : C.error}
            title="Sports P&L" value={fmtInr(agg.sportsPnl)}
            subtitle="Your lifetime take from the downline" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<Casino />} iconBg={agg.casinoPnl >= 0 ? C.success : C.error}
            title="Casino P&L" value={fmtInr(agg.casinoPnl)}
            subtitle="Your lifetime take from the downline" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<TrendingUp />} iconBg={(agg.sportsPnl + agg.casinoPnl) >= 0 ? C.success : C.error}
            title="Combined P&L" value={fmtInr(agg.sportsPnl + agg.casinoPnl)}
            subtitle="Sports + casino, lifetime" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard loading={loading} icon={<TrendingDown />} iconBg={C.textMuted}
            title="Legacy Settlements" value={fmtInr(legacyAgg.total)}
            subtitle={`${fmtNum(legacyAgg.count)} historical G/T rows`} />
        </Grid>
      </Grid>

      {/* Row 4: Charts */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={7}>
          <ChartCard title="Transfer Volume by Category" icon={<ShowChart sx={{ fontSize: 18 }} />} height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transferVolumeChart} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: C.textMuted, fontSize: 12 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: C.textMuted, fontSize: 12 }} />
                <Bar dataKey="total" name="All-time" fill={C.primary} radius={[6, 6, 0, 0]} barSize={42} />
                <Bar dataKey="today" name="Today" fill={C.warning} radius={[6, 6, 0, 0]} barSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid item xs={12} lg={5}>
          <ChartCard title="Downline Role Distribution" icon={<PieChartOutline sx={{ fontSize: 18 }} />} height={300}>
            <Box sx={{ display: 'flex', height: '100%' }}>
              <Box sx={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                      {roleDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.75, minWidth: 120 }}>
                {roleDistribution.map(r => (
                  <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.fill }} />
                    <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', flex: 1 }}>{r.name}</Typography>
                    <Typography sx={{ color: C.text, fontSize: '0.75rem', fontWeight: 700 }}>{r.value}</Typography>
                  </Box>
                ))}
                {roleDistribution.length === 0 && (
                  <Typography sx={{ color: C.textMuted, fontSize: '0.75rem' }}>No data</Typography>
                )}
              </Box>
            </Box>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Row 5: Role breakdown table */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Avatar sx={{ bgcolor: alpha(C.primary, 0.12), color: C.primary, width: 32, height: 32 }}>
                <AssessmentOutlined sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Role Breakdown (Direct Tree)</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Role', 'Count', 'Balance', 'Sports P&L', 'Casino P&L', 'Exposure'].map(h => (
                      <TableCell key={h} sx={{ color: C.textMuted, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.keys(agg.byRole).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ color: C.textMuted, py: 3, borderBottom: `1px solid ${C.border}` }}>
                        {loading ? 'Loading…' : 'No data'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    Object.entries(agg.byRole)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([role, v]) => (
                        <TableRow key={role} hover>
                          <TableCell sx={{ borderBottom: `1px solid ${C.border}` }}>
                            <Chip label={role} size="small"
                              sx={{ bgcolor: alpha(ROLE_COLORS[role] || '#8384A5', 0.12), color: ROLE_COLORS[role] || '#8384A5', fontWeight: 700, fontSize: 11 }} />
                          </TableCell>
                          <TableCell sx={{ color: C.text, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmtNum(v.count)}</TableCell>
                          <TableCell sx={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>{fmtInr(v.credit)}</TableCell>
                          <TableCell sx={{ color: v.sportsPnl >= 0 ? C.success : C.error, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{fmtInr(v.sportsPnl)}</TableCell>
                          <TableCell sx={{ color: v.casinoPnl >= 0 ? C.success : C.error, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{fmtInr(v.casinoPnl)}</TableCell>
                          <TableCell sx={{ color: v.exposure > 0 ? C.warning : C.textMuted, borderBottom: `1px solid ${C.border}` }}>{fmtInr(v.exposure)}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Row 6: Today's transfers + Top agents */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: alpha(C.warning, 0.12), color: C.warning, width: 32, height: 32 }}>
                <Receipt sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Today's Transfer Records</Typography>
              <Chip size="small" label={todayTransfers.length} sx={{ bgcolor: alpha(C.warning, 0.15), color: C.warning, fontWeight: 700 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              {MINI_CARD('Deposited Today', fmtInr(amountSum(todayOf(byKind.deposit))), C.success)}
              {MINI_CARD('Withdrawn Today', fmtInr(amountSum(todayOf(byKind.withdraw))), C.error)}
              {MINI_CARD('Net Today', fmtInr(amountSum(todayOf(byKind.deposit)) - amountSum(todayOf(byKind.withdraw))), C.primary)}
            </Box>
            <TableContainer sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Time', 'Category', 'Action', 'From → To', 'Amount'].map(h => (
                      <TableCell key={h} sx={{ color: C.textMuted, fontWeight: 600, fontSize: 12, bgcolor: C.card, borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {todayTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: C.textMuted, py: 3, borderBottom: `1px solid ${C.border}` }}>
                        {loading ? 'Loading…' : 'No transfers today'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    todayTransfers.map(t => {
                      const dir = labelDirection(t);
                      const meta = KIND_META[t.kind];
                      return (
                        <TableRow key={`today-${t.id}`} hover>
                          <TableCell sx={{ color: C.textMuted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                            {new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell sx={{ borderBottom: `1px solid ${C.border}` }}>
                            <Chip label={meta.label} size="small"
                              sx={{ bgcolor: alpha(meta.color, 0.15), color: meta.color, fontWeight: 700, fontSize: 11 }} />
                          </TableCell>
                          <TableCell sx={{ borderBottom: `1px solid ${C.border}` }}>
                            <Chip label={dir.label} size="small" icon={dir.icon as any}
                              sx={{ bgcolor: alpha(dir.color, 0.12), color: dir.color, fontWeight: 700, fontSize: 11,
                                '& .MuiChip-icon': { color: dir.color } }} />
                          </TableCell>
                          <TableCell sx={{ color: C.text, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                            {t.from_name || '—'} → {t.to_name || '—'}
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

        <Grid item xs={12} lg={5}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: alpha(C.success, 0.12), color: C.success, width: 32, height: 32 }}>
                <AccountTree sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Top Agents by Balance</Typography>
            </Box>
            {topAgents.length === 0 ? (
              <Typography sx={{ color: C.textMuted, fontSize: 13, textAlign: 'center', py: 4 }}>
                {loading ? 'Loading…' : 'No agents'}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {topAgents.map((a, i) => (
                  <Box key={a.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    bgcolor: C.cardHover, borderRadius: 2, p: 1.25, border: `1px solid ${C.border}`,
                  }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(ROLE_COLORS[a.role] || C.primary, 0.15), color: ROLE_COLORS[a.role] || C.primary, fontSize: 12, fontWeight: 800 }}>
                      {i + 1}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: C.text, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.username}
                      </Typography>
                      <Chip label={a.role} size="small"
                        sx={{ bgcolor: alpha(ROLE_COLORS[a.role] || '#8384A5', 0.12), color: ROLE_COLORS[a.role] || '#8384A5', fontWeight: 600, fontSize: 10, height: 18 }} />
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{fmtInr(a.balance)}</Typography>
                      <Typography sx={{ color: Number(a.sports_pnl) >= 0 ? C.success : C.error, fontSize: 10 }}>
                        Sports P&L: {fmtInr(a.sports_pnl)}
                      </Typography>
                      <Typography sx={{ color: Number(a.casino_pnl) >= 0 ? C.success : C.error, fontSize: 10 }}>
                        Casino P&L: {fmtInr(a.casino_pnl)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Row 7: Recent transfers log */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: alpha(C.info, 0.12), color: C.info, width: 32, height: 32 }}>
                <SwapHoriz sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>Recent Transfer Log</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Time', 'Category', 'Action', 'From', 'To', 'Amount'].map(h => (
                      <TableCell key={h} sx={{ color: C.textMuted, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ color: C.textMuted, py: 3, borderBottom: `1px solid ${C.border}` }}>
                        {loading ? 'Loading…' : 'No transfers yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTransfers.map(t => {
                      const dir = labelDirection(t);
                      const meta = KIND_META[t.kind];
                      return (
                        <TableRow key={`recent-${t.id}`} hover>
                          <TableCell sx={{ color: C.textMuted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                            {new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell sx={{ borderBottom: `1px solid ${C.border}` }}>
                            <Chip label={meta.label} size="small"
                              sx={{ bgcolor: alpha(meta.color, 0.15), color: meta.color, fontWeight: 700, fontSize: 11 }} />
                          </TableCell>
                          <TableCell sx={{ borderBottom: `1px solid ${C.border}` }}>
                            <Chip label={dir.label} size="small" icon={dir.icon as any}
                              sx={{ bgcolor: alpha(dir.color, 0.12), color: dir.color, fontWeight: 700, fontSize: 11,
                                '& .MuiChip-icon': { color: dir.color } }} />
                          </TableCell>
                          <TableCell sx={{ color: C.text, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>{t.from_name || '—'}</TableCell>
                          <TableCell sx={{ color: C.text, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>{t.to_name || '—'}</TableCell>
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
};

export default AgentSystemTab;
