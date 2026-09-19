import React, { useState } from 'react';
import {
  Dialog, DialogContent, Box, Typography, IconButton, Button, TextField,
  Stack, CircularProgress, Chip,
} from '@mui/material';
import { Assessment, Close, Download } from '@mui/icons-material';
import { API_BASE_URL, buildPath } from '../../utils/api';
import { ENDPOINTS } from '../../services/endpoints';

const C = {
  card: '#0E1831', border: '#1E2D55', primary: '#886CFF', primaryHover: '#9B82FF',
  text: '#F9F9F9', textMuted: '#8384A5', input: '#10182E', success: '#0ECC68', error: '#E01B4F',
};
const BASE = API_BASE_URL;

type Preset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';

const iso = (d: Date) => d.toISOString();
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

interface Props {
  open: boolean;
  userId: string | null;
  userName: string | null;
  onClose: () => void;
}

const PlayerReportDialog: React.FC<Props> = ({ open, userId, userName, onClose }) => {
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the selected preset into ISO from/to (undefined = open-ended).
  const resolveRange = (): { from?: string; to?: string } => {
    const now = new Date();
    switch (preset) {
      case 'all': return {};
      case 'today': return { from: iso(startOfDay(now)), to: iso(now) };
      case '7d': { const f = startOfDay(now); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(now) }; }
      case '30d': { const f = startOfDay(now); f.setDate(f.getDate() - 29); return { from: iso(f), to: iso(now) }; }
      case 'month': { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: iso(f), to: iso(now) }; }
      case 'custom': return {
        from: from ? iso(new Date(from)) : undefined,
        to: to ? iso(new Date(to + 'T23:59:59')) : undefined,
      };
    }
  };

  const download = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const range = resolveRange();
      const qs = new URLSearchParams();
      if (range.from) qs.set('from', range.from);
      if (range.to) qs.set('to', range.to);
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE}${buildPath(ENDPOINTS.reports.playerSheet, { uid: userId })}?${qs.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        let msg = `Failed (${res.status})`;
        try { msg = (await res.json()).error || msg; } catch { /* non-json */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safe = (userName || 'player').replace(/[^a-z0-9]+/gi, '_');
      a.download = `Player_${safe}_${userId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not generate the report');
    } finally {
      setLoading(false);
    }
  };

  const presets: { key: Preset; label: string }[] = [
    { key: 'all', label: 'All time' },
    { key: 'today', label: 'Today' },
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom range' },
  ];

  const inputSx = {
    '& .MuiInputBase-root': { bgcolor: C.input, color: C.text, fontSize: '0.82rem' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
    '& .MuiInputLabel-root': { color: C.textMuted, fontSize: '0.82rem' },
    '& .MuiSvgIcon-root': { color: C.textMuted },
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 } }}>
      <DialogContent sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${C.border}` }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Assessment sx={{ color: C.primary, fontSize: 20 }} />
            <Box>
              <Typography sx={{ color: C.text, fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.2 }}>Player Report</Typography>
              {userName && <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>{userName} · UID {userId}</Typography>}
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} disabled={loading} sx={{ color: C.textMuted }}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
            Report period
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {presets.map(p => (
              <Chip key={p.key} label={p.label} onClick={() => setPreset(p.key)}
                sx={{
                  bgcolor: preset === p.key ? C.primary : C.input,
                  color: preset === p.key ? '#fff' : C.textMuted,
                  border: `1px solid ${preset === p.key ? C.primary : C.border}`,
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  '&:hover': { bgcolor: preset === p.key ? C.primaryHover : '#162140' },
                }} />
            ))}
          </Box>

          {preset === 'custom' && (
            <Stack direction="row" gap={1} sx={{ mb: 2 }}>
              <TextField type="date" size="small" label="From" value={from}
                onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ ...inputSx, flex: 1 }} />
              <TextField type="date" size="small" label="To" value={to}
                onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ ...inputSx, flex: 1 }} />
            </Stack>
          )}

          <Typography sx={{ color: C.textMuted, fontSize: '0.72rem', mb: 2 }}>
            Generates a PDF with account summary, overall / daily / weekly P&amp;L, casino P&amp;L trajectory,
            game-by-game win/loss and full sports-bet detail.
          </Typography>

          {error && (
            <Box sx={{ mb: 1.5, p: 1.25, bgcolor: '#2B0E1A', border: `1px solid ${C.error}`, borderRadius: 1 }}>
              <Typography sx={{ color: C.error, fontSize: '0.78rem' }}>{error}</Typography>
            </Box>
          )}

          <Button fullWidth variant="contained" onClick={download} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Download />}
            sx={{ bgcolor: C.primary, textTransform: 'none', fontWeight: 700, fontSize: '0.85rem', py: 1, '&:hover': { bgcolor: C.primaryHover } }}>
            {loading ? 'Generating…' : 'Download PDF'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerReportDialog;
