import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Card, Typography, TextField, InputAdornment, Chip, IconButton,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Button, Select, MenuItem, FormControl, Snackbar, Alert,
  CircularProgress, Skeleton, Pagination, Dialog, DialogTitle,
  DialogContent, DialogActions, Radio, RadioGroup, FormControlLabel,
  InputLabel, AlertColor, Switch,
} from "@mui/material";
import {
  Search, Refresh, FilterList, Download, ArrowBack,
  Settings, Add, ChevronRight, Lock, LockOpen, AccountTree,
  AddCircle, RemoveCircle, Assessment,
} from "@mui/icons-material";
import { apiFetch } from "../../utils/api";
import * as lordsApi from "../../services/lordsApi";
import { socketService } from "../../services/socketService";
import { usePermissions } from "../../hooks/usePermissions";
import { DEPOSIT_WITHDRAW_KEYS } from "../../constants/permissions";

/* ─── ROLE CONFIG ──────────────────────────────────────────────────── */
const ROLE_HIERARCHY: Record<string, { level: number; color: string; bg: string }> = {
  SuperAdmin: { level: 0, color: "#F9F9F9", bg: "rgba(249,249,249,0.08)" },
  Admin:      { level: 1, color: "#E01B4F", bg: "rgba(224,27,79,0.12)" },
  SubAdmin:   { level: 2, color: "#FFC23F", bg: "rgba(255,194,63,0.12)" },
  Master:     { level: 3, color: "#886CFF", bg: "rgba(136,108,255,0.12)" },
  Agent:      { level: 4, color: "#0ECC68", bg: "rgba(14,204,104,0.12)" },
  SubAgent:   { level: 5, color: "#7B5EF5", bg: "rgba(123,94,245,0.12)" },
  User:       { level: 6, color: "#8384A5", bg: "rgba(131,132,165,0.12)" },
};

const CHILD_ROLES: Record<string, string[]> = {
  SuperAdmin: ["Admin", "SubAdmin", "Master", "Agent", "SubAgent", "User"],
  Admin: ["SubAdmin", "User"],
  SubAdmin: ["Master", "User"],
  Master: ["Agent", "User"],
  Agent: ["SubAgent", "User"],
  SubAgent: ["User"],
};

/* ─��─ TYPES ────────────────────────────────────────────────────────── */
interface Agent {
  id: number;
  username: string;
  role: string;
  account_type: string;
  /** Real INR wallet balance. There is no credit limit — this is all there is. */
  balance: number;
  exposure: number;
  percentage: number;
  status: string;
  bet_status: string;
  bet_locked: boolean;
  sports_locked: boolean;
  casino_locked: boolean;
  system_locked: boolean;
  exp_limit: number | null;
  /** Lifetime sports P&L YOU made from this account (+ = you earned).
   *  For an agent row, summed over its whole downline. */
  sports_pnl: number;
  /** Lifetime casino P&L YOU made from this account (+ = you earned). */
  casino_pnl: number;
  has_downline: boolean;
}

