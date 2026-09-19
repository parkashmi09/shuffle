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
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Tooltip,
  InputAdornment,
  Stack,
  Select,
  MenuItem,
  FormControl,
  Avatar,
} from "@mui/material";
import {
  Search,
  RefreshCw,
  Pencil,
  Lock,
  Unlock,
  TrendingUp,
  KeyRound,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { api, apiFetchPage, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

interface WagerRow {
  id: number;
  name: string;
  email: string;
  wager: number;
  total_deposit: number;
  target: number;
  target_percentage: number;
  wager_multiplier?: number;
  is_locked?: boolean;
}

/** One row as user-service shapes it — decimals are exact strings on the wire. */
interface WagerApiRow {
  userId: number;
  username: string | null;
  email: string | null;
  multiplier: string;
  locked: boolean;
  totalDeposited: string;
  target: string;
  wagered: string;
  remaining: string;
  percentage: string;
  met: boolean;
}

/** The validator's ceiling. The table filters and sorts client-side. */
const PAGE_LIMIT = 200;

const fmtAmt = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(n);
};

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

const cardSx = {
  bgcolor: "#0E1831",
  border: "1px solid #1E2D55",
  borderRadius: 2,
};

export default function UserWagerReports() {
  const [rows, setRows] = useState<WagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<keyof WagerRow>("target_percentage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [globalTargetX, setGlobalTargetX] = useState<number>(3);
  const [editingUser, setEditingUser] = useState<WagerRow | null>(null);
  const [userTargetX, setUserTargetX] = useState<number>(3);
  const pageSize = 10;

  const columns = [
    { key: "id", label: "User ID" },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "wager", label: "Wager" },
    { key: "total_deposit", label: "Total Deposit" },
    { key: "target", label: "Target" },
    { key: "target_percentage", label: "% Achieved" },
  ] as const;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiFetchPage<WagerApiRow>(ENDPOINTS.wager.list, {
        query: { limit: PAGE_LIMIT },
      });
      setRows(data.map((r) => ({
        id: r.userId,
        name: r.username ?? "—",
        email: r.email ?? "—",
        // Exact decimal strings on the wire; the table sorts and formats numbers.
        wager: Number(r.wagered ?? 0) || 0,
        total_deposit: Number(r.totalDeposited ?? 0) || 0,
        target: Number(r.target ?? 0) || 0,
        target_percentage: Number(r.percentage ?? 0) || 0,
        wager_multiplier: Number(r.multiplier ?? 0) || 0,
        is_locked: r.locked === true,
      })));
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? rows.filter(r =>
          r.name.toLowerCase().includes(term) ||
          r.email.toLowerCase().includes(term) ||
          String(r.id).includes(term)
        )
      : rows;

    return [...base].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return sortDir === "asc" ? -1 : 1;
      if (vb == null) return sortDir === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === "asc" ? (sa < sb ? -1 : 1) : (sa > sb ? -1 : 1);
    });
  }, [rows, q, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const onSort = (key: keyof WagerRow) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  /**
   * `apiFetch` returns the unwrapped `data` and THROWS on the failure envelope,
   * so there is no `success` flag left to test — the old `if (!res.success)`
   * turned every successful write into "Failed to update".
   *
   * The multiplier goes over the wire as a string: it is a decimal (2.5x is a
   * real setting) and the validator takes it as one.
   */
  const updateAllTargetX = async () => {
    if (!globalTargetX || globalTargetX <= 0) return;
    try {
      await api.post(ENDPOINTS.wager.bulkMultiplier, { multiplier: String(globalTargetX) });
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to update multiplier");
    }
  };

  const updateUserTargetX = async () => {
    if (!userTargetX || !editingUser) return;
    try {
      await api.post(buildPath(ENDPOINTS.wager.setForUser, { userId: editingUser.id }), {
        multiplier: String(userTargetX),
      });
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to update user multiplier");
    }
  };

  const toggleLock = async (userId: number, currentLockStatus: boolean) => {
    try {
      await api.post(buildPath(ENDPOINTS.wager.lock, { userId }), { locked: !currentLockStatus });
      setRows(prev => prev.map(r => r.id === userId ? { ...r, is_locked: !currentLockStatus } : r));
    } catch (err: any) {
      setError(err?.message || "Failed to toggle lock");
      fetchData();
    }
  };

  const thSx = {
    bgcolor: "#0B1427",
    color: "#8384A5",
    fontWeight: 700,
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    borderBottom: "1px solid #1E2D55",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    "&:hover": { bgcolor: "#162140", color: "#F9F9F9" },
    userSelect: "none" as const,
  };

  const tdSx = {
    color: "#C8CAE5",
    borderBottom: "1px solid #1E2D55",
    fontSize: "0.82rem",
    py: 1.5,
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: "rgba(136,108,255,0.15)", borderRadius: 2, display: "flex" }}>
            <TrendingUp size={22} color="#886CFF" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              Turnover Report
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              User wager progress & target management
            </Typography>
          </Box>
        </Box>
        <Button
          startIcon={<RefreshCw size={16} />}
          onClick={fetchData}
          disabled={loading}
          variant="outlined"
          size="small"
          sx={{ borderColor: "#1E2D55", color: "#8384A5", "&:hover": { borderColor: "#886CFF", color: "#886CFF" } }}
        >
          Refresh
        </Button>
      </Box>

      {/* Toolbar */}
      <Paper sx={{ ...cardSx, p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search by name, email or ID…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#8384A5" />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              "& .MuiOutlinedInput-root": {
                bgcolor: "#0B1427",
                "& fieldset": { borderColor: "#1E2D55" },
                "&:hover fieldset": { borderColor: "#886CFF" },
                "&.Mui-focused fieldset": { borderColor: "#886CFF" },
              },
              "& input": { color: "#F9F9F9" },
            }}
          />

          {/* Global TargetX */}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              type="number"
              size="small"
              value={globalTargetX}
              onChange={(e) => setGlobalTargetX(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{
                width: 90,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#0B1427",
                  "& fieldset": { borderColor: "#1E2D55" },
                  "&:hover fieldset": { borderColor: "#886CFF" },
                  "&.Mui-focused fieldset": { borderColor: "#886CFF" },
                },
                "& input": { color: "#F9F9F9", textAlign: "center" },
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={updateAllTargetX}
              startIcon={<KeyRound size={14} />}
              sx={{
                bgcolor: "#0ECC68",
                "&:hover": { bgcolor: "#0ab85e" },
                whiteSpace: "nowrap",
                textTransform: "none",
              }}
            >
              Update All TargetX
            </Button>
          </Stack>

          {/* Sort */}
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={String(sortKey)}
                onChange={(e) => setSortKey(e.target.value as keyof WagerRow)}
                sx={{
                  bgcolor: "#0B1427",
                  color: "#F9F9F9",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" },
                  "& .MuiSvgIcon-root": { color: "#8384A5" },
                }}
              >
                {columns.map(c => (
                  <MenuItem key={c.key} value={c.key}
                    sx={{ bgcolor: "#0E1831", color: "#F9F9F9", "&:hover": { bgcolor: "#162140" } }}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Toggle sort direction">
              <IconButton
                size="small"
                onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                sx={{ border: "1px solid #1E2D55", color: "#8384A5", "&:hover": { color: "#886CFF", borderColor: "#886CFF" } }}
              >
                {sortDir === "asc" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ ...cardSx, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ p: 3 }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 1, bgcolor: "#162140", borderRadius: 1 }} />
            ))}
          </Box>
        ) : error ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <TrendingUp size={40} color="#1E2D55" />
            <Typography sx={{ color: "#8384A5", mt: 1 }}>No results found.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map(c => (
                    <TableCell key={c.key} sx={thSx} onClick={() => onSort(c.key as keyof WagerRow)}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {c.label}
                        {sortKey === c.key && (
                          sortDir === "desc"
                            ? <ChevronDown size={12} />
                            : <ChevronUp size={12} />
                        )}
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell sx={thSx}>Progress</TableCell>
                  <TableCell sx={thSx}>Lock</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((r) => {
                  const pct = clampPct(r.target_percentage);
                  const over = r.target_percentage > 100;
                  const done = r.target_percentage >= 100;

                  return (
                    <TableRow
                      key={r.id}
                      sx={{
                        "&:hover": { bgcolor: "rgba(136,108,255,0.04)" },
                        transition: "background 150ms",
                      }}
                    >
                      <TableCell sx={tdSx}>
                        <Typography sx={{ color: "#A08FFF", fontWeight: 600, fontSize: "0.8rem" }}>
                          #{r.id}
                        </Typography>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: "#1E2D55", fontSize: "0.7rem", fontWeight: 700 }}>
                            {r.name?.charAt(0)?.toUpperCase() || "?"}
                          </Avatar>
                          <Typography sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 500 }}>
                            {r.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, color: "#8384A5" }}>{r.email}</TableCell>
                      <TableCell sx={tdSx}>{fmtAmt(r.wager)}</TableCell>
                      <TableCell sx={tdSx}>{fmtAmt(r.total_deposit)}</TableCell>
                      <TableCell sx={tdSx}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <span>{fmtAmt(r.target)}</span>
                          <Tooltip title="Edit target multiplier">
                            <Box
                              component="span"
                              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
                              onClick={() => { setEditingUser(r); setUserTargetX(r.wager_multiplier || 3); }}
                            >
                              <Pencil size={13} color="#886CFF" />
                              {r.wager_multiplier && (
                                <Chip
                                  label={`${r.wager_multiplier}x`}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#162140", color: "#8384A5", cursor: "pointer" }}
                                />
                              )}
                            </Box>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Typography
                          sx={{
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: done ? "#0ECC68" : "#C8CAE5",
                          }}
                        >
                          {r.target_percentage.toFixed(2)}%
                          {over && (
                            <Typography component="span" sx={{ color: "#0ECC68", fontSize: "0.7rem", ml: 0.5 }}>
                              +{(r.target_percentage - 100).toFixed(1)}%
                            </Typography>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, minWidth: 200 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: "#162140",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: done ? "#0ECC68" : "#886CFF",
                                borderRadius: 4,
                              },
                            }}
                          />
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" sx={{ color: "#8384A5" }}>{fmtAmt(r.wager)}</Typography>
                            <Typography variant="caption" sx={{ color: done ? "#0ECC68" : "#8384A5", fontWeight: 600 }}>
                              {r.target_percentage.toFixed(1)}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#8384A5" }}>{fmtAmt(r.target)}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Tooltip title={r.is_locked ? "Locked — click to unlock" : "Unlocked — click to lock"}>
                          <IconButton
                            size="small"
                            onClick={() => toggleLock(r.id, r.is_locked || false)}
                            sx={{
                              bgcolor: r.is_locked ? "rgba(224,27,79,0.12)" : "rgba(14,204,104,0.12)",
                              color: r.is_locked ? "#E01B4F" : "#0ECC68",
                              "&:hover": {
                                bgcolor: r.is_locked ? "rgba(224,27,79,0.22)" : "rgba(14,204,104,0.22)",
                              },
                            }}
                          >
                            {r.is_locked ? <Lock size={15} /> : <Unlock size={15} />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
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
              Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                sx={{
                  borderColor: "#1E2D55",
                  color: "#8384A5",
                  border: "1px solid",
                  textTransform: "none",
                  fontSize: "0.75rem",
                  "&:hover": { borderColor: "#886CFF", color: "#886CFF" },
                  "&:disabled": { opacity: 0.4 },
                }}
              >
                Previous
              </Button>
              <Typography variant="caption" sx={{ color: "#8384A5", px: 1 }}>
                {page} / {totalPages}
              </Typography>
              <Button
                size="small"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                sx={{
                  borderColor: "#1E2D55",
                  color: "#8384A5",
                  border: "1px solid",
                  textTransform: "none",
                  fontSize: "0.75rem",
                  "&:hover": { borderColor: "#886CFF", color: "#886CFF" },
                  "&:disabled": { opacity: 0.4 },
                }}
              >
                Next
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Edit User Target Dialog */}
      <Dialog
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        PaperProps={{
          sx: { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 3, minWidth: 380 },
        }}
      >
        <DialogTitle sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55", pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Pencil size={18} color="#886CFF" />
          Edit Target Multiplier
        </DialogTitle>
        {editingUser && (
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={1} sx={{ mb: 2.5 }}>
              <Typography variant="body2" sx={{ color: "#8384A5" }}>
                User ID: <Box component="span" sx={{ color: "#F9F9F9", fontWeight: 600 }}>#{editingUser.id}</Box>
              </Typography>
              <Typography variant="body2" sx={{ color: "#8384A5" }}>
                Name: <Box component="span" sx={{ color: "#F9F9F9", fontWeight: 600 }}>{editingUser.name}</Box>
              </Typography>
              <Typography variant="body2" sx={{ color: "#8384A5" }}>
                Email: <Box component="span" sx={{ color: "#F9F9F9" }}>{editingUser.email}</Box>
              </Typography>
              {editingUser.wager_multiplier && (
                <Typography variant="body2" sx={{ color: "#8384A5" }}>
                  Current Multiplier: <Box component="span" sx={{ color: "#886CFF", fontWeight: 600 }}>{editingUser.wager_multiplier}x</Box>
                </Typography>
              )}
              <Typography variant="body2" sx={{ color: "#8384A5" }}>
                Status:{" "}
                <Box component="span" sx={{ color: editingUser.is_locked ? "#E01B4F" : "#0ECC68", fontWeight: 600 }}>
                  {editingUser.is_locked ? "Locked" : "Unlocked"}
                </Box>
              </Typography>
            </Stack>
            <TextField
              label="Target Multiplier"
              type="number"
              fullWidth
              size="small"
              value={userTargetX}
              onChange={(e) => setUserTargetX(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#0B1427",
                  color: "#F9F9F9",
                  "& fieldset": { borderColor: "#1E2D55" },
                  "&:hover fieldset": { borderColor: "#886CFF" },
                  "&.Mui-focused fieldset": { borderColor: "#886CFF" },
                },
                "& .MuiInputLabel-root": { color: "#8384A5" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#886CFF" },
              }}
            />
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setEditingUser(null)}
            sx={{
              flex: 1,
              color: "#8384A5",
              border: "1px solid #1E2D55",
              textTransform: "none",
              "&:hover": { borderColor: "#8384A5", bgcolor: "transparent" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={updateUserTargetX}
            variant="contained"
            sx={{
              flex: 1,
              bgcolor: "#0ECC68",
              textTransform: "none",
              "&:hover": { bgcolor: "#0ab85e" },
            }}
          >
            Update TargetX
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
