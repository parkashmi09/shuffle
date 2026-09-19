import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Card, Typography, IconButton, Tooltip, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Skeleton, LinearProgress,
} from "@mui/material";
import { Refresh, Timer } from "@mui/icons-material";
import * as lordsApi from "../../services/lordsApi";

/* ─── TYPES ────────────────────────────────────────────── */
interface MarketEntry {
  gameType: string;
  teamName: string;
  exposure: number;
  userName?: string;
  userId?: number;
}

interface EventGroup {
  eventId: string;
  eventName: string;
  category: string;
  markets: MarketEntry[];
}

const fmt = (n: number) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AUTO_REFRESH_SEC = 10;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NET EXPOSURE TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const NetExposureTab: React.FC = () => {
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [totalExposure, setTotalExposure] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SEC);
  const intervalRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();

  const myId = localStorage.getItem("currentUserId") || "1";
  const myRole = localStorage.getItem("userRole") || "SuperAdmin";
  const userType = myRole === "User" ? "USER" as const : "STAFF" as const;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lordsApi.getNetExposure(myId, userType);
      setEvents(data.data || []);
      setTotalExposure(data.meta?.totalExposure || 0);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setCountdown(AUTO_REFRESH_SEC);
    }
  }, [myId, userType]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, AUTO_REFRESH_SEC * 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : AUTO_REFRESH_SEC));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
            Net Exposure
          </Typography>
          <Typography sx={{ color: "#8384A5", fontSize: 13 }}>
            Total Exposure: <span style={{ color: totalExposure > 0 ? "#E01B4F" : "#0ECC68", fontWeight: 700 }}>
              {fmt(totalExposure)}
            </span>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip icon={<Timer sx={{ fontSize: 14 }} />} label={`Refresh in ${countdown}s`}
            size="small" sx={{ bgcolor: "#10182E", color: "#8384A5", fontSize: 11 }} />
          <Tooltip title="Refresh now">
            <IconButton onClick={fetchData} sx={{ color: "#886CFF" }}><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Auto-refresh progress bar */}
      <LinearProgress variant="determinate"
        value={((AUTO_REFRESH_SEC - countdown) / AUTO_REFRESH_SEC) * 100}
        sx={{ mb: 2, height: 3, borderRadius: 1, bgcolor: "#1E2D55", "& .MuiLinearProgress-bar": { bgcolor: "#886CFF" } }} />

      {/* Events */}
      {loading && events.length === 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2, bgcolor: "#1E2D55" }} />
          ))}
        </Box>
      ) : events.length === 0 ? (
        <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2, p: 4, textAlign: "center" }}>
          <Typography sx={{ color: "#8384A5" }}>No open exposure found</Typography>
        </Card>
      ) : (
        events.map((ev) => (
          <Card key={ev.eventId} sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2, mb: 2, overflow: "hidden" }}>
            {/* Event header */}
            <Box sx={{ bgcolor: "#0A0F1F", px: 2, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box>
                <Typography sx={{ color: "#F9F9F9", fontWeight: 600, fontSize: 14 }}>{ev.eventName}</Typography>
                <Chip label={ev.category} size="small"
                  sx={{ mt: 0.5, bgcolor: "rgba(136,108,255,0.12)", color: "#886CFF", fontSize: 10 }} />
              </Box>
            </Box>

            {/* Market data */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Runner / Team", "Game Type", "Exposure", ...(ev.markets[0]?.userName ? ["User"] : [])].map((h) => (
                      <TableCell key={h} sx={{ color: "#8384A5", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #1E2D55" }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ev.markets.map((m, i) => (
                    <TableRow key={i} sx={{ "&:hover": { bgcolor: "#162140" } }}>
                      <TableCell sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55", fontSize: 13, fontWeight: 500 }}>
                        {m.teamName}
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Chip label={m.gameType || "MATCH_ODDS"} size="small"
                          sx={{ bgcolor: "#10182E", color: "#8384A5", fontSize: 10 }} />
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Typography sx={{
                          color: m.exposure >= 0 ? "#0ECC68" : "#E01B4F",
                          fontWeight: 700, fontSize: 13,
                        }}>
                          {m.exposure >= 0 ? "+" : ""}{fmt(m.exposure)}
                        </Typography>
                      </TableCell>
                      {m.userName && (
                        <TableCell sx={{ color: "#8384A5", borderBottom: "1px solid #1E2D55", fontSize: 12 }}>
                          {m.userName}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        ))
      )}
    </Box>
  );
};

export default NetExposureTab;
