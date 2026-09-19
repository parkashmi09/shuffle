import React, { useState, useMemo } from 'react';
import {
  Box, Card, Typography, TextField, InputAdornment, Avatar, Chip, IconButton,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Skeleton,
} from '@mui/material';
import {
  Search, Refresh, Shield, PersonOff, People, TrendingUp, TrendingDown,
  AccountBalanceWallet, Lock, ReceiptLong, Assessment,
} from '@mui/icons-material';

export interface UsersTableUser {
  id: string;
  name: string;
  email: string;
  country?: string;
  phone?: string;
  total_deposit_inr: number;
  total_withdrawal_inr: number;
  /** Actual betting result (sports + casino). Absent on the direct-users feed,
   *  where deposits minus withdrawals is the only figure available. */
  pnl_inr?: number;
  is_locked?: boolean;
  sports_betlocked?: boolean;
  staff_name?: string | null;
  staff_email?: string | null;
}

const C = {
  bg: '#0C0D1D', card: '#0E1831', cardLight: '#121E38', cardHover: '#162140',
  border: '#1E2D55', primary: '#886CFF', text: '#F9F9F9',
  textMuted: '#878AA2', textSecondary: '#8384A5',
  success: '#0ECC68', error: '#E01B4F', warning: '#FFC23F', info: '#A08FFF',
};

