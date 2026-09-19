import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Switch,
  Stack,
  Chip,
  Skeleton,
  Snackbar,
  Alert,
  Collapse,
  CircularProgress,
  Avatar,
} from "@mui/material";
import {
  Settings2,
  ChevronRight,
  Save,
  Users,
} from "lucide-react";
import { apiFetch, apiFetchPage, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import { flatToTree, TreeUser } from "../utils/faltTree";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * THIS SCREEN USED TO TOGGLE FLAGS THAT DO NOT EXIST PER PLAYER
 *
 * It rendered ~30 switches — `casino`, `sports`, `spribe`, `evolution`,
 * `home_heroSection` — and PUT them to `/api/admin/config/user/:uid`.
 *
 * `userconfig` has SEVEN columns: `uid`, the five preferences below, and
 * `updatedat`. Every one of those feature flags lives on `siteconfig`, which is
 * a single PLATFORM-wide row — there is no per-player equivalent and there
 * never has been. So the operator switched a player's casino access off, the
 * screen said saved, and nothing anywhere changed.
 *
 * Platform-wide feature gating is the Site Config screen, which edits the row
 * those flags actually live on. What is genuinely per-player is here.
 * ═══════════════════════════════════════════════════════════════════════
 */
const BOOLEAN_KEYS = ["email_notifications", "push_notifications", "hide_balance"] as const;

type BoolKey = typeof BOOLEAN_KEYS[number];
type Config = Record<string, any>;
type Draft = Partial<Record<BoolKey, boolean>>;

const GROUPED_KEYS: Record<string, string[]> = {
  "Notifications": ["email_notifications", "push_notifications"],
  "Display": ["hide_balance"],
};

/** The tree is the caller's own downline; the service scopes it. */
const PAGE_LIMIT = 200;

const cardSx = { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 };

const prettifyLabel = (s: string) =>
  s.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();

const DarkSwitch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
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
          "& + .MuiSwitch-track": { bgcolor: "#886CFF", opacity: 1 },
        },
      },
      "& .MuiSwitch-thumb": { width: 18, height: 18, bgcolor: "#F9F9F9" },
      "& .MuiSwitch-track": { borderRadius: 11, bgcolor: "#162140", opacity: 1 },
    }}
  />
);

