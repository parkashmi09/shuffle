import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  IconButton,
  Alert,
  Stack,
  Chip,
  TablePagination,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import { Gamepad, Search, Trash2, RefreshCw } from "lucide-react";
import { apiFetch, apiFetchPage } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/** Short, locale-stable timestamp for the table. */
const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/**
 * A bet as `GET /admin/sports/bet-admin/bets` shapes it.
 *
 * ── THIS IS NOT THE `sports_bets` ROW ───────────────────────────────────
 *
 * The monolith returned the row, so this screen was written against column
 * names: `match_title`, `selection_name`, `bet_type`, `stake_amount`,
 * `result_status`. sports-service shapes it — `matchTitle`, `selection`,
 * `side`, `stake`, `resultStatus` — and there is no `team_one`/`team_two`,
 * `category` or `usd_amount` on the staff payload at all. Every one of those
 * reads was `undefined`, and `bet.stake_amount.toFixed(2)` on `undefined`
 * throws, so a non-empty list would have blanked the table outright.
 */
interface SportsBet {
  id: number;
  username: string | null;
  userId: number;
  matchId: string;
  matchTitle: string;
  gameType: string;
  selection: string;
  side: string;
  odds: string;
  stake: string;
  liability: string;
  status: string;
  resultStatus: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Filters {
  status: string;
  gameResult: string;
  startDate: string;
  endDate: string;
  currency: string;
}

const Result_TYPES = [
  { value: "won", label: "Won" },
  { value: "loss", label: "Loss" },
  { value: "pending", label: "Pending" },
];

// The three values "SportsBet".status holds. `manual` is a market parked for a
// human to settle — a bet in it is neither open to the player nor paid out.
const STATUS_TYPES = [
  { value: "open", label: "Open" },
  { value: "manual", label: "Manual" },
  { value: "closed", label: "Closed" },
];

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

const selectSx = {
  bgcolor: "#0B1427",
  color: "#F9F9F9",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
  "& .MuiSvgIcon-root": { color: "#8384A5" },
};

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

const getResultChip = (status: string) => {
  const s = status?.toLowerCase();
  if (s === "won") return { bgcolor: "rgba(14,204,104,0.12)", color: "#0ECC68" };
  if (s === "loss" || s === "lost") return { bgcolor: "rgba(224,27,79,0.12)", color: "#E01B4F" };
  return { bgcolor: "rgba(255,194,63,0.12)", color: "#FFC23F" };
};

const getStatusChip = (status: string) => {
  const s = status?.toLowerCase();
  if (s === "open") return { bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF" };
  if (s === "closed") return { bgcolor: "rgba(131,132,165,0.12)", color: "#8384A5" };
  return { bgcolor: "rgba(255,194,63,0.12)", color: "#FFC23F" };
};

const SportsBetting = () => {
  const [bets, setBets] = useState<SportsBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBetId, setSelectedBetId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: "",
    gameResult: "",
    startDate: "",
    endDate: "",
    currency: "usd",
  });

