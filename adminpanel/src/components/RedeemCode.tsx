import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Button,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  PersonAdd,
  Refresh,
  CheckCircle,
  HourglassEmpty,
  Cancel,
  CardGiftcard,
  AttachMoney,
  CalendarToday,
  Autorenew,
  Redeem,
} from '@mui/icons-material';
import { ENDPOINTS } from '../services/endpoints';
import { apiFetch, apiFetchPage } from '../utils/api';

interface User {
  id: string;
  name: string;
}

/** One row of `GET /admin/user/bonus/codes` — see `bonus.service.js#shapeCode`. */
interface RedeemBonus {
  id: number;
  userId: string;
  code: string;
  amount: string;
  bonusPct: string | null;
  kind: 'percentage' | 'amount';
  status: string;
  source: string | null;
  createdAt: string;
}

/** `GET /admin/staff/players` — players in the operator's downline. */
interface StaffPlayerRow {
  id: number;
  name: string;
  email?: string;
}

const LIST_LIMIT = 100;
const PLAYER_SEARCH_LIMIT = 25;
/** Above MUI AppBar (1100) and drawer so the player list is not covered by sibling grid cells. */
const PLAYER_DROPDOWN_Z = 1400;

/**
 * `createCode` requires the code itself — the server does not mint one.
 *
 * The validator accepts `[A-Z0-9-]{4,40}`, and the column is unique, so this
 * is long enough that two operators issuing at the same moment do not collide.
 */
const generateCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 10; i++) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `RC-${body}`;
};

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  active:     { color: '#0ECC68', bg: 'rgba(14,204,104,0.12)', border: 'rgba(14,204,104,0.3)', icon: <CheckCircle sx={{ fontSize: 13 }} /> },
  redeemed:   { color: '#A08FFF', bg: 'rgba(85,129,247,0.12)', border: 'rgba(85,129,247,0.3)', icon: <Redeem sx={{ fontSize: 13 }} /> },
  expired:    { color: '#E01B4F', bg: 'rgba(224,27,79,0.12)',  border: 'rgba(224,27,79,0.3)',  icon: <Cancel sx={{ fontSize: 13 }} /> },
  superseded: { color: '#FFC23F', bg: 'rgba(255,194,63,0.12)', border: 'rgba(255,194,63,0.3)', icon: <HourglassEmpty sx={{ fontSize: 13 }} /> },
};

const getStatus = (s: string) => STATUS_CFG[s.toLowerCase()] ?? { color: '#8384A5', bg: 'rgba(131,132,165,0.12)', border: 'rgba(131,132,165,0.3)', icon: <HourglassEmpty sx={{ fontSize: 13 }} /> };

