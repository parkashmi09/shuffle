import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip as MuiTooltip, Typography, alpha,
} from '@mui/material';
import { ArrowBack, Close, Refresh, OpenInNew } from '@mui/icons-material';
import { C, fmtMoney, fmtNum } from './shared';
import { apiFetchPage, apiFetch, buildPath, ApiError } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ROWS BEHIND A HEADLINE FIGURE
 *
 * Two things make this more than a table:
 *
 * 1. IT READS THE SAME TABLES THE TOTAL DOES. `/dashboard/today` selects from
 *    `deposits` and `withdrawals`; the deposit total sums `ccdeposit`,
 *    `fiat_deposits`, `apaydeposits` and `pay_in_transactions` — four tables,
 *    none of them `deposits`. A drill-down built on the old route would have
 *    listed rows that are not in the number it was opened from. It reads
 *    `/dashboard/movements`, which unions the same six sources the totals do
 *    and names the source on every row.
 *
 * 2. THE WINDOW IS ADDITIVE. `Today` and `Overall` are the API's own `today`
 *    and `lifetime`; `Custom` sends `from`/`to` and gets a third figure back.
 *    Switching to a custom range never rewrites what "overall" means.
 *
 * Clicking a row opens that player's balance sheet — every source that moved
 * their wallet, with a running balance and the amount the ledger cannot
 * account for.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type DrilldownKind = 'deposits' | 'withdrawals' | 'both' | 'users';
export type Scope = 'today' | 'overall' | 'custom';

export interface DrilldownRequest {
  kind: DrilldownKind;
  title: string;
  /** Which window the card that was clicked is showing. */
  scope: Scope;
}

interface MovementRow {
  id: string;
  source: string;
  sourceLabel: string;
  direction: 'deposit' | 'withdrawal';
  at: string | null;
  userId: string | null;
  user: { id: string; name: string; email: string | null } | null;
  currency: string | null;
  amount: string;
  /** Null when no exchange rate covers the currency — NOT zero. */
  usd: string | null;
  status: string | null;
}

interface RegistrationRow {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  registeredAt: string;
  verified: boolean;
  channel: 'direct' | 'agent';
}

interface Totals {
  usd: string;
  count: number;
  byCurrency: { currency: string; amount: string; usd: string; count: number }[];
  unconverted: { currency: string | null; amount: string; count: number; reason: string }[];
}

interface SheetEvent {
  ts: string; category: string; type: 'CREDIT' | 'DEBIT';
  description: string; amount: string; balance: string;
}
interface BalanceSheet {
  subject: { id: string; name: string; email: string | null; agent: string | null };
  currency: string;
  balance: {
    live: string; ledger: string; openExposure: string;
    unexplained: string; credited: string; debited: string;
  };
  total: number;
  rows: SheetEvent[];
}

const SOURCES = [
  { value: '', label: 'All sources' },
  { value: 'crypto_deposit', label: 'Crypto deposit' },
  { value: 'bank_deposit', label: 'Bank deposit' },
  { value: 'gateway_deposit', label: 'Gateway deposit' },
  { value: 'payin_deposit', label: 'Pay-in' },
  { value: 'crypto_withdrawal', label: 'Crypto withdrawal' },
  { value: 'bank_withdrawal', label: 'Bank withdrawal' },
];

/**
 * `<input type="datetime-local">` speaks LOCAL wall-clock with no zone; the
 * API takes an instant. `new Date(local)` reads it in the browser's zone,
 * which is what the operator meant when they typed it.
 */
const toInstant = (local: string): string | undefined =>
  local ? new Date(local).toISOString() : undefined;

const localInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const cellSx = { color: C.text, borderColor: C.border, fontSize: '0.8rem' };
const headSx = { color: C.textMuted, borderColor: C.border, fontSize: '0.72rem', fontWeight: 700, bgcolor: C.cardLight };

