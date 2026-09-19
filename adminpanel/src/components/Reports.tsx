import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  LinearProgress,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Download,
  Refresh,
  Visibility,
  Close,
  EmojiEvents,
  Person,
  AccountBalanceWallet,
  SearchOff,
} from '@mui/icons-material';
import { Star } from 'lucide-react';
import { ENDPOINTS } from '../services/endpoints';
import { apiFetch, apiFetchPage, apiDownload, buildPath } from '../utils/api';

/**
 * THE WHOLE LEGACY `/reports` ROUTER WAS UNAUTHENTICATED, on three routes that
 * read the customer database — and the CSV export returned every direct player
 * (id, name, referral code, balance) to anyone who asked, escaping quotes but
 * not the `=`/`+`/`-`/`@` that make a spreadsheet cell a formula.
 *
 * The v1 routes are `reports:read`-scoped and paginate by `limit`/`offset` —
 * the validators are `.strict()`, so a stray `page` parameter is a 400.
 */
const PAGE_SIZE = 15;

/** `vip`, as `vipLevelFor` shapes it — a number, not a `"VIP 3"` string. */
interface Vip {
  level: number;
  card: string;
  nextLevel: number | null;
  wagerToNextLevel: string | null;
  progressPct: string;
}

interface User {
  id: string;
  name: string;
  avatar?: string | null;
  wager: string | number;
  gamesPlayed: number;
  vip: Vip;
  level?: number;
  referralCode?: string | null;
  channel?: 'direct' | 'agent';
  balance?: string;
  totalDeposited?: string;
  totalWithdrawn?: string;
}

/** The single-player read adds the wallet; it is not a different envelope. */
interface UserDetails extends User {
  wallets?: Record<string, string>;
  createdAt?: string | null;
}

const getVipTier = (level?: number | string) => {
  const n = Number(level) || 0;
  if (n >= 50) return { label: 'Platinum', color: '#E5E4E2', bg: 'rgba(229,228,226,0.15)' };
  if (n >= 30) return { label: 'Gold', color: '#FFD700', bg: 'rgba(255,215,0,0.15)' };
  if (n >= 10) return { label: 'Silver', color: '#C0C0C0', bg: 'rgba(192,192,192,0.15)' };
  return { label: 'Bronze', color: '#CD7F32', bg: 'rgba(205,127,50,0.15)' };
};

