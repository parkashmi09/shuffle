/* =========================================================================
   AccountStatement.tsx – All agent-system transfers (staff ↔ staff/user)
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Chip,
  InputAdornment,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  X,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetchPage, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import { Transfer, amountOf, formatAmount, dayOf, partyLabel } from "../services/transfers";

interface Pagination { page: number; size: number; }

/** A row with no timestamp still renders — it just has nothing to show here. */
const fmt = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd HH:mm:ss") : "—");

const cardSx = { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 };

const inputSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#0B1427",
    "& fieldset": { borderColor: "#1E2D55" },
    "&:hover fieldset": { borderColor: "#886CFF" },
    "&.Mui-focused fieldset": { borderColor: "#886CFF" },
  },
  "& input": { color: "#F9F9F9" },
  "& .MuiInputLabel-root": { color: "#8384A5" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#886CFF" },
};

const thSx = {
  bgcolor: "#0B1427", color: "#8384A5", fontWeight: 700, fontSize: "0.72rem",
  textTransform: "uppercase" as const, letterSpacing: "0.06em",
  borderBottom: "1px solid #1E2D55", whiteSpace: "nowrap" as const,
};

const tdSx = { color: "#C8CAE5", borderBottom: "1px solid #1E2D55", fontSize: "0.82rem", py: 1.5 };