/* ------------------------------------------------------------------ */
/*  User Accordion                                                     */
/* ------------------------------------------------------------------ */
const UserAccordion: React.FC<{
  user: TreeUser;
  cfgs: Record<number, Config>;
  drafts: Record<number, Draft>;
  saving: number | null;
  loadCfg: (id: number) => void;
  toggle: (uid: number, k: BoolKey) => void;
  save: (uid: number) => void;
  depth: number;
}> = ({ user, cfgs, drafts, saving, loadCfg, toggle, save, depth }) => {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    if (!open) loadCfg(user.id);
    setOpen(!open);
  };

  const cfg = cfgs[user.id];
  const draft = drafts[user.id];
  const draftCount = draft ? Object.keys(draft).length : 0;
  const isSaving = saving === user.id;

  return (
    <Box sx={{ ml: depth > 0 ? 3 : 0 }}>
      <Paper sx={{ ...cardSx, mb: 1.5, overflow: "hidden" }}>
        {/* Header */}
        <Box
          onClick={handleToggle}
          sx={{
            px: 2.5,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            cursor: "pointer",
            transition: "background 150ms",
            "&:hover": { bgcolor: "#162140" },
          }}
        >
          <Box sx={{ color: "#8384A5", display: "flex", transition: "transform 200ms", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
            <ChevronRight size={16} />
          </Box>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: "rgba(136,108,255,0.15)",
              color: "#886CFF",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {user.name?.charAt(0)?.toUpperCase() || "?"}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: "#F9F9F9", fontSize: "0.88rem", fontWeight: 600 }}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: "#8384A5" }}>
              {user.email}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {draftCount > 0 && (
              <Chip
                label={`${draftCount} changed`}
                size="small"
                sx={{ bgcolor: "rgba(255,194,63,0.12)", color: "#FFC23F", fontWeight: 600, fontSize: "0.65rem" }}
              />
            )}
            <Chip
              label={`ID #${user.id}`}
              size="small"
              sx={{ bgcolor: "#0B1427", color: "#8384A5", fontSize: "0.65rem" }}
            />
          </Stack>
        </Box>

        {/* Content */}
        <Collapse in={open}>
          <Box sx={{ borderTop: "1px solid #1E2D55" }}>
            {!cfg ? (
              <Box sx={{ p: 3 }}>
                <Stack spacing={1}>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={36} sx={{ bgcolor: "#162140", borderRadius: 1 }} />
                  ))}
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2.5}>
                  {Object.entries(GROUPED_KEYS).map(([group, keys]) => {
                    const enabledCount = keys.filter(k => !!cfg[k]).length;
                    return (
                      <Box key={group}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                          <Typography sx={{ color: "#C8CAE5", fontSize: "0.85rem", fontWeight: 700 }}>
                            {group}
                          </Typography>
                          <Chip
                            label={`${enabledCount}/${keys.length}`}
                            size="small"
                            sx={{ bgcolor: "rgba(136,108,255,0.12)", color: "#A08FFF", fontWeight: 600, fontSize: "0.65rem" }}
                          />
                        </Box>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" },
                            gap: 0.75,
                          }}
                        >
                          {keys.map(k => {
                            const checked = !!cfg[k];
                            const isDraft = draft?.[k as BoolKey] !== undefined;
                            return (
                              <Box
                                key={k}
                                onClick={() => toggle(user.id, k as BoolKey)}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  px: 1.5,
                                  py: 0.75,
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
                                    fontSize: "0.78rem",
                                    fontWeight: checked ? 500 : 400,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {prettifyLabel(k)}
                                </Typography>
                                <DarkSwitch checked={checked} onChange={() => toggle(user.id, k as BoolKey)} />
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>

                <Button
                  onClick={() => save(user.id)}
                  disabled={!draftCount || isSaving}
                  variant="contained"
                  startIcon={isSaving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <Save size={15} />}
                  sx={{
                    mt: 2.5,
                    bgcolor: "#886CFF",
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": { bgcolor: "#9B82FF" },
                    "&:disabled": { bgcolor: "#162140", color: "#8384A5" },
                  }}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Children */}
      {user.children.length > 0 && (
        <Box>
          {user.children.map(child => (
            <UserAccordion
              key={child.id}
              user={child}
              cfgs={cfgs}
              drafts={drafts}
              saving={saving}
              loadCfg={loadCfg}
              toggle={toggle}
              save={save}
              depth={depth + 1}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function UserConfig() {
  const [tree, setTree] = useState<TreeUser[]>([]);
  const [cfgs, setCfgs] = useState<Record<number, Config>>({});
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false, msg: "", sev: "success",
  });

  useEffect(() => {
    // The player directory IS the tree — same rows, same scoping, and it knows
    // that the platform owner also sees players with no agent.
    apiFetchPage<TreeUser>(ENDPOINTS.directory.list, { query: { limit: PAGE_LIMIT } })
      .then(({ data }) => setTree(flatToTree(data as any)))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, []);

  const loadCfg = async (id: number) => {
    if (cfgs[id]) return;
    try {
      const data = await apiFetch(buildPath(ENDPOINTS.siteConfig.userSettings, { userId: id }));
      setCfgs(prev => ({ ...prev, [id]: data }));
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || "Failed to load settings.", sev: "error" });
    }
  };

  const toggle = (uid: number, k: BoolKey) => {
    const c = cfgs[uid];
    if (!c) return;
    setCfgs(prev => ({ ...prev, [uid]: { ...c, [k]: !c[k] } }));
    setDrafts(prev => ({ ...prev, [uid]: { ...(prev[uid] || {}), [k]: !c[k] } }));
  };

  const save = async (uid: number) => {
    const d = drafts[uid];
    if (!d || !Object.keys(d).length) return;
    setSaving(uid);
    try {
      const updated = await apiFetch(buildPath(ENDPOINTS.siteConfig.userSettings, { userId: uid }), {
        method: "PUT",
        body: d,
      });
      setCfgs(prev => ({ ...prev, [uid]: updated }));
      setDrafts(prev => {
        const { [uid]: _, ...rest } = prev;
        return rest;
      });
      setSnack({ open: true, msg: "User config saved.", sev: "success" });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || "Failed to save.", sev: "error" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 1, bgcolor: "rgba(123,94,245,0.15)", borderRadius: 2, display: "flex" }}>
          <Settings2 size={22} color="#7B5EF5" />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
            User Site Configuration
          </Typography>
          <Typography variant="caption" sx={{ color: "#8384A5" }}>
            Per-user feature toggles — expand a user to configure
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Stack spacing={1.5}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={56} sx={{ bgcolor: "#162140", borderRadius: 2 }} />
          ))}
        </Stack>
      ) : tree.length === 0 ? (
        <Paper sx={{ ...cardSx, p: 6, textAlign: "center" }}>
          <Users size={40} color="#1E2D55" />
          <Typography sx={{ color: "#8384A5", mt: 1 }}>No users found.</Typography>
        </Paper>
      ) : (
        tree.map(u => (
          <UserAccordion
            key={u.id}
            user={u}
            cfgs={cfgs}
            drafts={drafts}
            saving={saving}
            loadCfg={loadCfg}
            toggle={toggle}
            save={save}
            depth={0}
          />
        ))
      )}

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnack(s => ({ ...s, open: false }))}
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
