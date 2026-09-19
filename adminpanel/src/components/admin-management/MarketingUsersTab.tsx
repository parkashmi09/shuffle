import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, CircularProgress, Tooltip as MuiTooltip,
  InputAdornment, Pagination, alpha,
} from '@mui/material';
import {
  Add, Search, LockOutlined, LockOpenOutlined, KeyOutlined,
  InsightsOutlined, ContentCopy,
} from '@mui/icons-material';
import { C } from '../admin-dashboard/shared';
import { usePermissions } from '../../hooks/usePermissions';
import * as lordsApi from '../../services/lordsApi';

interface MarketingUser {
  id: number;
  username: string;
  status: 'active' | 'inactive' | 'locked';
  createdAt: string;
  lastLogin: string | null;
}

type DialogKind = 'create' | 'password' | 'lock' | null;

const MarketingUsersTab: React.FC = () => {
  const { isSuper, loading: permsLoading } = usePermissions();

  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [target, setTarget] = useState<MarketingUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Form state — every mutation needs the SuperAdmin's transaction password.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [txnPassword, setTxnPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await lordsApi.listMarketingUsers({ page, limit: 25, search });
      setUsers(res?.users ?? []);
      setTotalPages(res?.totalPages ?? 1);
    } catch (e: any) {
      setError(e?.message || 'Could not load marketing accounts.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (isSuper) load();
    else setLoading(false);
  }, [isSuper, load]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openDialog = (kind: DialogKind, user?: MarketingUser) => {
    setDialog(kind);
    setTarget(user ?? null);
    setUsername(''); setPassword(''); setTxnPassword('');
    setDialogError(null);
  };

  const closeDialog = () => { if (!busy) { setDialog(null); setTarget(null); } };

  const submit = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      if (dialog === 'create') {
        if (!username.trim()) throw new Error('Username is required');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await lordsApi.createMarketingUser({
          username: username.trim(), password, transactionPassword: txnPassword,
        });
        setNotice(`Marketing account “${username.trim()}” created. They sign in at /marketing/login.`);
      } else if (dialog === 'password' && target) {
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await lordsApi.resetMarketingPassword(target.id, {
          newPassword: password, transactionPassword: txnPassword,
        });
        setNotice(`Password reset for “${target.username}”.`);
      } else if (dialog === 'lock' && target) {
        const lock = target.status === 'active';
        await lordsApi.lockMarketingUser(target.id, { lock, transactionPassword: txnPassword });
        setNotice(`“${target.username}” ${lock ? 'locked' : 'unlocked'}.`);
      }
      setDialog(null);
      setTarget(null);
      await load();
    } catch (e: any) {
      setDialogError(e?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (permsLoading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={26} /></Box>;
  }

  if (!isSuper) {
    return (
      <Alert
        severity="warning"
        sx={{ borderRadius: 2, bgcolor: alpha(C.warning, 0.12), color: C.text, border: `1px solid ${alpha(C.warning, 0.35)}` }}
      >
        Only SuperAdmin can manage marketing accounts.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.1rem' }}>
            Marketing Accounts
          </Typography>
          <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>
            Read-only analytics logins · sign in at <code>/marketing/login</code>
          </Typography>
        </Box>

        <TextField
          size="small"
          placeholder="Search username"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search sx={{ fontSize: 18, color: C.textMuted }} /></InputAdornment>
            ),
          }}
        />

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => openDialog('create')}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: C.primary, '&:hover': { bgcolor: C.primaryLight } }}
        >
          Create Account
        </Button>
      </Box>

      {notice && (
        <Alert onClose={() => setNotice(null)} severity="success"
          sx={{ mb: 2, borderRadius: 2, bgcolor: alpha(C.success, 0.12), color: C.text, border: `1px solid ${alpha(C.success, 0.35)}`, '& .MuiAlert-icon': { color: C.success } }}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error"
          sx={{ mb: 2, borderRadius: 2, bgcolor: alpha(C.error, 0.12), color: C.text, border: `1px solid ${alpha(C.error, 0.35)}`, '& .MuiAlert-icon': { color: C.error } }}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, bgcolor: C.card, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress size={26} /></Box>
        ) : !users.length ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <InsightsOutlined sx={{ fontSize: 40, color: C.textMuted, opacity: 0.5, mb: 1 }} />
            <Typography sx={{ color: C.textMuted, fontSize: '0.88rem' }}>
              No marketing accounts yet.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Username', 'Status', 'Created', 'Last login', 'Actions'].map((h) => (
                    <TableCell key={h} align={h === 'Actions' ? 'right' : 'left'}
                      sx={{ color: C.textMuted, borderColor: C.border, fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover sx={{ '&:hover': { bgcolor: C.cardHover } }}>
                    <TableCell sx={{ color: C.text, borderColor: C.border, fontWeight: 600 }}>{u.username}</TableCell>
                    <TableCell sx={{ borderColor: C.border }}>
                      <Chip size="small" label={u.status}
                        sx={{
                          textTransform: 'capitalize', fontWeight: 700, fontSize: '0.68rem',
                          bgcolor: alpha(u.status === 'active' ? C.success : C.error, 0.14),
                          color: u.status === 'active' ? C.success : C.error,
                        }} />
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, borderColor: C.border, whiteSpace: 'nowrap' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, borderColor: C.border, whiteSpace: 'nowrap' }}>
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell align="right" sx={{ borderColor: C.border, whiteSpace: 'nowrap' }}>
                      <MuiTooltip title="Reset password">
                        <IconButton size="small" onClick={() => openDialog('password', u)} sx={{ color: C.textSecondary }}>
                          <KeyOutlined fontSize="small" />
                        </IconButton>
                      </MuiTooltip>
                      <MuiTooltip title={u.status === 'active' ? 'Lock account' : 'Unlock account'}>
                        <IconButton size="small" onClick={() => openDialog('lock', u)}
                          sx={{ color: u.status === 'active' ? C.warning : C.success }}>
                          {u.status === 'active' ? <LockOutlined fontSize="small" /> : <LockOpenOutlined fontSize="small" />}
                        </IconButton>
                      </MuiTooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} size="small" />
          </Box>
        )}
      </Paper>

      {/* ── dialogs ── */}
      <Dialog open={dialog !== null} onClose={closeDialog} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 3 } }}>
        <DialogTitle sx={{ color: C.text, fontWeight: 700 }}>
          {dialog === 'create' && 'Create Marketing Account'}
          {dialog === 'password' && `Reset password — ${target?.username}`}
          {dialog === 'lock' && `${target?.status === 'active' ? 'Lock' : 'Unlock'} — ${target?.username}`}
        </DialogTitle>

        <DialogContent>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, bgcolor: alpha(C.error, 0.12), color: C.text }}>
              {dialogError}
            </Alert>
          )}

          {dialog === 'create' && (
            <>
              <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem', mb: 2 }}>
                This account can only view analytics. It cannot approve, edit, or message anyone.
              </Typography>
              <TextField fullWidth label="Username" value={username} autoFocus
                onChange={(e) => setUsername(e.target.value)} sx={{ mb: 2 }} />
              <TextField fullWidth label="Password" type="text" value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="Minimum 6 characters. Share this with the account holder."
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: password ? (
                    <InputAdornment position="end">
                      <MuiTooltip title="Copy">
                        <IconButton size="small" onClick={() => navigator.clipboard?.writeText(password)} sx={{ color: C.textMuted }}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </MuiTooltip>
                    </InputAdornment>
                  ) : null,
                }} />
            </>
          )}

          {dialog === 'password' && (
            <TextField fullWidth label="New password" type="text" value={password} autoFocus
              onChange={(e) => setPassword(e.target.value)}
              helperText="Minimum 6 characters." sx={{ mb: 2 }} />
          )}

          {dialog === 'lock' && (
            <Typography sx={{ color: C.textSecondary, fontSize: '0.85rem', mb: 2 }}>
              {target?.status === 'active'
                ? 'The account will be signed out and unable to log in until unlocked.'
                : 'The account will be able to sign in again.'}
            </Typography>
          )}

          <TextField fullWidth label="Transaction password" type="password" value={txnPassword}
            onChange={(e) => setTxnPassword(e.target.value)}
            helperText="Your SuperAdmin transaction password." />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeDialog} disabled={busy} sx={{ color: C.textSecondary, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={submit} variant="contained" disabled={busy}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: C.primary, '&:hover': { bgcolor: C.primaryLight } }}>
            {busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketingUsersTab;
