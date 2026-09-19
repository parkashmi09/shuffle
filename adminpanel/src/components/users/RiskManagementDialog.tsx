import React, { useEffect, useState } from 'react';
import { apiFetch, buildPath } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Divider,
  Grid, Chip, IconButton, CircularProgress, Switch, FormControlLabel, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Tooltip, Avatar,
  Snackbar,
} from '@mui/material';
import {
  Close, Shield, Public, Lock, LockOpen, VerifiedUser, Warning, Refresh,
  CalendarToday, AccountBalanceWallet, TrendingUp, TrendingDown, Fingerprint,
  SportsEsports, Casino, PersonOff,
} from '@mui/icons-material';

const C = {
  bg: '#0C0D1D', card: '#0E1831', cardLight: '#121E38', cardHover: '#162140',
  border: '#1E2D55', primary: '#886CFF', text: '#F9F9F9',
  textMuted: '#878AA2', textSecondary: '#8384A5',
  success: '#0ECC68', error: '#E01B4F', warning: '#FFC23F', info: '#A08FFF',
};

interface IpBreakdown {
  ip_address: string;
  uses: number;
  last_seen: string;
  first_seen: string;
}
interface RecentBet {
  id: number;
  ip_address: string | null;
  created_at: string;
  stake_amount: string | number;
  original_currency: string;
  status: string;
  result_status: string;
}
interface RecentLogin {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
interface RiskData {
  currency: string;
  user: {
    id: string;
    name: string;
    email: string;
    country: string;
    phone: string;
    created: string;
    updated_at: string;
    level: number;
    games_played: number;
    two_fa_status: boolean;
    parent_staff_id: number | null;
    staff_name: string | null;
    staff_email: string | null;
    is_direct: boolean;
    last_ip?: string | null;
    last_login_at?: string | null;
  };
  locks: {
    is_locked: boolean;
    lock_targetx: boolean;
    sports_betlocked: boolean;
    casino_locked: boolean;
  };
  financials: {
    total_deposit_inr: string;
    total_withdrawal_inr: string;
    net_inr: string;
    deposit_count: number;
    withdrawal_count: number;
  };
  activity: {
    source: string;
    distinct_ip_count: number;
    distinct_ips: string[];
    ip_breakdown: IpBreakdown[];
    recent_logins?: RecentLogin[];
    recent_bets: RecentBet[];
  };
  risk_flags: {
    multiple_ips: boolean;
    two_fa_disabled: boolean;
    high_withdrawal_ratio: boolean;
    no_activity: boolean;
  };
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
  userId: string | null;
  onClose: () => void;
}

const RiskManagementDialog: React.FC<Props> = ({ open, userId, onClose }) => {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<any>(buildPath(ENDPOINTS.reports.userRisk, { userId }));
      /**
       * One mapping here rather than renaming six hundred lines of rendering.
       * The service speaks camelCase like the rest of v1; this dialog's shape
       * is the legacy body it was written against.
       */
      setData({
        currency: r.currency,
        user: {
          id: r.user.id, name: r.user.name, email: r.user.email,
          country: r.user.country, phone: r.user.phone,
          created: r.user.created, updated_at: r.user.updatedAt,
          level: r.user.level, games_played: r.user.gamesPlayed,
          two_fa_status: r.user.twoFaEnabled,
          parent_staff_id: r.user.staffId != null ? Number(r.user.staffId) : null,
          staff_name: r.user.staffName, staff_email: r.user.staffEmail,
          is_direct: r.user.isDirect,
          last_ip: r.user.lastIp, last_login_at: r.user.lastLoginAt,
        },
        locks: {
          is_locked: r.locks.isLocked,
          lock_targetx: r.locks.lockTargetx,
          sports_betlocked: r.locks.sportsBetlocked,
          casino_locked: r.locks.casinoLocked,
        },
        financials: {
          total_deposit_inr: r.financials.totalDeposit,
          total_withdrawal_inr: r.financials.totalWithdrawal,
          net_inr: r.financials.net,
          deposit_count: 0,
          withdrawal_count: 0,
        },
        activity: {
          source: 'user_login_history + SportsBet',
          distinct_ip_count: r.activity.distinctIpCount,
          distinct_ips: r.activity.distinctIps,
          ip_breakdown: r.activity.ipBreakdown.map((i: any) => ({
            ip_address: i.ipAddress, uses: i.uses, first_seen: i.firstSeen, last_seen: i.lastSeen,
          })),
          recent_logins: r.activity.recentLogins.map((l: any) => ({
            id: l.id, ip_address: l.ipAddress, user_agent: l.userAgent, created_at: l.createdAt,
          })),
          recent_bets: r.activity.recentBets.map((b: any) => ({
            id: b.id, ip_address: b.ipAddress, created_at: b.createdAt,
            stake_amount: b.stakeAmount, original_currency: b.currency,
            status: b.status, result_status: b.resultStatus,
          })),
        },
        risk_flags: {
          multiple_ips: r.riskFlags.multipleIps,
          two_fa_disabled: r.riskFlags.twoFaDisabled,
          high_withdrawal_ratio: r.riskFlags.highWithdrawalRatio,
          no_activity: r.riskFlags.noActivity,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && userId) load();
    else setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  /** The three platform locks the locks module owns, by its own names. */
  const LOCK_NAMES: Record<string, 'system' | 'sports' | 'casino'> = {
    is_locked: 'system',
    sports_betlocked: 'sports',
    casino_locked: 'casino',
  };

  const toggleLock = async (field: 'is_locked' | 'sports_betlocked' | 'lock_targetx' | 'casino_locked', value: boolean) => {
    if (!userId || !data) return;
    setSaving(field);
    try {
      if (field === 'lock_targetx') {
        // The wagering lock is not a platform lock — it stops a bulk multiplier
        // change from overriding a negotiated rate, and lives with the wager
        // module that reads it.
        await apiFetch(buildPath(ENDPOINTS.wager.lock, { userId }), {
          method: 'POST',
          body: { locked: value },
        });
      } else {
        // Locking an AGENT reaches their whole subtree here; legacy locked the
        // agent and their own players and left the branch below still betting.
        await apiFetch(ENDPOINTS.locks.update, {
          method: 'POST',
          body: { userId: Number(userId), [LOCK_NAMES[field]]: value },
        });
      }
      setData({ ...data, locks: { ...data.locks, [field]: value } });
      setSnack({ open: true, msg: `${field.replace(/_/g, ' ')} ${value ? 'enabled' : 'disabled'}`, severity: 'success' });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || 'Failed to update', severity: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const activeRisks = data
    ? Object.entries(data.risk_flags).filter(([, v]) => v).map(([k]) => k)
    : [];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${C.warning}22`, color: C.warning, width: 36, height: 36 }}>
              <Shield />
            </Avatar>
            <Box>
              <Typography sx={{ color: C.text, fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>Risk Management</Typography>
              {data && (
                <Typography sx={{ color: C.textMuted, fontSize: '0.75rem' }}>
                  {data.user.name} · UID {data.user.id}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={load} sx={{ color: C.textMuted, '&:hover': { color: C.primary } }}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} sx={{ color: C.textMuted, '&:hover': { color: C.error } }}>
              <Close />
            </IconButton>
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
                    <Chip
                      key={r}
                      icon={<Warning sx={{ fontSize: 14 }} />}
                      label={r.replace(/_/g, ' ')}
                      size="small"
                      sx={{
                        bgcolor: `${C.warning}22`,
                        color: C.warning,
                        fontWeight: 700,
                        textTransform: 'capitalize',
                        '& .MuiChip-icon': { color: C.warning },
                      }}
                    />
                  ))}
                </Box>
              )}

              <Section title="Profile" icon={<VerifiedUser sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}><KV label="UID" value={data.user.id} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Name" value={data.user.name || '—'} /></Grid>
                  <Grid item xs={12} sm={4}><KV label="Email" value={data.user.email || '—'} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Phone" value={data.user.phone || '—'} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Country" value={data.user.country || '—'} /></Grid>
                  <Grid item xs={6} sm={4}><KV label="Level" value={data.user.level} /></Grid>
                  <Grid item xs={12} sm={6}><KV label="Registered" value={fmtDate(data.user.created)} /></Grid>
                  <Grid item xs={12} sm={6}><KV label="Updated" value={fmtDate(data.user.updated_at)} /></Grid>
                  <Grid item xs={6} sm={4}>
                    <KV label="Type" value={
                      <Chip
                        size="small"
                        label={data.user.is_direct ? 'Direct' : 'Agent'}
                        sx={{
                          bgcolor: data.user.is_direct ? `${C.info}22` : `${C.primary}22`,
                          color: data.user.is_direct ? C.info : C.primary,
                          fontWeight: 700, height: 20,
                        }}
                      />
                    } />
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <KV label="2FA" value={
                      <Chip
                        size="small"
                        label={data.user.two_fa_status ? 'Enabled' : 'Disabled'}
                        sx={{
                          bgcolor: data.user.two_fa_status ? `${C.success}22` : `${C.error}22`,
                          color: data.user.two_fa_status ? C.success : C.error,
                          fontWeight: 700, height: 20,
                        }}
                      />
                    } />
                  </Grid>
                  {!data.user.is_direct && (
                    <Grid item xs={12} sm={8}>
                      <KV label="Parent Staff" value={`${data.user.staff_name || '—'} · ${data.user.staff_email || ''}`} />
                    </Grid>
                  )}
                </Grid>
              </Section>

              <Section title="Financial Exposure" icon={<AccountBalanceWallet sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <KV label="Deposits" value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUp sx={{ color: C.success, fontSize: 16 }} />
                        <span style={{ color: C.success }}>{fmtInr(data.financials.total_deposit_inr)}</span>
                      </Box>
                    } />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <KV label="Withdrawals" value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingDown sx={{ color: C.error, fontSize: 16 }} />
                        <span style={{ color: C.error }}>{fmtInr(data.financials.total_withdrawal_inr)}</span>
                      </Box>
                    } />
                  </Grid>
                  <Grid item xs={6} sm={3}><KV label="Net" value={
                    <span style={{ color: Number(data.financials.net_inr) >= 0 ? C.success : C.error }}>
                      {fmtInr(data.financials.net_inr)}
                    </span>
                  } /></Grid>
                  <Grid item xs={6} sm={3}><KV label="Transactions" value={`${data.financials.deposit_count} dep · ${data.financials.withdrawal_count} wdr`} /></Grid>
                </Grid>
              </Section>

              <Section title="Network / IP Activity" icon={<Public sx={{ fontSize: 16 }} />}>
                <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', mb: 1.5 }}>
                  Source: {data.activity.source}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                  <Chip
                    icon={<Fingerprint sx={{ fontSize: 14 }} />}
                    label={`${data.activity.distinct_ip_count} distinct IPs`}
                    sx={{
                      bgcolor: data.activity.distinct_ip_count > 1 ? `${C.warning}22` : `${C.info}22`,
                      color: data.activity.distinct_ip_count > 1 ? C.warning : C.info,
                      fontWeight: 700,
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                  {data.user.last_ip && (
                    <Chip
                      icon={<Public sx={{ fontSize: 14 }} />}
                      label={`Last: ${data.user.last_ip}${data.user.last_login_at ? ` · ${fmtDate(data.user.last_login_at)}` : ''}`}
                      sx={{ bgcolor: `${C.primary}22`, color: C.primary, fontWeight: 600, '& .MuiChip-icon': { color: 'inherit' } }}
                    />
                  )}
                </Box>
                {data.activity.ip_breakdown.length === 0 ? (
                  <Typography sx={{ color: C.textMuted, fontSize: '0.82rem', py: 2, textAlign: 'center' }}>
                    No IP activity recorded for this user.
                  </Typography>
                ) : (
                  <Table size="small" sx={{ '& td, & th': { borderColor: C.border } }}>
                    <TableHead>
                      <TableRow>
                        {['IP Address', 'Uses', 'First Seen', 'Last Seen'].map(h => (
                          <TableCell key={h} sx={{ color: C.textMuted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.activity.ip_breakdown.map(r => (
                        <TableRow key={r.ip_address}>
                          <TableCell sx={{ color: C.text, fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.ip_address}</TableCell>
                          <TableCell sx={{ color: C.text, fontSize: '0.78rem' }}>{r.uses}</TableCell>
                          <TableCell sx={{ color: C.textMuted, fontSize: '0.75rem' }}>{fmtDate(r.first_seen)}</TableCell>
                          <TableCell sx={{ color: C.textMuted, fontSize: '0.75rem' }}>{fmtDate(r.last_seen)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>

              {data.activity.recent_logins && data.activity.recent_logins.length > 0 && (
                <Section title="Recent Logins (last 15)" icon={<Fingerprint sx={{ fontSize: 16 }} />}>
                  <Table size="small" sx={{ '& td, & th': { borderColor: C.border } }}>
                    <TableHead>
                      <TableRow>
                        {['Time', 'IP', 'User Agent'].map(h => (
                          <TableCell key={h} sx={{ color: C.textMuted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.activity.recent_logins.map(l => (
                        <TableRow key={l.id}>
                          <TableCell sx={{ color: C.textMuted, fontSize: '0.75rem' }}>{fmtDate(l.created_at)}</TableCell>
                          <TableCell sx={{ color: C.text, fontFamily: 'monospace', fontSize: '0.78rem' }}>{l.ip_address || '—'}</TableCell>
                          <TableCell sx={{ color: C.textSecondary, fontSize: '0.72rem', maxWidth: 320 }}>
                            <Typography noWrap sx={{ fontSize: '0.72rem', color: C.textSecondary }}>{l.user_agent || '—'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              )}

              {data.activity.recent_bets.length > 0 && (
                <Section title="Recent Bets (last 10)" icon={<CalendarToday sx={{ fontSize: 16 }} />}>
                  <Table size="small" sx={{ '& td, & th': { borderColor: C.border } }}>
                    <TableHead>
                      <TableRow>
                        {['Time', 'IP', 'Stake', 'Status', 'Result'].map(h => (
                          <TableCell key={h} sx={{ color: C.textMuted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.activity.recent_bets.map(b => (
                        <TableRow key={b.id}>
                          <TableCell sx={{ color: C.textMuted, fontSize: '0.75rem' }}>{fmtDate(b.created_at)}</TableCell>
                          <TableCell sx={{ color: C.text, fontFamily: 'monospace', fontSize: '0.75rem' }}>{b.ip_address || '—'}</TableCell>
                          <TableCell sx={{ color: C.text, fontSize: '0.78rem' }}>{b.original_currency} {Number(b.stake_amount).toLocaleString('en-IN')}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            <Chip label={b.status || '—'} size="small" sx={{ bgcolor: `${C.info}22`, color: C.info, height: 18, fontSize: '0.65rem' }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>
                            <Chip
                              label={b.result_status || 'pending'}
                              size="small"
                              sx={{
                                bgcolor: b.result_status === 'won' ? `${C.success}22` : b.result_status === 'lost' ? `${C.error}22` : `${C.warning}22`,
                                color: b.result_status === 'won' ? C.success : b.result_status === 'lost' ? C.error : C.warning,
                                height: 18, fontSize: '0.65rem',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              )}

              <Section title="Lock Controls" icon={<Lock sx={{ fontSize: 16 }} />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ bgcolor: C.cardHover, borderRadius: 1.5, p: 1.5, border: `1px solid ${C.border}` }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={data.locks.is_locked}
                            disabled={saving === 'is_locked'}
                            onChange={e => toggleLock('is_locked', e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PersonOff sx={{ fontSize: 16 }} /> Account Locked
                            </Typography>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                              Blocks all logins and activity
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ bgcolor: C.cardHover, borderRadius: 1.5, p: 1.5, border: `1px solid ${C.border}` }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={data.locks.sports_betlocked}
                            disabled={saving === 'sports_betlocked'}
                            onChange={e => toggleLock('sports_betlocked', e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SportsEsports sx={{ fontSize: 16 }} /> Sports Bet Lock
                            </Typography>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                              Prevents sportsbook wagers
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ bgcolor: C.cardHover, borderRadius: 1.5, p: 1.5, border: `1px solid ${C.border}` }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={data.locks.casino_locked}
                            disabled={saving === 'casino_locked'}
                            onChange={e => toggleLock('casino_locked', e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Casino sx={{ fontSize: 16 }} /> Casino Lock
                            </Typography>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                              Prevents casino play
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ bgcolor: C.cardHover, borderRadius: 1.5, p: 1.5, border: `1px solid ${C.border}` }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={data.locks.lock_targetx}
                            disabled={saving === 'lock_targetx'}
                            onChange={e => toggleLock('lock_targetx', e.target.checked)}
                          />
                        }
                        label={
                          <Box>
                            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Casino sx={{ fontSize: 16 }} /> Target Lock
                            </Typography>
                            <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                              Flags user for monitoring
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
          <Button onClick={onClose} sx={{ color: C.textMuted, '&:hover': { bgcolor: C.cardHover } }}>
            Close
          </Button>
          {data && !data.locks.is_locked ? (
            <Button
              variant="contained"
              startIcon={<Lock />}
              disabled={saving === 'is_locked'}
              onClick={() => toggleLock('is_locked', true)}
              sx={{ bgcolor: C.error, '&:hover': { bgcolor: '#C01540' }, fontWeight: 700 }}
            >
              Lock Account
            </Button>
          ) : data && data.locks.is_locked ? (
            <Button
              variant="contained"
              startIcon={<LockOpen />}
              disabled={saving === 'is_locked'}
              onClick={() => toggleLock('is_locked', false)}
              sx={{ bgcolor: C.success, '&:hover': { bgcolor: '#0AAA56' }, fontWeight: 700 }}
            >
              Unlock Account
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

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
            color: snack.severity === 'success' ? C.success : C.error,
            border: `1px solid ${snack.severity === 'success' ? C.success : C.error}`,
          }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RiskManagementDialog;
