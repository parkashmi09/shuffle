import React, { useEffect, useState } from 'react';
import { apiFetch, buildPath } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Grid, Chip,
  IconButton, CircularProgress, Switch, FormControlLabel, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Alert, Tooltip, Avatar, Snackbar,
} from '@mui/material';
import {
  Close, Shield, Lock, LockOpen, Refresh, Groups, Person, AccountBalance,
  TrendingUp, TrendingDown, SportsEsports, Warning, AccountTree,
} from '@mui/icons-material';

const C = {
  bg: '#0C0D1D', card: '#0E1831', cardLight: '#121E38', cardHover: '#162140',
  border: '#1E2D55', primary: '#886CFF', text: '#F9F9F9',
  textMuted: '#878AA2', textSecondary: '#8384A5',
  success: '#0ECC68', error: '#E01B4F', warning: '#FFC23F', info: '#A08FFF',
};

interface ParentChain { id: number; name: string; email: string; role_name: string; depth: number; }
interface StaffRiskData {
  currency: string;
  staff: {
    id: string; name: string; email: string; country: string; phone: string;
    role_id: number; role_name: string; role_level: number;
    parent_id: string | null; parent_name: string | null; parent_email: string | null;
    percentage: number; first_login: boolean; created_at: string;
    balance_inr: number | string;
  };
  locks: { system_locked: boolean; sports_betlocked: boolean };
  parent_chain: ParentChain[];
  downline: {
    direct_staff_count: number;
    subtree_staff_count: number;
    users_count: number;
    locked_users: number;
    total_deposits_inr: string;
    total_withdrawals_inr: string;
    net_inr: string;
  };
  risk_flags: { first_login_pending: boolean; locked: boolean; no_downline: boolean };
  timestamp: string;
}

