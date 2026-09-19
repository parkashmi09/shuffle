import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Skeleton,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Trophy,
  Save,
  Plus,
  Trash2,
  Info,
  RefreshCw,
  Gavel,
} from "lucide-react";
import { apiFetch, apiFetchPage, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

/**
 * The wagering race — daily and weekly.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT AN OPERATOR IS ACTUALLY DECIDING HERE
 *
 * Every bet is converted to USD, multiplied by its game bucket's rate, and
 * summed over a window. The window closes, the top N are paid out of a pool,
 * and each prize sits claimable until the player takes it.
 *
 * So this screen sets three things that all cost money: the multipliers (who
 * wins), the pool (what that is worth), and the switch (whether it runs at
 * all). Every write is audited server-side for that reason.
 *
 * ── THE PRIZE TABLE IS READ, NEVER COMPUTED ──────────────────────────────
 *
 * `rankPrizes` is calculated by the server on save and stored on the config
 * row; the player's leaderboard reads the same array. This screen shows what
 * came back and re-reads after every save.
 *
 * That is deliberate. The implementation this is ported from computed the
 * curve in TWO places — once on save, once per leaderboard request, from
 * different sources for the winner count — so the distribution an operator had
 * approved and the reward a player saw could disagree, with nothing anywhere
 * saying which was right. Previewing a change locally would reintroduce
 * exactly that. Save, then look.
 * ══════════════════════════════════════════════════════════════════════════
 */

/* ------------------------------------------------------------------ */
/*  Types — camelCase, money and percentages as decimal STRINGS        */
/* ------------------------------------------------------------------ */

type RaceType = "daily" | "weekly";

interface RankPrize {
  rank: number;
  /** Share of the NET pool, to 4dp. */
  percentage: number;
  amount: string;
}

interface RaceConfig {
  type: RaceType;
  enabled: boolean;
  /** bucket -> points per 1 USD wagered. Five of them; see BUCKETS. */
  multipliers: Record<string, string>;
  /** GROSS, before the platform fee. */
  prizePool: string;
  /** What the ranks actually add up to. */
  netPrizePool: string;
  currency: string;
  platformFeePercent: string;
  winnerCount: number;
  top3Percentage: string;
  minPoints: string;
  rankPrizes: RankPrize[];
  bookedSeatsEnabled: boolean;
  bookedSeats: number[];
}

interface RaceRow {
  id: number;
  type: RaceType;
  startsAt: string;
  endsAt: string;
  status: "open" | "settled";
  settledAt: string | null;
  prizePool: string;
  winnerCount: number;
  totalAwarded: string;
}

interface RewardRow {
  id: number;
  raceId: number;
  type: RaceType;
  rank: number;
  points: string;
  amount: string;
  currency: string;
  claimed: boolean;
  claimedAt: string | null;
  createdAt: string;
  userId: string;
  username: string | null;
}

interface Boat {
  id: number;
  name: string;
  isActive: boolean;
  dailyPoints: string;
  weeklyPoints: string;
  dailyRank: number | null;
  weeklyRank: number | null;
}

/**
 * The five game buckets, in the server's own classification order.
 *
 * `other` is not a leftover — it is the fall-through for any game the
 * catalogue does not classify (table games, casual games, an unsynced
 * provider). It has its own rate BECAUSE the reference had no such bucket: its
 * `CASE` ended `ELSE slot_point` with slots configured at zero, so roughly a
 * third of all turnover scored nothing while appearing to be counted, and no
 * field on any screen would have shown an operator that was happening.
 */
const BUCKETS: { key: string; label: string; hint: string }[] = [
  { key: "sports", label: "Sports", hint: "Sportsbook stakes" },
  { key: "crash", label: "Crash", hint: "Crash, Aviator, Limbo" },
  { key: "slot", label: "Slots", hint: "Slot titles" },
  { key: "casino", label: "Casino", hint: "Live, table, card games" },
  { key: "other", label: "Other", hint: "Anything the catalogue does not classify" },
];

const ROWS_PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/*  Shared styles — the panel's own tokens                             */
/* ------------------------------------------------------------------ */
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
  py: 1.4,
};