const avatarColor = (name: string) => {
  const colors = ['#886CFF','#7B5EF5','#0ECC68','#FFC23F','#E01B4F'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const fmt = (d: string) => (d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/** Amounts arrive as exact decimal strings — trim the eight places for display. */
const fmtAmount = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v;
};

const BonusRedemption: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [redeemList, setRedeemList] = useState<RedeemBonus[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState(generateCode);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notify = (msg: string, severity: 'success' | 'error') => setSnack({ open: true, msg, severity });

  const searchPlayers = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 1) {
      setUsers([]);
      return;
    }
    try {
      const { data } = await apiFetchPage<StaffPlayerRow>(ENDPOINTS.staff.players, {
        query: { search: q, limit: PLAYER_SEARCH_LIMIT, offset: 0 },
      });
      setUsers(
        (data ?? []).map((p) => ({
          id: String(p.id),
          name: p.name?.trim() || `User ${p.id}`,
        }))
      );
    } catch (err: any) {
      notify(err?.message || 'Failed to search players', 'error');
      setUsers([]);
    }
  }, []);

  const fetchRedeemList = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await apiFetchPage<RedeemBonus>(ENDPOINTS.bonus.codes, {
        query: { limit: LIST_LIMIT, offset: 0 },
      });
      setRedeemList(
        [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to load redemption list';
      setLoadError(msg);
      notify(msg, 'error');
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount || !code) return;
    setCreateLoading(true);
    try {
      await apiFetch(ENDPOINTS.bonus.codes, {
        method: 'POST',
        body: {
          userId: Number(selectedUser.id),
          code: code.trim().toUpperCase(),
          amount: String(amount).trim(),
        },
      });
      setAmount(''); setSelectedUser(null); setSearchTerm(''); setShowDropdown(false); setCode(generateCode());
      notify('Redeem code created successfully!', 'success');
      fetchRedeemList();
    } catch (err: any) { notify(err?.message || 'Failed to create redeem code', 'error'); }
    finally { setCreateLoading(false); }
  };

  useEffect(() => { fetchRedeemList(); }, []);

  useEffect(() => {
    if (!showDropdown || searchTerm.trim().length < 1) return;
    const timer = window.setTimeout(() => { searchPlayers(searchTerm); }, 280);
    return () => window.clearTimeout(timer);
  }, [searchTerm, showDropdown, searchPlayers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const HEADER_CELLS = ['User ID', 'Code', 'Amount', 'Status', 'Source', 'Created'];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Create Form ── */}
      <Card sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2, overflow: 'visible' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #1E2D55', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(136,108,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CardGiftcard sx={{ color: '#886CFF', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.95rem' }}>Create Redeem Code</Typography>
            <Typography sx={{ color: '#8384A5', fontSize: '0.72rem' }}>
              Issue a code for a specific player — they redeem it from Account → Redeem Code on the site.
            </Typography>
          </Box>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.5, overflow: 'visible' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '4fr 4fr 3fr 3fr' }, gap: 2, alignItems: 'flex-start', overflow: 'visible' }}>

            {/* User search */}
            <Box
              ref={dropdownRef}
              sx={{
                position: 'relative',
                zIndex: showDropdown ? PLAYER_DROPDOWN_Z : 1,
              }}
            >
              <Typography sx={{ color: '#8384A5', fontSize: '0.72rem', fontWeight: 600, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Select User
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Search users…"
                value={searchTerm}
                onChange={e => {
                  const v = e.target.value;
                  setSearchTerm(v);
                  setSelectedUser(null);
                  setShowDropdown(v.trim().length > 0);
                }}
                onFocus={() => { if (searchTerm.trim()) setShowDropdown(true); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: '#8384A5', fontSize: 18 }} /></InputAdornment>,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#0C0D1D', borderRadius: 1.5,
                    '& fieldset': { borderColor: selectedUser ? '#0ECC68' : '#1E2D55' },
                    '&:hover fieldset': { borderColor: '#886CFF' },
                    '&.Mui-focused fieldset': { borderColor: '#886CFF' },
                  },
                  '& input': { color: '#F9F9F9', fontSize: '0.85rem' },
                }}
              />
              {/* Dropdown */}
              {showDropdown && searchTerm.trim().length > 0 && filteredUsers.length === 0 && (
                <Paper
                  elevation={8}
                  sx={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: PLAYER_DROPDOWN_Z, mt: 0.5,
                    bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 1.5, px: 2, py: 1.5,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                  }}
                >
                  <Typography sx={{ color: '#8384A5', fontSize: '0.8rem' }}>No players match — try name or use a shorter search.</Typography>
                </Paper>
              )}
              {showDropdown && filteredUsers.length > 0 && (
                <Paper
                  elevation={8}
                  sx={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: PLAYER_DROPDOWN_Z, mt: 0.5,
                    bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 1.5,
                    maxHeight: 240, overflowY: 'auto',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#1E2D55', borderRadius: 2 },
                  }}
                >
                  {filteredUsers.map(user => (
                    <Box
                      key={user.id}
                      onClick={() => { setSelectedUser(user); setSearchTerm(user.name); setShowDropdown(false); }}
                      sx={{
                        px: 2, py: 1.25, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                        borderBottom: '1px solid #1E2D5533',
                        '&:hover': { bgcolor: '#121E38' },
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.65rem', fontWeight: 700, bgcolor: avatarColor(user.name), flexShrink: 0 }}>
                        {user.name.slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: '#F9F9F9', fontSize: '0.82rem', fontWeight: 600 }}>{user.name}</Typography>
                        <Typography sx={{ color: '#8384A5', fontSize: '0.68rem' }}>ID: {user.id}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Paper>
              )}
              {/* Selected badge */}
              {selectedUser && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(14,204,104,0.08)', border: '1px solid rgba(14,204,104,0.25)', borderRadius: 1.5, px: 1.5, py: 0.75 }}>
                  <CheckCircle sx={{ color: '#0ECC68', fontSize: 14 }} />
                  <Typography sx={{ color: '#0ECC68', fontSize: '0.75rem', fontWeight: 600 }}>{selectedUser.name}</Typography>
                  <Typography sx={{ color: '#8384A5', fontSize: '0.68rem', ml: 0.5 }}>· {selectedUser.id}</Typography>
                </Box>
              )}
            </Box>

            {/* Code — the server does not mint one, so it is issued here. */}
            <Box>
              <Typography sx={{ color: '#8384A5', fontSize: '0.72rem', fontWeight: 600, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Code
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="RC-XXXXXXXXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 40 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Generate a new code">
                        <IconButton size="small" onClick={() => setCode(generateCode())} sx={{ color: '#8384A5', '&:hover': { color: '#886CFF' } }}>
                          <Autorenew sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#0C0D1D', borderRadius: 1.5,
                    '& fieldset': { borderColor: '#1E2D55' },
                    '&:hover fieldset': { borderColor: '#886CFF' },
                    '&.Mui-focused fieldset': { borderColor: '#886CFF' },
                  },
                  '& input': { color: '#FFC23F', fontSize: '0.85rem', fontFamily: 'monospace', letterSpacing: '0.05em', fontWeight: 700 },
                }}
              />
            </Box>

            {/* Amount */}
            <Box>
              <Typography sx={{ color: '#8384A5', fontSize: '0.72rem', fontWeight: 600, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Amount
              </Typography>
              <TextField
                size="small"
                fullWidth
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                inputProps={{ min: 0, step: '0.01' }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><AttachMoney sx={{ color: '#FFC23F', fontSize: 18 }} /></InputAdornment>,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#0C0D1D', borderRadius: 1.5,
                    '& fieldset': { borderColor: '#1E2D55' },
                    '&:hover fieldset': { borderColor: '#886CFF' },
                    '&.Mui-focused fieldset': { borderColor: '#886CFF' },
                  },
                  '& input': { color: '#F9F9F9', fontSize: '0.85rem' },
                }}
              />
            </Box>

            {/* Submit — top margin lines up with labeled fields in other columns */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!selectedUser || !amount || code.trim().length < 4 || createLoading}
              startIcon={createLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <PersonAdd />}
              sx={{
                mt: { xs: 0, md: 2.35 },
                bgcolor: '#886CFF', '&:hover': { bgcolor: '#5F12CC' },
                '&.Mui-disabled': { bgcolor: '#1E2D55', color: '#8384A5' },
                borderRadius: 1.5, fontWeight: 700, py: 1.1,
              }}
            >
              Create Code
            </Button>
          </Box>
        </Box>
      </Card>

      {/* ── Redemption list ── */}
      <Card sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2, borderBottom: '1px solid #1E2D55', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CardGiftcard sx={{ color: '#7B5EF5', fontSize: 20 }} />
            <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.95rem' }}>
              Redemption History
              <Typography component="span" sx={{ ml: 1, color: '#8384A5', fontWeight: 400, fontSize: '0.78rem' }}>
                ({redeemList.length} records)
              </Typography>
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchRedeemList} disabled={loading} sx={{ color: '#8384A5', border: '1px solid #1E2D55', borderRadius: 1.5, '&:hover': { color: '#886CFF', borderColor: '#886CFF' } }}>
              <Refresh fontSize="small" sx={{ animation: loading ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#0C0D1D' }}>
                {HEADER_CELLS.map(h => (
                  <TableCell key={h} sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #1E2D55', py: 1.5, whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {HEADER_CELLS.map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: '1px solid #1E2D5533', py: 1.5 }}>
                          <Skeleton variant="text" sx={{ bgcolor: '#1E2D55' }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : loadError
                ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 6, borderBottom: 'none' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
                        <Cancel sx={{ fontSize: 40, color: 'rgba(224,27,79,0.4)' }} />
                        <Typography sx={{ color: '#E01B4F', fontSize: '0.85rem', fontWeight: 600 }}>{loadError}</Typography>
                        <Button size="small" onClick={fetchRedeemList} startIcon={<Refresh fontSize="small" />} sx={{ color: '#886CFF', textTransform: 'none', fontWeight: 600 }}>
                          Try again
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
                : redeemList.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 6, borderBottom: 'none' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <CardGiftcard sx={{ fontSize: 40, color: '#1E2D55' }} />
                        <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>No redeem codes found</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
                : redeemList.map((item) => {
                    const cfg = getStatus(item.status);
                    return (
                      <TableRow key={item.id} sx={{ '&:hover': { bgcolor: '#121E38' }, '& td': { borderBottom: '1px solid #1E2D5533' } }}>
                        {/* User ID */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ color: '#A08FFF', fontSize: '0.72rem', fontFamily: 'monospace', bgcolor: 'rgba(136,108,255,0.08)', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block' }}>
                            {item.userId}
                          </Typography>
                        </TableCell>

                        {/* Code */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ color: '#FFC23F', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, bgcolor: 'rgba(255,194,63,0.08)', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block', letterSpacing: '0.05em' }}>
                            {item.code}
                          </Typography>
                        </TableCell>

                        {/* Amount — or the deposit percentage, for a percentage code. */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ color: '#0ECC68', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {item.kind === 'percentage' ? `${item.bonusPct}%` : `$${fmtAmount(item.amount)}`}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            icon={<Box sx={{ color: `${cfg.color} !important`, display: 'flex', ml: '6px' }}>{cfg.icon}</Box>}
                            label={item.status}
                            size="small"
                            sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.7rem', height: 22, border: `1px solid ${cfg.border}`, textTransform: 'capitalize' }}
                          />
                        </TableCell>

                        {/* Source */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ color: '#8384A5', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                            {item.source || '—'}
                          </Typography>
                        </TableCell>

                        {/* Created */}
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <CalendarToday sx={{ color: '#8384A5', fontSize: 13 }} />
                            <Typography sx={{ color: '#8384A5', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmt(item.createdAt)}</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ bgcolor: snack.severity === 'success' ? '#0E2B1F' : '#2B0E1A', color: snack.severity === 'success' ? '#0ECC68' : '#E01B4F', border: `1px solid ${snack.severity === 'success' ? '#0ECC68' : '#E01B4F'}` }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BonusRedemption;
