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
  Chip,
  InputAdornment,
  Stack,
  Tooltip,
  IconButton,
  Avatar,
} from "@mui/material";
import {
  Gamepad2,
  Search,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Dices,
} from "lucide-react";

interface Game {
  id: number;
  name: string;
  minInvest: number;
  maxInvest: number;
  status: "Enabled" | "Disabled";
}

const sampleData: Game[] = [
  { id: 1, name: "Black Jack", minInvest: 5, maxInvest: 1000, status: "Enabled" },
  { id: 2, name: "Classic Dice", minInvest: 10, maxInvest: 5000, status: "Enabled" },
  { id: 3, name: "Crash", minInvest: 1, maxInvest: 500, status: "Enabled" },
  { id: 4, name: "Diamond", minInvest: 0.5, maxInvest: 100, status: "Disabled" },
  { id: 5, name: "Goal", minInvest: 25, maxInvest: 10000, status: "Enabled" },
  { id: 6, name: "Hash Dice", minInvest: 5, maxInvest: 2000, status: "Enabled" },
  { id: 7, name: "High Low", minInvest: 1, maxInvest: 200, status: "Enabled" },
  { id: 8, name: "Hilo", minInvest: 0.25, maxInvest: 50, status: "Disabled" },
  { id: 9, name: "Keno", minInvest: 1, maxInvest: 20, status: "Enabled" },
  { id: 10, name: "Limbo", minInvest: 2, maxInvest: 1000, status: "Enabled" },
  { id: 11, name: "Magical Wheel", minInvest: 10, maxInvest: 3000, status: "Enabled" },
  { id: 12, name: "Mine", minInvest: 5, maxInvest: 1500, status: "Disabled" },
  { id: 13, name: "Plinko", minInvest: 3, maxInvest: 1000, status: "Enabled" },
  { id: 14, name: "Roulette", minInvest: 5, maxInvest: 2000, status: "Enabled" },
  { id: 15, name: "Single Keno", minInvest: 1, maxInvest: 200, status: "Disabled" },
  { id: 16, name: "SnakeAndLadders", minInvest: 2, maxInvest: 500, status: "Enabled" },
  { id: 17, name: "Three Card Montre", minInvest: 0.5, maxInvest: 100, status: "Enabled" },
  { id: 18, name: "Tower", minInvest: 1, maxInvest: 1000, status: "Enabled" },
  { id: 19, name: "Video Poker", minInvest: 1, maxInvest: 300, status: "Disabled" },
  { id: 20, name: "Wheel", minInvest: 1, maxInvest: 500, status: "Enabled" },
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

/* stable color from game name for avatar accent */
const avatarColors = [
  "#886CFF", "#7B5EF5", "#0ECC68", "#FFC23F", "#E01B4F",
  "#A08FFF", "#F97316", "#EC4899", "#14B8A6", "#8B5CF6",
];
const colorFor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <Paper
    sx={{
      ...cardSx,
      p: 2.5,
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 2,
      transition: "all 200ms",
      "&:hover": { borderColor: color, transform: "translateY(-2px)" },
    }}
  >
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: `${color}22`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="caption" sx={{ color: "#8384A5", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  </Paper>
);

const GamesPage: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "Enabled" | "Disabled">("all");

  useEffect(() => { setGames(sampleData); }, []);

  const toggleStatus = (id: number) =>
    setGames((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, status: g.status === "Enabled" ? "Disabled" : "Enabled" } : g
      )
    );

  const stats = useMemo(() => ({
    total: games.length,
    enabled: games.filter((g) => g.status === "Enabled").length,
    disabled: games.filter((g) => g.status === "Disabled").length,
  }), [games]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return games.filter((g) => {
      if (filter !== "all" && g.status !== filter) return false;
      if (term && !g.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [games, q, filter]);

  const filterChipSx = (active: boolean) => ({
    cursor: "pointer",
    bgcolor: active ? "rgba(136,108,255,0.18)" : "#0B1427",
    color: active ? "#A08FFF" : "#8384A5",
    border: `1px solid ${active ? "#886CFF" : "#1E2D55"}`,
    fontWeight: 600,
    fontSize: "0.72rem",
    "&:hover": { bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF" },
  });

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 1, bgcolor: "rgba(136,108,255,0.15)", borderRadius: 2, display: "flex" }}>
          <Gamepad2 size={22} color="#886CFF" />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
            Games
          </Typography>
          <Typography variant="caption" sx={{ color: "#8384A5" }}>
            Manage casino game availability
          </Typography>
        </Box>
      </Box>

      {/* Stat cards */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <StatCard
          icon={<Dices size={22} color="#886CFF" />}
          label="Total Games"
          value={stats.total}
          color="#886CFF"
        />
        <StatCard
          icon={<CheckCircle2 size={22} color="#0ECC68" />}
          label="Enabled"
          value={stats.enabled}
          color="#0ECC68"
        />
        <StatCard
          icon={<XCircle size={22} color="#E01B4F" />}
          label="Disabled"
          value={stats.disabled}
          color="#E01B4F"
        />
      </Stack>

      {/* Toolbar */}
      <Paper sx={{ ...cardSx, p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search games…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={15} color="#8384A5" />
                </InputAdornment>
              ),
            }}
            sx={{ ...inputSx, flex: 1 }}
          />
          <Stack direction="row" spacing={1}>
            <Chip
              label={`All (${stats.total})`}
              size="small"
              onClick={() => setFilter("all")}
              sx={filterChipSx(filter === "all")}
            />
            <Chip
              label={`Enabled (${stats.enabled})`}
              size="small"
              onClick={() => setFilter("Enabled")}
              sx={filterChipSx(filter === "Enabled")}
            />
            <Chip
              label={`Disabled (${stats.disabled})`}
              size="small"
              onClick={() => setFilter("Disabled")}
              sx={filterChipSx(filter === "Disabled")}
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper sx={{ ...cardSx, overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "70vh" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Game</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Min Invest</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Max Invest</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "center" }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", py: 6, borderBottom: "none" }}>
                    <Gamepad2 size={40} color="#1E2D55" />
                    <Typography sx={{ color: "#8384A5", mt: 1 }}>No games found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((game) => {
                  const enabled = game.status === "Enabled";
                  const accent = colorFor(game.name);
                  return (
                    <TableRow
                      key={game.id}
                      sx={{
                        "&:hover": { bgcolor: "rgba(136,108,255,0.04)" },
                        transition: "background 150ms",
                        opacity: enabled ? 1 : 0.7,
                      }}
                    >
                      <TableCell sx={tdSx}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              bgcolor: `${accent}22`,
                              color: accent,
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              border: `1px solid ${accent}55`,
                            }}
                          >
                            {game.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography sx={{ color: "#F9F9F9", fontSize: "0.85rem", fontWeight: 600 }}>
                              {game.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#8384A5" }}>
                              ID #{game.id}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "right", fontFamily: "monospace", color: "#8384A5" }}>
                        ${game.minInvest.toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "right", fontFamily: "monospace", color: "#8384A5" }}>
                        ${game.maxInvest.toFixed(2)}
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Chip
                          icon={
                            enabled
                              ? <CheckCircle2 size={13} style={{ marginLeft: 8, color: "#0ECC68" }} />
                              : <XCircle size={13} style={{ marginLeft: 8, color: "#E01B4F" }} />
                          }
                          label={game.status}
                          size="small"
                          sx={{
                            bgcolor: enabled ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                            color: enabled ? "#0ECC68" : "#E01B4F",
                            fontWeight: 600,
                            fontSize: "0.72rem",
                            "& .MuiChip-icon": { color: "inherit" },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "center" }}>
                        <Tooltip title={enabled ? "Disable game" : "Enable game"}>
                          <Button
                            size="small"
                            onClick={() => toggleStatus(game.id)}
                            startIcon={enabled ? <EyeOff size={13} /> : <Eye size={13} />}
                            sx={{
                              textTransform: "none",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              border: `1px solid ${enabled ? "#E01B4F" : "#0ECC68"}`,
                              color: enabled ? "#E01B4F" : "#0ECC68",
                              bgcolor: "transparent",
                              "&:hover": {
                                bgcolor: enabled ? "rgba(224,27,79,0.1)" : "rgba(14,204,104,0.1)",
                              },
                              minWidth: 90,
                            }}
                          >
                            {enabled ? "Disable" : "Enable"}
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default GamesPage;
