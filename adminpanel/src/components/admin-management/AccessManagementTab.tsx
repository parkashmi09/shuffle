import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Card, Typography, TextField, InputAdornment, Chip, IconButton,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Button, Snackbar, Alert, AlertColor, Switch, Dialog,
  DialogTitle, DialogContent, DialogActions, Accordion, AccordionSummary,
  AccordionDetails, Divider, Skeleton, Pagination,
} from '@mui/material';
import {
  Search, Refresh, PersonAdd, Edit, Lock, LockOpen, VpnKey,
  ExpandMore, Close, Visibility, VisibilityOff, Shield, CheckCircle,
  Cancel, History as HistoryIcon, FiberManualRecord, BugReport,
} from '@mui/icons-material';
import {
  PAGE_GROUPS, AUTHORITY_GROUPS, StaffPermissions,
  buildEmptyPermissions, buildFullPermissions, ALL_PAGE_PATHS,
} from '../../constants/permissions';
import * as lordsApi from '../../services/lordsApi';
import { Executive, ExecutiveActivity } from '../../services/socketService';
import { usePermissions } from '../../hooks/usePermissions';

/* ── style helpers ─────────────────────────────────────────────── */
const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#10182E', borderRadius: 1.5,
    '& fieldset': { borderColor: '#1E2D55' },
    '&:hover fieldset': { borderColor: '#886CFF' },
    '&.Mui-focused fieldset': { borderColor: '#886CFF' },
  },
  '& input': { color: '#F9F9F9', fontSize: '0.85rem' },
  '& .MuiInputLabel-root': { color: '#8384A5', '&.Mui-focused': { color: '#886CFF' } },
} as const;

const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: '#0ECC68' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0ECC68' },
  '& .MuiSwitch-track': { bgcolor: '#1E2D55' },
} as const;

interface SnackState { open: boolean; msg: string; severity: AlertColor; }