const fmtInr = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const avatarColor = (name: string) => {
  const colors = [C.primary, '#7B5EF5', C.success, C.warning, C.error, C.info];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; color: string; loading?: boolean }> = ({ label, value, icon, color, loading }) => (
  <Card sx={{ bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2, p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ color: C.textSecondary, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
      {loading ? <Skeleton variant="text" width={80} sx={{ bgcolor: C.border }} /> :
        <Typography sx={{ color: C.text, fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.3 }}>{value}</Typography>}
    </Box>
  </Card>
);

interface Props {
  users: UsersTableUser[];
  loading: boolean;
  title: string;
  onRefresh: () => void;
  onOpenRisk: (userId: string) => void;
  onOpenBalanceSheet?: (userId: string) => void;
  onOpenReport?: (userId: string, userName: string) => void;
  showStaffColumn?: boolean;
}

const UsersTable: React.FC<Props> = ({ users, loading, title, onRefresh, onOpenRisk, onOpenBalanceSheet, onOpenReport, showStaffColumn }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const { totalDeposits, totalWithdrawals, activeUsers, lockedUsers } = useMemo(() => {
    let td = 0, tw = 0, au = 0, lu = 0;
    for (const u of users) {
      td += u.total_deposit_inr;
      tw += u.total_withdrawal_inr;
      if (u.total_deposit_inr > 0) au++;
      if (u.is_locked) lu++;
    }
    return { totalDeposits: td, totalWithdrawals: tw, activeUsers: au, lockedUsers: lu };
  }, [users]);

  const q = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => q
    ? users.filter(u => [u.id, u.name, u.email, u.phone, u.staff_name].filter(Boolean).map(s => String(s).toLowerCase()).join(' ').includes(q))
    : users, [users, q]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const baseHeaders = ['#', 'User', 'Risk', 'Email', 'UID', 'Phone', 'Deposits', 'Withdrawals', 'PNL', 'Status'];
  const HEADER_CELLS = showStaffColumn ? [...baseHeaders.slice(0, 6), 'Parent Staff', ...baseHeaders.slice(6)] : baseHeaders;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
        <StatCard label="Total Users" value={users.length.toLocaleString()} icon={<People />} color={C.primary} loading={loading} />
        <StatCard label="Active Users" value={activeUsers.toLocaleString()} icon={<TrendingUp />} color={C.success} loading={loading} />
        <StatCard label="Total Deposits" value={fmtInr(totalDeposits)} icon={<AccountBalanceWallet />} color={C.warning} loading={loading} />
        <StatCard label="Total Withdrawals" value={fmtInr(totalWithdrawals)} icon={<TrendingDown />} color={C.error} loading={loading} />
        <StatCard label="Locked" value={lockedUsers.toLocaleString()} icon={<Lock />} color="#7B5EF5" loading={loading} />
      </Box>

      <Card sx={{ bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '1rem' }}>
            {title}
            <Typography component="span" sx={{ ml: 1, color: C.textSecondary, fontWeight: 400, fontSize: '0.82rem' }}>
              ({filtered.length} results)
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search by name, email, UID…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Search sx={{ color: C.textSecondary, fontSize: 18 }} /></InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 280 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: C.bg, borderRadius: 1.5,
                  '& fieldset': { borderColor: C.border },
                  '&:hover fieldset': { borderColor: C.primary },
                  '&.Mui-focused fieldset': { borderColor: C.primary },
                },
                '& input': { color: C.text, fontSize: '0.85rem' },
              }}
            />
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} sx={{ color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 1.5, '&:hover': { color: C.primary, borderColor: C.primary } }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TableContainer sx={{ borderTop: `1px solid ${C.border}` }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: C.bg }}>
                {HEADER_CELLS.map((h, i) => (
                  <TableCell key={i} sx={{ color: C.textSecondary, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${C.border}`, py: 1.5, whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {HEADER_CELLS.map((_, j) => (
                    <TableCell key={j} sx={{ borderBottom: `1px solid ${C.border}33`, py: 1.5 }}>
                      <Skeleton variant="text" sx={{ bgcolor: C.border }} />
                    </TableCell>
                  ))}
                </TableRow>
              )) : paginated.map((user, idx) => {
                // Real betting P&L when the feed carries it; otherwise fall back
                // to net funding, which is all the direct-users feed knows.
                const pnl = user.pnl_inr ?? (user.total_deposit_inr - user.total_withdrawal_inr);
                const initials = user.name && user.name !== '—' ? user.name.slice(0, 2).toUpperCase() : '??';
                return (
                  <TableRow key={`${user.id}-${idx}`} sx={{ '&:hover': { bgcolor: C.cardLight }, '& td': { borderBottom: `1px solid ${C.border}33` } }}>
                    <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5 }}>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: '0.72rem', fontWeight: 700, bgcolor: avatarColor(user.name || ''), flexShrink: 0 }}>{initials}</Avatar>
                        <Box>
                          <Typography sx={{ color: C.text, fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>{user.name}</Typography>
                          {user.country && <Typography sx={{ color: C.textSecondary, fontSize: '0.68rem' }}>{user.country}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
                      <Tooltip title="Risk management">
                        <IconButton size="small" onClick={() => onOpenRisk(user.id)} sx={{ color: C.textSecondary, '&:hover': { color: C.warning, bgcolor: `${C.warning}15` } }}>
                          <Shield fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {onOpenBalanceSheet && (
                        <Tooltip title="Balance sheet">
                          <IconButton size="small" onClick={() => onOpenBalanceSheet(user.id)} sx={{ color: C.textSecondary, '&:hover': { color: C.primary, bgcolor: `${C.primary}15` } }}>
                            <ReceiptLong fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {onOpenReport && (
                        <Tooltip title="Download report">
                          <IconButton size="small" onClick={() => onOpenReport(user.id, user.name)} sx={{ color: C.textSecondary, '&:hover': { color: C.success, bgcolor: `${C.success}15` } }}>
                            <Assessment fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5, maxWidth: 200 }}>
                      <Typography noWrap sx={{ fontSize: '0.78rem', color: C.textSecondary }}>{user.email}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ color: C.info, fontSize: '0.72rem', fontFamily: 'monospace', bgcolor: 'rgba(136,108,255,0.08)', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block' }}>
                        {user.id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5, whiteSpace: 'nowrap' }}>{user.phone || '—'}</TableCell>
                    {showStaffColumn && (
                      <TableCell sx={{ py: 1.5 }}>
                        {user.staff_name ? (
                          <Box>
                            <Typography sx={{ color: C.text, fontSize: '0.78rem', fontWeight: 600 }}>{user.staff_name}</Typography>
                            <Typography sx={{ color: C.textSecondary, fontSize: '0.68rem' }} noWrap>{user.staff_email}</Typography>
                          </Box>
                        ) : <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>—</Typography>}
                      </TableCell>
                    )}
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip label={fmtInr(user.total_deposit_inr)} size="small" sx={{ bgcolor: 'rgba(14,204,104,0.12)', color: C.success, fontWeight: 600, fontSize: '0.72rem', height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip label={fmtInr(user.total_withdrawal_inr)} size="small" sx={{ bgcolor: 'rgba(224,27,79,0.12)', color: C.error, fontWeight: 600, fontSize: '0.72rem', height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip label={fmtInr(pnl)} size="small" sx={{ bgcolor: pnl >= 0 ? 'rgba(14,204,104,0.12)' : 'rgba(224,27,79,0.12)', color: pnl >= 0 ? C.success : C.error, fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      {user.is_locked ? (
                        <Chip label="Locked" size="small" sx={{ bgcolor: `${C.error}22`, color: C.error, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                      ) : user.sports_betlocked ? (
                        <Chip label="Sports Lock" size="small" sx={{ bgcolor: `${C.warning}22`, color: C.warning, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                      ) : (
                        <Chip label="Active" size="small" sx={{ bgcolor: `${C.success}22`, color: C.success, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={HEADER_CELLS.length} sx={{ py: 6, borderBottom: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <PersonOff sx={{ fontSize: 40, color: C.border }} />
                      <Typography sx={{ color: C.textSecondary, fontSize: '0.85rem' }}>No users found</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 15, 25, 50]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          sx={{
            color: C.textSecondary, borderTop: `1px solid ${C.border}`,
            '& .MuiTablePagination-select': { color: C.text },
            '& .MuiTablePagination-selectIcon': { color: C.textSecondary },
            '& .MuiIconButton-root': { color: C.textSecondary, '&:hover': { color: C.text }, '&.Mui-disabled': { color: C.border } },
          }}
        />
      </Card>
    </Box>
  );
};

export default UsersTable;