const fmtInr = (v: string | number | undefined) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <Box sx={{ bgcolor: C.cardLight, border: `1px solid ${C.border}`, borderRadius: 2, p: 2.5, mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Avatar sx={{ bgcolor: `${C.primary}22`, color: C.primary, width: 28, height: 28 }}>{icon}</Avatar>
      <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.92rem' }}>{title}</Typography>
    </Box>
    {children}
  </Box>
);

const KV: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box>
    <Typography sx={{ color: C.textMuted, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.3 }}>{label}</Typography>
    <Typography sx={{ color: C.text, fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-word' }}>{value}</Typography>
  </Box>
);

interface Props {
  open: boolean;
  staffId: string | null;
  onClose: () => void;
}

const StaffRiskDialog: React.FC<Props> = ({ open, staffId, onClose }) => {
  const [data, setData] = useState<StaffRiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const load = async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<any>(buildPath(ENDPOINTS.reports.staffRisk, { staffId }));
      // One mapping, so the rendering below keeps the shape it was written for.
      setData({
        currency: r.currency,
        staff: {
          id: r.staff.id, name: r.staff.name, email: r.staff.email,
          country: r.staff.country, phone: r.staff.phone,
          role_id: r.staff.roleId, role_name: r.staff.roleName, role_level: r.staff.roleLevel,
          parent_id: r.staff.parentId, parent_name: r.staff.parentName, parent_email: r.staff.parentEmail,
          percentage: Number(r.staff.percentage ?? 0),
          first_login: r.staff.firstLoginPending,
          created_at: r.staff.createdAt,
          balance_inr: r.staff.balance,
        },
        locks: {
          system_locked: r.locks.systemLocked,
          sports_betlocked: r.locks.sportsBetlocked,
        },
        parent_chain: r.parentChain.map((p: any) => ({
          id: p.id, name: p.name, email: p.email, role_name: p.roleName, depth: p.depth,
        })),
        downline: {
          direct_staff_count: r.downline.directStaffCount,
          subtree_staff_count: r.downline.subtreeStaffCount,
          users_count: r.downline.playersCount,
          locked_users: r.downline.lockedPlayers,
          total_deposits_inr: r.downline.totalDeposits,
          total_withdrawals_inr: r.downline.totalWithdrawals,
          net_inr: r.downline.net,
        },
        risk_flags: {
          first_login_pending: r.riskFlags.firstLoginPending,
          locked: r.riskFlags.locked,
          no_downline: r.riskFlags.noDownline,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load staff risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && staffId) load();
    else setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staffId]);

  const toggleLock = async (field: 'system_locked' | 'sports_betlocked', value: boolean) => {
    if (!staffId || !data) return;
    setSaving(field);
    try {
      /**
       * This reaches the agent's WHOLE SUBTREE — every sub-agent and every
       * player beneath them, in one transaction. Legacy locked the agent and
       * the players attached directly to them, and left the entire branch one
       * level down still betting while reporting success.
       */
      await apiFetch(ENDPOINTS.locks.update, {
        method: 'POST',
        body: { staffId: Number(staffId), [field === 'system_locked' ? 'system' : 'sports']: value },
      });
      setData({ ...data, locks: { ...data.locks, [field]: value } });
      setSnack({ open: true, msg: `${field.replace(/_/g, ' ')} ${value ? 'enabled' : 'disabled'}`, severity: 'success' });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || 'Failed to update', severity: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const activeRisks = data ? Object.entries(data.risk_flags).filter(([, v]) => v).map(([k]) => k) : [];

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${C.warning}22`, color: C.warning, width: 36, height: 36 }}><Shield /></Avatar>
            <Box>
              <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>Staff Risk Management</Typography>
              {data && (
                <Typography sx={{ color: C.textMuted, fontSize: '0.75rem' }}>
                  {data.staff.name} · {data.staff.role_name} · ID {data.staff.id}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={load} sx={{ color: C.textMuted, '&:hover': { color: C.primary } }}><Refresh /></IconButton>
            </Tooltip>
            <IconButton onClick={onClose} sx={{ color: C.textMuted, '&:hover': { color: C.error } }}><Close /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: C.bg, p: 2.5 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: C.primary }} />
            </Box>
          )}

          {error && !loading && (
            <Alert severity="error" sx={{ bgcolor: '#2B0E1A', color: C.error, border: `1px solid ${C.error}`, mb: 2 }}>
              {error}
            </Alert>
          )}

          {data && !loading && (
            <>
              {activeRisks.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {activeRisks.map(r => (
                    <Chip key={r} icon={<Warning sx={{ fontSize: 14 }} />} label={r.replace(/_/g, ' ')} size="small"
                      sx={{ bgcolor: `${C.warning}22`, color: C.warning, fontWeight: 700, textTransform: 'capitalize', '& .MuiChip-icon': { color: C.warning } }} />
                  ))}
                </Box>
              )}

              <Section title="Profile" icon={<Person sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}><KV label="Staff ID" value={data.staff.id} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Name" value={data.staff.name || '—'} /></Grid>
                  <Grid item xs={12} sm={4}><KV label="Email" value={data.staff.email || '—'} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Phone" value={data.staff.phone || '—'} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Country" value={data.staff.country || '—'} /></Grid>
                  <Grid item xs={6} sm={4}>
                    <KV label="Role" value={
                      <Chip size="small" label={`${data.staff.role_name} (L${data.staff.role_level})`}
                        sx={{ bgcolor: `${C.primary}22`, color: C.primary, fontWeight: 700, height: 20 }} />
                    } />
                  </Grid>
                  <Grid item xs={6} sm={4}><KV label="Commission %" value={`${Number(data.staff.percentage || 0).toFixed(2)}%`} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Wallet Balance" value={fmtInr(data.staff.balance_inr)} /></Grid>
                  <Grid item xs={12} sm={4}><KV label="Created" value={fmtDate(data.staff.created_at)} /></Grid>
                  {data.staff.parent_name && (
                    <Grid item xs={12}>
                      <KV label="Direct Parent" value={`${data.staff.parent_name} · ${data.staff.parent_email || ''}`} />
                    </Grid>
                  )}
                </Grid>
              </Section>

              {data.parent_chain.length > 0 && (
                <Section title="Upline Chain" icon={<AccountTree sx={{ fontSize: 16 }} />}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {data.parent_chain.map((p, i) => (
                      <Chip key={p.id}
                        label={`${i + 1}. ${p.name} — ${p.role_name}`}
                        size="small"
                        sx={{ bgcolor: C.cardHover, color: C.text, fontWeight: 600, fontSize: '0.72rem' }} />
                    ))}
                  </Box>
                </Section>
              )}

              <Section title="Downline Summary" icon={<Groups sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><KV label="Direct Staff" value={data.downline.direct_staff_count} /></Grid>
                  <Grid item xs={6} sm={3}><KV label="Total Staff (subtree)" value={data.downline.subtree_staff_count} /></Grid>
                  <Grid item xs={6} sm={3}><KV label="Users" value={data.downline.users_count} /></Grid>
                  <Grid item xs={6} sm={3}>
                    <KV label="Locked Users" value={
                      <span style={{ color: data.downline.locked_users > 0 ? C.error : C.success }}>
                        {data.downline.locked_users}
                      </span>
                    } />
                  </Grid>
                </Grid>
              </Section>

              <Section title="Downline Financials (INR)" icon={<AccountBalance sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <KV label="Total Deposits" value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUp sx={{ color: C.success, fontSize: 16 }} />
                        <span style={{ color: C.success }}>{fmtInr(data.downline.total_deposits_inr)}</span>
                      </Box>
                    } />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <KV label="Total Withdrawals" value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingDown sx={{ color: C.error, fontSize: 16 }} />
                        <span style={{ color: C.error }}>{fmtInr(data.downline.total_withdrawals_inr)}</span>
                      </Box>
                    } />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <KV label="Net" value={
                      <span style={{ color: Number(data.downline.net_inr) >= 0 ? C.success : C.error }}>
                        {fmtInr(data.downline.net_inr)}
                      </span>
                    } />
                  </Grid>
                </Grid>
              </Section>

              <Section title="Lock Controls" icon={<Lock sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ bgcolor: C.cardHover, borderRadius: 1.5, p: 1.5, border: `1px solid ${C.border}` }}>
                      <FormControlLabel
                        control={<Switch checked={data.locks.system_locked} disabled={saving === 'system_locked'} onChange={e => toggleLock('system_locked', e.target.checked)} />}
                        label={
                          <Box>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Lock sx={{ fontSize: 16 }} /> System Lock
                            </Typography>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                              Blocks staff + all descendants from logging in
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ bgcolor: C.cardHover, borderRadius: 1.5, p: 1.5, border: `1px solid ${C.border}` }}>
                      <FormControlLabel
                        control={<Switch checked={data.locks.sports_betlocked} disabled={saving === 'sports_betlocked'} onChange={e => toggleLock('sports_betlocked', e.target.checked)} />}
                        label={
                          <Box>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SportsEsports sx={{ fontSize: 16 }} /> Sports Bet Lock
                            </Typography>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                              Prevents sportsbook wagers for this staff line
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Section>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${C.border}`, px: 2.5, py: 1.5 }}>
          <Button onClick={onClose} sx={{ color: C.textMuted, '&:hover': { bgcolor: C.cardHover } }}>Close</Button>
          {data && !data.locks.system_locked ? (
            <Button variant="contained" startIcon={<Lock />} disabled={saving === 'system_locked'}
              onClick={() => toggleLock('system_locked', true)}
              sx={{ bgcolor: C.error, '&:hover': { bgcolor: '#C01540' }, fontWeight: 700 }}>
              Lock Staff
            </Button>
          ) : data && data.locks.system_locked ? (
            <Button variant="contained" startIcon={<LockOpen />} disabled={saving === 'system_locked'}
              onClick={() => toggleLock('system_locked', false)}
              sx={{ bgcolor: C.success, '&:hover': { bgcolor: '#0AAA56' }, fontWeight: 700 }}>
              Unlock Staff
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity}
          sx={{
            bgcolor: snack.severity === 'success' ? '#0E2B1F' : '#2B0E1A',
            color: snack.severity === 'success' ? C.success : C.error,
            border: `1px solid ${snack.severity === 'success' ? C.success : C.error}`,
          }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default StaffRiskDialog;