const sectionHeadSx = {
  px: 3,
  py: 2,
  bgcolor: "#0B1427",
  borderBottom: "1px solid #1E2D55",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
};

const DarkSwitch = ({
  checked,
  onChange,
  color = "#886CFF",
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
}) => (
  <Switch
    checked={checked}
    onChange={onChange}
    size="small"
    sx={{
      width: 38,
      height: 22,
      padding: 0,
      "& .MuiSwitch-switchBase": {
        padding: 0,
        margin: "2px",
        "&.Mui-checked": {
          transform: "translateX(16px)",
          color: "#fff",
          "& + .MuiSwitch-track": { bgcolor: color, opacity: 1 },
        },
      },
      "& .MuiSwitch-thumb": { width: 18, height: 18, bgcolor: "#F9F9F9" },
      "& .MuiSwitch-track": { borderRadius: 11, bgcolor: "#162140", opacity: 1 },
    }}
  />
);

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

const money = (v: string | number | undefined, dp = 2) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : "—";
};

const when = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

const Races: React.FC = () => {
  const [tab, setTab] = useState<RaceType>("daily");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const [config, setConfig] = useState<RaceConfig | null>(null);
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [newBoat, setNewBoat] = useState("");

  /* ---- the editable form, held apart from the saved config ---- */
  const [enabled, setEnabled] = useState(false);
  const [multipliers, setMultipliers] = useState<Record<string, string>>({});
  const [prizePool, setPrizePool] = useState("");
  const [feePercent, setFeePercent] = useState("");
  const [winnerCount, setWinnerCount] = useState("");
  const [top3, setTop3] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [seatsEnabled, setSeatsEnabled] = useState(false);
  const [seats, setSeats] = useState<number[]>([]);

  const applyConfig = (cfg: RaceConfig) => {
    setConfig(cfg);
    setEnabled(Boolean(cfg.enabled));
    setMultipliers({ ...cfg.multipliers });
    setPrizePool(String(Number(cfg.prizePool)));
    setFeePercent(String(Number(cfg.platformFeePercent)));
    setWinnerCount(String(cfg.winnerCount));
    setTop3(String(Number(cfg.top3Percentage)));
    setMinPoints(String(Number(cfg.minPoints)));
    setSeatsEnabled(Boolean(cfg.bookedSeatsEnabled));
    setSeats(Array.isArray(cfg.bookedSeats) ? cfg.bookedSeats : []);
  };

  const fetchConfig = useCallback(async (type: RaceType) => {
    const cfg = await apiFetch<RaceConfig>(buildPath(ENDPOINTS.race.config, { type }));
    if (cfg) applyConfig(cfg);
  }, []);

  /** `offset`, not `page` — the service declares no `page` and would reject it. */
  const fetchRaces = useCallback(async (type: RaceType) => {
    const { data } = await apiFetchPage<RaceRow>(ENDPOINTS.race.races, {
      query: { type, limit: ROWS_PER_PAGE, offset: 0 },
    });
    setRaces(data);
  }, []);

  const fetchRewards = useCallback(async (type: RaceType) => {
    const { data } = await apiFetchPage<RewardRow>(ENDPOINTS.race.rewards, {
      query: { type, limit: ROWS_PER_PAGE, offset: 0 },
    });
    setRewards(data);
  }, []);

  const fetchBoats = useCallback(async () => {
    setBoats(await apiFetch<Boat[]>(ENDPOINTS.race.boats));
  }, []);

  const reloadAll = useCallback(
    async (type: RaceType) => {
      setLoading(true);
      try {
        await Promise.all([fetchConfig(type), fetchRaces(type), fetchRewards(type), fetchBoats()]);
      } catch (e: any) {
        setSnack({ open: true, msg: e.message || "Could not load the race", sev: "error" });
      } finally {
        setLoading(false);
      }
    },
    [fetchConfig, fetchRaces, fetchRewards, fetchBoats]
  );

  useEffect(() => {
    reloadAll(tab);
  }, [tab, reloadAll]);

  /* ---- save ---- */
  const handleSave = async () => {
    setSaving(true);
    try {
      /**
       * The validator is `.strict()` camelCase: an undeclared key is a 422, not
       * a silent strip. `prizePool` and `minPoints` are decimal STRINGS —
       * they are money, and a float here is how a pool becomes 99.99999999.
       */
      await apiFetch(buildPath(ENDPOINTS.race.config, { type: tab }), {
        method: "PUT",
        body: {
          enabled,
          sportsPoints: Number(multipliers.sports ?? 0),
          casinoPoints: Number(multipliers.casino ?? 0),
          slotPoints: Number(multipliers.slot ?? 0),
          crashPoints: Number(multipliers.crash ?? 0),
          otherPoints: Number(multipliers.other ?? 0),
          prizePool: String(prizePool || "0"),
          platformFeePercent: Number(feePercent || 0),
          winnerCount: parseInt(winnerCount, 10) || 1,
          top3Percentage: Number(top3 || 0),
          minPoints: String(minPoints || "0"),
          bookedSeatsEnabled: seatsEnabled,
          // Sent as [] when the switch is off, so turning it off actually
          // clears the seats rather than leaving them to come back later.
          bookedSeats: seatsEnabled ? seats : [],
        },
      });

      setSnack({ open: true, msg: "Race configuration saved", sev: "success" });
      // Read back what the SERVER computed — see the header on why the prize
      // table is never derived here.
      await Promise.all([fetchConfig(tab), fetchRaces(tab)]);
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Failed to save", sev: "error" });
    } finally {
      setSaving(false);
    }
  };

  /* ---- settle a window by hand ---- */
  const handleSettle = async (raceId: number) => {
    setSettling(raceId);
    try {
      const result = await apiFetch<{ winners: number; totalAwarded: string }>(
        buildPath(ENDPOINTS.race.settle, { id: raceId }),
        { method: "POST" }
      );
      setSnack({
        open: true,
        msg: `Settled — ${result.winners} winner(s), ${money(result.totalAwarded)} awarded`,
        sev: "success",
      });
      await Promise.all([fetchRaces(tab), fetchRewards(tab)]);
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Could not settle", sev: "error" });
    } finally {
      setSettling(null);
    }
  };

  /* ---- decorative entries ---- */
  const handleAddBoat = async () => {
    const name = newBoat.trim();
    if (!name) return;
    try {
      await apiFetch(ENDPOINTS.race.boats, { method: "POST", body: { name } });
      setNewBoat("");
      await fetchBoats();
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Could not add", sev: "error" });
    }
  };

  const handleToggleBoat = async (boat: Boat) => {
    try {
      await apiFetch(buildPath(ENDPOINTS.race.boat, { id: boat.id }), {
        method: "PUT",
        body: { isActive: !boat.isActive },
      });
      await fetchBoats();
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Could not update", sev: "error" });
    }
  };

  const handleRemoveBoat = async (id: number) => {
    try {
      await apiFetch(buildPath(ENDPOINTS.race.boat, { id }), { method: "DELETE" });
      await fetchBoats();
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Could not remove", sev: "error" });
    }
  };

  const toggleSeat = (rank: number) =>
    setSeats((prev) => (prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank].sort((a, b) => a - b)));

  const winners = parseInt(winnerCount, 10) || 0;
  /** Seats can only be booked inside the payout line — the board stops there. */
  const seatChoices = Array.from({ length: Math.min(winners, 50) }, (_, i) => i + 1);
  const activeBoats = boats.filter((b) => b.isActive).length;
  const unclaimed = rewards.filter((r) => !r.claimed);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* ═══ HEADER ═══ */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ mb: 3, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: "1.25rem", display: "flex", alignItems: "center", gap: 1 }}>
            <Trophy size={20} color="#FFC23F" /> Races
          </Typography>
          <Typography sx={{ color: "#8384A5", fontSize: "0.82rem" }}>
            Wagering leaderboards paid from a prize pool — one daily, one weekly.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {(["daily", "weekly"] as RaceType[]).map((t) => (
            <Button
              key={t}
              onClick={() => setTab(t)}
              size="small"
              sx={{
                textTransform: "capitalize",
                fontWeight: 600,
                px: 2.5,
                color: tab === t ? "#fff" : "#8384A5",
                bgcolor: tab === t ? "#886CFF" : "#0E1831",
                border: "1px solid #1E2D55",
                "&:hover": { bgcolor: tab === t ? "#886CFF" : "#162140" },
              }}
            >
              {t}
            </Button>
          ))}
          <Tooltip title="Reload">
            <IconButton onClick={() => reloadAll(tab)} sx={{ color: "#8384A5" }}>
              <RefreshCw size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading && !config ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={220} sx={{ bgcolor: "#0E1831" }} />
          <Skeleton variant="rounded" height={180} sx={{ bgcolor: "#0E1831" }} />
        </Stack>
      ) : (
        <>
          {/* ═══ CONFIGURATION ═══ */}
          <Paper sx={{ ...cardSx, mb: 3, overflow: "hidden" }}>
            <Box sx={sectionHeadSx}>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700, textTransform: "capitalize" }}>
                {tab} race configuration
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Chip
                  label={enabled ? "Running" : "Stopped"}
                  size="small"
                  sx={{
                    bgcolor: enabled ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                    color: enabled ? "#0ECC68" : "#E01B4F",
                    fontWeight: 600,
                  }}
                />
                <DarkSwitch checked={enabled} onChange={() => setEnabled(!enabled)} color="#0ECC68" />
              </Stack>
            </Box>

            <Box sx={{ p: 3 }}>
              {/* ---- points per USD ---- */}
              <Typography sx={{ color: "#C8CAE5", fontWeight: 600, fontSize: "0.85rem", mb: 1.5 }}>
                Points per 1.00 USD wagered
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
                {BUCKETS.map(({ key, label, hint }) => (
                  <TextField
                    key={key}
                    label={label}
                    type="number"
                    size="small"
                    fullWidth
                    value={multipliers[key] ?? ""}
                    onChange={(e) => setMultipliers({ ...multipliers, [key]: e.target.value })}
                    helperText={hint}
                    sx={inputSx}
                    FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0, fontSize: "0.68rem" } }}
                  />
                ))}
              </Stack>

              {/* ---- pool ---- */}
              <Typography sx={{ color: "#C8CAE5", fontWeight: 600, fontSize: "0.85rem", mb: 1.5 }}>
                Prize pool
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label={`Pool (${config?.currency ?? "USDT"})`}
                  type="number"
                  size="small"
                  fullWidth
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  helperText="Gross — the fee comes off this"
                  sx={inputSx}
                  FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0, fontSize: "0.68rem" } }}
                />
                <TextField
                  label="Platform fee %"
                  type="number"
                  size="small"
                  fullWidth
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                  helperText="Skimmed before any rank is paid"
                  sx={inputSx}
                  FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0, fontSize: "0.68rem" } }}
                />
                <TextField
                  label="Winners"
                  type="number"
                  size="small"
                  fullWidth
                  value={winnerCount}
                  onChange={(e) => setWinnerCount(e.target.value)}
                  helperText="Also caps the visible leaderboard"
                  sx={inputSx}
                  FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0, fontSize: "0.68rem" } }}
                />
                <TextField
                  label="Top 3 share %"
                  type="number"
                  size="small"
                  fullWidth
                  value={top3}
                  onChange={(e) => setTop3(e.target.value)}
                  helperText="Rest is shared by ranks 4+"
                  sx={inputSx}
                  FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0, fontSize: "0.68rem" } }}
                />
                <TextField
                  label="Minimum points"
                  type="number"
                  size="small"
                  fullWidth
                  value={minPoints}
                  onChange={(e) => setMinPoints(e.target.value)}
                  helperText="Below this, no prize"
                  sx={inputSx}
                  FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0, fontSize: "0.68rem" } }}
                />
              </Stack>

              {/* The gap between the headline pool and what the ranks add up to,
                  named rather than left for someone to notice. */}
              <Paper sx={{ bgcolor: "#0B1427", border: "1px solid #1E2D55", borderRadius: 1.5, p: 2, mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Info size={14} color="#8384A5" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: "#8384A5" }}>
                    <strong style={{ color: "#C8CAE5" }}>Saved:</strong> pool{" "}
                    {money(config?.prizePool, 0)} {config?.currency} gross, of which{" "}
                    <strong style={{ color: "#C8CAE5" }}>{money(config?.netPrizePool, 2)}</strong> is paid
                    out across {config?.winnerCount ?? 0} ranks. Players see both figures.
                    Turning the switch on opens the current window immediately.
                  </Typography>
                </Box>
              </Paper>

              {/* ---- booked seats ---- */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#C8CAE5", fontWeight: 600, fontSize: "0.85rem" }}>
                  Booked seats
                </Typography>
                <DarkSwitch checked={seatsEnabled} onChange={() => setSeatsEnabled(!seatsEnabled)} color="#FFC23F" />
              </Box>
              <Typography variant="caption" sx={{ color: "#8384A5", display: "block", mb: 1.5 }}>
                Ranks held by a house entry. They appear on the leaderboard marked{" "}
                <strong style={{ color: "#FFC23F" }}>House</strong> and never receive a prize — the real
                players below them move up into the paid ranks.
              </Typography>
              {seatsEnabled && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
                  {seatChoices.length === 0 ? (
                    <Typography variant="caption" sx={{ color: "#8384A5" }}>
                      Set a winner count first — seats can only be booked inside the payout line.
                    </Typography>
                  ) : (
                    seatChoices.map((rank) => (
                      <Chip
                        key={rank}
                        label={rank}
                        size="small"
                        onClick={() => toggleSeat(rank)}
                        sx={{
                          cursor: "pointer",
                          minWidth: 34,
                          bgcolor: seats.includes(rank) ? "rgba(255,194,63,0.18)" : "#0B1427",
                          color: seats.includes(rank) ? "#FFC23F" : "#8384A5",
                          border: `1px solid ${seats.includes(rank) ? "#FFC23F" : "#1E2D55"}`,
                          fontWeight: 600,
                        }}
                      />
                    ))
                  )}
                </Box>
              )}

              <Button
                onClick={handleSave}
                disabled={saving}
                startIcon={<Save size={16} />}
                sx={{
                  bgcolor: "#886CFF",
                  color: "#fff",
                  fontWeight: 600,
                  px: 3,
                  "&:hover": { bgcolor: "#1F5AD6" },
                  "&.Mui-disabled": { bgcolor: "#1E2D55", color: "#8384A5" },
                }}
              >
                {saving ? "Saving…" : "Save configuration"}
              </Button>
            </Box>
          </Paper>

          {/* ═══ PRIZE CURVE (read-only) ═══ */}
          <Paper sx={{ ...cardSx, mb: 3, overflow: "hidden" }}>
            <Box sx={sectionHeadSx}>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>Prize distribution</Typography>
              <Chip
                label={`${config?.rankPrizes?.length ?? 0} ranks · ${money(config?.netPrizePool)} ${config?.currency ?? ""}`}
                size="small"
                sx={{ bgcolor: "#0B1427", color: "#8384A5", border: "1px solid #1E2D55" }}
              />
            </Box>
            <Box sx={{ px: 3, pt: 2 }}>
              <Typography variant="caption" sx={{ color: "#8384A5" }}>
                Computed and stored by the server on save — this is the exact table players are paid
                from. Change the pool above and save to update it.
              </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>Rank</TableCell>
                    <TableCell sx={thSx} align="right">Share of payout</TableCell>
                    <TableCell sx={thSx} align="right">Prize</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(config?.rankPrizes ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ ...tdSx, textAlign: "center", color: "#8384A5" }}>
                        No distribution yet — set a pool and a winner count, then save.
                      </TableCell>
                    </TableRow>
                  ) : (
                    config!.rankPrizes.map((r) => (
                      <TableRow key={r.rank} hover>
                        <TableCell sx={tdSx}>{r.rank}</TableCell>
                        <TableCell sx={tdSx} align="right">{r.percentage.toFixed(2)}%</TableCell>
                        <TableCell sx={{ ...tdSx, color: "#F9F9F9", fontWeight: 600 }} align="right">
                          {money(r.amount)} {config?.currency}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* ═══ WINDOWS ═══ */}
          <Paper sx={{ ...cardSx, mb: 3, overflow: "hidden" }}>
            <Box sx={sectionHeadSx}>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>Race windows</Typography>
              <Typography variant="caption" sx={{ color: "#8384A5" }}>
                Rolled automatically by the worker every 5 minutes · pool and award are set at settlement
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>#</TableCell>
                    <TableCell sx={thSx}>Window</TableCell>
                    <TableCell sx={thSx}>Status</TableCell>
                    <TableCell sx={thSx} align="right">Pool</TableCell>
                    <TableCell sx={thSx} align="right">Awarded</TableCell>
                    <TableCell sx={thSx} align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {races.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ ...tdSx, textAlign: "center", color: "#8384A5" }}>
                        No windows yet. One opens as soon as the race is switched on.
                      </TableCell>
                    </TableRow>
                  ) : (
                    races.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={tdSx}>{r.id}</TableCell>
                        <TableCell sx={tdSx}>
                          {when(r.startsAt)} → {when(r.endsAt)}
                        </TableCell>
                        <TableCell sx={tdSx}>
                          <Chip
                            label={r.status}
                            size="small"
                            sx={{
                              textTransform: "capitalize",
                              bgcolor: r.status === "open" ? "rgba(136,108,255,0.14)" : "rgba(14,204,104,0.12)",
                              color: r.status === "open" ? "#A08FFF" : "#0ECC68",
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        {/*
                          An OPEN window has no pool and no award yet: those
                          columns are a snapshot taken at settlement, so they
                          are zero until then. Rendering that zero reads as a
                          race with nothing in it — which is what the reference
                          did, and why a live race appeared to be paying out
                          nothing. A dash says "not decided yet", which is the
                          truth; the configured pool is shown above.
                        */}
                        <TableCell sx={tdSx} align="right">
                          {r.status === "open" ? "—" : money(r.prizePool, 0)}
                        </TableCell>
                        <TableCell sx={tdSx} align="right">
                          {r.status === "open" ? "—" : money(r.totalAwarded)}
                        </TableCell>
                        <TableCell sx={tdSx} align="right">
                          {/* Settling early ends the window and writes the prizes.
                              Safe to repeat — the unique constraint absorbs it —
                              but it cannot be undone, so it is spelled out. */}
                          <Tooltip
                            title={
                              r.status === "settled"
                                ? "Already settled — re-running writes nothing new"
                                : "Close this window now and pay out"
                            }
                          >
                            <span>
                              <Button
                                size="small"
                                disabled={settling === r.id}
                                onClick={() => handleSettle(r.id)}
                                startIcon={<Gavel size={13} />}
                                sx={{
                                  color: r.status === "settled" ? "#8384A5" : "#FFC23F",
                                  fontSize: "0.72rem",
                                  textTransform: "none",
                                }}
                              >
                                {settling === r.id ? "Settling…" : "Settle"}
                              </Button>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* ═══ PRIZES ═══ */}
          <Paper sx={{ ...cardSx, mb: 3, overflow: "hidden" }}>
            <Box sx={sectionHeadSx}>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>Prizes</Typography>
              {/* Unclaimed prizes are a liability, so it is a number worth
                  carrying at the top rather than counting by eye. */}
              <Chip
                label={`${unclaimed.length} unclaimed · ${money(
                  unclaimed.reduce((sum, r) => sum + Number(r.amount), 0)
                )} ${config?.currency ?? ""}`}
                size="small"
                sx={{
                  bgcolor: unclaimed.length ? "rgba(255,194,63,0.12)" : "#0B1427",
                  color: unclaimed.length ? "#FFC23F" : "#8384A5",
                  border: "1px solid #1E2D55",
                  fontWeight: 600,
                }}
              />
            </Box>
            <TableContainer sx={{ maxHeight: 380 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>Race</TableCell>
                    <TableCell sx={thSx}>Rank</TableCell>
                    <TableCell sx={thSx}>Player</TableCell>
                    <TableCell sx={thSx} align="right">Points</TableCell>
                    <TableCell sx={thSx} align="right">Prize</TableCell>
                    <TableCell sx={thSx}>Claimed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rewards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ ...tdSx, textAlign: "center", color: "#8384A5" }}>
                        No prizes yet — they are written when a window settles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rewards.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={tdSx}>#{r.raceId}</TableCell>
                        <TableCell sx={tdSx}>{r.rank}</TableCell>
                        <TableCell sx={{ ...tdSx, color: "#F9F9F9" }}>
                          {r.username ?? `user ${r.userId}`}
                        </TableCell>
                        <TableCell sx={tdSx} align="right">{money(r.points, 0)}</TableCell>
                        <TableCell sx={{ ...tdSx, fontWeight: 600 }} align="right">
                          {money(r.amount)} {r.currency}
                        </TableCell>
                        <TableCell sx={tdSx}>
                          <Chip
                            label={r.claimed ? when(r.claimedAt) : "Pending"}
                            size="small"
                            sx={{
                              bgcolor: r.claimed ? "rgba(14,204,104,0.12)" : "rgba(255,194,63,0.12)",
                              color: r.claimed ? "#0ECC68" : "#FFC23F",
                              fontWeight: 600,
                              fontSize: "0.7rem",
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* ═══ HOUSE ENTRIES ═══ */}
          <Paper sx={{ ...cardSx, overflow: "hidden" }}>
            <Box sx={sectionHeadSx}>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>House entries</Typography>
              <Chip
                label={`${activeBoats} active of ${boats.length}`}
                size="small"
                sx={{ bgcolor: "#0B1427", color: "#8384A5", border: "1px solid #1E2D55" }}
              />
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="caption" sx={{ color: "#8384A5", display: "block", mb: 2 }}>
                One entry is needed per booked seat. They are placed just above whoever holds each
                booked rank and are re-positioned every 10 minutes. They are never paid.
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mb: 2, maxWidth: 420 }}>
                <TextField
                  label="Display name"
                  size="small"
                  fullWidth
                  value={newBoat}
                  onChange={(e) => setNewBoat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddBoat()}
                  sx={inputSx}
                />
                <Button
                  onClick={handleAddBoat}
                  disabled={!newBoat.trim()}
                  startIcon={<Plus size={15} />}
                  sx={{
                    bgcolor: "#886CFF",
                    color: "#fff",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    "&:hover": { bgcolor: "#1F5AD6" },
                    "&.Mui-disabled": { bgcolor: "#1E2D55", color: "#8384A5" },
                  }}
                >
                  Add
                </Button>
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thSx}>Name</TableCell>
                      <TableCell sx={thSx} align="right">Daily rank</TableCell>
                      <TableCell sx={thSx} align="right">Weekly rank</TableCell>
                      <TableCell sx={thSx}>Active</TableCell>
                      <TableCell sx={thSx} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {boats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ ...tdSx, textAlign: "center", color: "#8384A5" }}>
                          None yet. Booked seats do nothing without entries to fill them.
                        </TableCell>
                      </TableRow>
                    ) : (
                      boats.map((b) => (
                        <TableRow key={b.id} hover>
                          <TableCell sx={{ ...tdSx, color: "#F9F9F9" }}>{b.name}</TableCell>
                          <TableCell sx={tdSx} align="right">{b.dailyRank ?? "—"}</TableCell>
                          <TableCell sx={tdSx} align="right">{b.weeklyRank ?? "—"}</TableCell>
                          <TableCell sx={tdSx}>
                            <DarkSwitch checked={b.isActive} onChange={() => handleToggleBoat(b)} color="#FFC23F" />
                          </TableCell>
                          <TableCell sx={tdSx} align="right">
                            <IconButton size="small" onClick={() => handleRemoveBoat(b.id)} sx={{ color: "#E01B4F" }}>
                              <Trash2 size={15} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>
        </>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Races;