const isEndpointMissing = (e: any): boolean => {
  const status = e?.status;
  if (status === 404 || status === 501) return true;
  const msg = String(e?.message || '');
  return /Cannot GET|Cannot POST|Cannot PATCH/i.test(msg);
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PERMISSIONS EDITOR
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PermissionsEditor: React.FC<{
  value: StaffPermissions;
  onChange: (p: StaffPermissions) => void;
}> = ({ value, onChange }) => {

  const togglePage = (path: string) => {
    onChange({ ...value, pages: { ...value.pages, [path]: !value.pages[path] } });
  };
  const toggleGroup = (title: string, allOn: boolean) => {
    const group = PAGE_GROUPS.find(g => g.title === title);
    if (!group) return;
    const newPages = { ...value.pages };
    group.pages.forEach(p => { newPages[p.path] = !allOn; });
    onChange({
      ...value,
      groups: { ...value.groups, [title]: !allOn },
      pages: newPages,
    });
  };
  const toggleAuth = (key: string) => {
    onChange({ ...value, authority: { ...value.authority, [key]: !value.authority[key] } });
  };

  const groupAllOn = (title: string) => {
    const g = PAGE_GROUPS.find(x => x.title === title);
    if (!g) return false;
    return g.pages.every(p => value.pages[p.path]);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button size="small" variant="outlined"
          onClick={() => onChange(buildFullPermissions())}
          sx={{ borderColor: '#1E2D55', color: '#0ECC68', textTransform: 'none', '&:hover': { borderColor: '#0ECC68', bgcolor: 'rgba(14,204,104,0.08)' } }}>
          Grant All
        </Button>
        <Button size="small" variant="outlined"
          onClick={() => onChange(buildEmptyPermissions())}
          sx={{ borderColor: '#1E2D55', color: '#E01B4F', textTransform: 'none', '&:hover': { borderColor: '#E01B4F', bgcolor: 'rgba(224,27,79,0.08)' } }}>
          Revoke All
        </Button>
      </Box>

      <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
        Sidebar Access
      </Typography>
      {PAGE_GROUPS.map(group => {
        const allOn = groupAllOn(group.title);
        return (
          <Accordion key={group.title}
            sx={{ bgcolor: '#10182E', border: '1px solid #1E2D55', boxShadow: 'none', mb: 0.5,
              '&:before': { display: 'none' }, borderRadius: '8px !important' }}>
            <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#8384A5' }} />}
              sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 } }}>
              <Switch size="small" checked={allOn} sx={switchSx}
                onClick={(e) => { e.stopPropagation(); toggleGroup(group.title, allOn); }} />
              <Typography sx={{ color: '#F9F9F9', fontSize: '0.85rem', fontWeight: 600 }}>
                {group.title}
              </Typography>
              <Chip label={`${group.pages.filter(p => value.pages[p.path]).length}/${group.pages.length}`}
                size="small"
                sx={{ ml: 'auto', mr: 1, bgcolor: 'rgba(136,108,255,0.12)', color: '#A08FFF', fontSize: '0.65rem', height: 18 }} />
            </AccordionSummary>
            <AccordionDetails sx={{ borderTop: '1px solid #1E2D55', pt: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                {group.pages.map(p => (
                  <Box key={`${group.title}-${p.path}`}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1, borderRadius: 1,
                      '&:hover': { bgcolor: 'rgba(136,108,255,0.06)' } }}>
                    <Switch size="small" checked={!!value.pages[p.path]} onChange={() => togglePage(p.path)} sx={switchSx} />
                    <Typography sx={{ color: '#F9F9F9', fontSize: '0.78rem' }}>{p.label}</Typography>
                    <Typography sx={{ color: '#A08FFF', fontSize: '0.65rem', fontFamily: 'monospace', ml: 'auto' }}>
                      {p.path}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Divider sx={{ borderColor: '#1E2D55', my: 2 }} />

      <Typography sx={{ color: '#F9F9F9', fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
        Authority & Actions
      </Typography>
      {AUTHORITY_GROUPS.map(grp => (
        <Box key={grp.title} sx={{ mb: 2 }}>
          <Typography sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>
            {grp.title}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
            {grp.items.map(item => (
              <Box key={item.key}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1, borderRadius: 1,
                  bgcolor: '#10182E', border: '1px solid #1E2D55' }}>
                <Switch size="small" checked={!!value.authority[item.key]} onChange={() => toggleAuth(item.key)} sx={switchSx} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#F9F9F9', fontSize: '0.78rem', fontWeight: 500 }}>{item.label}</Typography>
                  {item.description && (
                    <Typography sx={{ color: '#8384A5', fontSize: '0.65rem' }}>{item.description}</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CREATE / EDIT EXECUTIVE DIALOG
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ExecutiveDialog: React.FC<{
  open: boolean;
  executive: Executive | null;          // null => create
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ open, executive, onClose, onSaved, onError }) => {
  const isEdit = !!executive;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [permissions, setPermissions] = useState<StaffPermissions>(buildEmptyPermissions());
  const [txnPwd, setTxnPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (executive) {
      setUsername(executive.username);
      setPermissions(executive.permissions ?? buildEmptyPermissions());
    } else {
      setUsername('');
      setPermissions(buildEmptyPermissions());
    }
    setPassword('');
    setConfirmPassword('');
    setTxnPwd('');
  }, [open, executive]);

  const validate = (): string | null => {
    if (!isEdit) {
      if (!username.trim()) return 'Username is required';
      if (!password) return 'Password is required';
      if (password.length < 6) return 'Password must be at least 6 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    if (!txnPwd) return 'Transaction password is required';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { onError(err); return; }
    setSaving(true);
    try {
      if (isEdit && executive) {
        await lordsApi.updateExecutive(executive.id, { permissions, transactionPassword: txnPwd });
        onSaved('Executive updated');
      } else {
        await lordsApi.createExecutive({
          username: username.trim(),
          password,
          permissions,
          transactionPassword: txnPwd,
        });
        onSaved('Executive created');
      }
      onClose();
    } catch (e: any) {
      onError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E2D55', pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Shield sx={{ color: '#886CFF', fontSize: 20 }} />
          <Typography sx={{ color: '#F9F9F9', fontWeight: 700 }}>
            {isEdit ? `Edit Executive — ${executive?.username}` : 'Create Executive'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#8384A5' }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {!isEdit && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
            <TextField label="Username" size="small" value={username}
              onChange={e => setUsername(e.target.value)} sx={{ ...inputSx, gridColumn: { xs: '1', sm: '1 / -1' } }} fullWidth />
            <TextField label="Password" size="small" type={showPwd ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)} sx={inputSx} fullWidth
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPwd(p => !p)} sx={{ color: '#8384A5' }}>
                    {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )}} />
            <TextField label="Confirm Password" size="small" type={showPwd ? 'text' : 'password'}
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} sx={inputSx} fullWidth
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPwd(p => !p)} sx={{ color: '#8384A5' }}>
                    {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )}} />
          </Box>
        )}

        <PermissionsEditor value={permissions} onChange={setPermissions} />

        <Divider sx={{ borderColor: '#1E2D55', my: 2 }} />

        <TextField label="Transaction Password" size="small" type="password" fullWidth
          value={txnPwd} onChange={e => setTxnPwd(e.target.value)} sx={inputSx}
          helperText="Required for any access change."
          FormHelperTextProps={{ sx: { color: '#8384A5' } }} />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1E2D55', gap: 1 }}>
        <Button onClick={onClose} sx={{ color: '#8384A5', textTransform: 'none', '&:hover': { bgcolor: '#162140' } }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: '#886CFF', '&:hover': { bgcolor: '#5F12CC' }, fontWeight: 700, textTransform: 'none' }}>
          {saving ? 'Saving…' : (isEdit ? 'Save Permissions' : 'Create Executive')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RESET PASSWORD DIALOG
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ResetPasswordDialog: React.FC<{
  open: boolean;
  executive: Executive | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ open, executive, onClose, onSaved, onError }) => {
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [txnPwd, setTxnPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => { if (open) { setNewPwd(''); setConfirm(''); setTxnPwd(''); setShowPwd(false); } }, [open]);

  const submit = async () => {
    if (!executive) return;
    if (newPwd.length < 6) return onError('Password must be 6+ chars');
    if (newPwd !== confirm) return onError('Passwords do not match');
    if (!txnPwd) return onError('Transaction password required');
    setSaving(true);
    try {
      await lordsApi.resetExecutivePassword(executive.id, { newPassword: newPwd, transactionPassword: txnPwd });
      onSaved('Password reset');
      onClose();
    } catch (e: any) {
      onError(e?.message || 'Reset failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #1E2D55', pb: 1.5 }}>
        <VpnKey sx={{ color: '#FFC23F' }} />
        <Typography sx={{ color: '#F9F9F9', fontWeight: 700 }}>
          Reset Password — {executive?.username}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="New Password" type={showPwd ? 'text' : 'password'} size="small" fullWidth
          value={newPwd} onChange={e => setNewPwd(e.target.value)} sx={inputSx}
          InputProps={{ endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShowPwd(p => !p)} sx={{ color: '#8384A5' }}>
                {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          )}} />
        <TextField label="Confirm Password" type={showPwd ? 'text' : 'password'} size="small" fullWidth
          value={confirm} onChange={e => setConfirm(e.target.value)} sx={inputSx}
          InputProps={{ endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShowPwd(p => !p)} sx={{ color: '#8384A5' }}>
                {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          )}} />
        <TextField label="Transaction Password" type="password" size="small" fullWidth
          value={txnPwd} onChange={e => setTxnPwd(e.target.value)} sx={inputSx} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1E2D55' }}>
        <Button onClick={onClose} sx={{ color: '#8384A5', textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          sx={{ bgcolor: '#FFC23F', color: '#0C0D1D', '&:hover': { bgcolor: '#E5AD2E' }, fontWeight: 700, textTransform: 'none' }}>
          {saving ? 'Saving…' : 'Reset'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACTIVITY LOG DIALOG
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ACTION_COLORS: Record<string, string> = {
  login:               '#A08FFF',
  logout:              '#8384A5',
  'user.create':       '#0ECC68',
  'user.update':       '#A08FFF',
  'user.password.reset':'#FFC23F',
  'user.lock':         '#E01B4F',
  'user.unlock':       '#0ECC68',
  'transfer.credit':   '#FFC23F',
  'transfer.casino':   '#7B5EF5',
  'settle.sports':     '#FFC23F',
  'settle.fancy':      '#FFC23F',
  'settle.casino':     '#7B5EF5',
  'deposit.approve':   '#0ECC68',
  'deposit.reject':    '#E01B4F',
  'withdraw.approve':  '#0ECC68',
  'withdraw.reject':   '#E01B4F',
  'kyc.update':        '#A08FFF',
  'redeem.create':     '#0ECC68',
  'giftcard.issue':    '#0ECC68',
  'bonus.issue':       '#0ECC68',
  'notification.send': '#A08FFF',
  'config.update':     '#A08FFF',
};

const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleString(); } catch { return s; }
};

const ActivityLogDialog: React.FC<{
  open: boolean;
  executive: Executive | null;
  onClose: () => void;
}> = ({ open, executive, onClose }) => {
  const [entries, setEntries] = useState<ExecutiveActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    if (!executive) return;
    setLoading(true); setError(null); setMissing(false);
    try {
      const data: any = await lordsApi.getExecutiveActivity(executive.id, { page, limit: 50 });
      setEntries(data?.entries || []);
      setTotalPages(data?.totalPages || 1);
    } catch (e: any) {
      if (isEndpointMissing(e)) setMissing(true);
      else setError(e?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [executive, page]);

  useEffect(() => { if (open) { setPage(1); fetchLog(); } }, [open, fetchLog]);

  /**
   * Live tail.
   *
   * `subscribeToExecutiveActivity` does not exist on `socketService` —
   * admin-service registers no such push — so this threw a TypeError every time
   * the dialog opened. `fetchLog` above already reads the same data over REST;
   * polling it keeps the tail live without inventing a transport.
   */
  useEffect(() => {
    if (!open || !executive) return;
    const timer = setInterval(fetchLog, 15_000);
    return () => clearInterval(timer);
  }, [open, executive, fetchLog]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E2D55', pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HistoryIcon sx={{ color: '#A08FFF' }} />
          <Typography sx={{ color: '#F9F9F9', fontWeight: 700 }}>
            Activity Log — {executive?.username}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Refresh"><IconButton size="small" onClick={fetchLog} sx={{ color: '#8384A5' }}><Refresh /></IconButton></Tooltip>
          <IconButton size="small" onClick={onClose} sx={{ color: '#8384A5' }}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {missing ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 40, color: '#1E2D55', mb: 1 }} />
            <Typography sx={{ color: '#F9F9F9', fontWeight: 600 }}>Activity log endpoint not deployed</Typography>
            <Typography sx={{ color: '#8384A5', fontSize: '0.8rem', mt: 0.5 }}>
              Backend route <code style={{ color: '#A08FFF' }}>GET /lords/access/executives/{executive?.id}/activity</code> is not yet available.
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ bgcolor: '#2B0E1A', color: '#E01B4F', border: '1px solid #E01B4F' }}>{error}</Alert>
        ) : loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={40} sx={{ bgcolor: '#10182E', mb: 0.5, borderRadius: 1 }} />
          ))
        ) : entries.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: '#8384A5' }}>
            <Typography sx={{ fontSize: '0.85rem' }}>No activity recorded yet.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#0C0D1D' }}>
                  {['When', 'Action', 'Target', 'Details', 'IP'].map(h => (
                    <TableCell key={h} sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #1E2D55' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map(e => {
                  const color = ACTION_COLORS[e.action] || '#A08FFF';
                  return (
                    <TableRow key={e.id} sx={{ '&:hover': { bgcolor: '#121E38' }, '& td': { borderBottom: '1px solid #1E2D5533' } }}>
                      <TableCell sx={{ color: '#8384A5', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                        {fmtDate(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <FiberManualRecord sx={{ fontSize: 8, color }} />
                          <Typography sx={{ color: '#F9F9F9', fontSize: '0.78rem', fontFamily: 'monospace' }}>{e.action}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#A08FFF', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                        {e.targetType ? `${e.targetType}#${e.targetId ?? '-'}` : '-'}
                      </TableCell>
                      <TableCell sx={{ color: '#8384A5', fontSize: '0.72rem', maxWidth: 280 }}>
                        {e.details ? (
                          <Tooltip title={<pre style={{ margin: 0, fontSize: 11 }}>{JSON.stringify(e.details, null, 2)}</pre>}>
                            <span style={{ cursor: 'help', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: 260 }}>
                              {JSON.stringify(e.details)}
                            </span>
                          </Tooltip>
                        ) : '-'}
                      </TableCell>
                      <TableCell sx={{ color: '#8384A5', fontSize: '0.72rem', fontFamily: 'monospace' }}>{e.ip || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)}
              sx={{ '& .MuiPaginationItem-root': { color: '#8384A5' },
                '& .Mui-selected': { bgcolor: '#886CFF !important', color: '#F9F9F9' } }} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TEST LOGIN DIALOG
   Verifies an executive's password without affecting the
   parent admin's session.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const TestLoginDialog: React.FC<{
  open: boolean;
  executive: Executive | null;
  onClose: () => void;
}> = ({ open, executive, onClose }) => {
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) { setPwd(''); setShowPwd(false); setResult(null); }
  }, [open]);

  const run = async () => {
    if (!executive || !pwd) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await lordsApi.testExecutiveLogin({ username: executive.username, password: pwd });
      if (r.ok) {
        setResult({ ok: true, message: 'Credentials are valid — this executive can sign in.' });
      } else {
        setResult({ ok: false, message: r.body?.message || `Failed (${r.status})` });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || 'Request failed' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #1E2D55', pb: 1.5 }}>
        <BugReport sx={{ color: '#A08FFF' }} />
        <Typography sx={{ color: '#F9F9F9', fontWeight: 700 }}>
          Test Login — {executive?.username}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ color: '#8384A5', fontSize: '0.78rem' }}>
          Verify the executive's password without signing them in. Your own session is unaffected.
        </Typography>
        <TextField label={`Password for ${executive?.username || 'executive'}`}
          type={showPwd ? 'text' : 'password'} size="small" fullWidth autoFocus
          value={pwd} onChange={e => setPwd(e.target.value)} sx={inputSx}
          onKeyDown={e => { if (e.key === 'Enter' && !running) run(); }}
          InputProps={{ endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShowPwd(p => !p)} sx={{ color: '#8384A5' }}>
                {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          )}} />
        {result && (
          <Alert severity={result.ok ? 'success' : 'error'}
            sx={{
              bgcolor: result.ok ? 'rgba(14,204,104,0.08)' : 'rgba(224,27,79,0.08)',
              color:   result.ok ? '#0ECC68' : '#E01B4F',
              border:  `1px solid ${result.ok ? '#0ECC68' : '#E01B4F'}`,
              '& .MuiAlert-icon': { color: 'inherit' },
            }}>
            {result.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1E2D55' }}>
        <Button onClick={onClose} sx={{ color: '#8384A5', textTransform: 'none' }}>Close</Button>
        <Button variant="contained" onClick={run} disabled={running || !pwd}
          sx={{ bgcolor: '#A08FFF', '&:hover': { bgcolor: '#4170E6' }, fontWeight: 700, textTransform: 'none' }}>
          {running ? 'Testing…' : 'Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACCESS MANAGEMENT TAB (main)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const AccessManagementTab: React.FC = () => {
  const { isSuper, can, loading: permLoading } = usePermissions();
  const allowed = isSuper || can('canManageStaff');

  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', severity: 'info' });
  const [endpointMissing, setEndpointMissing] = useState(false);

  const [editing, setEditing] = useState<Executive | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<Executive | null>(null);
  const [lockTarget, setLockTarget] = useState<Executive | null>(null);
  const [activityTarget, setActivityTarget] = useState<Executive | null>(null);
  const [testLoginTarget, setTestLoginTarget] = useState<Executive | null>(null);
  const [lockTxnPwd, setLockTxnPwd] = useState('');
  const [lockSaving, setLockSaving] = useState(false);

  const notify = (msg: string, severity: AlertColor = 'success') =>
    setSnack({ open: true, msg, severity });

  const fetchList = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const data: any = await lordsApi.listExecutives({ page, limit: 25, search: search.length >= 3 ? search : undefined });
      setExecutives(data?.executives || []);
      setTotalPages(data?.totalPages || 1);
      setEndpointMissing(false);
    } catch (e: any) {
      if (isEndpointMissing(e)) {
        setEndpointMissing(true);
        setExecutives([]);
      } else {
        notify(e?.message || 'Failed to load executives', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [allowed, page, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /** Same as the activity tail above — no `subscribeToExecutiveList` exists. */
  useEffect(() => {
    if (!allowed || endpointMissing) return;
    const timer = setInterval(fetchList, 20_000);
    return () => clearInterval(timer);
  }, [allowed, endpointMissing, fetchList]);

  const submitLock = async () => {
    if (!lockTarget) return;
    if (!lockTxnPwd) { notify('Transaction password required', 'error'); return; }
    setLockSaving(true);
    try {
      const lock = lockTarget.status !== 'locked';
      await lordsApi.lockExecutive(lockTarget.id, { lock, transactionPassword: lockTxnPwd });
      notify(lock ? 'Executive locked' : 'Executive unlocked');
      setLockTarget(null);
      setLockTxnPwd('');
      fetchList();
    } catch (e: any) {
      notify(e?.message || 'Lock failed', 'error');
    } finally { setLockSaving(false); }
  };

  const filtered = useMemo(() => {
    if (!search) return executives;
    const q = search.toLowerCase();
    return executives.filter(s => s.username.toLowerCase().includes(q));
  }, [executives, search]);

  if (permLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <Skeleton variant="rectangular" height={300} width="100%" sx={{ bgcolor: '#10182E', borderRadius: 2 }} />
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 1.5 }}>
        <Shield sx={{ fontSize: 48, color: '#1E2D55' }} />
        <Typography sx={{ color: '#F9F9F9', fontWeight: 600 }}>No Management Access</Typography>
        <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>
          You don't have permission to manage executives.
        </Typography>
      </Box>
    );
  }

  const HEADERS = ['Executive', 'Status', 'Last Login', 'Permissions', 'Actions'];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ color: '#F9F9F9', fontWeight: 700 }}>
            Access Management — Executives
          </Typography>
          <Typography sx={{ color: '#8384A5', fontSize: '0.78rem' }}>
            Create executives that act on your behalf, scope what they can see and do, and review every action they take.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchList} sx={{ color: '#8384A5', border: '1px solid #1E2D55', borderRadius: 1.5 }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<PersonAdd />}
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            sx={{ bgcolor: '#0ECC68', '&:hover': { bgcolor: '#0BB858' }, textTransform: 'none', fontWeight: 700 }}>
            Create Executive
          </Button>
        </Box>
      </Box>

      {endpointMissing && (
        <Alert severity="warning"
          sx={{ mb: 2, bgcolor: 'rgba(255,194,63,0.08)', color: '#FFC23F', border: '1px solid #FFC23F',
            '& .MuiAlert-icon': { color: '#FFC23F' } }}>
          Backend access-management endpoints (<code>/lords/access/executives</code>) aren't deployed yet.
          The UI is wired and will populate as soon as the routes are live on the API server.
        </Alert>
      )}

      <Card sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2, mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <TextField size="small" placeholder="Search by username…"
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#8384A5', fontSize: 18 }} /></InputAdornment> }}
            sx={{ ...inputSx, minWidth: 280 }} />
        </Box>
      </Card>

      <Card sx={{ bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#0C0D1D' }}>
                {HEADERS.map(h => (
                  <TableCell key={h} sx={{ color: '#8384A5', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #1E2D55', py: 1.5, whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && executives.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {HEADERS.map((_, j) => (
                      <TableCell key={j} sx={{ borderBottom: '1px solid #1E2D5533' }}>
                        <Skeleton variant="text" sx={{ bgcolor: '#1E2D55' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={HEADERS.length} sx={{ py: 6, borderBottom: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Shield sx={{ fontSize: 40, color: '#1E2D55' }} />
                      <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>
                        {endpointMissing ? 'Waiting for backend' : 'No executives yet'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(s => {
                const pageCount = ALL_PAGE_PATHS.filter(p => s.permissions?.pages?.[p]).length;
                const authCount = Object.values(s.permissions?.authority ?? {}).filter(Boolean).length;
                const isLocked = s.status === 'locked';
                return (
                  <TableRow key={s.id} sx={{ '&:hover': { bgcolor: '#121E38' }, '& td': { borderBottom: '1px solid #1E2D5533' } }}>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ color: '#F9F9F9', fontSize: '0.85rem', fontWeight: 600 }}>{s.username}</Typography>
                      <Typography sx={{ color: '#A08FFF', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                        Executive #{s.id}{s.parentUsername ? ` · under ${s.parentUsername}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={s.status}
                        size="small"
                        icon={s.status === 'active'
                          ? <CheckCircle sx={{ fontSize: '13px !important' }} />
                          : <Cancel sx={{ fontSize: '13px !important' }} />}
                        sx={{
                          bgcolor: s.status === 'active' ? 'rgba(14,204,104,0.12)'
                            : isLocked ? 'rgba(224,27,79,0.12)' : 'rgba(131,132,165,0.12)',
                          color: s.status === 'active' ? '#0ECC68'
                            : isLocked ? '#E01B4F' : '#8384A5',
                          fontWeight: 700, fontSize: '0.68rem', height: 20, textTransform: 'capitalize',
                          '& .MuiChip-icon': { color: 'inherit', ml: '4px' },
                        }} />
                    </TableCell>
                    <TableCell sx={{ color: '#8384A5', fontSize: '0.75rem', py: 1.5, whiteSpace: 'nowrap' }}>
                      {s.lastLogin ? fmtDate(s.lastLogin) : 'Never'}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip label={`${pageCount} pages`} size="small"
                          sx={{ bgcolor: 'rgba(136,108,255,0.12)', color: '#A08FFF', fontSize: '0.65rem', height: 18 }} />
                        <Chip label={`${authCount} actions`} size="small"
                          sx={{ bgcolor: 'rgba(14,204,104,0.12)', color: '#0ECC68', fontSize: '0.65rem', height: 18 }} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit Access">
                          <IconButton size="small" onClick={() => { setEditing(s); setDialogOpen(true); }}
                            sx={{ color: '#886CFF', bgcolor: 'rgba(136,108,255,0.08)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(136,108,255,0.18)' } }}>
                            <Edit sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Activity Log">
                          <IconButton size="small" onClick={() => setActivityTarget(s)}
                            sx={{ color: '#A08FFF', bgcolor: 'rgba(85,129,247,0.08)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(85,129,247,0.18)' } }}>
                            <HistoryIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Test Login">
                          <IconButton size="small" onClick={() => setTestLoginTarget(s)}
                            sx={{ color: '#0ECC68', bgcolor: 'rgba(14,204,104,0.08)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(14,204,104,0.18)' } }}>
                            <BugReport sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset Password">
                          <IconButton size="small" onClick={() => setPwdTarget(s)}
                            sx={{ color: '#FFC23F', bgcolor: 'rgba(255,194,63,0.08)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,194,63,0.18)' } }}>
                            <VpnKey sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={isLocked ? 'Unlock' : 'Lock'}>
                          <IconButton size="small" onClick={() => setLockTarget(s)}
                            sx={{ color: isLocked ? '#0ECC68' : '#E01B4F',
                              bgcolor: isLocked ? 'rgba(14,204,104,0.08)' : 'rgba(224,27,79,0.08)',
                              borderRadius: 1,
                              '&:hover': { bgcolor: isLocked ? 'rgba(14,204,104,0.18)' : 'rgba(224,27,79,0.18)' } }}>
                            {isLocked ? <LockOpen sx={{ fontSize: 15 }} /> : <Lock sx={{ fontSize: 15 }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderTop: '1px solid #1E2D55' }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)}
              sx={{ '& .MuiPaginationItem-root': { color: '#8384A5' },
                '& .Mui-selected': { bgcolor: '#886CFF !important', color: '#F9F9F9' } }} />
          </Box>
        )}
      </Card>

      <ExecutiveDialog
        open={dialogOpen}
        executive={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={(m) => { notify(m); fetchList(); }}
        onError={(m) => notify(m, 'error')}
      />

      <ResetPasswordDialog
        open={!!pwdTarget}
        executive={pwdTarget}
        onClose={() => setPwdTarget(null)}
        onSaved={(m) => { notify(m); fetchList(); }}
        onError={(m) => notify(m, 'error')}
      />

      <ActivityLogDialog
        open={!!activityTarget}
        executive={activityTarget}
        onClose={() => setActivityTarget(null)}
      />

      <Dialog open={!!lockTarget} onClose={() => { setLockTarget(null); setLockTxnPwd(''); }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#0E1831', border: '1px solid #1E2D55', borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #1E2D55', pb: 1.5 }}>
          {lockTarget?.status === 'locked'
            ? <LockOpen sx={{ color: '#0ECC68' }} />
            : <Lock sx={{ color: '#E01B4F' }} />}
          <Typography sx={{ color: '#F9F9F9', fontWeight: 700 }}>
            {lockTarget?.status === 'locked' ? 'Unlock' : 'Lock'} {lockTarget?.username}?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ color: '#8384A5', fontSize: '0.85rem' }}>
            {lockTarget?.status === 'locked'
              ? 'The executive will regain login access immediately.'
              : 'The executive will be signed out and unable to log in until you unlock them.'}
          </Typography>
          <TextField label="Transaction Password" type="password" size="small" fullWidth
            value={lockTxnPwd} onChange={e => setLockTxnPwd(e.target.value)} sx={inputSx} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1E2D55' }}>
          <Button onClick={() => { setLockTarget(null); setLockTxnPwd(''); }} sx={{ color: '#8384A5', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitLock} disabled={lockSaving}
            sx={{
              bgcolor: lockTarget?.status === 'locked' ? '#0ECC68' : '#E01B4F',
              '&:hover': { bgcolor: lockTarget?.status === 'locked' ? '#0BB858' : '#C0153F' },
              fontWeight: 700, textTransform: 'none',
            }}>
            {lockSaving ? 'Saving…' : lockTarget?.status === 'locked' ? 'Unlock' : 'Lock'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity}
          sx={{ bgcolor: snack.severity === 'success' ? '#0E2B1F' : snack.severity === 'error' ? '#2B0E1A' : '#0C0D1D',
            color: snack.severity === 'success' ? '#0ECC68' : snack.severity === 'error' ? '#E01B4F' : '#A08FFF',
            border: '1px solid currentColor' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AccessManagementTab;