interface SnackState {
  open: boolean;
  msg: string;
  severity: AlertColor;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   USER SETTINGS MODAL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const UserSettingsModal: React.FC<{
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
  onSuccess: () => void;
  setSnack: (s: SnackState) => void;
}> = ({ open, agent, onClose, onSuccess, setSnack }) => {
  const { can } = usePermissions();
  const caps = {
    password: can("canChangeUserPassword"),
    status:   can("canLockUser"),
    locks:    can("canLockUser"),
    exposure: can("canChangeExposureLimit"),
  };
  const [tab, setTab] = useState<"password" | "status" | "exposure" | "locks">("status");
  const [txnPwd, setTxnPwd] = useState("");
  const [saving, setSaving] = useState(false);
  // Status
  const [status, setStatus] = useState("active");
  const [betStatus, setBetStatus] = useState("active");
  // Locks
  const [sportsLocked, setSportsLocked] = useState(false);
  const [casinoLocked, setCasinoLocked] = useState(false);
  const [systemLocked, setSystemLocked] = useState(false);
  // Password
  const [newPwd, setNewPwd] = useState("");
  // Exposure
  const [expLimit, setExpLimit] = useState("");

  useEffect(() => {
    if (agent) {
      setStatus(agent.status || "active");
      setBetStatus(agent.bet_status || "active");
      setSportsLocked(!!agent.sports_locked);
      setCasinoLocked(!!agent.casino_locked);
      setSystemLocked(!!agent.system_locked);
      setExpLimit(agent.exp_limit != null ? String(agent.exp_limit) : "");
      setTxnPwd("");
      setNewPwd("");
    }
  }, [agent]);

  // Keep selected tab valid when caps change.
  useEffect(() => {
    const allowed: string[] = [];
    if (caps.status)   allowed.push("status");
    if (caps.locks)    allowed.push("locks");
    if (caps.password) allowed.push("password");
    if (caps.exposure) allowed.push("exposure");
    if (allowed.length && !allowed.includes(tab)) setTab(allowed[0] as any);
  }, [caps.status, caps.locks, caps.password, caps.exposure, tab]);

  if (!agent) return null;
  const userType = agent.account_type === "USER" ? "USER" as const : "STAFF" as const;

  const handleSave = async () => {
    if (!txnPwd) { setSnack({ open: true, msg: "Transaction password required", severity: "error" }); return; }
    const tabCap: Record<typeof tab, boolean> = {
      password: caps.password, status: caps.status, locks: caps.locks,
      exposure: caps.exposure,
    };
    if (!tabCap[tab]) {
      setSnack({ open: true, msg: "You don't have permission for this action", severity: "error" });
      return;
    }
    setSaving(true);
    const results: string[] = [];
    try {
      if (tab === "password" && newPwd) {
        await lordsApi.updatePassword({ userId: agent.id, userType, newPassword: newPwd, transactionPassword: txnPwd });
        results.push("Password updated");
      }
      if (tab === "status") {
        await lordsApi.updateStatus({ userId: agent.id, userType, status, betStatus, transactionPassword: txnPwd });
        results.push("Status updated");
      }
      if (tab === "locks") {
        await lordsApi.updateStatus({
          userId: agent.id, userType,
          sportsLocked, casinoLocked, systemLocked,
          transactionPassword: txnPwd,
        });
        results.push("Lock settings updated");
      }
      if (tab === "exposure") {
        const val = expLimit === "" ? null : Number(expLimit);
        await lordsApi.updateExposureLimit({ userId: agent.id, userType, exposureLimit: val, transactionPassword: txnPwd });
        results.push("Exposure limit updated");
      }
      setSnack({ open: true, msg: results.join(", "), severity: "success" });
      onSuccess();
      onClose();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || "Failed", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const allTabs = [
    { key: "status",         label: "Status",            cap: caps.status },
    { key: "locks",          label: "Locks (Bet/Sports/Casino)", cap: caps.locks },
    { key: "password",       label: "Password",          cap: caps.password },
    { key: "exposure",       label: "Exposure Limit",    cap: caps.exposure },
  ] as const;
  const tabs = allTabs.filter(t => t.cap);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 } }}>
      <DialogTitle sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55" }}>
        <Settings sx={{ mr: 1, verticalAlign: "middle", color: "#886CFF" }} />
        Settings — {agent.username} ({agent.role})
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {tabs.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 1 }}>
            <Lock sx={{ color: "#1E2D55", fontSize: 40 }} />
            <Typography sx={{ color: "#F9F9F9", fontWeight: 600 }}>No Action Permissions</Typography>
            <Typography sx={{ color: "#8384A5", fontSize: 13 }}>
              Your role can view this user but cannot make changes.
            </Typography>
          </Box>
        ) : null}
        {/* Tab selector */}
        <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <Chip key={t.key} label={t.label} clickable
              onClick={() => setTab(t.key as any)}
              sx={{
                bgcolor: tab === t.key ? "#886CFF" : "#10182E",
                color: tab === t.key ? "#fff" : "#8384A5",
                "&:hover": { bgcolor: tab === t.key ? "#9B82FF" : "#1E2D55" },
              }} />
          ))}
        </Box>

        {/* Status tab */}
        {tab === "status" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography sx={{ color: "#8384A5", mb: 1, fontSize: 13 }}>User Status</Typography>
              <RadioGroup row value={status} onChange={(e) => setStatus(e.target.value)}>
                <FormControlLabel value="active" control={<Radio sx={{ color: "#0ECC68", "&.Mui-checked": { color: "#0ECC68" } }} />}
                  label={<Typography sx={{ color: "#F9F9F9" }}>Active</Typography>} />
                <FormControlLabel value="inactive" control={<Radio sx={{ color: "#E01B4F", "&.Mui-checked": { color: "#E01B4F" } }} />}
                  label={<Typography sx={{ color: "#F9F9F9" }}>Inactive</Typography>} />
              </RadioGroup>
            </Box>
            <Box>
              <Typography sx={{ color: "#8384A5", mb: 1, fontSize: 13 }}>Bet Status</Typography>
              <RadioGroup row value={betStatus} onChange={(e) => setBetStatus(e.target.value)}>
                <FormControlLabel value="active" control={<Radio sx={{ color: "#0ECC68", "&.Mui-checked": { color: "#0ECC68" } }} />}
                  label={<Typography sx={{ color: "#F9F9F9" }}>Active</Typography>} />
                <FormControlLabel value="inactive" control={<Radio sx={{ color: "#E01B4F", "&.Mui-checked": { color: "#E01B4F" } }} />}
                  label={<Typography sx={{ color: "#F9F9F9" }}>Inactive</Typography>} />
              </RadioGroup>
            </Box>
          </Box>
        )}

        {/* Locks tab */}
        {tab === "locks" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ color: "#8384A5", fontSize: 12, mb: 1 }}>
              Locks propagate downward — locking a staff member locks their entire downline too.
            </Typography>
            {[
              { label: "Sports Lock", desc: "Block sports betting for this account and all downline users", value: sportsLocked, setter: setSportsLocked, color: "#FFC23F" },
              { label: "Casino Lock", desc: "Block casino/slot games for this account and all downline users", value: casinoLocked, setter: setCasinoLocked, color: "#7B5EF5" },
              { label: "System Lock", desc: "Full lockout — no login, no betting, no access. Auto-logout.", value: systemLocked, setter: setSystemLocked, color: "#E01B4F" },
            ].map((lock) => (
              <Box key={lock.label} sx={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                bgcolor: lock.value ? `${lock.color}15` : "#10182E",
                border: `1px solid ${lock.value ? lock.color : "#1E2D55"}`,
                borderRadius: 1.5, p: 2,
              }}>
                <Box>
                  <Typography sx={{ color: "#F9F9F9", fontWeight: 600, fontSize: 14 }}>{lock.label}</Typography>
                  <Typography sx={{ color: "#8384A5", fontSize: 12 }}>{lock.desc}</Typography>
                </Box>
                <Switch checked={lock.value} onChange={(e) => lock.setter(e.target.checked)}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: lock.color },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: lock.color },
                  }} />
              </Box>
            ))}
          </Box>
        )}

        {/* Password tab */}
        {tab === "password" && (
          <TextField fullWidth label="New Password" type="password" value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
        )}

        {/* Exposure tab */}
        {tab === "exposure" && (
          <Box>
            <Typography sx={{ color: "#8384A5", mb: 1, fontSize: 13 }}>
              Current: {agent.exp_limit != null ? fmt(agent.exp_limit) : "Unlimited"}
            </Typography>
            <TextField fullWidth label="Exposure Limit (empty = unlimited)" type="number"
              value={expLimit} onChange={(e) => setExpLimit(e.target.value)}
              sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
          </Box>
        )}

        {/* Transaction password */}
        <TextField fullWidth label="Transaction Password (Master Password)" type="password"
          value={txnPwd} onChange={(e) => setTxnPwd(e.target.value)}
          sx={{ mt: 3, "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
      </DialogContent>
      <DialogActions sx={{ borderTop: "1px solid #1E2D55", p: 2 }}>
        <Button onClick={onClose} sx={{ color: "#8384A5" }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || tabs.length === 0}
          sx={{ bgcolor: "#886CFF", "&:hover": { bgcolor: "#9B82FF" } }}>
          {saving ? <CircularProgress size={20} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CREATE AGENT MODAL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const CreateAgentModal: React.FC<{
  open: boolean;
  myRole: string;
  onClose: () => void;
  onSuccess: () => void;
  setSnack: (s: SnackState) => void;
}> = ({ open, myRole, onClose, onSuccess, setSnack }) => {
  const [form, setForm] = useState({
    loginName: "", password: "", repeatPassword: "",
    userStatus: "active", betStatus: "active",
    openingBalance: "", userRate: "1", selectedRole: "", notes: "",
    masterPassword: "", email: "",
  });
  const [saving, setSaving] = useState(false);

  const availableRoles = useMemo(() => CHILD_ROLES[myRole] || [], [myRole]);

  useEffect(() => {
    if (availableRoles.length && !form.selectedRole)
      setForm((f) => ({ ...f, selectedRole: availableRoles[0] }));
  }, [availableRoles, form.selectedRole]);

  const handleChange = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.loginName || !form.password || !form.masterPassword) {
      setSnack({ open: true, msg: "Fill all required fields", severity: "error" });
      return;
    }
    if (form.password !== form.repeatPassword) {
      setSnack({ open: true, msg: "Passwords do not match", severity: "error" });
      return;
    }
    setSaving(true);
    try {
      const isUser = form.selectedRole === "User";
      if (isUser) {
        await lordsApi.createUser({
          username: form.loginName,
          email: form.email || `${form.loginName.replace(/\s/g, '')}@ibitplay.local`,
          password: form.password,
          initialBalance: Number(form.openingBalance) || 0,
          percentage: Number(form.userRate) || 1,
          transactionPassword: form.masterPassword,
        });
      } else {
        await lordsApi.createStaff({
          username: form.loginName,
          email: form.email || `${form.loginName.replace(/\s/g, '')}@ibitplay.local`,
          password: form.password,
          role: form.selectedRole,
          initialBalance: Number(form.openingBalance) || 0,
          percentage: Number(form.userRate) || 1,
          transactionPassword: form.masterPassword,
        });
      }
      setSnack({ open: true, msg: `${form.selectedRole} created successfully`, severity: "success" });
      setForm({ loginName: "", password: "", repeatPassword: "", userStatus: "active", betStatus: "active",
        openingBalance: "", userRate: "1", selectedRole: availableRoles[0] || "", notes: "", masterPassword: "", email: "" });
      onSuccess();
      onClose();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || "Creation failed", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 } }}>
      <DialogTitle sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55" }}>
        <Add sx={{ mr: 1, verticalAlign: "middle", color: "#0ECC68" }} />
        Create Agent
      </DialogTitle>
      <DialogContent sx={{ pt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Role select */}
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel sx={{ color: "#8384A5" }}>Select Level</InputLabel>
          <Select value={form.selectedRole} label="Select Level"
            onChange={(e) => handleChange("selectedRole", e.target.value)}
            sx={{ bgcolor: "#10182E" }}>
            {availableRoles.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField fullWidth label="Login Name *" value={form.loginName}
          onChange={(e) => handleChange("loginName", e.target.value)}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />

        <TextField fullWidth label="Email" value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />

        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField fullWidth label="Password *" type="password" value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
          <TextField fullWidth label="Repeat Password *" type="password" value={form.repeatPassword}
            onChange={(e) => handleChange("repeatPassword", e.target.value)}
            sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Box>
            <Typography sx={{ color: "#8384A5", mb: 0.5, fontSize: 13 }}>User Status</Typography>
            <RadioGroup row value={form.userStatus} onChange={(e) => handleChange("userStatus", e.target.value)}>
              <FormControlLabel value="active" control={<Radio size="small" sx={{ color: "#0ECC68", "&.Mui-checked": { color: "#0ECC68" } }} />}
                label={<Typography sx={{ color: "#F9F9F9", fontSize: 13 }}>Active</Typography>} />
              <FormControlLabel value="inactive" control={<Radio size="small" sx={{ color: "#E01B4F", "&.Mui-checked": { color: "#E01B4F" } }} />}
                label={<Typography sx={{ color: "#F9F9F9", fontSize: 13 }}>Inactive</Typography>} />
            </RadioGroup>
          </Box>
          <Box>
            <Typography sx={{ color: "#8384A5", mb: 0.5, fontSize: 13 }}>Bet Status</Typography>
            <RadioGroup row value={form.betStatus} onChange={(e) => handleChange("betStatus", e.target.value)}>
              <FormControlLabel value="active" control={<Radio size="small" sx={{ color: "#0ECC68", "&.Mui-checked": { color: "#0ECC68" } }} />}
                label={<Typography sx={{ color: "#F9F9F9", fontSize: 13 }}>Active</Typography>} />
              <FormControlLabel value="inactive" control={<Radio size="small" sx={{ color: "#E01B4F", "&.Mui-checked": { color: "#E01B4F" } }} />}
                label={<Typography sx={{ color: "#F9F9F9", fontSize: 13 }}>Inactive</Typography>} />
            </RadioGroup>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField fullWidth label="Opening Balance" type="number" value={form.openingBalance}
            onChange={(e) => handleChange("openingBalance", e.target.value)}
            helperText="Funded from your own balance"
            sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
          <TextField fullWidth label="User Rate" type="number" value={form.userRate}
            onChange={(e) => handleChange("userRate", e.target.value)}
            sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }}
            inputProps={{ step: "0.01" }} />
        </Box>

        <TextField fullWidth label="Notes" multiline rows={2} value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />

        <TextField fullWidth label="Master Password (Transaction Password) *" type="password"
          value={form.masterPassword} onChange={(e) => handleChange("masterPassword", e.target.value)}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
      </DialogContent>
      <DialogActions sx={{ borderTop: "1px solid #1E2D55", p: 2 }}>
        <Button onClick={onClose} sx={{ color: "#8384A5" }}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}
          sx={{ bgcolor: "#0ECC68", "&:hover": { bgcolor: "#0BB858" } }}>
          {saving ? <CircularProgress size={20} /> : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEPOSIT / WITHDRAW MODAL

   Moves an actual amount of money. A deposit comes out of your own balance
   and lands in theirs; a withdrawal does the reverse. Neither side can go
   negative — there is no credit limit backing the movement.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FundsModal: React.FC<{
  open: boolean;
  agent: Agent | null;
  mode: "deposit" | "withdraw";
  myBalance: number | null;
  onClose: () => void;
  onSuccess: () => void;
  setSnack: (s: SnackState) => void;
}> = ({ open, agent, mode, myBalance, onClose, onSuccess, setSnack }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [txnPwd, setTxnPwd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setAmount(""); setNote(""); setTxnPwd(""); } }, [open]);

  if (!agent) return null;
  const userType = agent.account_type === "USER" ? "USER" as const : "STAFF" as const;
  const isDeposit = mode === "deposit";
  const amt = Number(amount) || 0;
  const theirBalance = Number(agent.balance || 0);
  const theirNewBalance = isDeposit ? theirBalance + amt : theirBalance - amt;
  const accent = isDeposit ? "#0ECC68" : "#E01B4F";

  // The payer must actually hold the money. `myBalance` is null for the owner,
  // which is the house source of funds and therefore uncapped.
  const overdrawn = isDeposit
    ? myBalance != null && amt > myBalance
    : amt > theirBalance;

  const handleSubmit = async () => {
    if (!amount || amt <= 0) { setSnack({ open: true, msg: "Enter a valid amount", severity: "error" }); return; }
    if (!txnPwd) { setSnack({ open: true, msg: "Transaction password required", severity: "error" }); return; }
    if (overdrawn) {
      setSnack({
        open: true,
        severity: "error",
        msg: isDeposit ? "Amount exceeds your balance" : `${agent.username} does not have that much`,
      });
      return;
    }
    setSaving(true);
    try {
      await lordsApi.transferFunds({
        userId: agent.id,
        userType,
        amount: amt,
        direction: mode,
        note: note || undefined,
        transactionPassword: txnPwd,
      });
      setSnack({
        open: true,
        severity: "success",
        msg: `${fmt(amt)} ${isDeposit ? `deposited to ${agent.username}` : `withdrawn from ${agent.username}`}`,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || "Failed", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 } }}>
      <DialogTitle sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55" }}>
        {isDeposit
          ? <AddCircle sx={{ mr: 1, verticalAlign: "middle", color: "#0ECC68" }} />
          : <RemoveCircle sx={{ mr: 1, verticalAlign: "middle", color: "#E01B4F" }} />}
        {isDeposit ? "Deposit" : "Withdraw"} — {agent.username}
      </DialogTitle>
      <DialogContent sx={{ pt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ bgcolor: "#10182E", border: "1px solid #1E2D55", borderRadius: 1.5, p: 2 }}>
          <Typography sx={{ color: "#8384A5", fontSize: 12, mb: 0.5 }}>
            {agent.username}&rsquo;s Balance
          </Typography>
          <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: 20 }}>{fmt(theirBalance)}</Typography>
          {myBalance != null && (
            <Typography sx={{ color: "#8384A5", fontSize: 11, mt: 0.5 }}>
              Your balance: {fmt(myBalance)}
            </Typography>
          )}
        </Box>

        <TextField fullWidth autoFocus type="number" label={`Amount to ${mode}`}
          value={amount} onChange={(e) => setAmount(e.target.value)}
          error={overdrawn}
          helperText={overdrawn
            ? (isDeposit ? "More than you hold" : `More than ${agent.username} holds`)
            : " "}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />

        {amt > 0 && !overdrawn && (
          <Box sx={{ bgcolor: "#10182E", border: `1px solid ${accent}`, borderRadius: 1.5, p: 1.5 }}>
            <Typography sx={{ color: "#8384A5", fontSize: 11 }}>
              {agent.username}&rsquo;s balance after
            </Typography>
            <Typography sx={{ color: accent, fontWeight: 700, fontSize: 18 }}>{fmt(theirNewBalance)}</Typography>
          </Box>
        )}

        <TextField fullWidth label="Reference / Note" value={note}
          onChange={(e) => setNote(e.target.value)}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />

        <TextField fullWidth label="Transaction Password (Master Password)" type="password"
          value={txnPwd} onChange={(e) => setTxnPwd(e.target.value)}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
      </DialogContent>
      <DialogActions sx={{ borderTop: "1px solid #1E2D55", p: 2 }}>
        <Button onClick={onClose} sx={{ color: "#8384A5" }}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || overdrawn}
          sx={{ bgcolor: accent, "&:hover": { bgcolor: accent, filter: "brightness(1.1)" } }}>
          {saving ? <CircularProgress size={20} /> : isDeposit ? "Deposit" : "Withdraw"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN AGENT LISTING TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const AgentListingTab: React.FC = () => {
  const { can, canAny, isSuper } = usePermissions();
  const canCreate = can("canCreateAgent") || can("canCreateUser");
  const canExport = can("canExportCSV");
  const canMoveFunds = canAny(DEPOSIT_WITHDRAW_KEYS);
  const [agents, setAgents] = useState<Agent[]>([]);
  // Own balance, so the deposit form can stop you spending money you don't have.
  // SuperAdmin is the house source of funds and therefore uncapped (null).
  const [myBalance, setMyBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [parentStack, setParentStack] = useState<{ id: number; name: string }[]>([]);
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: "", severity: "info" });
  const [settingsAgent, setSettingsAgent] = useState<Agent | null>(null);
  const [fundsAction, setFundsAction] = useState<{ agent: Agent; mode: "deposit" | "withdraw" } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  /* The report opens in its own tab so the listing stays put and two accounts
     can be compared side by side. Players get the same screen as agents. */
  const openReport = (a: Agent) => {
    const subject = a.account_type === "USER" ? "user" : "staff";
    window.open(
      `/account-report/${subject}/${a.id}?name=${encodeURIComponent(a.username)}`,
      "_blank",
      "noopener"
    );
  };

  const myRole = localStorage.getItem("userRole") || "SuperAdmin";
  const currentParentId = parentStack.length > 0
    ? parentStack[parentStack.length - 1].id
    : undefined;

  /* Money moves one level at a time: only an account's DIRECT parent may
     deposit into it or withdraw from it. The top level of this listing is your
     own downline, so funds actions belong there and nowhere else — once you
     drill into somebody else's downline you are looking at accounts their
     parent settles with, not you. Paying a grandchild directly would credit
     them out of your balance while the agent in between never sees the money,
     silently breaking their books. The API enforces the same rule. */
  const canMoveFundsHere = canMoveFunds && parentStack.length === 0;
  const fundsOwner = parentStack.length > 0 ? parentStack[parentStack.length - 1].name : null;

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      /**
       * `{data, pagination, meta}` — not `{users, totalPages}`.
       *
       * The listing goes through `apiFetchPage`, so the rows are `data.data`
       * and the count is `data.pagination.totalPages`. Reading `.users` gave
       * `undefined` on every successful response, so the table was empty and
       * the pager stuck at one page.
       *
       * `parentId` IS sent, and it is what makes the drill-down work: without it
       * every request asked for the caller's own children, so clicking the tree
       * icon pushed a breadcrumb and then re-rendered the very same rows under
       * it. It is not the legacy hole it resembles — the server checks the id
       * against the caller's own descendants and answers 404 for anything
       * outside them, so naming a parent asks to walk down rather than out.
       */
      const res = await lordsApi.getAllDetails({
        page,
        limit: 25,
        search: search.length >= 3 ? search : undefined,
        parentId: currentParentId,
      });
      setAgents((res.data ?? []) as Agent[]);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (e: any) {
      /* Don't leave the previous level's rows on screen under the new
         breadcrumb — that reads as "this agent's downline happens to look
         identical", which is exactly the bug this fixed. */
      setAgents([]);
      setTotalPages(1);
      setSnack({ open: true, msg: e?.message || "Failed to load accounts", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [page, search, currentParentId]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const refreshMyBalance = useCallback(async () => {
    if (isSuper) { setMyBalance(null); return; }
    try {
      const res: any = await lordsApi.updateCurrent();
      setMyBalance(Number(res?.data?.balance ?? 0));
    } catch {
      setMyBalance(null);
    }
  }, [isSuper]);

  useEffect(() => { refreshMyBalance(); }, [refreshMyBalance]);

  const afterMoneyMove = useCallback(() => {
    fetchAgents();
    refreshMyBalance();
  }, [fetchAgents, refreshMyBalance]);

  /**
   * Live agent listing.
   *
   * `subscribeToUsersAllDetails` does not exist — admin-service registers no
   * push for this, so the call threw a TypeError on every mount and the effect
   * never ran. `pollUsersAllDetails` is the supported shape: it re-requests on
   * an interval and returns its own unsubscribe.
   *
   * It carries `parentId` for the same reason the HTTP fetch does. Dropping it
   * here was not merely incomplete: the poll re-answers with the caller's own
   * children every ten seconds, so a drilled-down table that loaded correctly
   * still snapped back to the top level on the next tick.
   */
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("staffToken");
    if (!token) return;

    socketService.connect(token);

    const stop = socketService.pollUsersAllDetails(
      { page, limit: 25, search: search.length >= 3 ? search : undefined, parentId: currentParentId },
      (res) => {
        if (Array.isArray(res?.data)) {
          setAgents(res.data as Agent[]);
          setTotalPages(res.pagination?.totalPages || 1);
        }
      }
    );

    return stop;
  }, [page, search, currentParentId]);

  const drillDown = (agent: Agent) => {
    setParentStack((s) => [...s, { id: agent.id, name: agent.username }]);
    setPage(1);
  };

  const goBack = () => {
    setParentStack((s) => s.slice(0, -1));
    setPage(1);
  };

  const exportCSV = () => {
    const header = "Login Name,Role,Balance,Exposure,Percentage,Status,Bet Status,Sports P&L,Casino P&L\n";
    const rows = agents.map((a) =>
      `${a.username},${a.role},${a.balance ?? 0},${a.exposure || 0},${a.percentage},${a.status},${a.bet_status},${a.sports_pnl ?? 0},${a.casino_pnl ?? 0}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agents.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const roleMeta = (role: string) => ROLE_HIERARCHY[role] || { color: "#8384A5", bg: "rgba(131,132,165,0.12)" };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {parentStack.length > 0 && (
            <IconButton onClick={goBack} sx={{ color: "#886CFF" }}><ArrowBack /></IconButton>
          )}
          <Box>
            <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
              {parentStack.length > 0 ? parentStack.map((p) => p.name).join(" > ") : "Agent Listing"}
            </Typography>
            {/* Say why the deposit/withdraw icons are absent, so it reads as a
                rule rather than a missing feature. */}
            {fundsOwner && canMoveFunds && (
              <Typography sx={{ color: "#878AA2", fontSize: 12, mt: 0.25 }}>
                Viewing {fundsOwner}&apos;s downline — only {fundsOwner} can deposit to or withdraw from these accounts.
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {canCreate && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreate(true)}
              sx={{ bgcolor: "#0ECC68", "&:hover": { bgcolor: "#0BB858" }, textTransform: "none" }}>
              Create Agent
            </Button>
          )}
          {canExport && (
            <Tooltip title="Export CSV">
              <IconButton onClick={exportCSV} sx={{ color: "#8384A5" }}><Download /></IconButton>
            </Tooltip>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={fetchAgents} sx={{ color: "#8384A5" }}><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search
      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2, p: 2, mb: 3 }}>
        <TextField fullWidth placeholder="Search by username (min 3 chars)..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: "#8384A5" }} /></InputAdornment>,
          }}
          sx={{ "& .MuiInputBase-root": { bgcolor: "#10182E", borderRadius: 1 } }} />
      </Card> */}

      {/* Table */}
      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#0A0F1F" }}>
                {["Login Name", "Account Type", "Balance",
                  "Net Exposure", "Current %", "Betting Status", "Status",
                  "Sports P&L", "Casino P&L", "Actions",
                ].map((h) => (
                  <TableCell key={h} sx={{ color: "#8384A5", fontWeight: 600, fontSize: 12, borderBottom: "1px solid #1E2D55", whiteSpace: "nowrap" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j} sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Skeleton variant="text" sx={{ bgcolor: "#1E2D55" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ color: "#8384A5", py: 4, borderBottom: "1px solid #1E2D55" }}>
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((a) => {
                  const rm = roleMeta(a.role);
                  return (
                    <TableRow key={`${a.account_type}-${a.id}`} hover
                      onClick={() => setSettingsAgent(a)}
                      sx={{ "&:hover": { bgcolor: "#162140" }, cursor: "pointer" }}>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Typography onClick={(e) => { e.stopPropagation(); setSettingsAgent(a); }}
                          sx={{ color: "#886CFF", fontWeight: 600, fontSize: 13, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
                          {a.username}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Chip label={a.role} size="small"
                          sx={{ bgcolor: rm.bg, color: rm.color, fontWeight: 600, fontSize: 11 }} />
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55", fontSize: 13 }}>
                        <Typography sx={{ color: "#F9F9F9", fontWeight: 600, fontSize: 13 }}>
                          {fmt(a.balance)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55", fontSize: 13 }}>
                        <Typography sx={{ color: Number(a.exposure) > 0 ? "#FFC23F" : "#8384A5", fontWeight: 600, fontSize: 13 }}>
                          {fmt(a.exposure ?? 0)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55", fontSize: 13 }}>
                        {a.percentage}%
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Chip size="small"
                          icon={a.bet_locked ? <Lock sx={{ fontSize: 14 }} /> : <LockOpen sx={{ fontSize: 14 }} />}
                          label={a.bet_locked ? "Locked" : "Unlocked"}
                          sx={{
                            bgcolor: a.bet_locked ? "rgba(224,27,79,0.12)" : "rgba(14,204,104,0.12)",
                            color: a.bet_locked ? "#E01B4F" : "#0ECC68",
                            fontSize: 11,
                          }} />
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Chip size="small" label={a.status === "active" ? "Active" : "Inactive"}
                          sx={{
                            bgcolor: a.status === "active" ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                            color: a.status === "active" ? "#0ECC68" : "#E01B4F",
                            fontSize: 11,
                          }} />
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55", fontSize: 13 }}>
                        <Typography sx={{ color: Number(a.sports_pnl) >= 0 ? "#0ECC68" : "#E01B4F", fontWeight: 600, fontSize: 13 }}>
                          {fmt(a.sports_pnl ?? 0)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55", fontSize: 13 }}>
                        <Typography sx={{ color: Number(a.casino_pnl) >= 0 ? "#0ECC68" : "#E01B4F", fontWeight: 600, fontSize: 13 }}>
                          {fmt(a.casino_pnl ?? 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ borderBottom: "1px solid #1E2D55", whiteSpace: "nowrap" }}>
                        <Box sx={{ display: "flex", gap: 0.25, justifyContent: "center" }}>
                          {canMoveFundsHere && (
                            <>
                              <Tooltip title="Deposit">
                                <span>
                                  <IconButton size="small"
                                    onClick={(e) => { e.stopPropagation(); setFundsAction({ agent: a, mode: "deposit" }); }}
                                    sx={{
                                      color: "#0ECC68",
                                      "&:hover": { bgcolor: "rgba(14,204,104,0.12)" },
                                    }}>
                                    <AddCircle sx={{ fontSize: 20 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Withdraw">
                                <span>
                                  <IconButton size="small"
                                    onClick={(e) => { e.stopPropagation(); setFundsAction({ agent: a, mode: "withdraw" }); }}
                                    sx={{
                                      color: "#E01B4F",
                                      "&:hover": { bgcolor: "rgba(224,27,79,0.12)" },
                                    }}>
                                    <RemoveCircle sx={{ fontSize: 20 }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title={canExport
                            ? `Account report — balance, deposits, withdrawals, sports & casino`
                            : "No permission"}>
                            <span>
                              <IconButton size="small" disabled={!canExport}
                                onClick={(e) => { e.stopPropagation(); openReport(a); }}
                                sx={{
                                  color: "#A08FFF",
                                  "&:hover": { bgcolor: "rgba(85,129,247,0.12)" },
                                  "&.Mui-disabled": { color: "#1E2D55" },
                                }}>
                                <Assessment sx={{ fontSize: 20 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={a.has_downline ? `View ${a.username}'s downline` : "No downline"}>
                            <span>
                              <IconButton size="small" disabled={!a.has_downline}
                                onClick={(e) => { e.stopPropagation(); drillDown(a); }}
                                sx={{
                                  color: a.has_downline ? "#F9F9F9" : "#1E2D55",
                                  "&:hover": { color: "#886CFF", bgcolor: "rgba(136,108,255,0.08)" },
                                  "&.Mui-disabled": { color: "#1E2D55" },
                                }}>
                                <AccountTree sx={{ fontSize: 20 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)}
              sx={{
                "& .MuiPaginationItem-root": { color: "#8384A5" },
                "& .Mui-selected": { bgcolor: "#886CFF !important", color: "#fff" },
              }} />
          </Box>
        )}
      </Card>

      {/* Modals */}
      <UserSettingsModal
        open={!!settingsAgent}
        agent={settingsAgent}
        onClose={() => setSettingsAgent(null)}
        onSuccess={fetchAgents}
        setSnack={setSnack}
      />

      <CreateAgentModal
        open={showCreate}
        myRole={myRole}
        onClose={() => setShowCreate(false)}
        onSuccess={afterMoneyMove}
        setSnack={setSnack}
      />

      <FundsModal
        open={!!fundsAction}
        agent={fundsAction?.agent || null}
        mode={fundsAction?.mode || "deposit"}
        myBalance={myBalance}
        onClose={() => setFundsAction(null)}
        onSuccess={afterMoneyMove}
        setSnack={setSnack}
      />

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AgentListingTab;
