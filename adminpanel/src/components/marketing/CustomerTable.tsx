import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, TextField, InputAdornment, Pagination, Skeleton,
  Alert, MenuItem, Tooltip as MuiTooltip, alpha,
} from '@mui/material';
import { Search, PersonOutline, HelpOutline } from '@mui/icons-material';
import { C } from '../admin-dashboard/shared';
import { fetchCustomers, Customer, CustomerQuery } from '../../services/marketingApi';

const fmtUsd = (v: number) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

interface Props {
  /** Base filter for this view. Callers pass channel and any range narrowing. */
  query: Omit<CustomerQuery, 'page' | 'search' | 'sort'>;
  /** Show the agent column — only meaningful for agent-acquired customers. */
  showAgent?: boolean;
  /** Compact mode for use inside a modal. */
  dense?: boolean;
  pageSize?: number;
}

const CustomerTable: React.FC<Props> = ({ query, showAgent = false, dense = false, pageSize = 25 }) => {
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<'recent' | 'deposits' | 'name'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialise the caller's filter so the effect re-runs when it genuinely
  // changes, rather than on every parent render (object identity churn).
  const queryKey = JSON.stringify(query);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCustomers({
        ...(JSON.parse(queryKey) as CustomerQuery),
        page, search, sort, limit: pageSize,
      });
      setRows(res.customers);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e: any) {
      setError(e?.message || 'Could not load customers.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryKey, page, search, sort, pageSize]);

  useEffect(() => { load(); }, [load]);

  // Debounce typing so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // A new base filter invalidates the current page number.
  useEffect(() => { setPage(1); }, [queryKey]);

  const cell = { borderColor: C.border, whiteSpace: 'nowrap' as const };

  const columns = [
    'Customer', 'Contact', 'Location', ...(showAgent ? ['Agent'] : []),
    'Signed up', 'Last login', 'Deposits', 'Status',
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search name, email, phone or ID"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 260, flex: dense ? 1 : 'unset' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search sx={{ fontSize: 18, color: C.textMuted }} /></InputAdornment>
            ),
          }}
        />
        <TextField
          size="small" select value={sort}
          onChange={(e) => { setPage(1); setSort(e.target.value as any); }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="recent">Newest first</MenuItem>
          <MenuItem value="deposits">Highest deposits</MenuItem>
          <MenuItem value="name">Name (A–Z)</MenuItem>
        </TextField>

        <Typography sx={{ color: C.textSecondary, fontSize: '0.8rem', ml: 'auto' }}>
          {loading ? 'Loading…' : `${total.toLocaleString()} customer${total === 1 ? '' : 's'}`}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2, bgcolor: alpha(C.error, 0.12), color: C.text }}>
          {error}
        </Alert>
      )}

      <TableContainer
        sx={{
          border: `1px solid ${C.border}`, borderRadius: 2, overflowX: 'auto',
          maxHeight: dense ? 420 : 'unset',
        }}
      >
        <Table size="small" stickyHeader={dense}>
          <TableHead>
            <TableRow>
              {columns.map((h) => (
                <TableCell
                  key={h}
                  align={h === 'Deposits' ? 'right' : 'left'}
                  sx={{ ...cell, bgcolor: C.cardLight, color: C.textMuted, fontWeight: 700, fontSize: '0.72rem' }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c} sx={cell}>
                      <Skeleton sx={{ bgcolor: C.cardHover }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ ...cell, py: 5, textAlign: 'center' }}>
                  <PersonOutline sx={{ fontSize: 34, color: C.textMuted, opacity: 0.5 }} />
                  <Typography sx={{ color: C.textMuted, fontSize: '0.85rem', mt: 1 }}>
                    No customers match this view.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id} hover sx={{ '&:hover': { bgcolor: C.cardHover } }}>
                  <TableCell sx={cell}>
                    <Typography sx={{ color: C.text, fontWeight: 600, fontSize: '0.83rem' }}>
                      {c.name || '—'}
                    </Typography>
                    <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>
                      ID {c.id}
                    </Typography>
                  </TableCell>

                  <TableCell sx={cell}>
                    <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>
                      {c.email || '—'}
                    </Typography>
                    <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                      {c.phone || 'No phone'}
                    </Typography>
                  </TableCell>

                  <TableCell sx={cell}>
                    <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>
                      {c.country || '—'}
                    </Typography>
                    <Typography sx={{ color: C.textMuted, fontSize: '0.72rem' }}>
                      {c.lastIp || '—'}
                    </Typography>
                  </TableCell>

                  {showAgent && (
                    <TableCell sx={cell}>
                      {c.agent ? (
                        <>
                          <Typography sx={{ color: C.text, fontSize: '0.78rem', fontWeight: 600 }}>
                            {c.agent.name}
                          </Typography>
                          <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>
                            {c.agent.code} · {c.agent.role}
                          </Typography>
                        </>
                      ) : '—'}
                    </TableCell>
                  )}

                  <TableCell sx={cell}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ color: C.textSecondary, fontSize: '0.78rem' }}>
                        {fmtDate(c.createdAt)}
                      </Typography>
                      {/* The real signup date was never recorded for these rows;
                          say so rather than present an estimate as fact. */}
                      {c.createdEstimated && (
                        <MuiTooltip title="Estimated — the original signup date was not recorded">
                          <HelpOutline sx={{ fontSize: 13, color: C.warning }} />
                        </MuiTooltip>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell sx={{ ...cell, color: C.textMuted, fontSize: '0.75rem' }}>
                    {fmtDateTime(c.lastLoginAt)}
                  </TableCell>

                  <TableCell align="right" sx={cell}>
                    <Typography sx={{ color: c.depositVolume > 0 ? C.success : C.textMuted, fontWeight: 700, fontSize: '0.8rem' }}>
                      {fmtUsd(c.depositVolume)}
                    </Typography>
                    <Typography sx={{ color: C.textMuted, fontSize: '0.7rem' }}>
                      {c.depositCount} deposit{c.depositCount === 1 ? '' : 's'}
                    </Typography>
                  </TableCell>

                  <TableCell sx={cell}>
                    <Chip
                      size="small"
                      label={c.status}
                      sx={{
                        textTransform: 'capitalize', fontWeight: 700, fontSize: '0.66rem', height: 20,
                        bgcolor: alpha(c.status === 'active' ? C.success : C.error, 0.14),
                        color: c.status === 'active' ? C.success : C.error,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} size="small" />
        </Box>
      )}
    </Box>
  );
};

export default CustomerTable;
