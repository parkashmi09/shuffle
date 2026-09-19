import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, IconButton,
  CircularProgress, Button, Table, TableBody, TableCell, TableHead, TableRow,
  Alert, Tooltip, Avatar, TablePagination, Select, MenuItem, Chip, FormControlLabel, Switch,
} from '@mui/material';
import {
  Close, Refresh, ReceiptLong, TrendingUp, TrendingDown, AccountBalanceWallet, HourglassTop,
} from '@mui/icons-material';
import { getBalanceSheet, BalanceSheetResponse } from '../../services/lordsApi';

const C = {
  bg: '#0C0D1D', card: '#0E1831', cardLight: '#121E38', cardHover: '#162140',
  border: '#1E2D55', primary: '#886CFF', text: '#F9F9F9',
  textMuted: '#878AA2', textSecondary: '#8384A5',
  success: '#0ECC68', error: '#E01B4F', warning: '#FFC23F', info: '#A08FFF',
};

const CURRENCIES = ['INR', 'PKR', 'USDT', 'USD', 'EUR', 'BDT', 'NPR'];

/** Every money field on the sheet is an exact decimal string, not a number. */
const num = (v: string | number | null | undefined) => Number(v ?? 0) || 0;

const fmt = (n: string | number | null | undefined, cur: string) =>
  `${cur === 'INR' ? '₹' : ''}${num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  !iso ? '—' : new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const catColor = (cat: string) => ({
  Deposit: C.success, Withdrawal: C.error, Agent: C.info,
  Sports: C.warning, Casino: '#7B5EF5',
} as Record<string, string>)[cat] || C.textSecondary;

interface Props {
  open: boolean;
  userId: string | null;
  onClose: () => void;
}

const Stat: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <Box sx={{ bgcolor: C.cardLight, border: `1px solid ${C.border}`, borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 150 }}>
    <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ color: C.textSecondary, fontSize: '0.66rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
      <Typography sx={{ color: C.text, fontSize: '1rem', fontWeight: 700 }}>{value}</Typography>
    </Box>
  </Box>
);

const BalanceSheetDialog: React.FC<Props> = ({ open, userId, onClose }) => {
  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [live, setLive] = useState(true);   // auto-refresh while open (near real-time)

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await getBalanceSheet(userId, { currency, limit: rowsPerPage, offset: page * rowsPerPage });
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  }, [userId, currency, page, rowsPerPage]);

  useEffect(() => {
    if (open && userId) load();
    else setData(null);
  }, [open, userId, load]);

  // Lightweight polling for near real-time updates while the dialog is open.
  useEffect(() => {
    if (!open || !live || !userId) return;
    const id = setInterval(() => load(true), 10000);
    return () => clearInterval(id);
  }, [open, live, userId, load]);

  const exposure = num(data?.balance.openExposure);
  /** `live + openExposure - ledger`. Non-zero means money moved by a path this sheet does not read. */
  const unexplained = num(data?.balance.unexplained);
  const reconciled = unexplained === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: `${C.primary}22`, color: C.primary, width: 36, height: 36 }}><ReceiptLong /></Avatar>
          <Box>
            <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>Balance Sheet</Typography>
            {data && (
              <Typography sx={{ color: C.textMuted, fontSize: '0.75rem' }}>
                {data.subject.name} · UID {data.subject.id}{data.subject.agent ? ` · under ${data.subject.agent}` : ''}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <FormControlLabel
            control={<Switch size="small" checked={live} onChange={e => setLive(e.target.checked)} />}
            label={<Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>Live</Typography>}
            sx={{ mr: 0.5 }}
          />
          <Select size="small" value={currency} onChange={e => { setCurrency(e.target.value); setPage(0); }}
            sx={{ color: C.text, fontSize: '0.8rem', height: 34, '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border }, '& .MuiSvgIcon-root': { color: C.textMuted } }}
            MenuProps={{ PaperProps: { sx: { bgcolor: C.card, border: `1px solid ${C.border}`, '& .MuiMenuItem-root': { color: C.text, fontSize: '0.8rem' } } } }}>
            {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
          <Tooltip title="Refresh"><IconButton onClick={() => load()} sx={{ color: C.textMuted, '&:hover': { color: C.primary } }}><Refresh /></IconButton></Tooltip>
          <IconButton onClick={onClose} sx={{ color: C.textMuted, '&:hover': { color: C.error } }}><Close /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: C.bg, p: 2.5 }}>
        {error && <Alert severity="error" sx={{ bgcolor: '#2B0E1A', color: C.error, border: `1px solid ${C.error}`, mb: 2 }}>{error}</Alert>}

        {data && (
          <>
            <Box sx={{ display: 'flex', gap: 1.5, mb: exposure > 0 || !reconciled ? 1 : 2, flexWrap: 'wrap' }}>
              <Stat label="Current Balance" value={fmt(data.balance.live, currency)} color={C.primary} icon={<AccountBalanceWallet sx={{ fontSize: 18 }} />} />
              {exposure > 0 && (
                <Stat label="In Play (Unsettled)" value={fmt(exposure, currency)} color={C.warning} icon={<HourglassTop sx={{ fontSize: 18 }} />} />
              )}
              <Stat label="Total Credit" value={fmt(data.balance.credited, currency)} color={C.success} icon={<TrendingUp sx={{ fontSize: 18 }} />} />
              <Stat label="Total Debit" value={fmt(Math.abs(num(data.balance.debited)), currency)} color={C.error} icon={<TrendingDown sx={{ fontSize: 18 }} />} />
              <Stat label="Ledger" value={fmt(data.balance.ledger, currency)} color={num(data.balance.ledger) >= 0 ? C.success : C.error} icon={<ReceiptLong sx={{ fontSize: 18 }} />} />
            </Box>
            {(exposure > 0 || !reconciled) && (
              <Box sx={{ mb: 2, px: 1.5, py: 1, bgcolor: C.cardLight, border: `1px solid ${reconciled ? C.success : C.warning}55`, borderRadius: 2 }}>
                <Typography sx={{ color: C.textSecondary, fontSize: '0.74rem' }}>
                  Current Balance <b style={{ color: C.text }}>{fmt(data.balance.live, currency)}</b>
                  {' + '}In Play <b style={{ color: C.warning }}>{fmt(exposure, currency)}</b>
                  {' − '}Ledger <b style={{ color: C.text }}>{fmt(data.balance.ledger, currency)}</b>
                  {'  '}
                  <span style={{ color: reconciled ? C.success : C.error, fontWeight: 700 }}>
                    {reconciled ? '✓ reconciled' : `⚠ ${fmt(unexplained, currency)} unexplained — needs review`}
                  </span>
                </Typography>
              </Box>
            )}
          </>
        )}

        {loading && !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: C.primary }} /></Box>
        ) : (
          <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            <Table size="small" sx={{ '& td, & th': { borderColor: `${C.border}55` } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: C.card }}>
                  {['Date', 'Type', 'Description', 'Credit', 'Debit', 'Balance'].map(h => (
                    <TableCell key={h} sx={{ color: C.textSecondary, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.rows.map((r, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: C.cardLight } }}>
                    <TableCell sx={{ color: C.textMuted, fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{fmtDate(r.ts)}</TableCell>
                    <TableCell><Chip label={r.category} size="small" sx={{ bgcolor: `${catColor(r.category)}22`, color: catColor(r.category), fontWeight: 700, fontSize: '0.66rem', height: 20 }} /></TableCell>
                    <TableCell sx={{ color: C.text, fontSize: '0.78rem', maxWidth: 380 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: C.text, whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.description}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: C.success, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{num(r.amount) > 0 ? fmt(r.amount, currency) : ''}</TableCell>
                    <TableCell sx={{ color: C.error, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{num(r.amount) < 0 ? fmt(Math.abs(num(r.amount)), currency) : ''}</TableCell>
                    <TableCell sx={{ color: num(r.balance) >= 0 ? C.text : C.error, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(r.balance, currency)}</TableCell>
                  </TableRow>
                ))}
                {data && data.rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: 'center', color: C.textMuted, fontSize: '0.85rem', borderBottom: 'none' }}>No transactions in {currency} for this user.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${C.border}`, px: 1, py: 0.5, justifyContent: 'space-between' }}>
        <TablePagination
          component="div"
          count={data?.total || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100, 200]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          sx={{
            color: C.textSecondary,
            '& .MuiTablePagination-select': { color: C.text },
            '& .MuiTablePagination-selectIcon': { color: C.textSecondary },
            '& .MuiIconButton-root': { color: C.textSecondary, '&.Mui-disabled': { color: C.border } },
          }}
        />
        <Button onClick={onClose} sx={{ color: C.textMuted, '&:hover': { bgcolor: C.cardHover }, mr: 1 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BalanceSheetDialog;