const avatarColor = (name: string) => {
  const colors = ['#886CFF', '#7B5EF5', '#0ECC68', '#FFC23F', '#E01B4F', '#A08FFF'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const HEADER_CELLS = ['#', 'User', 'Wager (INR)', 'Games Played', 'VIP Level', 'Actions'];

const Reports: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, [currentPage, searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, pagination } = await apiFetchPage<User>(ENDPOINTS.reports.players, {
        query: { limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE, search: searchTerm },
      });
      setUsers(data);
      setTotalPages(pagination?.totalPages ?? 1);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewUserDetails = async (userId: string) => {
    setUserDetailsLoading(true);
    setSelectedUser({} as UserDetails);
    try {
      setSelectedUser(await apiFetch<UserDetails>(buildPath(ENDPOINTS.reports.player, { userId })));
    } catch {
      setSelectedUser(null);
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const exportReports = async () => {
    setExportLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      const blob = await apiDownload(ENDPOINTS.reports.export, { query: { search: searchTerm } });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user_reports_${date}.csv`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch {
      // silent
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
      <Card sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 }}>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '1rem' }}>
              User Reports
            </Typography>
            <Typography sx={{ color: '#8384A5', fontSize: '0.75rem', mt: 0.25 }}>
              VIP levels, wager history &amp; balances
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by username or referral code…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#8384A5', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#0C0D1D',
                  borderRadius: 1.5,
                  '& fieldset': { borderColor: '#1E2D55' },
                  '&:hover fieldset': { borderColor: '#886CFF' },
                  '&.Mui-focused fieldset': { borderColor: '#886CFF' },
                },
                '& input': { color: '#F9F9F9', fontSize: '0.85rem' },
              }}
            />
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchUsers}
                sx={{ color: '#8384A5', border: '1px solid #1E2D55', borderRadius: 1.5, '&:hover': { color: '#886CFF', borderColor: '#886CFF' } }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={exportLoading ? <CircularProgress size={14} /> : <Download fontSize="small" />}
              onClick={exportReports}
              disabled={exportLoading}
              sx={{
                borderColor: '#1E2D55',
                color: '#8384A5',
                borderRadius: 1.5,
                fontSize: '0.8rem',
                '&:hover': { borderColor: '#886CFF', color: '#886CFF', bgcolor: 'rgba(136,108,255,0.06)' },
              }}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ borderTop: '1px solid #1E2D55' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#0C0D1D' }}>
                {HEADER_CELLS.map((h, i) => (
                  <TableCell
                    key={i}
                    sx={{
                      color: '#8384A5',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      borderBottom: '1px solid #1E2D55',
                      py: 1.5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {HEADER_CELLS.map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: '1px solid #1E2D5533', py: 1.5 }}>
                          <Skeleton variant="text" sx={{ bgcolor: '#1E2D55' }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : users.map((user, idx) => {
                    const tier = getVipTier(user.vip?.level);
                    const initials = user.name ? user.name.slice(0, 2).toUpperCase() : '??';
                    return (
                      <TableRow
                        key={user.id}
                        sx={{ '&:hover': { bgcolor: '#121E38' }, '& td': { borderBottom: '1px solid #1E2D5533' } }}
                      >
                        {/* # */}
                        <TableCell sx={{ color: '#8384A5', fontSize: '0.78rem', py: 1.5 }}>
                          {(currentPage - 1) * 15 + idx + 1}
                        </TableCell>

                        {/* User */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 34, height: 34, fontSize: '0.72rem', fontWeight: 700, bgcolor: avatarColor(user.name), flexShrink: 0 }}>
                              {initials}
                            </Avatar>
                            <Typography sx={{ color: '#F9F9F9', fontSize: '0.82rem', fontWeight: 600 }}>
                              {user.name}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Wager */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ color: '#FFC23F', fontSize: '0.82rem', fontWeight: 600 }}>
                            ₹{Number(user.wager ?? 0).toFixed(2)}
                          </Typography>
                        </TableCell>

                        {/* Games */}
                        <TableCell sx={{ color: '#8384A5', fontSize: '0.82rem', py: 1.5 }}>
                          {user.gamesPlayed?.toLocaleString() ?? '—'}
                        </TableCell>

                        {/* VIP */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            icon={<Star size={12} color={tier.color} />}
                            label={`VIP ${String(user.vip?.level ?? 0).padStart(2, '0')}`}
                            size="small"
                            sx={{
                              bgcolor: tier.bg,
                              color: tier.color,
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              height: 22,
                              border: `1px solid ${tier.color}44`,
                              '& .MuiChip-icon': { ml: '6px' },
                            }}
                          />
                        </TableCell>

                        {/* Action */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Visibility sx={{ fontSize: '14px !important' }} />}
                            onClick={() => handleViewUserDetails(user.id)}
                            sx={{
                              borderColor: '#1E2D55',
                              color: '#8384A5',
                              fontSize: '0.72rem',
                              borderRadius: 1.5,
                              py: 0.4,
                              '&:hover': { borderColor: '#886CFF', color: '#886CFF', bgcolor: 'rgba(136,108,255,0.06)' },
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, borderBottom: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <SearchOff sx={{ fontSize: 40, color: '#1E2D55' }} />
                      <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>No users found</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 2, py: 1.5, borderTop: '1px solid #1E2D55', gap: 1 }}>
          <Typography sx={{ color: '#8384A5', fontSize: '0.78rem', mr: 'auto' }}>
            Page {currentPage} of {totalPages}
          </Typography>
          <Button
            size="small"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            sx={{ color: '#8384A5', borderColor: '#1E2D55', minWidth: 0, px: 1.5, '&:hover': { color: '#F9F9F9' }, '&.Mui-disabled': { color: '#1E2D5566' } }}
          >
            ← Prev
          </Button>
          <Button
            size="small"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            sx={{ color: '#8384A5', borderColor: '#1E2D55', minWidth: 0, px: 1.5, '&:hover': { color: '#F9F9F9' }, '&.Mui-disabled': { color: '#1E2D5566' } }}
          >
            Next →
          </Button>
        </Box>
      </Card>

      {/* ── User Detail Dialog ── */}
      <Dialog
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0E1831',
            border: '1px solid #1E2D55',
            borderRadius: 2,
            backgroundImage: 'linear-gradient(135deg, rgba(136,108,255,0.06) 0%, rgba(123,94,245,0.06) 100%)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '1rem' }}>User Details</Typography>
          <IconButton size="small" onClick={() => setSelectedUser(null)} sx={{ color: '#8384A5', '&:hover': { color: '#F9F9F9' } }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {userDetailsLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
              <CircularProgress sx={{ color: '#886CFF' }} />
              <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>Loading details…</Typography>
            </Box>
          ) : selectedUser?.id ? (
            <>
              {/* VIP Banner */}
              {selectedUser.vip && (() => {
                const tier = getVipTier(selectedUser.vip.level);
                const pct = Number(selectedUser.vip.progressPct) || 0;
                return (
                  <Box
                    sx={{
                      bgcolor: '#0C0D1D',
                      border: `1px solid ${tier.color}44`,
                      borderRadius: 2,
                      p: 2.5,
                      mb: 2,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', bgcolor: tier.color, opacity: 0.06 }} />
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography sx={{ color: '#8384A5', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          VIP Status
                        </Typography>
                        <Typography sx={{ color: tier.color, fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>
                          VIP {selectedUser.vip.level ?? 0}
                        </Typography>
                      </Box>
                      <Box sx={{ bgcolor: tier.bg, border: `1px solid ${tier.color}44`, borderRadius: 2, p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <EmojiEvents sx={{ color: tier.color, fontSize: 28 }} />
                      </Box>
                    </Box>

                    <Box sx={{ mb: 0.75, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#8384A5', fontSize: '0.72rem' }}>Progress to next level</Typography>
                      <Typography sx={{ color: tier.color, fontSize: '0.72rem', fontWeight: 700 }}>{pct}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(pct, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#1E2D55',
                        '& .MuiLinearProgress-bar': { bgcolor: tier.color, borderRadius: 3 },
                      }}
                    />
                    <Box sx={{ mt: 1.5, display: 'flex', gap: 2 }}>
                      <Box>
                        <Typography sx={{ color: '#8384A5', fontSize: '0.65rem' }}>Current Wager</Typography>
                        <Typography sx={{ color: '#F9F9F9', fontSize: '0.82rem', fontWeight: 600 }}>
                          ₹{Number(selectedUser.wager ?? 0).toFixed(2)}
                        </Typography>
                      </Box>
                      {Number(selectedUser.vip.wagerToNextLevel ?? 0) > 0 && (
                        <Box>
                          <Typography sx={{ color: '#8384A5', fontSize: '0.65rem' }}>Needed for next</Typography>
                          <Typography sx={{ color: '#F9F9F9', fontSize: '0.82rem', fontWeight: 600 }}>
                            ₹{Number(selectedUser.vip.wagerToNextLevel).toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })()}

              {/* User Info */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {/* User Info card */}
                <Box sx={{ bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 2, p: 2, gridColumn: '1 / -1' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Person sx={{ color: '#886CFF', fontSize: 16 }} />
                    <Typography sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      User Information
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: '#1E2D55', mb: 1.5 }} />
                  {[
                    { label: 'Username', value: selectedUser.name },
                    { label: 'User ID', value: selectedUser.id, mono: true },
                    { label: 'Referral Code', value: selectedUser.referralCode || 'N/A', mono: true },
                  ].map(row => (
                    <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
                      <Typography sx={{ color: '#8384A5', fontSize: '0.78rem' }}>{row.label}</Typography>
                      <Typography
                        sx={{
                          color: row.mono ? '#A08FFF' : '#F9F9F9',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          fontFamily: row.mono ? 'monospace' : 'inherit',
                          bgcolor: row.mono ? 'rgba(136,108,255,0.08)' : 'transparent',
                          px: row.mono ? 1 : 0,
                          borderRadius: 1,
                        }}
                      >
                        {row.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Balance card */}
                {selectedUser.wallets && Object.keys(selectedUser.wallets).length > 0 && (
                  <Box sx={{ bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 2, p: 2, gridColumn: '1 / -1' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <AccountBalanceWallet sx={{ color: '#FFC23F', fontSize: 16 }} />
                      <Typography sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Balance Information
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: '#1E2D55', mb: 1.5 }} />
                    {Object.entries(selectedUser.wallets)
                      .map(([key, value]) => (
                        <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
                          <Typography sx={{ color: '#8384A5', fontSize: '0.78rem', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                            {key}
                          </Typography>
                          <Typography sx={{ color: '#0ECC68', fontSize: '0.78rem', fontWeight: 600 }}>
                            {Number(value ?? 0).toFixed(8)}
                          </Typography>
                        </Box>
                      ))}
                  </Box>
                )}
              </Box>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Reports;
