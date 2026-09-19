import React, { useState, useEffect } from 'react';
import { apiFetch, apiFetchPage, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';
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
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Refresh,
  History,
  AccountBalanceWallet,
  Add,
  Remove,
  Close,
  ExpandLess,
  SwapHoriz,
  TrendingUp,
  TrendingDown,
  WalletOutlined,
  Lock,
} from '@mui/icons-material';

/**
 * One player in the list, with every currency the listing returned.
 *
 * `balances` is a MAP rather than 28 numeric fields, and a MISSING key is not
 * a zero — the currency selector renders `—` for one it does not have. That
 * distinction is why the map survived: a shape with a field per coin renders
 * an unknown balance as a confident `0.0000` against a wallet with money in it.
 */
interface House {
  uid: string;
  name: string;
  /** Lower-case coin code -> amount. Absent means "unknown", not "zero". */
  balances: Partial<Record<string, number>>;
}

/** One row of `GET /admin/user/wallet/balances` — decimal strings per coin. */
interface WalletRow {
  uid: number;
  name: string;
  balances: Record<string, string>;
}

interface TransactionHistory {
  id: number;
  uid: number;
  username: string;
  coin: string;
  operation: string;
  amount: number;
  previous_balance: number;
  new_balance: number;
  transaction_time: string;
  description: string | null;
}

interface WalletHistoryResponse {
  history: TransactionHistory[];
  count: number;
}

const CURRENCIES = [
  'btc', 'npr', 'pkr', 'bdt', 'inr', 'usdt', 'eth',
  // 'ltc','bch','trx','doge','ada','xrp','bnb','usdp','nexo','mkr',
  // 'tusd','usdc','busd','nc','shib','matic','bjb','sc','mvr','aed',
];

