import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, TextField, MenuItem, Button, Chip, Tooltip, IconButton,
  Pagination, CircularProgress, Stack, Dialog, DialogContent, Divider,
} from '@mui/material';
import { History, RefreshCw, Search, MapPin, Eye, X } from 'lucide-react';
import { getActivity } from '../../services/lordsApi';
import type { ActivityEntry } from '../../services/lordsApi';

/* Build a plain-English sentence describing what an entry actually did, e.g.
   "Credited 100 INR to user Test 222". Falls back to a generic phrasing for
   unknown actions so nothing is ever blank. */
const targetLabel = (e: ActivityEntry) => {
  const noun = (e.targetType || 'record').toLowerCase();
  if (e.targetName) return `${noun} ${e.targetName}${e.targetId ? ` (#${e.targetId})` : ''}`;
  if (e.targetId) return `${noun} #${e.targetId}`;
  return noun;
};

export const describeEntry = (e: ActivityEntry): string => {
  const d = e.details || {};
  const amt = d.amount != null ? d.amount : '';
  const coin = d.coin ? String(d.coin).toUpperCase() : 'INR';
  switch (e.action) {
    case 'login':  return 'Logged in';
    case 'logout': return 'Logged out';
    case 'wallet.balance.update':
      return `${d.operation === 'debit' ? 'Debited' : 'Credited'} ${amt} ${coin} ${d.operation === 'debit' ? 'from' : 'to'} ${targetLabel(e)}`;
    case 'user.wallet.refill':
      return `Refilled ${amt} INR to ${targetLabel(e)}${d.note ? ` — "${d.note}"` : ''}`;
    case 'funds.deposit':  return `Deposited ${amt} to ${targetLabel(e)}${d.note ? ` — "${d.note}"` : ''}`;
    case 'funds.withdraw': return `Withdrew ${amt} from ${targetLabel(e)}${d.note ? ` — "${d.note}"` : ''}`;
    // Retired G/T settlement model — kept so historical rows still read correctly.
    case 'transfer.credit': return `Transferred ${amt} credit to ${targetLabel(e)} (legacy)`;
    case 'transfer.casino': return `Casino transfer of ${amt} to ${targetLabel(e)} (legacy)`;
    case 'staff.transfer':  return `Transferred ${amt} (${d.direction || 'deposit'}) to ${targetLabel(e)}`;
    case 'user.create':     return `Created ${targetLabel(e)}${d.username ? ` "${d.username}"` : ''}`;
    case 'user.update':     return `Updated ${targetLabel(e)}`;
    case 'user.delete':     return `Deleted ${targetLabel(e)}`;
    case 'user.lock':       return `Updated lock settings for ${targetLabel(e)}`;
    case 'user.status.update': return `Updated status for ${targetLabel(e)}`;
    case 'user.credit-limit.update':   return `Set credit limit ${d.creditLimit ?? ''} for ${targetLabel(e)} (legacy)`;
    case 'user.exposure-limit.update': return `Set exposure limit ${d.exposureLimit ?? ''} for ${targetLabel(e)}`;
    case 'user.password.reset': return `Reset password for ${targetLabel(e)}`;
    case 'staff.create':    return `Created staff "${d.name || ''}"${d.role ? ` (${d.role})` : ''}`;
    case 'staff.update':    return `Updated ${targetLabel(e)}`;
    case 'staff.delete':    return `Deleted ${targetLabel(e)}`;
    case 'staff.bulk-status': return `Bulk status "${d.status ?? ''}" for ${(d.ids?.length ?? 0)} account(s)`;
    case 'staff.password.change': return `Changed staff password`;
    case 'staff.password.reset':  return `Reset own staff password`;
    case 'executive.create': return `Created executive "${d.username || ''}"`;
    case 'executive.update': return `Updated ${targetLabel(e)}`;
    case 'executive.password.reset': return `Reset password for ${targetLabel(e)}`;
    case 'executive.lock':   return `Set ${targetLabel(e)} status to "${d.status ?? ''}"`;
    case 'settle.declare-result':
      return `Declared result for market #${e.targetId}${d.market_type ? ` (${d.market_type})` : ''}${d.winnerName ? ` — winner ${d.winnerName}` : ''}`;
    case 'settle.void-market':
    case 'settle.void-market-after': return `Voided market #${e.targetId}${d.market_type ? ` (${d.market_type})` : ''}`;
    case 'settle.void-bet':
    case 'settle.void-bet-after':    return `Voided bet #${e.targetId}`;
    case 'deposit.approved': return `Approved deposit #${d.depositId ?? ''} for ${targetLabel(e)}${amt ? ` (${amt})` : ''}`;
    case 'deposit.rejected': return `Rejected deposit #${d.depositId ?? ''} for ${targetLabel(e)}`;
    case 'withdraw.approved': return `Approved withdrawal of ${amt} ${d.currency ? String(d.currency).toUpperCase() : 'INR'} for ${targetLabel(e)}`;
    case 'withdraw.rejected': return `Rejected withdrawal of ${amt} ${d.currency ? String(d.currency).toUpperCase() : 'INR'} for ${targetLabel(e)} (refunded)`;
    default:
      return `${e.action.replace(/[._]/g, ' ')}${e.targetType ? ` on ${targetLabel(e)}` : ''}`;
  }
};

/* Colour per action key — extends the executive-activity palette with the
   newly-logged staff / settlement / deposit actions. */
const ACTION_COLORS: Record<string, string> = {
  login: '#A08FFF', logout: '#8384A5',
  'user.create': '#0ECC68', 'user.update': '#A08FFF', 'user.delete': '#E01B4F',
  'user.lock': '#E01B4F', 'user.unlock': '#0ECC68', 'user.current.update': '#A08FFF',
  'user.password.reset': '#FFC23F', 'user.status.update': '#A08FFF',
  'user.credit-limit.update': '#FFC23F', 'user.exposure-limit.update': '#FFC23F',
  'user.wallet.refill': '#0ECC68', 'wallet.balance.update': '#0ECC68',
  'staff.create': '#0ECC68', 'staff.update': '#A08FFF', 'staff.delete': '#E01B4F',
  'staff.transfer': '#FFC23F', 'staff.bulk-status': '#A08FFF',
  'staff.password.change': '#FFC23F', 'staff.password.reset': '#FFC23F',
  'executive.create': '#0ECC68', 'executive.update': '#A08FFF',
  'executive.password.reset': '#FFC23F', 'executive.lock': '#E01B4F',
  'funds.deposit': '#0ECC68', 'funds.withdraw': '#E01B4F',
  'transfer.credit': '#8384A5', 'transfer.casino': '#8384A5',
  'settle.declare-result': '#FFC23F', 'settle.void-market': '#E01B4F',
  'settle.void-bet': '#E01B4F', 'settle.void-market-after': '#E01B4F',
  'settle.void-bet-after': '#E01B4F',
  'deposit.approved': '#0ECC68', 'deposit.rejected': '#E01B4F',
  'withdraw.approved': '#0ECC68', 'withdraw.rejected': '#E01B4F',
};

const actionColor = (a: string) => ACTION_COLORS[a] || '#878AA2';

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'user.create', label: 'Create user' },
  { value: 'user.update', label: 'Update user' },
  { value: 'user.wallet.refill', label: 'Wallet refill' },
  { value: 'wallet.balance.update', label: 'Wallet credit/debit' },
  { value: 'user.lock', label: 'Lock user' },
  { value: 'staff.create', label: 'Create staff' },
  { value: 'staff.transfer', label: 'Staff transfer' },
  { value: 'funds.deposit', label: 'Deposit' },
  { value: 'funds.withdraw', label: 'Withdraw' },
  { value: 'settle.declare-result', label: 'Declare result' },
  { value: 'settle.void-market', label: 'Void market' },
  { value: 'deposit.approved', label: 'Deposit approved' },
  { value: 'deposit.rejected', label: 'Deposit rejected' },
  { value: 'withdraw.approved', label: 'Withdraw approved' },
  { value: 'withdraw.rejected', label: 'Withdraw rejected' },
  { value: 'executive.create', label: 'Create executive' },
];

