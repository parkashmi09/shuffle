import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Switch,
  Stack,
  Chip,
  InputAdornment,
  IconButton,
  Skeleton,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Settings,
  Save,
  Lock,
  Eye,
  EyeOff,
  XCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiFetch } from "../utils/api";
import { BOOLEAN_KEYS } from "../constants/booleanKeys";
import { API_BASE_URL, buildPath, getStaffToken } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';
import { WALLET_CURRENCIES } from "../constants/walletCurrencies";

const authHeader = (): Record<string, string> => {
  const token = getStaffToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

type BoolKey = typeof BOOLEAN_KEYS[number];
type Config = Record<string, any>;
type Draft = Partial<Record<BoolKey, boolean>>;

type Provider = { id: number; name: string; enabled: boolean; created_at?: string };

type SportItem = { id: number; game_id: number; game_name: string; enabled: boolean };

type RewardCurrencies = {
  bonusCurrency: string;
  rakebackCurrency: string;
  configured?: boolean;
};

/* Grouped toggles — keys must exist as columns in siteconfig.
 * Mirrors what's actually rendered in jackopot sidebar + home page. */
const GROUPED_KEYS: Record<string, string[]> = {
  "Site Features (sidebar)": [
    "casino", "wheelspin", "welcomepack", "provablyfair", "vipclub",
    "bonus", "affiliate", "giftcards",
  ],
  "Sports Module": [
    "sports", "home_livesports",
  ],
  "Home Page Sections": [
    "home_heroSection",
    "home_welcomebanner",
    "home_latestwins",
    "home_livecasino",
    "home_gamingcards",
    "home_popularslots",
    "home_bonus500banner",
    "home_crashgames",
    "home_paymentbanner",
    "home_leaderboard",
    "home_promocards",
  ],
};

const cardSx = { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 };

const LABEL_OVERRIDES: Record<string, string> = {
  welcomepack: "Welcome Pack",
  wheelspin: "Wheel Spin",
  provablyfair: "Provably Fair",
  vipclub: "VIP Club",
  giftcards: "Gift Cards",
  sports: "Sports / Exchange",
  home_heroSection: "Hero Section",
  home_welcomebanner: "Welcome Banner",
  home_latestwins: "Latest Wins",
  home_paymentbanner: "Payment Banner",
  home_livecasino: "Live Casino",
  home_livesports: "Live Sports Section",
  home_popularslots: "Popular Slots",
  home_crashgames: "Crash Games",
  home_leaderboard: "Leaderboard",
  home_gamingcards: "Gaming Cards (BC Originals)",
  home_bonus500banner: "Bonus 500 Banner",
  home_promocards: "Sidebar Promo Cards",
};

const prettifyLabel = (s: string) => {
  if (LABEL_OVERRIDES[s]) return LABEL_OVERRIDES[s];
  return s
    .replace(/^home_/, "")
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

const DarkSwitch = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) => (
  <Switch
    checked={checked}
    onChange={onChange}
    disabled={disabled}
    size="small"
    sx={{
      width: 38,
      height: 22,
      padding: 0,
      "& .MuiSwitch-switchBase": {
        padding: 0,
        margin: "2px",
        transitionDuration: "250ms",
        "&.Mui-checked": {
          transform: "translateX(16px)",
          color: "#fff",
          "& + .MuiSwitch-track": { bgcolor: "#886CFF", opacity: 1, border: 0 },
        },
      },
      "& .MuiSwitch-thumb": {
        boxSizing: "border-box",
        width: 18,
        height: 18,
        bgcolor: "#F9F9F9",
      },
      "& .MuiSwitch-track": { borderRadius: 11, bgcolor: "#162140", opacity: 1 },
    }}
  />
);

export default function SiteConfig() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);

  /* Providers */
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [providerDraft, setProviderDraft] = useState<Record<string, boolean>>({});
  const [providerSearch, setProviderSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  /* Per-sport toggles — sports-service owns the catalogue. */
  const [sports, setSports] = useState<SportItem[] | null>(null);
  const [sportTogglingId, setSportTogglingId] = useState<number | null>(null);

  /* VIP bonus + Instant Rakeback payout currencies (siteconfig columns). */
  const [rewards, setRewards] = useState<RewardCurrencies | null>(null);
  const [rewardDraft, setRewardDraft] = useState<Partial<RewardCurrencies>>({});
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  /* Transaction password — verified server-side on every save */
  const [txnPwd, setTxnPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  /* Snackbar */
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const notify = (msg: string, sev: "success" | "error" = "success") =>
    setSnack({ open: true, msg, sev });

  const loadRewards = async () => {
    setRewardsError(null);
    try {
      const data = await apiFetch<RewardCurrencies>(ENDPOINTS.siteConfig.rewards);
      setRewards(data);
      setRewardDraft({});
    } catch (e: any) {
      setRewards(null);
      const hint =
        e?.status === 404
          ? "The API route is missing — restart the backend (`cd backend && npm run dev`) so admin-service picks up the reward-currency routes."
          : e?.message || "Could not load reward currencies.";
      setRewardsError(hint);
      notify(hint, "error");
    }
  };

  useEffect(() => {
    apiFetch<Config>(ENDPOINTS.siteConfig.global).then(setCfg).catch((e) =>
      notify(e?.message || "Failed to load config", "error")
    );
    loadRewards();
    loadProviders();
    loadSports();
  }, []);

  const rewardBonus = rewardDraft.bonusCurrency ?? rewards?.bonusCurrency ?? "BJB";
  const rewardRakeback = rewardDraft.rakebackCurrency ?? rewards?.rakebackCurrency ?? "USDT";
  const rewardDirty =
    Boolean(rewards) &&
    ((rewardDraft.bonusCurrency !== undefined && rewardDraft.bonusCurrency !== rewards.bonusCurrency) ||
      (rewardDraft.rakebackCurrency !== undefined && rewardDraft.rakebackCurrency !== rewards.rakebackCurrency));

  const saveRewards = async () => {
    if (!rewards || !rewardDirty) return;
    setRewardBusy(true);
    try {
      const body: Record<string, string> = {};
      if (rewardDraft.bonusCurrency !== undefined && rewardDraft.bonusCurrency !== rewards.bonusCurrency) {
        body.bonusCurrency = rewardBonus;
      }
      if (rewardDraft.rakebackCurrency !== undefined && rewardDraft.rakebackCurrency !== rewards.rakebackCurrency) {
        body.rakebackCurrency = rewardRakeback;
      }
      const upd = await apiFetch<RewardCurrencies>(ENDPOINTS.siteConfig.rewards, {
        method: "PUT",
        body,
      });
      setRewards(upd);
      setRewardDraft({});
      notify("Reward currencies saved.");
    } catch (e: any) {
      notify(e?.message || "Failed to save reward currencies.", "error");
    } finally {
      setRewardBusy(false);
    }
  };

  const loadSports = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.sportsCatalogue.sports}`, { headers: authHeader() });
      const data = await res.json();
      setSports(data?.data || []);
    } catch {
      setSports([]);
    }
  };

  const toggleSport = async (s: SportItem) => {
    setSportTogglingId(s.id);
    try {
      const res = await fetch(`${API_BASE_URL}${buildPath(ENDPOINTS.sportsCatalogue.sport, { id: s.id })}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      const data = await res.json();
      if (data?.success) {
        setSports((prev) =>
          (prev || []).map((it) => (it.id === s.id ? { ...it, enabled: !s.enabled } : it))
        );
        notify(`${s.game_name} ${!s.enabled ? "enabled" : "disabled"}.`);
      } else {
        notify(`Failed to toggle ${s.game_name}.`, "error");
      }
    } catch (e: any) {
      notify(e?.message || "Failed to toggle sport.", "error");
    } finally {
      setSportTogglingId(null);
    }
  };

  const loadProviders = async () => {
    try {
      // `apiFetch` unwraps the `{ success, data }` envelope, so this already IS
      // the provider array — `res.data` was `undefined` and the Providers panel
      // rendered empty even on a perfectly good 200.
      const res = await apiFetch<Provider[]>(ENDPOINTS.casinoGames.providers);
      setProviders(Array.isArray(res) ? res : []);
      setProviderDraft({});
    } catch (e: any) {
      /* fall through to empty state so user can hit Refresh */
      setProviders([]);
      setProviderDraft({});
      notify(
        e?.message?.includes("enabled")
          ? "Run siteconfig/migration.js first — gis_providers_new.enabled column missing."
          : e?.message || "Failed to load providers",
        "error"
      );
    }
  };

  const refreshFromDb = async () => {
    setRefreshing(true);
    try {
      // POST, and `gis/sync/providers`: this RE-READS THE PROVIDER CATALOGUE
      // FROM THE UPSTREAM and rewrites rows, so it is not a GET. Legacy served
      // it on GET, which made a browser prefetch or a retry a second sync.
      const res = await apiFetch<{ added: number; removed: number; providers_count: number }>(
        ENDPOINTS.casinoGis.syncProviders,
        { method: "POST" }
      );
      notify(
        `Refreshed: ${res.providers_count} providers (+${res.added} / -${res.removed})`,
        "success"
      );
      await loadProviders();
    } catch (e: any) {
      notify(e?.message || "Refresh failed", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleFeature = (k: BoolKey) => {
    if (!cfg) return;
    setCfg({ ...cfg, [k]: !cfg[k] });
    setDraft({ ...draft, [k]: !cfg[k] });
  };

  const toggleProvider = (name: string) => {
    if (!providers) return;
    const cur = providerDraft[name] !== undefined
      ? providerDraft[name]
      : providers.find((p) => p.name === name)?.enabled ?? true;
    setProviderDraft({ ...providerDraft, [name]: !cur });
    setProviders(providers.map((p) => (p.name === name ? { ...p, enabled: !cur } : p)));
  };

  const clearPassword = () => {
    setTxnPwd("");
    setShowPwd(false);
  };

  const save = async () => {
    if (!txnPwd) {
      notify("Enter your transaction password.", "error");
      return;
    }

    const hasFeatureChanges = Object.keys(draft).length > 0;
    const hasProviderChanges = Object.keys(providerDraft).length > 0;
    if (!hasFeatureChanges && !hasProviderChanges) return;

    setBusy(true);
    try {
      if (hasFeatureChanges) {
        /**
         * No `transactionPassword`.
         *
         * The transaction password guards operations that MOVE MONEY. Legacy
         * asked for it here too, and spreading it across settings screens is
         * how it stops being a meaningful second factor. Feature flags are
         * `config:write` plus an audit row naming which flags moved.
         */
        const upd = await apiFetch<Config>(ENDPOINTS.siteConfig.global, {
          method: "PUT",
          body: JSON.stringify(draft),
        });
        setCfg(upd);
        setDraft({});
      }

      if (hasProviderChanges) {
        const updates = Object.entries(providerDraft).map(([name, enabled]) => ({ name, enabled }));
        // The PUT echoes the full provider list back, same shape as the GET.
        const res = await apiFetch<Provider[]>(ENDPOINTS.casinoGames.providers, {
          method: "PUT",
          body: JSON.stringify({ updates, transactionPassword: txnPwd }),
        });
        setProviders(Array.isArray(res) ? res : []);
        setProviderDraft({});
      }

      notify("Configuration saved.");
      clearPassword();
    } catch (e: any) {
      notify(e?.message || "Failed to save configuration.", "error");
    } finally {
      setBusy(false);
    }
  };

  const featureDraftCount = Object.keys(draft).length;
  const providerDraftCount = Object.keys(providerDraft).length;
  const draftCount = featureDraftCount + providerDraftCount;
  const canSave = !!txnPwd && draftCount > 0 && !busy;

  const filteredProviders = (providers ?? []).filter((p) =>
    p.name.toLowerCase().includes(providerSearch.trim().toLowerCase())
  );

  if (!cfg) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
        <Skeleton variant="rectangular" height={80} sx={{ bgcolor: "#162140", borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={100} sx={{ bgcolor: "#162140", borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ bgcolor: "#162140", borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ p: 1, bgcolor: "rgba(136,108,255,0.15)", borderRadius: 2, display: "flex" }}>
            <Settings size={22} color="#886CFF" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              Global Configuration
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              Sidebar features, home sections, and game providers
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {draftCount > 0 && (
            <Chip
              label={`${draftCount} unsaved change${draftCount > 1 ? "s" : ""}`}
              size="small"
              sx={{ bgcolor: "rgba(255,194,63,0.12)", color: "#FFC23F", fontWeight: 600 }}
            />
          )}
          <Button
            onClick={save}
            disabled={!canSave}
            variant="contained"
            startIcon={busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <Save size={15} />}
            sx={{
              bgcolor: "#886CFF",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "#9B82FF" },
              "&:disabled": { bgcolor: "#162140", color: "#8384A5" },
            }}
          >
            {busy ? "Saving..." : "Save Changes"}
          </Button>
        </Stack>
      </Box>

      {/* Master Password Card */}
      <Paper
        sx={{
          ...cardSx,
          p: 2.5,
          mb: 3,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
            <Box sx={{ p: 1, bgcolor: "rgba(255,194,63,0.15)", borderRadius: 2, display: "flex" }}>
              <Lock size={20} color="#FFC23F" />
            </Box>
            <Box>
              <Typography sx={{ color: "#F9F9F9", fontSize: "0.9rem", fontWeight: 600 }}>
                Transaction Password Required
              </Typography>
              <Typography variant="caption" sx={{ color: "#8384A5" }}>
                Your staff transaction password is verified on each save.
              </Typography>
            </Box>
          </Box>

          <TextField
            size="small"
            type={showPwd ? "text" : "password"}
            placeholder="Transaction password"
            value={txnPwd}
            onChange={(e) => setTxnPwd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSave) save(); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock size={14} color="#8384A5" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPwd(!showPwd)} sx={{ color: "#8384A5" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: 260,
              "& .MuiOutlinedInput-root": {
                bgcolor: "#0B1427",
                "& fieldset": { borderColor: "#1E2D55" },
                "&:hover fieldset": { borderColor: "#886CFF" },
                "&.Mui-focused fieldset": { borderColor: "#886CFF" },
              },
              "& input": { color: "#F9F9F9" },
            }}
          />
        </Stack>
      </Paper>

      {/* Missing password warning */}
      {!txnPwd && draftCount > 0 && (
        <Alert
          severity="warning"
          icon={<XCircle size={18} color="#FFC23F" />}
          sx={{
            mb: 2,
            bgcolor: "rgba(255,194,63,0.1)",
            color: "#FFC23F",
            border: "1px solid rgba(255,194,63,0.3)",
            "& .MuiAlert-icon": { color: "#FFC23F" },
          }}
        >
          You have {draftCount} unsaved change{draftCount > 1 ? "s" : ""}. Enter your transaction password to save.
        </Alert>
      )}

      {/* Reward payout currencies */}
      <Paper sx={{ ...cardSx, p: 2.5, mb: 2.5 }}>
        <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: "0.95rem", mb: 0.5 }}>
          Reward currencies
        </Typography>
        <Typography variant="caption" sx={{ color: "#8384A5", display: "block", mb: 2 }}>
          Which wallet column VIP bonuses and Instant Rakeback credit into. Applies on the next claim; existing balances are not converted.
        </Typography>
        {rewardsError ? (
          <Alert
            severity="warning"
            sx={{
              mb: 2,
              bgcolor: "rgba(255,194,63,0.1)",
              color: "#FFC23F",
              border: "1px solid rgba(255,194,63,0.3)",
              "& .MuiAlert-icon": { color: "#FFC23F" },
            }}
            action={
              <Button color="inherit" size="small" onClick={() => loadRewards()} sx={{ textTransform: "none" }}>
                Retry
              </Button>
            }
          >
            {rewardsError}
          </Alert>
        ) : null}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
          <TextField
            select
            size="small"
            label="VIP / periodic bonus"
            value={rewardBonus}
            onChange={(e) => setRewardDraft((d) => ({ ...d, bonusCurrency: e.target.value }))}
            disabled={!rewards || rewardBusy}
            sx={{
              minWidth: 200,
              flex: 1,
              "& .MuiOutlinedInput-root": {
                bgcolor: "#0B1427",
                "& fieldset": { borderColor: "#1E2D55" },
              },
              "& .MuiInputLabel-root": { color: "#8384A5" },
              "& .MuiSelect-select": { color: "#F9F9F9" },
            }}
          >
            {WALLET_CURRENCIES.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Instant rakeback"
            value={rewardRakeback}
            onChange={(e) => setRewardDraft((d) => ({ ...d, rakebackCurrency: e.target.value }))}
            disabled={!rewards || rewardBusy}
            sx={{
              minWidth: 200,
              flex: 1,
              "& .MuiOutlinedInput-root": {
                bgcolor: "#0B1427",
                "& fieldset": { borderColor: "#1E2D55" },
              },
              "& .MuiInputLabel-root": { color: "#8384A5" },
              "& .MuiSelect-select": { color: "#F9F9F9" },
            }}
          >
            {WALLET_CURRENCIES.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <Button
            onClick={saveRewards}
            disabled={!rewardDirty || rewardBusy || !rewards}
            variant="contained"
            startIcon={rewardBusy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <Save size={15} />}
            sx={{
              bgcolor: "#886CFF",
              textTransform: "none",
              fontWeight: 600,
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "#9B82FF" },
              "&:disabled": { bgcolor: "#162140", color: "#8384A5" },
            }}
          >
            {rewardBusy ? "Saving…" : "Save currencies"}
          </Button>
        </Stack>
      </Paper>

      {/* Config groups */}
      <Stack spacing={2.5}>
        {Object.entries(GROUPED_KEYS).map(([group, keys]) => {
          const enabledCount = keys.filter((k) => !!cfg[k]).length;
          return (
            <Paper key={group} sx={{ ...cardSx, overflow: "hidden" }}>
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bgcolor: "#0B1427",
                  borderBottom: "1px solid #1E2D55",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: "0.95rem" }}>
                  {group}
                </Typography>
                <Chip
                  label={`${enabledCount} / ${keys.length} enabled`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(136,108,255,0.12)",
                    color: "#A08FFF",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                  }}
                />
              </Box>

              <Box
                sx={{
                  p: 2,
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                    lg: "repeat(4, 1fr)",
                  },
                  gap: 1,
                }}
              >
                {keys.map((k) => {
                  const checked = !!cfg[k];
                  const isDraft = draft[k as BoolKey] !== undefined;
                  return (
                    <Box
                      key={k}
                      onClick={() => toggleFeature(k as BoolKey)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: isDraft ? "rgba(255,194,63,0.4)" : "transparent",
                        bgcolor: isDraft ? "rgba(255,194,63,0.06)" : "transparent",
                        transition: "all 150ms",
                        "&:hover": { bgcolor: "#162140" },
                      }}
                    >
                      <Typography
                        sx={{
                          color: checked ? "#F9F9F9" : "#8384A5",
                          fontSize: "0.82rem",
                          fontWeight: checked ? 500 : 400,
                        }}
                      >
                        {prettifyLabel(k)}
                      </Typography>
                      <DarkSwitch checked={checked} onChange={() => toggleFeature(k as BoolKey)} />
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          );
        })}

        {/* Per-sport toggles */}
        <Paper sx={{ ...cardSx, overflow: "hidden" }}>
          <Box
            sx={{
              px: 3,
              py: 2,
              bgcolor: "#0B1427",
              borderBottom: "1px solid #1E2D55",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: "0.95rem" }}>
                Per-Sport Toggles
              </Typography>
              <Typography variant="caption" sx={{ color: "#8384A5" }}>
                Enable or disable individual sports on the sportsbook (Cricket, Football, Tennis…).
              </Typography>
            </Box>
            {sports && (
              <Chip
                label={`${sports.filter((s) => s.enabled).length} / ${sports.length} enabled`}
                size="small"
                sx={{
                  bgcolor: "rgba(136,108,255,0.12)",
                  color: "#A08FFF",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                }}
              />
            )}
          </Box>

          <Box
            sx={{
              p: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 1,
            }}
          >
            {!sports ? (
              <Skeleton
                variant="rectangular"
                height={120}
                sx={{ gridColumn: "1 / -1", bgcolor: "#162140", borderRadius: 1 }}
              />
            ) : sports.length === 0 ? (
              <Typography
                sx={{ gridColumn: "1 / -1", color: "#8384A5", textAlign: "center", py: 4 }}
              >
                No sports configured
              </Typography>
            ) : (
              sports.map((s) => (
                <Box
                  key={s.id}
                  onClick={() => sportTogglingId !== s.id && toggleSport(s)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    cursor: sportTogglingId === s.id ? "wait" : "pointer",
                    border: "1px solid transparent",
                    transition: "all 150ms",
                    opacity: sportTogglingId === s.id ? 0.6 : 1,
                    "&:hover": { bgcolor: "#162140" },
                  }}
                >
                  <Typography
                    sx={{
                      color: s.enabled ? "#F9F9F9" : "#8384A5",
                      fontSize: "0.82rem",
                      fontWeight: s.enabled ? 500 : 400,
                    }}
                  >
                    {s.game_name}
                  </Typography>
                  <DarkSwitch
                    checked={s.enabled}
                    disabled={sportTogglingId === s.id}
                    onChange={() => toggleSport(s)}
                  />
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Providers section */}
        <Paper sx={{ ...cardSx, overflow: "hidden" }}>
          <Box
            sx={{
              px: 3,
              py: 2,
              bgcolor: "#0B1427",
              borderBottom: "1px solid #1E2D55",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: "0.95rem" }}>
                GIS Providers
              </Typography>
              <Typography variant="caption" sx={{ color: "#8384A5" }}>
                Synced from distinct providers in gisgamesnew. Disable to hide from the frontend.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {providers && (
                <Chip
                  label={`${providers.filter((p) => p.enabled).length} / ${providers.length} enabled`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(136,108,255,0.12)",
                    color: "#A08FFF",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                  }}
                />
              )}
              <Tooltip title="Re-scan gisgamesnew for distinct providers">
                <span>
                  <Button
                    onClick={refreshFromDb}
                    disabled={refreshing}
                    variant="outlined"
                    size="small"
                    startIcon={
                      refreshing ? (
                        <CircularProgress size={14} sx={{ color: "#886CFF" }} />
                      ) : (
                        <RefreshCw size={14} />
                      )
                    }
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      color: "#F9F9F9",
                      borderColor: "#1E2D55",
                      "&:hover": { borderColor: "#886CFF", bgcolor: "rgba(136,108,255,0.08)" },
                    }}
                  >
                    {refreshing ? "Refreshing..." : "Refresh from DB"}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Box>

          <Box sx={{ px: 3, pt: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search providers"
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} color="#8384A5" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#0B1427",
                  "& fieldset": { borderColor: "#1E2D55" },
                  "&:hover fieldset": { borderColor: "#886CFF" },
                  "&.Mui-focused fieldset": { borderColor: "#886CFF" },
                },
                "& input": { color: "#F9F9F9" },
              }}
            />
          </Box>

          <Box
            sx={{
              p: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 1,
              maxHeight: 480,
              overflow: "auto",
            }}
          >
            {!providers ? (
              <Skeleton variant="rectangular" height={120} sx={{ gridColumn: "1 / -1", bgcolor: "#162140", borderRadius: 1 }} />
            ) : filteredProviders.length === 0 ? (
              <Typography sx={{ gridColumn: "1 / -1", color: "#8384A5", textAlign: "center", py: 4 }}>
                No providers {providerSearch ? `match "${providerSearch}"` : "synced yet — click Refresh from DB"}
              </Typography>
            ) : (
              filteredProviders.map((p) => {
                const isDraft = providerDraft[p.name] !== undefined;
                return (
                  <Box
                    key={p.name}
                    onClick={() => toggleProvider(p.name)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isDraft ? "rgba(255,194,63,0.4)" : "transparent",
                      bgcolor: isDraft ? "rgba(255,194,63,0.06)" : "transparent",
                      transition: "all 150ms",
                      "&:hover": { bgcolor: "#162140" },
                    }}
                  >
                    <Typography
                      sx={{
                        color: p.enabled ? "#F9F9F9" : "#8384A5",
                        fontSize: "0.82rem",
                        fontWeight: p.enabled ? 500 : 400,
                      }}
                    >
                      {p.name}
                    </Typography>
                    <DarkSwitch
                      checked={p.enabled}
                      onChange={() => toggleProvider(p.name)}
                    />
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>
      </Stack>

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
}
