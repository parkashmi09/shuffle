import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
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
} from "@mui/material";
import { Trophy, Search, X, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import axios from "axios";
import { API_BASE_URL, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/* ===== Types ===== */
interface FanWin {
  id: number;
  userid: number;
  fancyname: string;
  selection: string;
  runsodds: number;
  payout: number;
  eventid: number;
  matchid: number;
  created_at: string;
}

interface PaginationState {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

interface FanWinResponse {
  data: FanWin[];
  pagination: PaginationState;
}

const formatCurrency = (n: number) =>
  typeof n === "number" && !Number.isNaN(n) ? n.toFixed(2) : "-";
const formatDate = (iso: string) => new Date(iso).toLocaleString();

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
  whiteSpace: "nowrap" as const,
};

/* ===== Component ===== */
const FanWins: React.FC = () => {
  const staffId = localStorage.getItem("currentUserId");
  const token = localStorage.getItem("token");

  const [rows, setRows] = useState<FanWin[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    limit: 10,
  });

  const BASE_URL = API_BASE_URL;

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${BASE_URL}${ENDPOINTS.sportsResults.fancy}?page=${pagination.currentPage}&limit=${pagination.limit}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (userId) url += `&userId=${encodeURIComponent(userId)}`;

      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(staffId ? { "x-staff-id": staffId } : {}),
      };

      const { data } = await axios.get<FanWinResponse>(url, { headers });
      setRows(data.data);
      setPagination((p) => ({ ...p, ...data.pagination }));
    } catch (e) {
      console.error("Failed to fetch fan wins:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };
  const handleUserFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(e.target.value);
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (pagination.totalPages && newPage > pagination.totalPages)) return;
    setPagination((p) => ({ ...p, currentPage: newPage }));
  };
  const handleClearFilters = () => {
    setSearchTerm("");
    setUserId("");
    setPagination((p) => ({ ...p, currentPage: 1 }));
  };

  const hasFilters = searchTerm || userId;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: "rgba(123,94,245,0.15)", borderRadius: 2, display: "flex" }}>
            <Trophy size={22} color="#7B5EF5" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              Fan Wins
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              {pagination.totalCount} total records
            </Typography>
          </Box>
        </Box>
        <Button
          startIcon={<RefreshCw size={15} />}
          onClick={fetchData}
          disabled={loading}
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search fancy, selection, event or match…"
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search size={15} color="#8384A5" /></InputAdornment>
              ),
            }}
            sx={{ ...inputSx, flex: 1 }}
          />
          <TextField
            size="small"
            placeholder="Filter by User ID"
            value={userId}
            onChange={handleUserFilterChange}
            sx={{ ...inputSx, width: 180 }}
          />
          {hasFilters && (
            <Button
              size="small"
              startIcon={<X size={14} />}
              onClick={handleClearFilters}
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
                <TableCell sx={thSx}>User ID</TableCell>
                <TableCell sx={thSx}>Fancy</TableCell>
                <TableCell sx={thSx}>Selection</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Runs / Odds</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Payout</TableCell>
                <TableCell sx={thSx}>Event ID</TableCell>
                <TableCell sx={thSx}>Match ID</TableCell>
                <TableCell sx={thSx}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && rows.length === 0 ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j} sx={tdSx}>
                        <Skeleton variant="text" width={j === 1 ? 130 : 70} sx={{ bgcolor: "#162140" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: "center", py: 6, borderBottom: "none" }}>
                    <Trophy size={40} color="#1E2D55" />
                    <Typography sx={{ color: "#8384A5", mt: 1 }}>No fan wins found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.id}
                    sx={{ "&:hover": { bgcolor: "rgba(136,108,255,0.04)" }, transition: "background 150ms" }}
                  >
                    <TableCell sx={{ ...tdSx, color: "#A08FFF", fontWeight: 600 }}>
                      #{r.userid}
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Typography sx={{ color: "#F9F9F9", fontWeight: 500, fontSize: "0.82rem" }}>
                        {r.fancyname}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tdSx}>
                      <Chip
                        label={r.selection}
                        size="small"
                        sx={{
                          bgcolor: "rgba(136,108,255,0.12)",
                          color: "#A08FFF",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...tdSx, textAlign: "right", fontFamily: "monospace" }}>
                      {r.runsodds}
                    </TableCell>
                    <TableCell sx={{ ...tdSx, textAlign: "right" }}>
                      <Chip
                        label={`₹ ${formatCurrency(r.payout)}`}
                        size="small"
                        sx={{
                          bgcolor: r.payout >= 0 ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                          color: r.payout >= 0 ? "#0ECC68" : "#E01B4F",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                          fontFamily: "monospace",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...tdSx, color: "#8384A5" }}>{r.eventid}</TableCell>
                    <TableCell sx={{ ...tdSx, color: "#8384A5" }}>{r.matchid}</TableCell>
                    <TableCell sx={{ ...tdSx, color: "#8384A5", fontSize: "0.75rem" }}>
                      {formatDate(r.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
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
              Page {pagination.currentPage} of {pagination.totalPages}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                disabled={pagination.currentPage === 1}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                startIcon={<ChevronLeft size={14} />}
                sx={{
                  border: "1px solid #1E2D55",
                  color: "#8384A5",
                  textTransform: "none",
                  fontSize: "0.75rem",
                  "&:hover": { borderColor: "#886CFF", color: "#886CFF" },
                  "&:disabled": { opacity: 0.4 },
                }}
              >
                Previous
              </Button>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  bgcolor: "#0B1427",
                  border: "1px solid #1E2D55",
                  borderRadius: 1,
                  minWidth: 60,
                  textAlign: "center",
                }}
              >
                <Typography variant="caption" sx={{ color: "#F9F9F9", fontWeight: 600 }}>
                  {pagination.currentPage} / {pagination.totalPages}
                </Typography>
              </Box>
              <Button
                size="small"
                disabled={pagination.totalPages === 0 || pagination.currentPage === pagination.totalPages}
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                endIcon={<ChevronRight size={14} />}
                sx={{
                  border: "1px solid #1E2D55",
                  color: "#8384A5",
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
    </Box>
  );
};

export default FanWins;