const inputSx = {
  '& .MuiInputBase-root': { bgcolor: '#10182E', color: '#F9F9F9', fontSize: '0.78rem' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1E2D55' },
  '& .MuiInputLabel-root': { color: '#8384A5', fontSize: '0.78rem' },
  '& .MuiSvgIcon-root': { color: '#8384A5' },
};

const headCellSx = {
  bgcolor: '#0C0D1D', color: '#8384A5', fontSize: '0.68rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #1E2D55',
  whiteSpace: 'nowrap',
};
const bodyCellSx = { color: '#F9F9F9', fontSize: '0.75rem', borderBottom: '1px solid #1E2D5533', verticalAlign: 'top' };

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: '2-digit', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const LIMIT = 50;

const ActivityLogTab = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActivityEntry | null>(null);

  // filters
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // committed search text (only applied on submit so typing doesn't spam the API)
  const [qApplied, setQApplied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      /**
       * `{rows, pagination}`, and EVERY filter goes to the server.
       *
       * `q` and `status` used to be applied to the rows already in hand, which
       * is "search this page" wearing the label "search" — a match on row
       * 3,000 could not be found, and the entry count above the table then
       * described a different set of rows than the table showed.
       */
      const res = await getActivity({
        page, limit: LIMIT,
        action: action || undefined,
        status: status || undefined,
        q: qApplied.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      });

      setEntries(res.rows ?? []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total ?? res.rows?.length ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load activity log');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page, qApplied, action, status, from, to]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 whenever a filter (other than page) changes.
  useEffect(() => { setPage(1); }, [qApplied, action, status, from, to]);

  const onSearch = () => setQApplied(q.trim());

  const summary = useMemo(
    () => `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}`,
    [total]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <History size={20} color="#886CFF" />
          <Typography sx={{ color: '#F9F9F9', fontSize: '1.05rem', fontWeight: 700 }}>
            Activity Log
          </Typography>
          <Chip label={summary} size="small"
            sx={{ bgcolor: '#10182E', color: '#8384A5', fontSize: '0.7rem', border: '1px solid #1E2D55' }} />
        </Stack>
        <Button onClick={load} startIcon={<RefreshCw size={15} />} disabled={loading}
          sx={{ color: '#886CFF', textTransform: 'none', fontSize: '0.78rem', '&:hover': { bgcolor: '#162140' } }}>
          Refresh
        </Button>
      </Stack>

      {/* Filters */}
      <Stack direction="row" sx={{ mb: 2, flexWrap: 'wrap', gap: 1.25 }}>
        <TextField
          size="small" placeholder="Search admin / target / IP" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSearch(); }}
          sx={{ ...inputSx, minWidth: 230 }}
          InputProps={{ startAdornment: <Search size={15} color="#8384A5" style={{ marginRight: 6 }} /> }}
        />
        <TextField select size="small" label="Action" value={action}
          onChange={e => setAction(e.target.value)} sx={{ ...inputSx, minWidth: 160 }}>
          {ACTION_OPTIONS.map(o => <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.78rem' }}>{o.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Status" value={status}
          onChange={e => setStatus(e.target.value)} sx={{ ...inputSx, minWidth: 120 }}>
          <MenuItem value="" sx={{ fontSize: '0.78rem' }}>All</MenuItem>
          <MenuItem value="success" sx={{ fontSize: '0.78rem' }}>Success</MenuItem>
          <MenuItem value="failed" sx={{ fontSize: '0.78rem' }}>Failed</MenuItem>
        </TextField>
        <TextField type="datetime-local" size="small" label="From" value={from}
          onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ ...inputSx, minWidth: 190 }} />
        <TextField type="datetime-local" size="small" label="To" value={to}
          onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ ...inputSx, minWidth: 190 }} />
        <Button variant="contained" onClick={onSearch}
          sx={{ bgcolor: '#886CFF', textTransform: 'none', fontSize: '0.78rem', '&:hover': { bgcolor: '#9B82FF' } }}>
          Apply
        </Button>
      </Stack>

      {error && (
        <Box sx={{ mb: 2, p: 1.5, bgcolor: '#2B0E1A', border: '1px solid #E01B4F', borderRadius: 1 }}>
          <Typography sx={{ color: '#E01B4F', fontSize: '0.78rem' }}>{error}</Typography>
        </Box>
      )}

      <TableContainer component={Paper}
        sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2, boxShadow: 'none' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx}>When</TableCell>
              <TableCell sx={headCellSx}>Admin</TableCell>
              <TableCell sx={headCellSx}>Role</TableCell>
              <TableCell sx={headCellSx}>Action</TableCell>
              <TableCell sx={headCellSx}>Target</TableCell>
              <TableCell sx={headCellSx}>Details</TableCell>
              <TableCell sx={headCellSx}>IP</TableCell>
              <TableCell sx={headCellSx}>Location</TableCell>
              <TableCell sx={headCellSx}>Status</TableCell>
              <TableCell sx={{ ...headCellSx, textAlign: 'center' }}>View</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ ...bodyCellSx, textAlign: 'center', py: 5 }}>
                  <CircularProgress size={26} sx={{ color: '#886CFF' }} />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ ...bodyCellSx, textAlign: 'center', py: 5, color: '#8384A5' }}>
                  No activity found for the selected filters.
                </TableCell>
              </TableRow>
            ) : entries.map(e => (
              <TableRow key={e.id} sx={{ '&:hover': { bgcolor: '#121E38' } }}>
                <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap', color: '#C7CBDA' }}>{fmtWhen(e.createdAt)}</TableCell>
                <TableCell sx={{ ...bodyCellSx, fontWeight: 600 }}>
                  {e.actorName || `#${e.staffId}`}
                  {e.executiveId ? (
                    <Chip label="EXEC" size="small"
                      sx={{ ml: 0.75, height: 16, fontSize: '0.55rem', bgcolor: '#7B5EF522', color: '#A78BFA' }} />
                  ) : null}
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, color: '#8384A5' }}>{e.actorRole || '—'}</TableCell>
                <TableCell sx={bodyCellSx}>
                  <Chip label={e.action} size="small"
                    sx={{
                      bgcolor: `${actionColor(e.action)}22`, color: actionColor(e.action),
                      fontSize: '0.65rem', fontWeight: 700, height: 20, borderRadius: '4px',
                    }} />
                </TableCell>
                <TableCell sx={bodyCellSx}>
                  {e.targetType ? (
                    <Box>
                      <Typography component="span" sx={{ color: '#8384A5', fontSize: '0.65rem' }}>{e.targetType}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#F9F9F9' }}>
                        {e.targetName || (e.targetId ? `#${e.targetId}` : '—')}
                      </Typography>
                    </Box>
                  ) : <span style={{ color: '#878AA2' }}>—</span>}
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, maxWidth: 280 }}>
                  <Tooltip title={describeEntry(e)} arrow placement="top">
                    <Typography sx={{
                      fontSize: '0.72rem', color: '#C7CBDA',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
                    }}>
                      {describeEntry(e)}
                    </Typography>
                  </Tooltip>
                  {e.status === 'failed' && e.errorMessage ? (
                    <Typography sx={{ fontSize: '0.65rem', color: '#E01B4F', mt: 0.25 }}>{e.errorMessage}</Typography>
                  ) : null}
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, fontFamily: 'monospace', color: '#C7CBDA' }}>{e.ip || '—'}</TableCell>
                <TableCell sx={bodyCellSx}>
                  {e.location ? (
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <MapPin size={12} color="#8384A5" />
                      <span>{e.location}</span>
                    </Stack>
                  ) : <span style={{ color: '#878AA2' }}>—</span>}
                </TableCell>
                <TableCell sx={bodyCellSx}>
                  <Chip label={e.status} size="small"
                    sx={{
                      bgcolor: e.status === 'success' ? '#0ECC6822' : '#E01B4F22',
                      color: e.status === 'success' ? '#0ECC68' : '#E01B4F',
                      fontSize: '0.62rem', fontWeight: 700, height: 18, textTransform: 'capitalize',
                    }} />
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, textAlign: 'center' }}>
                  <Tooltip title="View full details" arrow>
                    <IconButton size="small" onClick={() => setDetail(e)}
                      sx={{ color: '#886CFF', '&:hover': { bgcolor: '#162140' } }}>
                      <Eye size={16} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Pagination
            count={totalPages} page={page} onChange={(_, p) => setPage(p)} size="small"
            sx={{
              '& .MuiPaginationItem-root': { color: '#8384A5' },
              '& .Mui-selected': { bgcolor: '#886CFF !important', color: '#fff' },
            }}
          />
        </Stack>
      )}

      {/* Details dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}>
        {detail && (
          <DialogContent sx={{ p: 0 }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #1E2D55' }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Eye size={18} color="#886CFF" />
                <Typography sx={{ color: '#F9F9F9', fontSize: '0.95rem', fontWeight: 700 }}>Activity Detail</Typography>
              </Stack>
              <IconButton size="small" onClick={() => setDetail(null)} sx={{ color: '#8384A5' }}>
                <X size={16} />
              </IconButton>
            </Stack>

            {/* Human-readable summary */}
            <Box sx={{ px: 2.5, py: 2 }}>
              <Box sx={{ p: 1.75, bgcolor: '#10182E', border: '1px solid #1E2D55', borderRadius: 1.5, mb: 2 }}>
                <Typography sx={{ color: '#8384A5', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  What happened
                </Typography>
                <Typography sx={{ color: '#F9F9F9', fontSize: '0.9rem', fontWeight: 600 }}>
                  {describeEntry(detail)}
                </Typography>
              </Box>

              {/* Metadata grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {([
                  ['Performed by', `${detail.actorName || `#${detail.staffId}`}${detail.executiveId ? ' (Executive)' : ''}`],
                  ['Role', detail.actorRole || '—'],
                  ['Action', detail.action],
                  ['Status', detail.status],
                  ['Target', detail.targetType ? `${detail.targetType} ${detail.targetName || (detail.targetId ? `#${detail.targetId}` : '')}`.trim() : '—'],
                  ['When', new Date(detail.createdAt).toLocaleString()],
                  ['IP address', detail.ip || '—'],
                  ['Location', detail.location || '—'],
                ] as [string, string][]).map(([label, value]) => (
                  <Box key={label}>
                    <Typography sx={{ color: '#8384A5', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
                    <Typography sx={{ color: '#F9F9F9', fontSize: '0.8rem', wordBreak: 'break-word' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>

              {detail.status === 'failed' && detail.errorMessage && (
                <Box sx={{ mt: 2, p: 1.25, bgcolor: '#2B0E1A', border: '1px solid #E01B4F', borderRadius: 1 }}>
                  <Typography sx={{ color: '#E01B4F', fontSize: '0.75rem' }}>{detail.errorMessage}</Typography>
                </Box>
              )}

              {detail.details && (
                <>
                  <Divider sx={{ my: 2, borderColor: '#1E2D55' }} />
                  <Typography sx={{ color: '#8384A5', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
                    Raw data
                  </Typography>
                  <Box component="pre" sx={{
                    m: 0, p: 1.5, bgcolor: '#0C0D1D', border: '1px solid #1E2D55', borderRadius: 1,
                    color: '#C7CBDA', fontSize: '0.72rem', overflowX: 'auto', whiteSpace: 'pre-wrap',
                  }}>
                    {JSON.stringify(detail.details, null, 2)}
                  </Box>
                </>
              )}
            </Box>
          </DialogContent>
        )}
      </Dialog>
    </Box>
  );
};

export default ActivityLogTab;
