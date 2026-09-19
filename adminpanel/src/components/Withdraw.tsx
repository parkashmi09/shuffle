/* =========================================================================
   Withdraw.tsx    – shows down-line Withdraws (INR)
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
  ArrowDownCircle,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetchPage, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import { Transfer, amountOf, formatAmount, dayOf, partyLabel } from "../services/transfers";

interface Pagination { page: number; size: number; }

/** A row with no timestamp still renders — it just has nothing to show here. */
const fmt = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd HH:mm:ss") : "—");

const cardSx = {
  bgcolor: "#0E1831",
  border: "1px solid #1E2D55",
  borderRadius: 2,
};

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

/* ----------------------------------------------------------------------- */
export default function Withdraw() {
  const [rows, setRows] = useState<Transfer[]>([]);
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState("");
  const [pg, setPg] = useState<Pagination>({ page: 1, size: 25 });

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  /* ---------------- fetch ---------------------------------------------- */
  const refetch = async () => {
    try {
      setLoad(true); setErr("");
      const uid = localStorage.getItem("currentUserId") || "";
      // See Deposit.tsx: `dir`/`page` are not declared by the service and were
      // dropped, so this list was neither filtered nor paged.
      const { data } = await apiFetchPage<Transfer>(
        uid ? buildPath(ENDPOINTS.staff.transfersFor, { staffId: uid }) : ENDPOINTS.staff.transfers,
        { query: { direction: "withdraw", limit: pg.size, offset: (pg.page - 1) * pg.size } }
      );
      setRows(data);
    } catch (e: any) { setErr(e.message || "Server error"); }
    finally { setLoad(false); }
  };
  useEffect(() => { refetch(); /* eslint-disable */ }, [pg.page]);

  /* ---------------- filter in memory ----------------------------------- */
  const view = useMemo(() => rows.filter(r => {
    if (q && !(String(r.from?.id) === q || String(r.to?.id) === q)) return false;
    const day = dayOf(r);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (min && amountOf(r) < +min) return false;
    if (max && amountOf(r) > +max) return false;
    return true;
  }), [rows, q, from, to, min, max]);

  const hasFilters = q || from || to || min || max;
  const clearFilters = () => { setQ(""); setFrom(""); setTo(""); setMin(""); setMax(""); };

  const thSx = {
    bgcolor: "#0B1427",
    color: "#8384A5",
    fontWeight: 700,
    fontSize: "0.72rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    borderBottom: "1px solid #1E2D55",
    whiteSpace: "nowrap" as const,
  };

  const tdSx = {
    color: "#C8CAE5",
    borderBottom: "1px solid #1E2D55",
    fontSize: "0.82rem",
    py: 1.5,
  };

  /* ---------------- render --------------------------------------------- */
  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: "rgba(224,27,79,0.15)", borderRadius: 2, display: "flex" }}>
            <ArrowDownCircle size={22} color="#E01B4F" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              Withdraw History
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              Down-line withdrawal transactions
            </Typography>
          </Box>
        </Box>
        <Button
          startIcon={<RefreshCw size={15} />}
          onClick={() => { setPg(p => ({ ...p, page: 1 })); refetch(); }}
          disabled={load}
          variant="outlined"
          size="small"
          sx={{
            borderColor: "#1E2D55",
            color: "#8384A5",
            textTransform: "none",
            "&:hover": { borderColor: "#886CFF", color: "#886CFF" },
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ ...cardSx, p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            placeholder="Search by ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search size={15} color="#8384A5" /></InputAdornment>
              ),
            }}
            sx={{ ...inputSx, minWidth: 160 }}
          />
          <TextField
            size="small"
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...inputSx, minWidth: 150 }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...inputSx, minWidth: 150 }}
          />
          <TextField
            size="small"
            placeholder="Min ₹"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            sx={{ ...inputSx, width: 110 }}
          />
          <TextField
            size="small"
            placeholder="Max ₹"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            sx={{ ...inputSx, width: 110 }}
          />
          {hasFilters && (
            <Button
              size="small"
              startIcon={<X size={14} />}
              onClick={clearFilters}
              sx={{
                color: "#8384A5",
                border: "1px solid #1E2D55",
                textTransform: "none",
                whiteSpace: "nowrap",
                "&:hover": { borderColor: "#E01B4F", color: "#E01B4F" },
              }}
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
                <TableCell sx={thSx}>From</TableCell>
                <TableCell sx={thSx}>To</TableCell>
                <TableCell sx={thSx}>Amount (₹)</TableCell>
                <TableCell sx={thSx}>Date & Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {load ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((_, j) => (
                      <TableCell key={j} sx={tdSx}>
                        <Skeleton variant="text" width={j === 1 || j === 2 ? 140 : 80} sx={{ bgcolor: "#162140" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : err ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 5, borderBottom: "none" }}>
                    <Typography color="error">{err}</Typography>
                  </TableCell>
                </TableRow>
              ) : view.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 5, borderBottom: "none" }}>
                    <ArrowDownCircle size={36} color="#1E2D55" />
                    <Typography sx={{ color: "#8384A5", mt: 1 }}>No withdrawals found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                view.map((r) => (
                  <TableRow key={r.id} sx={{ "&:hover": { bgcolor: "rgba(136,108,255,0.04)" }, transition: "background 150ms" }}>
                    <TableCell sx={tdSx}>
                      <Typography sx={{ color: "#A08FFF", fontWeight: 600, fontSize: "0.8rem" }}>#{r.id}</Typography>
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
                      <Chip
                        label={formatAmount(r)}
                        size="small"
                        sx={{
                          bgcolor: "rgba(224,27,79,0.12)",
                          color: "#E01B4F",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          fontFamily: "monospace",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...tdSx, color: "#8384A5" }}>
                      {fmt(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #1E2D55",
          }}
        >
          <Typography variant="caption" sx={{ color: "#8384A5" }}>
            Page {pg.page} · {view.length} record{view.length !== 1 ? "s" : ""}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Previous page">
              <span>
                <IconButton
                  size="small"
                  disabled={pg.page === 1}
                  onClick={() => setPg(p => ({ ...p, page: p.page - 1 }))}
                  sx={{ color: "#8384A5", border: "1px solid #1E2D55", "&:hover": { borderColor: "#886CFF", color: "#886CFF" }, "&:disabled": { opacity: 0.3 } }}
                >
                  <ChevronLeft size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" sx={{ color: "#8384A5", px: 1 }}>
              {pg.page}
            </Typography>
            <Tooltip title="Next page">
              <IconButton
                size="small"
                onClick={() => setPg(p => ({ ...p, page: p.page + 1 }))}
                sx={{ color: "#8384A5", border: "1px solid #1E2D55", "&:hover": { borderColor: "#886CFF", color: "#886CFF" } }}
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
