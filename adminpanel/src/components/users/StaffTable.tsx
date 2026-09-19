import React, { useMemo, useState } from 'react';
import {
  Box, Card, Typography, TextField, InputAdornment, Avatar, Chip, IconButton,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Skeleton,
} from '@mui/material';
import { Search, Refresh, PersonOff, Lock, Shield } from '@mui/icons-material';

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  country?: string;
  phone?: string;
  role_id: number;
  role_name: string;
  role_level: number;
  parent_id: string | null;
  parent_name: string | null;
  system_locked: boolean;
  sports_betlocked: boolean;
  created_at: string;
}

const C = {
  bg: '#0C0D1D', card: '#0E1831', cardLight: '#121E38', cardHover: '#162140',
  border: '#1E2D55', primary: '#886CFF', text: '#F9F9F9',
  textMuted: '#878AA2', textSecondary: '#8384A5',
  success: '#0ECC68', error: '#E01B4F', warning: '#FFC23F', info: '#A08FFF',
};

const avatarColor = (name: string) => {
  const colors = [C.primary, '#7B5EF5', C.success, C.warning, C.error, C.info];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const roleColor = (level: number) => {
  if (level === 0) return C.error;
  if (level === 1) return C.warning;
  if (level === 2) return '#7B5EF5';
  if (level === 3) return C.primary;
  if (level === 4) return C.info;
  return C.success;
};

interface Props {
  staff: StaffRow[];
  loading: boolean;
  title: string;
  onRefresh: () => void;
  onOpenRisk?: (staffId: string) => void;
}

const StaffTable: React.FC<Props> = ({ staff, loading, title, onRefresh, onOpenRisk }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const q = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => q
    ? staff.filter(s =>
        [s.id, s.name, s.email, s.phone, s.role_name, s.parent_name].filter(Boolean)
          .map(x => String(x).toLowerCase()).join(' ').includes(q))
    : staff, [staff, q]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const HEADER = onOpenRisk
    ? ['#', 'Staff', 'Risk', 'Email', 'ID', 'Role', 'Parent', 'Phone', 'Status', 'Created']
    : ['#', 'Staff', 'Email', 'ID', 'Role', 'Parent', 'Phone', 'Status', 'Created'];

  return (
    <Card sx={{ bgcolor: C.card, border: `1px solid ${C.border}`, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ color: C.text, fontWeight: 700, fontSize: '1rem' }}>
          {title}
          <Typography component="span" sx={{ ml: 1, color: C.textSecondary, fontWeight: 400, fontSize: '0.82rem' }}>
            ({filtered.length} results)
          </Typography>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by name, email, role…"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><Search sx={{ color: C.textSecondary, fontSize: 18 }} /></InputAdornment>) }}
            sx={{
              width: { xs: '100%', sm: 280 },
              '& .MuiOutlinedInput-root': {
                bgcolor: C.bg, borderRadius: 1.5,
                '& fieldset': { borderColor: C.border },
                '&:hover fieldset': { borderColor: C.primary },
                '&.Mui-focused fieldset': { borderColor: C.primary },
              },
              '& input': { color: C.text, fontSize: '0.85rem' },
            }}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} sx={{ color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 1.5, '&:hover': { color: C.primary, borderColor: C.primary } }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <TableContainer sx={{ borderTop: `1px solid ${C.border}` }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: C.bg }}>
              {HEADER.map((h, i) => (
                <TableCell key={i} sx={{ color: C.textSecondary, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${C.border}`, py: 1.5, whiteSpace: 'nowrap' }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {HEADER.map((_, j) => (
                  <TableCell key={j} sx={{ borderBottom: `1px solid ${C.border}33`, py: 1.5 }}>
                    <Skeleton variant="text" sx={{ bgcolor: C.border }} />
                  </TableCell>
                ))}
              </TableRow>
            )) : paginated.map((s, idx) => {
              const initials = s.name && s.name !== '—' ? s.name.slice(0, 2).toUpperCase() : '??';
              return (
                <TableRow key={`${s.id}-${idx}`} sx={{ '&:hover': { bgcolor: C.cardLight }, '& td': { borderBottom: `1px solid ${C.border}33` } }}>
                  <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5 }}>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 34, height: 34, fontSize: '0.72rem', fontWeight: 700, bgcolor: avatarColor(s.name || ''), flexShrink: 0 }}>{initials}</Avatar>
                      <Box>
                        <Typography sx={{ color: C.text, fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>{s.name}</Typography>
                        {s.country && <Typography sx={{ color: C.textSecondary, fontSize: '0.68rem' }}>{s.country}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  {onOpenRisk && (
                    <TableCell sx={{ py: 1.5 }}>
                      <Tooltip title="Risk management">
                        <IconButton size="small" onClick={() => onOpenRisk(s.id)} sx={{ color: C.textSecondary, '&:hover': { color: C.warning, bgcolor: `${C.warning}15` } }}>
                          <Shield fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                  <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5, maxWidth: 220 }}>
                    <Typography noWrap sx={{ fontSize: '0.78rem', color: C.textSecondary }}>{s.email}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography sx={{ color: C.info, fontSize: '0.72rem', fontFamily: 'monospace', bgcolor: 'rgba(136,108,255,0.08)', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block' }}>
                      {s.id}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      label={s.role_name}
                      size="small"
                      sx={{
                        bgcolor: `${roleColor(s.role_level)}22`,
                        color: roleColor(s.role_level),
                        fontWeight: 700, fontSize: '0.7rem', height: 20,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5, whiteSpace: 'nowrap' }}>
                    {s.parent_name || <Typography component="span" sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>—</Typography>}
                  </TableCell>
                  <TableCell sx={{ color: C.textSecondary, fontSize: '0.78rem', py: 1.5, whiteSpace: 'nowrap' }}>{s.phone || '—'}</TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    {s.system_locked ? (
                      <Chip icon={<Lock sx={{ fontSize: 12 }} />} label="Locked" size="small" sx={{ bgcolor: `${C.error}22`, color: C.error, fontWeight: 700, fontSize: '0.68rem', height: 20, '& .MuiChip-icon': { color: 'inherit' } }} />
                    ) : s.sports_betlocked ? (
                      <Chip label="Sports Lock" size="small" sx={{ bgcolor: `${C.warning}22`, color: C.warning, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                    ) : (
                      <Chip label="Active" size="small" sx={{ bgcolor: `${C.success}22`, color: C.success, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ color: C.textSecondary, fontSize: '0.75rem', py: 1.5, whiteSpace: 'nowrap' }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : '—'}
                  </TableCell>
                </TableRow>
              );
            })}

            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={HEADER.length} sx={{ py: 6, borderBottom: 'none' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <PersonOff sx={{ fontSize: 40, color: C.border }} />
                    <Typography sx={{ color: C.textSecondary, fontSize: '0.85rem' }}>No staff found</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 15, 25, 50]}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        sx={{
          color: C.textSecondary, borderTop: `1px solid ${C.border}`,
          '& .MuiTablePagination-select': { color: C.text },
          '& .MuiTablePagination-selectIcon': { color: C.textSecondary },
          '& .MuiIconButton-root': { color: C.textSecondary, '&:hover': { color: C.text }, '&.Mui-disabled': { color: C.border } },
        }}
      />
    </Card>
  );
};

export default StaffTable;