const DrilldownModal: React.FC<{ request: DrilldownRequest | null; onClose: () => void }> = ({ request, onClose }) => {
  const [scope, setScope] = useState<Scope>('overall');
  const [from, setFrom] = useState(localInput(startOfToday()));
  const [to, setTo] = useState(localInput(new Date()));
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  /** The player's own sheet, layered over the list rather than replacing it. */
  const [sheetFor, setSheetFor] = useState<{ id: string; name: string } | null>(null);
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const isUsers = request?.kind === 'users';

  // Open on whichever window the card that was clicked is showing.
  useEffect(() => {
    if (!request) return;
    setScope(request.scope);
    setSource('');
    setSearch('');
    setPage(0);
    setSheetFor(null);
    setSheet(null);
    setSheetError('');
  }, [request]);

  /**
   * The window as the API takes it.
   *
   * `overall` sends nothing at all — the absence of a window is what asks for
   * the lifetime figure, and sending `from=epoch` instead would be a different
   * question that happens to have the same answer today.
   */
  const windowQuery = useMemo(() => {
    if (scope === 'overall') return {};
    if (scope === 'today') return { from: startOfToday().toISOString(), to: new Date().toISOString() };
    return { from: toInstant(from), to: toInstant(to) };
  }, [scope, from, to]);

  const load = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError('');
    try {
      const path = isUsers ? ENDPOINTS.dashboard.registrations : ENDPOINTS.dashboard.movements;
      const result = await apiFetchPage<any>(path, {
        query: {
          ...windowQuery,
          ...(isUsers
            ? { search: search || undefined }
            : { kind: request.kind, source: source || undefined }),
          limit: rowsPerPage,
          offset: page * rowsPerPage,
        },
      });
      setRows(result.data);
      setTotal(result.pagination?.total ?? result.data.length);
      setTotals(result.meta?.totals ?? null);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setTotals(null);
      setError(err instanceof ApiError ? err.message : 'Could not load the records');
    }
    setLoading(false);
  }, [request, isUsers, windowQuery, search, source, page, rowsPerPage]);

  useEffect(() => { if (request) load(); }, [request, load]);

  /**
   * One player's wallet history — every source that moved it.
   *
   * This is the existing balance sheet, which is the only read on the platform
   * that unifies agent transfers, bank and gateway deposits, withdrawals,
   * sports settlement and casino rounds into one running balance. Its
   * `unexplained` figure is money that moved through a path the sheet cannot
   * see; it is shown rather than hidden.
   */
  const openSheet = async (userId: string, name: string) => {
    setSheetFor({ id: userId, name });
    setSheet(null);
    setSheetError('');
    setSheetLoading(true);
    try {
      const data = await apiFetch<BalanceSheet>(
        buildPath(ENDPOINTS.reports.balanceSheet, { userId }),
        { query: { limit: 100, offset: 0 } }
      );
      setSheet(data);
    } catch (err) {
      setSheetError(err instanceof ApiError ? err.message : 'Could not load this player');
    }
    setSheetLoading(false);
  };

  const currency = 'USD';

  return (
    <Dialog
      open={Boolean(request)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, backgroundImage: 'none' } }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {sheetFor && (
            <MuiTooltip title="Back to the list">
              <IconButton size="small" onClick={() => setSheetFor(null)} sx={{ color: C.textSecondary }}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </MuiTooltip>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.05rem' }}>
              {sheetFor ? sheetFor.name : request?.title}
            </Typography>
            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
              {sheetFor
                ? `Player #${sheetFor.id} — every source that moved this wallet`
                : `${fmtNum(total)} record${total === 1 ? '' : 's'}`}
            </Typography>
          </Box>
          {!sheetFor && (
            <MuiTooltip title="Refresh">
              <IconButton size="small" onClick={load} sx={{ color: C.textSecondary }}>
                <Refresh fontSize="small" />
              </IconButton>
            </MuiTooltip>
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: C.textSecondary }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 0 }}>
        {sheetFor ? (
          <PlayerSheet sheet={sheet} loading={sheetLoading} error={sheetError} />
        ) : (
          <>
            {/* ── the filters ────────────────────────────────────────── */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={scope}
                onChange={(_e, next: Scope | null) => { if (next) { setScope(next); setPage(0); } }}
                sx={{
                  '& .MuiToggleButton-root': {
                    color: C.textMuted, borderColor: C.border, textTransform: 'none',
                    fontSize: '0.75rem', px: 1.75,
                    '&.Mui-selected': { color: C.text, bgcolor: alpha(C.primary, 0.2), borderColor: C.primary },
                  },
                }}
              >
                <ToggleButton value="today">Today</ToggleButton>
                <ToggleButton value="overall">Overall</ToggleButton>
                <ToggleButton value="custom">Custom range</ToggleButton>
              </ToggleButtonGroup>

              {scope === 'custom' && (
                <>
                  {/* Date AND time — `datetime-local`, not `date`. A window
                      that silently snapped to midnight would answer a
                      different question than the one that was typed. */}
                  <TextField
                    size="small" type="datetime-local" label="From" value={from}
                    onChange={(e) => { setFrom(e.target.value); setPage(0); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiInputBase-root': { color: C.text, bgcolor: C.cardLight } }}
                  />
                  <TextField
                    size="small" type="datetime-local" label="To" value={to}
                    onChange={(e) => { setTo(e.target.value); setPage(0); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiInputBase-root': { color: C.text, bgcolor: C.cardLight } }}
                  />
                </>
              )}

              {isUsers ? (
                <TextField
                  size="small" placeholder="Search name or email" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  sx={{ minWidth: 220, '& .MuiInputBase-root': { color: C.text, bgcolor: C.cardLight } }}
                />
              ) : (
                <TextField
                  size="small" select label="Source" value={source}
                  onChange={(e) => { setSource(e.target.value); setPage(0); }}
                  sx={{ minWidth: 180, '& .MuiInputBase-root': { color: C.text, bgcolor: C.cardLight } }}
                >
                  {SOURCES.filter((s) =>
                    request?.kind === 'both' || !s.value || s.value.includes(request?.kind.replace(/s$/, '') ?? '')
                  ).map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </TextField>
              )}
            </Box>

            {/* ── what the filtered set adds up to ───────────────────── */}
            {totals && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip
                  size="small"
                  label={`${fmtMoney(totals.usd, currency)} · ${fmtNum(totals.count)} txns`}
                  sx={{ bgcolor: alpha(C.primary, 0.15), color: C.text, fontWeight: 700 }}
                />
                {totals.byCurrency.map((leg) => (
                  <Chip
                    key={leg.currency}
                    size="small"
                    variant="outlined"
                    label={`${leg.currency}: ${leg.amount} (${fmtMoney(leg.usd, currency)})`}
                    sx={{ color: C.textMuted, borderColor: C.border }}
                  />
                ))}
              </Box>
            )}

            {totals && totals.unconverted.length > 0 && (
              <Alert
                severity="warning"
                sx={{ mb: 2, bgcolor: alpha(C.warning, 0.1), color: C.text, border: `1px solid ${alpha(C.warning, 0.3)}` }}
              >
                {/* The service reports this on purpose — legacy's INNER JOIN
                    dropped these rows and the total was quietly smaller. */}
                Excluded from the total above:{' '}
                {totals.unconverted.map((u, i) => (
                  <span key={i}>{i > 0 ? ', ' : ''}<strong>{u.amount} {u.currency ?? 'unknown coin'}</strong> ({u.reason})</span>
                ))}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2, bgcolor: alpha(C.error, 0.1), color: C.text }}>{error}</Alert>
            )}

            {/* ── the rows ───────────────────────────────────────────── */}
            <TableContainer sx={{ border: `1px solid ${C.border}`, borderRadius: 2, maxHeight: 440 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {isUsers ? (
                      <>
                        <TableCell sx={headSx}>Player</TableCell>
                        <TableCell sx={headSx}>Email</TableCell>
                        <TableCell sx={headSx}>Country</TableCell>
                        <TableCell sx={headSx}>Channel</TableCell>
                        <TableCell sx={headSx}>KYC</TableCell>
                        <TableCell sx={headSx}>Registered</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell sx={headSx}>When</TableCell>
                        <TableCell sx={headSx}>Source</TableCell>
                        <TableCell sx={headSx}>Player</TableCell>
                        <TableCell sx={headSx} align="right">Amount</TableCell>
                        <TableCell sx={headSx} align="right">Value</TableCell>
                        <TableCell sx={headSx}>Status</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ ...cellSx, py: 5 }}>
                        <CircularProgress size={22} />
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ ...cellSx, py: 5, color: C.textMuted }}>
                        Nothing in this window
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading && isUsers && (rows as RegistrationRow[]).map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => openSheet(row.id, row.name)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: C.cardHover } }}
                    >
                      <TableCell sx={cellSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {row.name || `User #${row.id}`}
                          <OpenInNew sx={{ fontSize: 12, color: C.textSecondary }} />
                        </Box>
                      </TableCell>
                      <TableCell sx={cellSx}>{row.email || '—'}</TableCell>
                      <TableCell sx={cellSx}>{row.country || '—'}</TableCell>
                      <TableCell sx={cellSx}>{row.channel}</TableCell>
                      <TableCell sx={cellSx}>
                        <Chip
                          size="small"
                          label={row.verified ? 'Verified' : 'Unverified'}
                          sx={{
                            bgcolor: alpha(row.verified ? C.success : C.textSecondary, 0.15),
                            color: row.verified ? C.success : C.textMuted, fontSize: '0.65rem',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={cellSx}>{fmtWhen(row.registeredAt)}</TableCell>
                    </TableRow>
                  ))}

                  {!loading && !isUsers && (rows as MovementRow[]).map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => row.userId && openSheet(row.userId, row.user?.name || `User #${row.userId}`)}
                      sx={{ cursor: row.userId ? 'pointer' : 'default', '&:hover': { bgcolor: C.cardHover } }}
                    >
                      <TableCell sx={cellSx}>{fmtWhen(row.at)}</TableCell>
                      <TableCell sx={cellSx}>
                        <Chip
                          size="small"
                          label={row.sourceLabel}
                          sx={{
                            bgcolor: alpha(row.direction === 'deposit' ? C.success : C.error, 0.15),
                            color: row.direction === 'deposit' ? C.success : C.error,
                            fontSize: '0.65rem', fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {row.user?.name || (row.userId ? `User #${row.userId}` : '—')}
                          {row.userId && <OpenInNew sx={{ fontSize: 12, color: C.textSecondary }} />}
                        </Box>
                      </TableCell>
                      <TableCell sx={cellSx} align="right">
                        {row.amount} <span style={{ color: C.textMuted }}>{row.currency ?? '?'}</span>
                      </TableCell>
                      <TableCell sx={cellSx} align="right">
                        {/* Null means no rate covers this currency — the row is
                            outside the total, which the banner above says. */}
                        {row.usd === null
                          ? <MuiTooltip title="No exchange rate — excluded from the total"><span style={{ color: C.warning }}>—</span></MuiTooltip>
                          : fmtMoney(row.usd, currency)}
                      </TableCell>
                      <TableCell sx={{ ...cellSx, color: C.textMuted }}>{row.status ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_e, next) => setPage(next)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[25, 50, 100]}
              sx={{ color: C.textMuted, '& .MuiSvgIcon-root': { color: C.textSecondary } }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** One player's wallet, from every direction money reaches it. */
const PlayerSheet: React.FC<{ sheet: BalanceSheet | null; loading: boolean; error: string }> = ({ sheet, loading, error }) => {
  if (loading) {
    return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={26} /></Box>;
  }
  if (error) {
    return <Alert severity="error" sx={{ bgcolor: alpha(C.error, 0.1), color: C.text }}>{error}</Alert>;
  }
  if (!sheet) return null;

  const unexplained = parseFloat(sheet.balance.unexplained);

  const tiles = [
    { label: 'Wallet now', value: sheet.balance.live },
    { label: 'Ledger close', value: sheet.balance.ledger },
    { label: 'Total credited', value: sheet.balance.credited },
    { label: 'Total debited', value: sheet.balance.debited },
    { label: 'Open bet exposure', value: sheet.balance.openExposure },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        {tiles.map((tile) => (
          <Box key={tile.label} sx={{ bgcolor: C.cardHover, border: `1px solid ${C.border}`, borderRadius: 2, p: 1.5, minWidth: 140 }}>
            <Typography sx={{ color: C.textMuted, fontSize: '0.65rem' }}>{tile.label}</Typography>
            <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '0.95rem' }}>
              {fmtMoney(tile.value, sheet.currency === 'USDT' ? 'USD' : sheet.currency)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/*
        `unexplained` is `wallet + open exposure − ledger`. Non-zero means money
        moved through a path this sheet does not read. Legacy showed a running
        balance that silently disagreed with the wallet.
      */}
      {unexplained !== 0 && (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: alpha(C.warning, 0.1), color: C.text, border: `1px solid ${alpha(C.warning, 0.3)}` }}>
          <strong>{fmtMoney(sheet.balance.unexplained, sheet.currency === 'USDT' ? 'USD' : sheet.currency)}</strong> of this
          wallet is not accounted for by the rows below — money moved through a path this sheet does not read.
        </Alert>
      )}

      <Divider sx={{ borderColor: C.border, mb: 1.5 }} />

      <TableContainer sx={{ border: `1px solid ${C.border}`, borderRadius: 2, maxHeight: 380 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>When</TableCell>
              <TableCell sx={headSx}>From</TableCell>
              <TableCell sx={headSx}>Detail</TableCell>
              <TableCell sx={headSx} align="right">Amount</TableCell>
              <TableCell sx={headSx} align="right">Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sheet.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ ...cellSx, py: 4, color: C.textMuted }}>
                  Nothing has moved this wallet
                </TableCell>
              </TableRow>
            )}
            {sheet.rows.map((event, i) => (
              <TableRow key={`${event.ts}-${i}`} hover>
                <TableCell sx={cellSx}>{fmtWhen(event.ts)}</TableCell>
                <TableCell sx={cellSx}>
                  <Chip size="small" label={event.category} sx={{ bgcolor: C.cardLight, color: C.textMuted, fontSize: '0.65rem' }} />
                </TableCell>
                <TableCell sx={{ ...cellSx, color: C.textMuted }}>{event.description}</TableCell>
                <TableCell sx={{ ...cellSx, color: event.type === 'CREDIT' ? C.success : C.error, fontWeight: 700 }} align="right">
                  {event.amount}
                </TableCell>
                <TableCell sx={cellSx} align="right">{event.balance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {sheet.total > sheet.rows.length && (
        <Typography sx={{ color: C.textMuted, fontSize: '0.7rem', mt: 1 }}>
          Showing the {sheet.rows.length} most recent of {fmtNum(sheet.total)} movements.
        </Typography>
      )}
    </Box>
  );
};

export default DrilldownModal;
