import React, { useEffect, useState } from "react";
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
  LinearProgress,
} from "@mui/material";
import {
  Gamepad2,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { apiFetch, apiFetchPage } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
/** One page of the claims table. Drives both the request and `totalPages`. */
const CLAIMS_PER_PAGE = 15;

/**
 * These three mirror what the service returns — camelCase, with money and
 * percentages as decimal STRINGS. They used to be declared in snake_case, so
 * every read was `undefined` and the whole tab rendered blank.
 */
interface Config {
  id: number;
  minDeposit: string;
  claimCooldownDays: number;
  isActive: boolean;
  unlimitedSpin: boolean;
}

interface Slice {
  id?: number;
  label: string;
  /** `"12.50"` — the bulk-save validator rejects a number here. */
  rewardPct: string;
  color: string;
  sortOrder: number;
  isBadLuck: boolean;
  weight: number;
}

interface Claim {
  id: number;
  userId: number;
  username: string | null;
  depositAmount: string;
  rewardAmount: string;
  sliceLabel: string | null;
  redeemCode: string | null;
  claimedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
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
  py: 1.5,
};

/* ------------------------------------------------------------------ */
/*  Dark Switch                                                        */
/* ------------------------------------------------------------------ */
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
/*  Wheel Preview (SVG)                                                */
/* ------------------------------------------------------------------ */
const WHEEL_SIZE = 300;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = WHEEL_SIZE / 2 - 8;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const WheelPreview: React.FC<{ slices: Slice[] }> = ({ slices }) => {
  if (!slices.length) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280 }}>
        <Typography sx={{ color: "#8384A5" }}>Add slices to see preview</Typography>
      </Box>
    );
  }

  const sliceAngle = 360 / slices.length;

  return (
    <svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
      <circle cx={CENTER} cy={CENTER} r={RADIUS + 5} fill="none" stroke="#C8A84E" strokeWidth={4} />
      {slices.map((s, i) => {
        const startAngle = i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const start = polarToCartesian(CENTER, CENTER, RADIUS, startAngle);
        const end = polarToCartesian(CENTER, CENTER, RADIUS, endAngle);
        const largeArc = sliceAngle > 180 ? 1 : 0;
        const d = `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
        const midAngle = startAngle + sliceAngle / 2;
        const lp = polarToCartesian(CENTER, CENTER, RADIUS * 0.65, midAngle);
        return (
          <g key={i}>
            <path d={d} fill={s.color} stroke="#C8A84E" strokeWidth={1} />
            <text
              x={lp.x}
              y={lp.y}
              fill="#fff"
              fontSize={slices.length > 10 ? 9 : 12}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${midAngle}, ${lp.x}, ${lp.y})`}
            >
              {s.isBadLuck ? "BAD LUCK" : `${s.rewardPct}%`}
            </text>
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={28} fill="#0C0D1D" stroke="#C8A84E" strokeWidth={2} />
      <text x={CENTER} y={CENTER} fill="#C8A84E" fontSize={11} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
        SPIN
      </text>
      <polygon points={`${CENTER - 10},8 ${CENTER + 10},8 ${CENTER},26`} fill="#C8A84E" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
const SpinWheel: React.FC = () => {
  const [, setConfig] = useState<Config | null>(null);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSlices, setSavingSlices] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const [minDeposit, setMinDeposit] = useState("");
  const [cooldownDays, setCooldownDays] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [unlimitedSpin, setUnlimitedSpin] = useState(false);

  /* ---- fetchers ---- */
  /**
   * `apiFetch` already unwraps the `{ success, data }` envelope and returns the
   * payload. These three used to ask for the envelope and then read `.data` off
   * the payload — always `undefined`, so the config was skipped, the slices fell
   * back to `[]` and the claims table stayed empty without a single error.
   */
  const fetchConfig = async () => {
    try {
      const cfg = await apiFetch<Config>(ENDPOINTS.spinWheel.config);
      if (cfg) {
        setConfig(cfg);
        setMinDeposit(String(cfg.minDeposit ?? ""));
        setCooldownDays(String(cfg.claimCooldownDays ?? ""));
        setIsActive(Boolean(cfg.isActive));
        setUnlimitedSpin(Boolean(cfg.unlimitedSpin));
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchSlices = async () => {
    try {
      const rows = await apiFetch<Slice[]>(ENDPOINTS.spinWheel.slices);
      setSlices(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      console.error(e);
    }
  };

  /** `offset`, not `page` — the service declares no `page` and dropped it. */
  const fetchClaims = async (p = 1) => {
    try {
      const { data, pagination } = await apiFetchPage<Claim>(ENDPOINTS.spinWheel.claims, {
        query: { limit: CLAIMS_PER_PAGE, offset: (p - 1) * CLAIMS_PER_PAGE },
      });
      setClaims(data);
      setTotal(pagination?.total ?? data.length);
      setPage(p);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    Promise.all([fetchConfig(), fetchSlices(), fetchClaims()]).then(() => setLoading(false));
  }, []);

  /* ---- save config ---- */
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      // The validator is `.strict()` camelCase and takes `minDeposit` as a
      // decimal STRING — the old snake_case body with a float was rejected
      // outright, so "Save" never saved.
      await apiFetch(ENDPOINTS.spinWheel.config, {
        method: "PUT",
        body: JSON.stringify({
          minDeposit: String(parseFloat(minDeposit) || 0),
          claimCooldownDays: parseInt(cooldownDays, 10) || 0,
          isActive,
          unlimitedSpin,
        }),
      });
      setSnack({ open: true, msg: "Configuration saved!", sev: "success" });
      await fetchConfig();
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Failed to save", sev: "error" });
    } finally {
      setSaving(false);
    }
  };

  /* ---- slice management ---- */
  const handleAddSlice = () => {
    setSlices([
      ...slices,
      {
        label: "",
        rewardPct: "0",
        color: slices.length % 2 === 0 ? "#1a1a2e" : "#8B0000",
        sortOrder: slices.length + 1,
        isBadLuck: false,
        weight: 10,
      },
    ]);
  };

  const handleSliceChange = (idx: number, field: keyof Slice, value: any) => {
    const updated = [...slices];
    (updated[idx] as any)[field] = value;
    if (field === "rewardPct" && !updated[idx].isBadLuck) updated[idx].label = `${value}%`;
    if (field === "isBadLuck" && value) {
      updated[idx].label = "Bad Luck";
      updated[idx].rewardPct = "0";
    }
    setSlices(updated);
  };

  const handleRemoveSlice = (idx: number) => setSlices(slices.filter((_, i) => i !== idx));

  const handleSaveSlices = async () => {
    setSavingSlices(true);
    try {
      // `slice` is `.strict()`: `id` comes back on a fetched slice but is not an
      // accepted key, so it has to be dropped or the whole save 422s. `rewardPct`
      // must be a string matching `12.5`.
      await apiFetch(ENDPOINTS.spinWheel.slicesBulk, {
        method: "PUT",
        body: JSON.stringify({
          slices: slices.map(({ label, rewardPct, color, sortOrder, isBadLuck, weight }) => ({
            label,
            rewardPct: String(Number(rewardPct) || 0),
            color,
            sortOrder,
            isBadLuck,
            weight,
          })),
        }),
      });
      setSnack({ open: true, msg: "Wheel slices saved!", sev: "success" });
      await fetchSlices();
    } catch (e: any) {
      setSnack({ open: true, msg: e.message || "Failed to save slices", sev: "error" });
    } finally {
      setSavingSlices(false);
    }
  };

  const moveSlice = (idx: number, dir: -1 | 1) => {
    const arr = [...slices];
    [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
    setSlices(arr);
  };

  /* ---- pagination ---- */
  const totalPages = Math.ceil(total / CLAIMS_PER_PAGE);

  const totalWeight = slices.reduce((s, sl) => s + (sl.weight || 0), 0);

  if (loading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
        <Skeleton variant="rectangular" height={80} sx={{ bgcolor: "#162140", borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={200} sx={{ bgcolor: "#162140", borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ bgcolor: "#162140", borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 1, bgcolor: "rgba(255,194,63,0.15)", borderRadius: 2, display: "flex" }}>
          <Gamepad2 size={22} color="#FFC23F" />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
            Spin Wheel Management
          </Typography>
          <Typography variant="caption" sx={{ color: "#8384A5" }}>
            Configure wheel settings, slices and view claims
          </Typography>
        </Box>
      </Box>

      {/* ═══ CONFIG CARD ═══ */}
      <Paper sx={{ ...cardSx, mb: 3, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, bgcolor: "#0B1427", borderBottom: "1px solid #1E2D55", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>General Configuration</Typography>
          <Chip
            label={isActive ? "Active" : "Inactive"}
            size="small"
            sx={{
              bgcolor: isActive ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
              color: isActive ? "#0ECC68" : "#E01B4F",
              fontWeight: 600,
            }}
          />
        </Box>
        <Box sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <TextField
                label="Minimum First Deposit (INR)"
                type="number"
                size="small"
                fullWidth
                value={minDeposit}
                onChange={(e) => setMinDeposit(e.target.value)}
                helperText="User's first deposit must meet this threshold"
                sx={inputSx}
                FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0 } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <TextField
                label="Claim Cooldown (days)"
                type="number"
                size="small"
                fullWidth
                value={cooldownDays}
                onChange={(e) => setCooldownDays(e.target.value)}
                helperText="Days between claims (7 = once per week)"
                sx={inputSx}
                FormHelperTextProps={{ sx: { color: "#8384A5", ml: 0 } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Stack spacing={2}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography sx={{ color: "#8384A5", fontSize: "0.82rem" }}>Spin Wheel Active</Typography>
                  <DarkSwitch checked={isActive} onChange={() => setIsActive(!isActive)} color="#0ECC68" />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography sx={{ color: "#8384A5", fontSize: "0.82rem" }}>Unlimited Spin</Typography>
                  <DarkSwitch checked={unlimitedSpin} onChange={() => setUnlimitedSpin(!unlimitedSpin)} color="#7B5EF5" />
                </Box>
              </Stack>
            </Box>
          </Stack>

          <Paper sx={{ bgcolor: "#0B1427", border: "1px solid #1E2D55", borderRadius: 1.5, p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Info size={14} color="#8384A5" style={{ marginTop: 2, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: "#8384A5" }}>
                <strong style={{ color: "#C8CAE5" }}>How it works:</strong> First spin is always free for every user.
                After that, the cooldown ({cooldownDays || 7} days) kicks in before they can spin again.
                Min deposit is only checked for repeat spins. Toggle unlimited to remove cooldown entirely.
              </Typography>
            </Box>
          </Paper>

          <Button
            onClick={handleSaveConfig}
            disabled={saving}
            variant="contained"
            startIcon={<Save size={15} />}
            sx={{ bgcolor: "#886CFF", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#9B82FF" } }}
          >
            {saving ? "Saving..." : "Save Config"}
          </Button>
        </Box>
      </Paper>

      {/* ═══ WHEEL SLICES ═══ */}
      <Paper sx={{ ...cardSx, mb: 3, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, bgcolor: "#0B1427", borderBottom: "1px solid #1E2D55", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>Wheel Slices</Typography>
          <Chip label={`${slices.length} slices`} size="small" sx={{ bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF", fontWeight: 600 }} />
        </Box>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, gap: 3 }}>
            {/* Left: Slice editor */}
            <Box>
              {/* Column headers */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 60px 50px 70px", gap: 1, px: 1, mb: 1 }}>
                {["Label", "Reward %", "Weight", "Color", "Bad Luck", ""].map((h) => (
                  <Typography key={h} variant="caption" sx={{ color: "#8384A5", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase" }}>
                    {h}
                  </Typography>
                ))}
              </Box>

              <Stack spacing={1}>
                {slices.map((s, i) => (
                  <Paper
                    key={i}
                    sx={{
                      bgcolor: "#0B1427",
                      border: "1px solid #1E2D55",
                      borderRadius: 1.5,
                      p: 1,
                      display: "grid",
                      gridTemplateColumns: "1fr 80px 70px 60px 50px 70px",
                      gap: 1,
                      alignItems: "center",
                    }}
                  >
                    <TextField
                      size="small"
                      value={s.label}
                      onChange={(e) => handleSliceChange(i, "label", e.target.value)}
                      placeholder="e.g. 50%"
                      sx={{ ...inputSx, "& .MuiOutlinedInput-root": { ...inputSx["& .MuiOutlinedInput-root"], bgcolor: "#0E1831" } }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      value={s.rewardPct}
                      onChange={(e) => handleSliceChange(i, "rewardPct", String(parseFloat(e.target.value) || 0))}
                      disabled={s.isBadLuck}
                      sx={{ ...inputSx, "& .MuiOutlinedInput-root": { ...inputSx["& .MuiOutlinedInput-root"], bgcolor: "#0E1831" } }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      value={s.weight}
                      onChange={(e) => handleSliceChange(i, "weight", parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1 }}
                      sx={{ ...inputSx, "& .MuiOutlinedInput-root": { ...inputSx["& .MuiOutlinedInput-root"], bgcolor: "#0E1831" } }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => handleSliceChange(i, "color", e.target.value)}
                        style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent" }}
                      />
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <DarkSwitch
                        checked={s.isBadLuck}
                        onChange={() => handleSliceChange(i, "isBadLuck", !s.isBadLuck)}
                        color="#E01B4F"
                      />
                    </Box>
                    <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                      {i > 0 && (
                        <IconButton size="small" onClick={() => moveSlice(i, -1)} sx={{ color: "#8384A5", "&:hover": { color: "#F9F9F9" } }}>
                          <ChevronUp size={14} />
                        </IconButton>
                      )}
                      {i < slices.length - 1 && (
                        <IconButton size="small" onClick={() => moveSlice(i, 1)} sx={{ color: "#8384A5", "&:hover": { color: "#F9F9F9" } }}>
                          <ChevronDown size={14} />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => handleRemoveSlice(i)} sx={{ color: "#8384A5", "&:hover": { color: "#E01B4F" } }}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                <Button
                  startIcon={<Plus size={15} />}
                  onClick={handleAddSlice}
                  sx={{ bgcolor: "#162140", color: "#F9F9F9", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#1C2B4A" } }}
                >
                  Add Slice
                </Button>
                <Button
                  startIcon={<Save size={15} />}
                  onClick={handleSaveSlices}
                  disabled={savingSlices || slices.length === 0}
                  variant="contained"
                  sx={{ bgcolor: "#886CFF", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#9B82FF" }, "&:disabled": { bgcolor: "#162140", color: "#8384A5" } }}
                >
                  {savingSlices ? "Saving..." : "Save Slices"}
                </Button>
              </Stack>

              {/* Win probability breakdown */}
              {slices.length > 0 && (
                <Paper sx={{ bgcolor: "#0B1427", border: "1px solid #1E2D55", borderRadius: 1.5, p: 2, mt: 2 }}>
                  <Typography variant="caption" sx={{ color: "#8384A5", fontWeight: 700, textTransform: "uppercase", display: "block", mb: 1 }}>
                    Win Probability
                  </Typography>
                  <Stack spacing={0.75}>
                    {slices.map((s, i) => {
                      const pct = totalWeight > 0 ? (s.weight / totalWeight) * 100 : 0;
                      return (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color, flexShrink: 0 }} />
                          <Typography sx={{ color: "#C8CAE5", fontSize: "0.75rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.label || `Slice ${i + 1}`}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              width: 80,
                              height: 5,
                              borderRadius: 3,
                              bgcolor: "#162140",
                              "& .MuiLinearProgress-bar": { bgcolor: s.color, borderRadius: 3 },
                            }}
                          />
                          <Typography sx={{ color: "#8384A5", fontSize: "0.7rem", fontWeight: 600, minWidth: 40, textAlign: "right" }}>
                            {pct.toFixed(1)}%
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              )}
            </Box>

            {/* Right: Wheel preview */}
            <Paper
              sx={{
                bgcolor: "#0a0e1a",
                border: "1px solid #1E2D55",
                borderRadius: 2,
                p: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="caption" sx={{ color: "#8384A5", fontWeight: 700, textTransform: "uppercase", mb: 2 }}>
                Live Preview
              </Typography>
              <WheelPreview slices={slices} />
              <Typography variant="caption" sx={{ color: "#8384A5", mt: 2 }}>
                {slices.length} slices configured
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Paper>

      {/* ═══ CLAIMS TABLE ═══ */}
      <Paper sx={{ ...cardSx, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, bgcolor: "#0B1427", borderBottom: "1px solid #1E2D55", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>Claim History</Typography>
          <Chip label={`${total} total`} size="small" sx={{ bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF", fontWeight: 600 }} />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>#</TableCell>
                <TableCell sx={thSx}>User ID</TableCell>
                <TableCell sx={thSx}>Username</TableCell>
                <TableCell sx={thSx}>Slice</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Deposit</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Reward</TableCell>
                <TableCell sx={thSx}>Redeem Code</TableCell>
                <TableCell sx={thSx}>Claimed At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: "center", py: 6, borderBottom: "none" }}>
                    <Gamepad2 size={36} color="#1E2D55" />
                    <Typography sx={{ color: "#8384A5", mt: 1 }}>No claims yet.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((c, i) => (
                  <TableRow key={c.id} sx={{ "&:hover": { bgcolor: "rgba(136,108,255,0.04)" }, transition: "background 150ms" }}>
                    <TableCell sx={{ ...tdSx, color: "#8384A5" }}>{(page - 1) * 15 + i + 1}</TableCell>
                    <TableCell sx={{ ...tdSx, color: "#A08FFF", fontWeight: 600 }}>#{c.userId}</TableCell>
                    <TableCell sx={tdSx}>{c.username || "—"}</TableCell>
                    <TableCell sx={tdSx}>
                      {c.sliceLabel ? (
                        <Chip label={c.sliceLabel} size="small" sx={{ bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF", fontWeight: 600, fontSize: "0.7rem" }} />
                      ) : "—"}
                    </TableCell>
                    <TableCell sx={{ ...tdSx, textAlign: "right", fontFamily: "monospace" }}>
                      {Number(c.depositAmount).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ ...tdSx, textAlign: "right" }}>
                      <Chip
                        label={Number(c.rewardAmount) > 0 ? `+${Number(c.rewardAmount).toLocaleString()}` : "Bad Luck"}
                        size="small"
                        sx={{
                          bgcolor: Number(c.rewardAmount) > 0 ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                          color: Number(c.rewardAmount) > 0 ? "#0ECC68" : "#E01B4F",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                          fontFamily: "monospace",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={tdSx}>
                      {c.redeemCode ? (
                        <Chip
                          label={c.redeemCode}
                          size="small"
                          sx={{
                            bgcolor: "rgba(255,194,63,0.12)",
                            color: "#FFC23F",
                            fontWeight: 600,
                            fontSize: "0.7rem",
                            fontFamily: "monospace",
                          }}
                        />
                      ) : "—"}
                    </TableCell>
                    <TableCell sx={{ ...tdSx, color: "#8384A5", fontSize: "0.75rem" }}>
                      {new Date(c.claimedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #1E2D55", gap: 1.5 }}>
            <Button
              size="small"
              disabled={page <= 1}
              onClick={() => fetchClaims(page - 1)}
              startIcon={<ChevronLeft size={14} />}
              sx={{ border: "1px solid #1E2D55", color: "#8384A5", textTransform: "none", fontSize: "0.75rem", "&:hover": { borderColor: "#886CFF", color: "#886CFF" }, "&:disabled": { opacity: 0.4 } }}
            >
              Prev
            </Button>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              Page {page} of {totalPages}
            </Typography>
            <Button
              size="small"
              disabled={page >= totalPages}
              onClick={() => fetchClaims(page + 1)}
              endIcon={<ChevronRight size={14} />}
              sx={{ border: "1px solid #1E2D55", color: "#8384A5", textTransform: "none", fontSize: "0.75rem", "&:hover": { borderColor: "#886CFF", color: "#886CFF" }, "&:disabled": { opacity: 0.4 } }}
            >
              Next
            </Button>
          </Box>
        )}
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnack({ ...snack, open: false })}
          severity={snack.sev}
          sx={{
            bgcolor: snack.sev === "success" ? "rgba(14,204,104,0.15)" : "rgba(224,27,79,0.15)",
            color: snack.sev === "success" ? "#0ECC68" : "#E01B4F",
            border: `1px solid ${snack.sev === "success" ? "#0ECC68" : "#E01B4F"}44`,
            "& .MuiAlert-icon": { color: snack.sev === "success" ? "#0ECC68" : "#E01B4F" },
          }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SpinWheel;