export default function AccountStatement() {
  const [rows, setRows] = useState<Transfer[]>([]);
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState("");
  const [pg, setPg] = useState<Pagination>({ page: 1, size: 50 });

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const refetch = async () => {
    try {
      setLoad(true); setErr("");
      const uid = localStorage.getItem("currentUserId") || "";
      // See Deposit.tsx: `page` is not declared by the service — it takes
      // `offset` — so every page returned the first `limit` rows.
      const { data } = await apiFetchPage<Transfer>(
        uid ? buildPath(ENDPOINTS.staff.transfersFor, { staffId: uid }) : ENDPOINTS.staff.transfers,
        { query: { limit: pg.size, offset: (pg.page - 1) * pg.size } }
      );
      setRows(data);
    } catch (e: any) { setErr(e.message || "Server error"); }
    finally { setLoad(false); }
  };
  useEffect(() => { refetch(); }, [pg.page]);

  const view = useMemo(() => rows.filter(r => {
    const nameMatch = q.toLowerCase();
    if (q && !(
      String(r.from?.id ?? "").includes(q) ||
      String(r.to?.id ?? "").includes(q) ||
      (r.from?.name || "").toLowerCase().includes(nameMatch) ||
      (r.to?.name || "").toLowerCase().includes(nameMatch)
    )) return false;
    const day = dayOf(r);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (min && amountOf(r) < +min) return false;
    if (max && amountOf(r) > +max) return false;
    return true;
  }), [rows, q, from, to, min, max]);

  const hasFilters = q || from || to || min || max;
  const clearFilters = () => { setQ(""); setFrom(""); setTo(""); setMin(""); setMax(""); };

  const dirChip = (r: Transfer) => {
    const fromType = r.from?.type;
    const toType = r.to?.type;
    if (fromType === "staff" && toType === "user") {
      return { label: "Credit to User", color: "#0ECC68", bg: "rgba(14,204,104,0.12)" };
    }
    if (fromType === "staff" && toType === "staff") {
      return { label: "Staff → Staff", color: "#886CFF", bg: "rgba(136,108,255,0.12)" };
    }
    if (fromType === "user" && toType === "staff") {
      return { label: "Debit from User", color: "#E01B4F", bg: "rgba(224,27,79,0.12)" };
    }
    return { label: "Transfer", color: "#FFC23F", bg: "rgba(255,194,63,0.12)" };
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: "rgba(136,108,255,0.15)", borderRadius: 2, display: "flex" }}>
            <FileText size={22} color="#886CFF" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              Account Statement
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              All agent system transactions (staff & user transfers)
            </Typography>
          </Box>
        </Box>
        <Button
          startIcon={<RefreshCw size={15} />}
          onClick={() => { setPg(p => ({ ...p, page: 1 })); refetch(); }}
          disabled={load}
          variant="outlined"
          size="small"
          sx={{ borderColor: "#1E2D55", color: "#8384A5", textTransform: "none", "&:hover": { borderColor: "#886CFF", color: "#886CFF" } }}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ ...cardSx, p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField size="small" placeholder="Search name or ID..." value={q} onChange={e => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={15} color="#8384A5" /></InputAdornment> }}
            sx={{ ...inputSx, minWidth: 180 }}
          />
          <TextField size="small" type="date" label="From" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ ...inputSx, minWidth: 150 }} />
          <TextField size="small" type="date" label="To" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ ...inputSx, minWidth: 150 }} />
          <TextField size="small" placeholder="Min ₹" value={min} onChange={e => setMin(e.target.value)} sx={{ ...inputSx, width: 110 }} />
          <TextField size="small" placeholder="Max ₹" value={max} onChange={e => setMax(e.target.value)} sx={{ ...inputSx, width: 110 }} />
          {hasFilters && (
            <Button size="small" startIcon={<X size={14} />} onClick={clearFilters}
              sx={{ color: "#8384A5", border: "1px solid #1E2D55", textTransform: "none", whiteSpace: "nowrap", "&:hover": { borderColor: "#E01B4F", color: "#E01B4F" } }}
            >
              Clear
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ ...cardSx, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>ID</TableCell>
                <TableCell sx={thSx}>Date & Time</TableCell>
                <TableCell sx={thSx}>From</TableCell>
                <TableCell sx={thSx}>To</TableCell>
                <TableCell sx={thSx}>Type</TableCell>
                <TableCell sx={thSx} align="right">Amount (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {load ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j} sx={tdSx}><Skeleton variant="text" width={j === 2 || j === 3 ? 140 : 80} sx={{ bgcolor: "#162140" }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : err ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 5, borderBottom: "none" }}>
                    <Typography color="error">{err}</Typography>
                  </TableCell>
                </TableRow>
              ) : view.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6, borderBottom: "none" }}>
                    <FileText size={36} color="#1E2D55" />
                    <Typography sx={{ color: "#8384A5", mt: 1 }}>No transactions found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                view.map(r => {
                  const chip = dirChip(r);
                  return (
                    <TableRow key={r.id} sx={{ "&:hover": { bgcolor: "rgba(136,108,255,0.04)" }, transition: "background 150ms" }}>
                      <TableCell sx={tdSx}>
                        <Typography sx={{ color: "#A08FFF", fontWeight: 600, fontSize: "0.8rem" }}>#{r.id}</Typography>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, color: "#8384A5", whiteSpace: "nowrap" }}>
                        {fmt(r.createdAt)}
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Box>
                          <Typography sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 500 }}>
                            {partyLabel(r.from).name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#8384A5" }}>
                            {partyLabel(r.from).ref}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Box>
                          <Typography sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 500 }}>
                            {partyLabel(r.to).name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#8384A5" }}>
                            {partyLabel(r.to).ref}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Chip label={chip.label} size="small"
                          sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, fontSize: "0.72rem", border: `1px solid ${chip.color}33` }}
                        />
                      </TableCell>
                      <TableCell sx={tdSx} align="right">
                        <Typography sx={{ color: "#FFC23F", fontWeight: 700, fontSize: "0.85rem", fontFamily: "monospace" }}>
                          {formatAmount(r)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1E2D55" }}>
          <Typography variant="caption" sx={{ color: "#8384A5" }}>
            Page {pg.page} · {view.length} record{view.length !== 1 ? "s" : ""}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Previous page">
              <span>
                <IconButton size="small" disabled={pg.page === 1} onClick={() => setPg(p => ({ ...p, page: p.page - 1 }))}
                  sx={{ color: "#8384A5", border: "1px solid #1E2D55", "&:hover": { borderColor: "#886CFF", color: "#886CFF" }, "&:disabled": { opacity: 0.3 } }}
                >
                  <ChevronLeft size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" sx={{ color: "#8384A5", px: 1 }}>{pg.page}</Typography>
            <Tooltip title="Next page">
              <IconButton size="small" onClick={() => setPg(p => ({ ...p, page: p.page + 1 }))}
                disabled={view.length < pg.size}
                sx={{ color: "#8384A5", border: "1px solid #1E2D55", "&:hover": { borderColor: "#886CFF", color: "#886CFF" }, "&:disabled": { opacity: 0.3 } }}
              >
                <ChevronRight size={16} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