  /**
   * Fetch one page of bets.
   *
   * ── WHAT THE ENDPOINT ACTUALLY ACCEPTS ──────────────────────────────
   *
   * `limit`/`offset`, plus `status`, `userId`, `matchId`, `gameType`, `from`
   * and `to`. The `page`, `gameResult`, `search`, `startDate`, `endDate` and
   * `currency` parameters this screen used to send are not in the schema and
   * were STRIPPED server-side — so those filter controls appeared to work and
   * changed nothing. The date pair maps onto `from`/`to`; result and free-text
   * search have no server-side equivalent, so they are applied to the page in
   * hand and labelled as such.
   *
   * Auth is the staff TOKEN, via `apiFetchPage`. The `x-staff-id` header this
   * used to send is what legacy authenticated on — the caller naming its own
   * authority — and the route ignores it now.
   */
  const fetchBets = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, pagination } = await apiFetchPage<SportsBet>(ENDPOINTS.sportsBetAdmin.bets, {
        query: {
          limit: rowsPerPage,
          offset: page * rowsPerPage,
          ...(filters.status && { status: filters.status }),
          ...(filters.startDate && { from: new Date(filters.startDate).toISOString() }),
          ...(filters.endDate && { to: new Date(`${filters.endDate}T23:59:59`).toISOString() }),
        },
      });

      setBets(data);
      setTotalCount(pagination?.total ?? data.length);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch bets");
      setBets([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, filters]);

  /**
   * Void a bet — refund the stake and release the exposure.
   *
   * `POST /settlement/void-bet` with `{bet_id}`. This used to send DELETE, and
   * then PUT for the status dropdown, to a route that is POST-only and NAMES
   * THE BET IN THE BODY — so neither carried the id and neither could have
   * done anything but 404.
   */
  const handleDelete = async () => {
    if (!selectedBetId) return;
    try {
      await apiFetch(ENDPOINTS.sportsSettlement.voidBet, {
        method: "POST",
        body: { bet_id: selectedBetId },
      });
      setDeleteDialogOpen(false);
      setSelectedBetId(null);
      fetchBets();
    } catch (err: any) {
      setError(err?.message || "Failed to void bet");
    }
  };

  /**
   * Result and free-text search, applied client-side.
   *
   * Neither is a server-side filter on this endpoint — see `fetchBets` — so
   * they narrow the page in hand rather than the query. Doing it here at least
   * makes the controls do what they say for the rows on screen.
   */
  const visibleBets = bets.filter((bet) => {
    if (filters.gameResult && (bet.resultStatus ?? "pending") !== filters.gameResult) return false;
    if (!searchTerm) return true;
    const needle = searchTerm.toLowerCase();
    return [bet.username, bet.matchTitle, bet.selection, bet.matchId]
      .some((v) => String(v ?? "").toLowerCase().includes(needle));
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: "rgba(136,108,255,0.15)", borderRadius: 2, display: "flex" }}>
            <Gamepad size={22} color="#886CFF" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              Sports Betting
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              {totalCount} total bets
            </Typography>
          </Box>
        </Box>
        <Button
          startIcon={<RefreshCw size={15} />}
          onClick={fetchBets}
          disabled={loading}
          variant="outlined"
          size="small"
          sx={{ borderColor: "#1E2D55", color: "#8384A5", textTransform: "none", "&:hover": { borderColor: "#886CFF", color: "#886CFF" } }}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ ...cardSx, p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search bets…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search size={15} color="#8384A5" /></InputAdornment>
              ),
            }}
            sx={{ ...inputSx, flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: "#8384A5", "&.Mui-focused": { color: "#886CFF" } }}>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              sx={selectSx}
            >
              <MenuItem value="" sx={{ color: "#F9F9F9" }}>All Status</MenuItem>
              {STATUS_TYPES.map(s => (
                <MenuItem key={s.value} value={s.value} sx={{ color: "#F9F9F9" }}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ color: "#8384A5", "&.Mui-focused": { color: "#886CFF" } }}>Result</InputLabel>
            <Select
              value={filters.gameResult}
              label="Result"
              onChange={(e) => setFilters({ ...filters, gameResult: e.target.value })}
              sx={selectSx}
            >
              <MenuItem value="" sx={{ color: "#F9F9F9" }}>All Results</MenuItem>
              {Result_TYPES.map(r => (
                <MenuItem key={r.value} value={r.value} sx={{ color: "#F9F9F9" }}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="date"
            label="Start Date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ ...inputSx, minWidth: 150 }}
          />
          <TextField
            type="date"
            label="End Date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ ...inputSx, minWidth: 150 }}
          />
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2, bgcolor: "rgba(224,27,79,0.1)", color: "#E01B4F", border: "1px solid rgba(224,27,79,0.3)", "& .MuiAlert-icon": { color: "#E01B4F" } }}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <Paper sx={{ ...cardSx, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>User</TableCell>
                <TableCell sx={thSx}>Match</TableCell>
                <TableCell sx={thSx}>Type</TableCell>
                <TableCell sx={thSx}>Selection</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Odds</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Stake</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={thSx}>Result</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "center" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(9)].map((_, j) => (
                      <TableCell key={j} sx={tdSx}>
                        <Skeleton variant="text" width={j === 1 ? 140 : 80} sx={{ bgcolor: "#162140" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleBets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: "center", py: 6, borderBottom: "none" }}>
                    <Gamepad size={40} color="#1E2D55" />
                    <Typography sx={{ color: "#8384A5", mt: 1 }}>No bets found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                visibleBets.map((bet) => {
                  const rc = getResultChip(bet.resultStatus ?? "");
                  return (
                    <TableRow key={bet.id} sx={{ "&:hover": { bgcolor: "rgba(136,108,255,0.04)" }, transition: "background 150ms" }}>
                      <TableCell sx={tdSx}>
                        <Typography sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 500 }}>{bet.username ?? `#${bet.userId}`}</Typography>
                        <Typography variant="caption" sx={{ color: "#A08FFF" }}>#{bet.userId}</Typography>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Typography sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 500 }}>{bet.matchTitle}</Typography>
                        <Typography variant="caption" sx={{ color: "#8384A5" }}>{bet.matchId}</Typography>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Typography sx={{ color: "#C8CAE5", fontSize: "0.82rem" }}>{bet.gameType}</Typography>
                        <Typography variant="caption" sx={{ color: "#8384A5" }}>{fmtDate(bet.createdAt)}</Typography>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Typography sx={{ color: "#C8CAE5", fontSize: "0.82rem" }}>{bet.selection}</Typography>
                        <Typography variant="caption" sx={{ color: "#8384A5" }}>{bet.side}</Typography>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "right", fontFamily: "monospace" }}>{bet.odds}</TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "right" }}>
                        <Chip
                          label={`₹ ${Number(bet.stake).toFixed(2)}`}
                          size="small"
                          sx={{ bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF", fontWeight: 600, fontSize: "0.72rem", fontFamily: "monospace" }}
                        />
                      </TableCell>
                      <TableCell sx={tdSx}>
                        {/* Read-only: a bet's status is settlement's to change, and
                            there is no endpoint that sets it directly. */}
                        <Chip
                          label={bet.status}
                          size="small"
                          sx={{ ...getStatusChip(bet.status), fontWeight: 600, fontSize: "0.7rem", height: 22 }}
                        />
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Chip
                          label={bet.resultStatus || "pending"}
                          size="small"
                          sx={{ ...rc, fontWeight: 600, fontSize: "0.7rem", height: 22 }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "center" }}>
                        <Tooltip title="Void bet">
                          <IconButton
                            size="small"
                            onClick={() => { setSelectedBetId(bet.id); setDeleteDialogOpen(true); }}
                            sx={{ color: "#8384A5", "&:hover": { color: "#E01B4F", bgcolor: "rgba(224,27,79,0.1)" } }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          sx={{
            borderTop: "1px solid #1E2D55",
            color: "#8384A5",
            "& .MuiTablePagination-selectIcon": { color: "#8384A5" },
            "& .MuiTablePagination-select": { color: "#F9F9F9" },
            "& .MuiIconButton-root": { color: "#8384A5" },
            "& .MuiIconButton-root.Mui-disabled": { color: "#1E2D55" },
          }}
        />
      </Paper>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 3, minWidth: 360 } }}
      >
        <DialogTitle sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55", display: "flex", alignItems: "center", gap: 1 }}>
          <Trash2 size={18} color="#E01B4F" />
          Confirm Void
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ color: "#8384A5" }}>
            Void this bet? The stake is refunded and the exposure released. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ flex: 1, color: "#8384A5", border: "1px solid #1E2D55", textTransform: "none", "&:hover": { borderColor: "#8384A5" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            sx={{ flex: 1, bgcolor: "#E01B4F", textTransform: "none", "&:hover": { bgcolor: "#c4164a" } }}
          >
            Void
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SportsBetting;