const avatarColor = (name: string) => {
  const colors = ['#886CFF','#7B5EF5','#0ECC68','#FFC23F','#E01B4F','#A08FFF'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const fmt = (v: number) => v?.toFixed(4) ?? '0.0000';

const HEADER_CELLS = ['#', 'User', 'UID', 'Currency', 'Balance', 'Actions'];

/** The server caps a page at 200; the search finds anyone past it. */
const PAGE_SIZE = 200;

const Wallet: React.FC = () => {
  const [wallets, setWallets] = useState<House[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Record<string, string>>({});
  const [debitValues, setDebitValues] = useState<Record<string, string>>({});
  const [creditValues, setCreditValues] = useState<Record<string, string>>({});
  const [txnPasswords, setTxnPasswords] = useState<Record<string, string>>({});
  /** The written reason for an adjustment. The server requires one. */
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // History modal
  const [historyUser, setHistoryUser] = useState<{ uid: string; name: string } | null>(null);
  const [txHistory, setTxHistory] = useState<TransactionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCoin, setHistoryCoin] = useState('');

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const notify = (msg: string, severity: 'success' | 'error') => setSnack({ open: true, msg, severity });

  /**
   * The search is SERVER-SIDE, so it reaches players beyond the loaded page.
   *
   * One page is `PAGE_SIZE` rows out of however many players exist; filtering
   * that page in the browser would answer "no users match" for anybody who
   * happens to sit on page two. Debounced, because this fires per keystroke.
   */
  useEffect(() => {
    const id = setTimeout(() => { fetchWallets(searchTerm); }, 350);
    return () => clearTimeout(id);
    // The term is the whole trigger — `fetchWallets` is redeclared every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchWallets = async (search = searchTerm) => {
    setLoading(true);
    try {
      /**
       * PLAYER WALLETS — `GET /getwallet`, as the operator console's listing.
       *
       * Not `getAllDetails`: that is the ACCOUNT tree, whose first level under
       * the platform owner is agents, so this screen rendered agent rows —
       * and every action on a row goes to `/admin/user/wallet/…`, which is
       * keyed by PLAYER id. Staff and players are separate tables with their
       * own id sequences, so an agent row here read and adjusted the balance
       * of whichever player happened to share that id. Filtering the agents
       * out of it left the screen empty instead, because the owner's own
       * direct players are not the platform's players — the players hang off
       * the agents.
       *
       * This endpoint answers the question the screen is asking: every player
       * the operator may see, with every currency on each row. Agent money
       * moves through `POST /accounts/refill`, not here.
       */
      const { data, pagination } = await apiFetchPage<WalletRow>(ENDPOINTS.wallet.list, {
        query: { limit: PAGE_SIZE, offset: 0, search: search || undefined },
      });

      setTotal(pagination?.total ?? data.length);
      setWallets(
        data.map((r) => ({
          uid: String(r.uid),
          name: r.name,
          // The server keys them upper-case; this screen keys them lower-case.
          balances: Object.fromEntries(
            Object.entries(r.balances ?? {}).map(([code, value]) => [code.toLowerCase(), Number(value) || 0])
          ),
        }))
      );
    } catch {
      setWallets([]);
      setTotal(0);
      notify('Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Re-read one row's currencies after its balance was changed.
   *
   * The listing already carries every currency, so this is not a lazy load —
   * it is the read-back after an adjustment, kept to one row rather than
   * re-fetching the whole page.
   */
  const loadBalances = async (uid: string) => {
    try {
      const { balances } = await apiFetch<{ userId: string; balances: Record<string, string> }>(
        buildPath(ENDPOINTS.wallet.balances, { userId: uid })
      );
      const mapped = Object.fromEntries(
        Object.entries(balances ?? {}).map(([code, value]) => [code.toLowerCase(), Number(value) || 0])
      );
      setWallets((p) => p.map((w) => (w.uid === uid ? { ...w, balances: mapped } : w)));
    } catch {
      notify(`Failed to load balances for UID ${uid}`, 'error');
    }
  };

  const fetchHistory = async (uid: string, coin?: string) => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<WalletHistoryResponse>(
        buildPath(ENDPOINTS.wallet.history, { userId: uid }),
        // `currency`, upper-case — the parameter is named `coin` in the
        // response rows but `currency` in the query, and the old `coin` key was
        // simply ignored, so picking a coin filtered nothing.
        { query: { currency: coin ? coin.toUpperCase() : undefined } }
      );
      setTxHistory(data.history);
    } catch {
      setTxHistory([]);
      notify('Failed to load transaction history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = (user: House) => {
    setHistoryUser({ uid: user.uid, name: user.name });
    setHistoryCoin('');
    fetchHistory(user.uid);
  };

  const handleHistoryCoinChange = (coin: string) => {
    setHistoryCoin(coin);
    if (historyUser) fetchHistory(historyUser.uid, coin || undefined);
  };

  const handleAmount = (uid: string, val: string, type: 'debit' | 'credit') => {
    const clean = val.replace(/[^0-9.]/g, '');
    type === 'debit'
      ? setDebitValues(p => ({ ...p, [uid]: clean }))
      : setCreditValues(p => ({ ...p, [uid]: clean }));
  };

  const handleOperation = async (uid: string, type: 'debit' | 'credit') => {
    const coin = selectedCurrency[uid] || 'inr';
    const amount = type === 'debit' ? debitValues[uid] : creditValues[uid];
    const transactionPassword = txnPasswords[uid] || '';
    const description = (reasons[uid] || '').trim();

    if (!transactionPassword) {
      notify('Transaction password is required', 'error');
      return;
    }
    if (!description) {
      notify('A reason is required — it is recorded on the audit row', 'error');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      notify('Please enter a valid amount', 'error');
      return;
    }
    setActionLoading(`${uid}-${type}`);
    try {
      /**
       * The body the endpoint actually validates.
       *
       * `userId`/`currency`/`description`, not `uid`/`coin` — the schema is
       * `.strict()`, so the old names were a 400 on every adjustment rather
       * than a silently ignored field, and `description` is mandatory because
       * a balance change with no game or deposit behind it is only auditable
       * if somebody wrote down why.
       *
       * The amount goes as a STRING. A float amount is how a rounding error
       * becomes a balance, so the server rejects numbers outright.
       *
       * Staff identity is taken from the JWT server-side — do not send staffId.
       */
      await apiFetch(ENDPOINTS.wallet.adjust, {
        method: 'POST',
        body: {
          userId: Number(uid),
          currency: coin.toUpperCase(),
          amount: String(amount),
          operation: type,
          description,
          transactionPassword,
        },
      });
      // The changed row only — the rest of the page is unaffected by one
      // adjustment, and re-listing would scroll the operator away from it.
      await loadBalances(uid);
      type === 'debit'
        ? setDebitValues(p => ({ ...p, [uid]: '' }))
        : setCreditValues(p => ({ ...p, [uid]: '' }));
      setTxnPasswords(p => ({ ...p, [uid]: '' }));
      setReasons(p => ({ ...p, [uid]: '' }));
      notify(`Successfully ${type === 'debit' ? 'debited' : 'credited'} ${amount} ${coin.toUpperCase()}`, 'success');
    } catch (err: any) {
      // `apiFetch` has already unwrapped `{ error: { message } }` into the
      // Error's message — the server's words, not a generic failure.
      notify(err?.message || `Failed to process ${type} operation`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // The rows as they came back — name and UID are both matched server-side.
  const filtered = wallets;

  // `—` rather than `0.0000` for a currency that has not been fetched yet — a
  // zero here is indistinguishable from an empty wallet.
  const getCoinBalance = (user: House, coin: string) =>
    user.balances[coin] === undefined ? '—' : fmt(user.balances[coin] as number);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
      <Card sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 }}>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'rgba(136,108,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WalletOutlined sx={{ color: '#886CFF', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '1rem' }}>User Wallet</Typography>
              <Typography sx={{ color: '#8384A5', fontSize: '0.72rem' }}>
                Player balances ·{' '}
                {/* The count is the whole result set, not the page — saying
                    "200 users" under a 40k-player platform is a wrong number,
                    not a rounded one. */}
                {total > filtered.length ? `${filtered.length} of ${total}` : `${filtered.length}`} users
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search by name or UID…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ color: '#8384A5', fontSize: 18 }} /></InputAdornment>,
              }}
              sx={{
                width: { xs: '100%', sm: 240 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#0C0D1D', borderRadius: 1.5,
                  '& fieldset': { borderColor: '#1E2D55' },
                  '&:hover fieldset': { borderColor: '#886CFF' },
                  '&.Mui-focused fieldset': { borderColor: '#886CFF' },
                },
                '& input': { color: '#F9F9F9', fontSize: '0.85rem' },
              }}
            />
            <Tooltip title="Refresh">
              <IconButton onClick={() => fetchWallets()} sx={{ color: '#8384A5', border: '1px solid #1E2D55', borderRadius: 1.5, '&:hover': { color: '#886CFF', borderColor: '#886CFF' } }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ borderTop: '1px solid #1E2D55' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#0C0D1D' }}>
                {HEADER_CELLS.map((h, i) => (
                  <TableCell key={i} sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #1E2D55', py: 1.5, whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {HEADER_CELLS.map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: '1px solid #1E2D5533', py: 1.5 }}>
                          <Skeleton variant="text" sx={{ bgcolor: '#1E2D55' }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.map((user, idx) => {
                    const coin = selectedCurrency[user.uid] || 'inr';
                    const balance = getCoinBalance(user, coin);
                    const isExpanded = expandedRow === user.uid;

                    return (
                      <React.Fragment key={user.uid}>
                        <TableRow sx={{ '&:hover': { bgcolor: '#121E38' }, '& td': { borderBottom: isExpanded ? 'none' : '1px solid #1E2D5533' } }}>
                          {/* # */}
                          <TableCell sx={{ color: '#8384A5', fontSize: '0.78rem', py: 1.5 }}>{idx + 1}</TableCell>

                          {/* User */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: '0.7rem', fontWeight: 700, bgcolor: avatarColor(user.name), flexShrink: 0 }}>
                                {user.name.slice(0, 2).toUpperCase()}
                              </Avatar>
                              <Typography sx={{ color: '#F9F9F9', fontSize: '0.82rem', fontWeight: 600 }}>{user.name}</Typography>
                            </Box>
                          </TableCell>

                          {/* UID */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Typography sx={{ color: '#A08FFF', fontSize: '0.72rem', fontFamily: 'monospace', bgcolor: 'rgba(136,108,255,0.08)', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block' }}>
                              {user.uid}
                            </Typography>
                          </TableCell>

                          {/* Currency selector */}
                          <TableCell sx={{ py: 1.5 }}>
                            <FormControl size="small" sx={{ minWidth: 90 }}>
                              <Select
                                value={coin}
                                // Every currency is already on the row, so
                                // switching one is a re-render, not a fetch.
                                onChange={e => setSelectedCurrency(p => ({ ...p, [user.uid]: e.target.value }))}
                                sx={{
                                  bgcolor: '#0C0D1D', color: '#F9F9F9', fontSize: '0.78rem', borderRadius: 1.5,
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1E2D55' },
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#886CFF' },
                                  '& .MuiSvgIcon-root': { color: '#8384A5' },
                                  '& .MuiSelect-select': { py: 0.75 },
                                }}
                                MenuProps={{ PaperProps: { sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', '& .MuiMenuItem-root': { fontSize: '0.8rem', color: '#F9F9F9', '&:hover': { bgcolor: '#121E38' }, '&.Mui-selected': { bgcolor: 'rgba(136,108,255,0.15)' } } } } }}
                              >
                                {CURRENCIES.map(c => (
                                  <MenuItem key={c} value={c}>{c.toUpperCase()}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>

                          {/* Balance */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Chip
                              label={balance}
                              size="small"
                              icon={<AccountBalanceWallet sx={{ fontSize: '12px !important', color: '#FFC23F !important' }} />}
                              sx={{ bgcolor: 'rgba(255,194,63,0.1)', color: '#FFC23F', fontWeight: 700, fontSize: '0.72rem', height: 22, border: '1px solid rgba(255,194,63,0.25)', fontFamily: 'monospace' }}
                            />
                          </TableCell>

                          {/* Actions */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Box sx={{ display: 'flex', gap: 0.75 }}>
                              <Tooltip title="Transaction History">
                                <IconButton size="small" onClick={() => openHistory(user)} sx={{ color: '#886CFF', bgcolor: 'rgba(136,108,255,0.08)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(136,108,255,0.18)' } }}>
                                  <History sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Manage Funds">
                                <IconButton
                                  size="small"
                                  onClick={() => setExpandedRow(isExpanded ? null : user.uid)}
                                  sx={{ color: '#7B5EF5', bgcolor: 'rgba(123,94,245,0.08)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(123,94,245,0.18)' } }}
                                >
                                  {isExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <SwapHoriz sx={{ fontSize: 16 }} />}
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>

                        {/* Expandable debit/credit row */}
                        {isExpanded && (
                          <TableRow sx={{ bgcolor: '#0C0D1D', '& td': { borderBottom: '1px solid #1E2D55', pt: 0, pb: 2 } }}>
                            <TableCell colSpan={6} sx={{ px: 2 }}>
                              {/* Transaction Password */}
                              <Box sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2, p: 2, mt: 0.5, mb: 2, maxWidth: 420 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                  <Lock sx={{ color: '#FFC23F', fontSize: 16 }} />
                                  <Typography sx={{ color: '#FFC23F', fontSize: '0.78rem', fontWeight: 700 }}>Transaction Password</Typography>
                                </Box>
                                <TextField
                                  size="small"
                                  type="password"
                                  placeholder="Enter transaction password"
                                  value={txnPasswords[user.uid] || ''}
                                  onChange={e => setTxnPasswords(p => ({ ...p, [user.uid]: e.target.value }))}
                                  fullWidth
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      bgcolor: '#0C0D1D', borderRadius: 1.5, fontSize: '0.82rem',
                                      '& fieldset': { borderColor: '#1E2D55' },
                                      '&:hover fieldset': { borderColor: '#FFC23F' },
                                      '&.Mui-focused fieldset': { borderColor: '#FFC23F' },
                                    },
                                    '& input': { color: '#F9F9F9' },
                                  }}
                                />
                                {/* Mandatory server-side: the adjustment's audit
                                    row carries this text. */}
                                <TextField
                                  size="small"
                                  placeholder="Reason for this adjustment"
                                  value={reasons[user.uid] || ''}
                                  onChange={e => setReasons(p => ({ ...p, [user.uid]: e.target.value }))}
                                  fullWidth
                                  sx={{
                                    mt: 1.5,
                                    '& .MuiOutlinedInput-root': {
                                      bgcolor: '#0C0D1D', borderRadius: 1.5, fontSize: '0.82rem',
                                      '& fieldset': { borderColor: '#1E2D55' },
                                      '&:hover fieldset': { borderColor: '#FFC23F' },
                                      '&.Mui-focused fieldset': { borderColor: '#FFC23F' },
                                    },
                                    '& input': { color: '#F9F9F9' },
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                {/* Debit */}
                                <Box sx={{ bgcolor: '#0E1831', border: '1px solid rgba(224,27,79,0.25)', borderRadius: 2, p: 2 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                    <TrendingDown sx={{ color: '#E01B4F', fontSize: 16 }} />
                                    <Typography sx={{ color: '#E01B4F', fontSize: '0.78rem', fontWeight: 700 }}>Debit Funds</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                      size="small"
                                      placeholder={`Amount in ${coin.toUpperCase()}`}
                                      value={debitValues[user.uid] || ''}
                                      onChange={e => handleAmount(user.uid, e.target.value, 'debit')}
                                      sx={{
                                        flex: 1,
                                        '& .MuiOutlinedInput-root': {
                                          bgcolor: '#0C0D1D', borderRadius: 1.5, fontSize: '0.82rem',
                                          '& fieldset': { borderColor: '#1E2D55' },
                                          '&:hover fieldset': { borderColor: '#E01B4F' },
                                          '&.Mui-focused fieldset': { borderColor: '#E01B4F' },
                                        },
                                        '& input': { color: '#F9F9F9' },
                                      }}
                                    />
                                    <Button
                                      variant="contained"
                                      size="small"
                                      startIcon={actionLoading === `${user.uid}-debit` ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <Remove />}
                                      disabled={!!actionLoading}
                                      onClick={() => handleOperation(user.uid, 'debit')}
                                      sx={{ bgcolor: '#E01B4F', '&:hover': { bgcolor: '#C01540' }, borderRadius: 1.5, whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.78rem' }}
                                    >
                                      Debit
                                    </Button>
                                  </Box>
                                </Box>

                                {/* Credit */}
                                <Box sx={{ bgcolor: '#0E1831', border: '1px solid rgba(14,204,104,0.25)', borderRadius: 2, p: 2 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                    <TrendingUp sx={{ color: '#0ECC68', fontSize: 16 }} />
                                    <Typography sx={{ color: '#0ECC68', fontSize: '0.78rem', fontWeight: 700 }}>Credit Funds</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                      size="small"
                                      placeholder={`Amount in ${coin.toUpperCase()}`}
                                      value={creditValues[user.uid] || ''}
                                      onChange={e => handleAmount(user.uid, e.target.value, 'credit')}
                                      sx={{
                                        flex: 1,
                                        '& .MuiOutlinedInput-root': {
                                          bgcolor: '#0C0D1D', borderRadius: 1.5, fontSize: '0.82rem',
                                          '& fieldset': { borderColor: '#1E2D55' },
                                          '&:hover fieldset': { borderColor: '#0ECC68' },
                                          '&.Mui-focused fieldset': { borderColor: '#0ECC68' },
                                        },
                                        '& input': { color: '#F9F9F9' },
                                      }}
                                    />
                                    <Button
                                      variant="contained"
                                      size="small"
                                      startIcon={actionLoading === `${user.uid}-credit` ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <Add />}
                                      disabled={!!actionLoading}
                                      onClick={() => handleOperation(user.uid, 'credit')}
                                      sx={{ bgcolor: '#0ECC68', '&:hover': { bgcolor: '#0BAD58' }, borderRadius: 1.5, whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.78rem' }}
                                    >
                                      Credit
                                    </Button>
                                  </Box>
                                </Box>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, borderBottom: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <WalletOutlined sx={{ fontSize: 40, color: '#1E2D55' }} />
                      <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>
                        {searchTerm ? 'No users match your search' : 'No wallet data found'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Transaction History Dialog ── */}
      <Dialog
        open={!!historyUser}
        onClose={() => setHistoryUser(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid #1E2D55' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <History sx={{ color: '#886CFF', fontSize: 20 }} />
            <Box>
              <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.95rem' }}>Transaction History</Typography>
              {historyUser && (
                <Typography sx={{ color: '#8384A5', fontSize: '0.72rem' }}>
                  {historyUser.name} · UID {historyUser.uid}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setHistoryUser(null)} sx={{ color: '#8384A5', '&:hover': { color: '#F9F9F9' } }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {/* Currency filter */}
          <FormControl size="small" sx={{ minWidth: 160, mb: 2 }}>
            <InputLabel sx={{ color: '#8384A5', '&.Mui-focused': { color: '#886CFF' } }}>Filter by Currency</InputLabel>
            <Select
              value={historyCoin}
              label="Filter by Currency"
              onChange={e => handleHistoryCoinChange(e.target.value)}
              sx={{
                bgcolor: '#0C0D1D', color: '#F9F9F9', fontSize: '0.82rem', borderRadius: 1.5,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1E2D55' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#886CFF' },
                '& .MuiSvgIcon-root': { color: '#8384A5' },
              }}
              MenuProps={{ PaperProps: { sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', '& .MuiMenuItem-root': { fontSize: '0.8rem', color: '#F9F9F9', '&:hover': { bgcolor: '#121E38' } } } } }}
            >
              <MenuItem value="">All Currencies</MenuItem>
              {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c.toUpperCase()}</MenuItem>)}
            </Select>
          </FormControl>

          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress sx={{ color: '#886CFF' }} />
            </Box>
          ) : txHistory.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1 }}>
              <History sx={{ fontSize: 40, color: '#1E2D55' }} />
              <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>
                No transactions found{historyCoin && ` for ${historyCoin.toUpperCase()}`}
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 380, border: '1px solid #1E2D55', borderRadius: 1.5 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Date & Time', 'Coin', 'Operation', 'Amount', 'Prev Balance', 'New Balance'].map(h => (
                      <TableCell key={h} sx={{ bgcolor: '#0C0D1D', color: '#8384A5', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #1E2D55', whiteSpace: 'nowrap' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {txHistory.map(tx => (
                    <TableRow key={tx.id} sx={{ '&:hover': { bgcolor: '#121E38' }, '& td': { borderBottom: '1px solid #1E2D5533' } }}>
                      <TableCell sx={{ color: '#8384A5', fontSize: '0.75rem', whiteSpace: 'nowrap', py: 1.25 }}>
                        {new Date(tx.transaction_time).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography sx={{ color: '#F9F9F9', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          {tx.coin}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Chip
                          label={tx.operation}
                          size="small"
                          icon={tx.operation === 'credit'
                            ? <TrendingUp sx={{ fontSize: '12px !important', color: '#0ECC68 !important' }} />
                            : <TrendingDown sx={{ fontSize: '12px !important', color: '#E01B4F !important' }} />
                          }
                          sx={{
                            bgcolor: tx.operation === 'credit' ? 'rgba(14,204,104,0.12)' : 'rgba(224,27,79,0.12)',
                            color: tx.operation === 'credit' ? '#0ECC68' : '#E01B4F',
                            fontWeight: 700, fontSize: '0.68rem', height: 20,
                            border: `1px solid ${tx.operation === 'credit' ? 'rgba(14,204,104,0.3)' : 'rgba(224,27,79,0.3)'}`,
                            textTransform: 'capitalize',
                            '& .MuiChip-icon': { ml: '4px' },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#FFC23F', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', py: 1.25 }}>
                        {tx.amount}
                      </TableCell>
                      <TableCell sx={{ color: '#8384A5', fontSize: '0.75rem', fontFamily: 'monospace', py: 1.25 }}>
                        {tx.previous_balance}
                      </TableCell>
                      <TableCell sx={{ color: '#F9F9F9', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, py: 1.25 }}>
                        {tx.new_balance}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1E2D55' }}>
          <Button onClick={() => setHistoryUser(null)} variant="contained" sx={{ bgcolor: '#886CFF', '&:hover': { bgcolor: '#5F12CC' }, fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.severity}
          sx={{
            bgcolor: snack.severity === 'success' ? '#0E2B1F' : '#2B0E1A',
            color: snack.severity === 'success' ? '#0ECC68' : '#E01B4F',
            border: `1px solid ${snack.severity === 'success' ? '#0ECC68' : '#E01B4F'}`,
          }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Wallet;
