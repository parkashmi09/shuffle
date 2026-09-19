/*  ──────────────────────────────────────────────────────────────
    StaffPortalTab.tsx
    Quick day-to-day actions for staff:
      1. Quick ID creation  — create a new player fast
      2. Wallet refill      — top up a user's INR with a reference note
                              ("who gave the shout"); emails the admin inbox.
    Reuses the existing /api/staff/players and /lords/quick-refill endpoints.
    ────────────────────────────────────────────────────────────── */
import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, TextField, InputAdornment,
  Button, IconButton, Snackbar, Alert, CircularProgress, Divider,
  FormControlLabel, Switch,
} from '@mui/material';
import {
  PersonAdd, Wallet, Visibility, VisibilityOff, Save, AccountBalanceWallet,
  SportsEsports, Casino, Lock,
} from '@mui/icons-material';
import { createUser, quickRefill, updateStatus } from '../../services/lordsApi';

const C = {
  bg: '#0C0D1D', card: '#0E1831', border: '#1E2D55', primary: '#886CFF',
  text: '#F9F9F9', textMuted: '#8384A5', success: '#0ECC68', error: '#E01B4F',
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: C.bg, borderRadius: 1.5,
    '& fieldset': { borderColor: C.border },
    '&:hover fieldset': { borderColor: C.primary },
    '&.Mui-focused fieldset': { borderColor: C.primary },
  },
  '& .MuiInputBase-input': { color: C.text, fontSize: '0.88rem' },
  '& .MuiInputLabel-root': { color: C.textMuted, '&.Mui-focused': { color: C.primary } },
} as const;

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; color: string }> = ({ icon, title, subtitle, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}22`, color }}>{icon}</Box>
    <Box>
      <Typography sx={{ fontWeight: 700, color: C.text, fontSize: 18 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: C.textMuted }}>{subtitle}</Typography>
    </Box>
  </Box>
);

const StaffPortalTab: React.FC = () => {
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });
  const notify = (msg: string, sev: 'success' | 'error' = 'success') => setSnack({ open: true, msg, sev });

  /* ── create user ── */
  const [cu, setCu] = useState({ username: '', email: '', password: '', credit: '', txn: '' });
  const [showCuPwd, setShowCuPwd] = useState(false);
  const [creating, setCreating] = useState(false);

  const doCreate = async () => {
    if (!cu.username.trim() || !cu.password.trim()) return notify('Username and password are required', 'error');
    if (!cu.txn.trim()) return notify('Transaction password is required', 'error');
    setCreating(true);
    try {
      const res: any = await createUser({
        username: cu.username.trim(),
        email: cu.email.trim() || `${cu.username.trim().replace(/\s/g, '')}@ibitplay.local`,
        password: cu.password,
        initialBalance: Number(cu.credit) || 0,
        percentage: 1,
        transactionPassword: cu.txn,
      });
      notify(`User created${res?.userId ? ` — UID ${res.userId}` : ''}`);
      setCu({ username: '', email: '', password: '', credit: '', txn: '' });
    } catch (e: any) {
      notify(e?.message || 'Failed to create user', 'error');
    } finally { setCreating(false); }
  };

  /* ── wallet refill ── */
  const [rf, setRf] = useState({ userId: '', amount: '', note: '', txn: '' });
  const [refilling, setRefilling] = useState(false);

  const doRefill = async () => {
    if (!rf.userId.trim()) return notify('Enter the user UID', 'error');
    if (!(Number(rf.amount) > 0)) return notify('Enter a valid amount', 'error');
    if (!rf.txn.trim()) return notify('Transaction password is required', 'error');
    setRefilling(true);
    try {
      const res: any = await quickRefill({
        userId: rf.userId.trim(),
        amount: Number(rf.amount),
        note: rf.note.trim() || undefined,
        transactionPassword: rf.txn,
      });
      notify(`Wallet refilled — new balance ₹${Number(res?.balance ?? 0).toLocaleString('en-IN')}`);
      setRf({ userId: '', amount: '', note: '', txn: '' });
    } catch (e: any) {
      notify(e?.message || 'Refill failed', 'error');
    } finally { setRefilling(false); }
  };

  /* ── lock controls (close sports / casino / account) ── */
  const [lk, setLk] = useState({ userId: '', sports: false, casino: false, account: false, txn: '' });
  const [locking, setLocking] = useState(false);

  const doLock = async () => {
    if (!lk.userId.trim()) return notify('Enter the user UID', 'error');
    if (!lk.txn.trim()) return notify('Transaction password is required', 'error');
    setLocking(true);
    try {
      await updateStatus({
        userId: lk.userId.trim(),
        userType: 'USER',
        sportsLocked: lk.sports,
        casinoLocked: lk.casino,
        systemLocked: lk.account,
        transactionPassword: lk.txn,
      });
      notify(`Updated — Sports ${lk.sports ? 'closed' : 'open'}, Casino ${lk.casino ? 'closed' : 'open'}, Account ${lk.account ? 'locked' : 'active'}`);
      setLk(s => ({ ...s, txn: '' }));
    } catch (e: any) {
      notify(e?.message || 'Failed to update locks', 'error');
    } finally { setLocking(false); }
  };

  return (
    <Box sx={{ p: 3, bgcolor: C.bg, minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1.4rem' }}>Staff Portal</Typography>
          <Typography sx={{ color: C.textMuted, fontSize: '0.82rem' }}>Quickly create player IDs and refill wallets. Each refill notifies the admin by email.</Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* Quick create user */}
          <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${C.border}`, bgcolor: C.card }}>
            <CardContent sx={{ p: 4 }}>
              <SectionHeader icon={<PersonAdd />} color={C.primary} title="Quick ID Creation" subtitle="Create a new player account" />
              <Stack spacing={2.5}>
                <TextField fullWidth label="Username" value={cu.username} onChange={e => setCu(s => ({ ...s, username: e.target.value }))} sx={fieldSx} />
                <TextField fullWidth label="Email (optional)" value={cu.email} onChange={e => setCu(s => ({ ...s, email: e.target.value }))} sx={fieldSx} />
                <TextField fullWidth label="Password" type={showCuPwd ? 'text' : 'password'} value={cu.password}
                  onChange={e => setCu(s => ({ ...s, password: e.target.value }))}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowCuPwd(p => !p)} sx={{ color: C.textMuted }}>{showCuPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }}
                  sx={fieldSx} />
                <TextField fullWidth label="Initial Credit (INR, optional)" type="number" value={cu.credit}
                  onChange={e => setCu(s => ({ ...s, credit: e.target.value }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AccountBalanceWallet sx={{ color: C.textMuted, fontSize: 18 }} /></InputAdornment> }}
                  sx={fieldSx} />
                <Divider sx={{ borderColor: C.border }} />
                <TextField fullWidth label="Transaction Password" type="password" value={cu.txn}
                  onChange={e => setCu(s => ({ ...s, txn: e.target.value }))} sx={fieldSx} />
                <Button variant="contained" disabled={creating} onClick={doCreate}
                  startIcon={creating ? <CircularProgress size={18} /> : <PersonAdd />}
                  sx={{ bgcolor: C.primary, fontWeight: 700, '&:hover': { bgcolor: '#9B82FF' }, '&:disabled': { bgcolor: C.border } }}>
                  {creating ? 'Creating…' : 'Create User'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Wallet refill */}
          <Card elevation={0} sx={{ borderRadius: 3, border: `1px solid ${C.border}`, bgcolor: C.card }}>
            <CardContent sx={{ p: 4 }}>
              <SectionHeader icon={<Wallet />} color={C.success} title="Wallet Refill" subtitle="Top up a user's INR balance" />
              <Stack spacing={2.5}>
                <TextField fullWidth label="User UID" value={rf.userId} onChange={e => setRf(s => ({ ...s, userId: e.target.value }))} sx={fieldSx} />
                <TextField fullWidth label="Amount (INR)" type="number" value={rf.amount}
                  onChange={e => setRf(s => ({ ...s, amount: e.target.value }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AccountBalanceWallet sx={{ color: C.textMuted, fontSize: 18 }} /></InputAdornment> }}
                  sx={fieldSx} />
                <TextField fullWidth label="Reference — who gave the shout" placeholder="e.g. requested by Ramesh / WhatsApp"
                  value={rf.note} onChange={e => setRf(s => ({ ...s, note: e.target.value }))}
                  multiline minRows={2} sx={fieldSx} />
                <Divider sx={{ borderColor: C.border }} />
                <TextField fullWidth label="Transaction Password" type="password" value={rf.txn}
                  onChange={e => setRf(s => ({ ...s, txn: e.target.value }))} sx={fieldSx} />
                <Button variant="contained" disabled={refilling} onClick={doRefill}
                  startIcon={refilling ? <CircularProgress size={18} /> : <Save />}
                  sx={{ bgcolor: C.success, fontWeight: 700, '&:hover': { bgcolor: '#0AAA56' }, '&:disabled': { bgcolor: C.border } }}>
                  {refilling ? 'Refilling…' : 'Refill Wallet'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Lock controls — close sports / casino / account for a user */}
        <Card elevation={0} sx={{ mt: 3, borderRadius: 3, border: `1px solid ${C.border}`, bgcolor: C.card }}>
          <CardContent sx={{ p: 4 }}>
            <SectionHeader icon={<Lock />} color="#FFC23F" title="Close Sports / Casino for a User" subtitle="Block sportsbook or casino for an individual ID in your hierarchy" />
            <Stack spacing={2.5}>
              <TextField fullWidth label="User UID" value={lk.userId} onChange={e => setLk(s => ({ ...s, userId: e.target.value }))} sx={fieldSx} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
                <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 1.5, p: 1.5 }}>
                  <FormControlLabel control={<Switch checked={lk.sports} onChange={e => setLk(s => ({ ...s, sports: e.target.checked }))} />}
                    label={<Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}><SportsEsports sx={{ fontSize: 16 }} /> Close Sports</Typography>} sx={{ m: 0 }} />
                </Box>
                <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 1.5, p: 1.5 }}>
                  <FormControlLabel control={<Switch checked={lk.casino} onChange={e => setLk(s => ({ ...s, casino: e.target.checked }))} />}
                    label={<Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}><Casino sx={{ fontSize: 16 }} /> Close Casino</Typography>} sx={{ m: 0 }} />
                </Box>
                <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 1.5, p: 1.5 }}>
                  <FormControlLabel control={<Switch checked={lk.account} onChange={e => setLk(s => ({ ...s, account: e.target.checked }))} />}
                    label={<Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}><Lock sx={{ fontSize: 16 }} /> Lock Account</Typography>} sx={{ m: 0 }} />
                </Box>
              </Box>
              <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>Set the switches to the desired state, then Apply. ON = closed/locked.</Typography>
              <TextField fullWidth label="Transaction Password" type="password" value={lk.txn} onChange={e => setLk(s => ({ ...s, txn: e.target.value }))} sx={fieldSx} />
              <Button variant="contained" disabled={locking} onClick={doLock}
                startIcon={locking ? <CircularProgress size={18} /> : <Lock />}
                sx={{ bgcolor: '#FFC23F', color: '#1a1300', fontWeight: 700, alignSelf: 'flex-start', '&:hover': { bgcolor: '#e6ae2f' }, '&:disabled': { bgcolor: C.border } }}>
                {locking ? 'Applying…' : 'Apply'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} sx={{ bgcolor: snack.sev === 'success' ? '#0E2B1F' : '#2B0E1A', color: snack.sev === 'success' ? C.success : C.error, border: `1px solid ${snack.sev === 'success' ? C.success : C.error}` }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StaffPortalTab;
