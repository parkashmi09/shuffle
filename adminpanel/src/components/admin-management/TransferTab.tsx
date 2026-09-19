import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Card, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Snackbar,
  Alert, CircularProgress, Skeleton, AlertColor, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import { Refresh, CheckCircle, Error as ErrorIcon, Lock } from "@mui/icons-material";
import * as lordsApi from "../../services/lordsApi";
import { usePermissions } from "../../hooks/usePermissions";
import { DEPOSIT_WITHDRAW_KEYS } from "../../constants/permissions";

/* ─── TYPES ────────────────────────────────────────────── */
interface Agent {
  id: number;
  username: string;
  role: string;
  account_type: string;
  /** Real INR wallet balance — the only number that gates a movement. */
  balance: number;
  exposure: number;
  /** Lifetime sports P&L you made from this account (+ = you earned). */
  sports_pnl: number;
  /** Lifetime casino P&L you made from this account (+ = you earned). */
  casino_pnl: number;
}

interface RowState {
  amount: string;
  status: "idle" | "loading" | "success" | "error";
  msg: string;
}

interface SnackState { open: boolean; msg: string; severity: AlertColor; }

type Direction = "deposit" | "withdraw";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyRow: RowState = { amount: "", status: "idle", msg: "" };

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEPOSIT / WITHDRAW TAB

   Bulk funding grid for the whole downline. Every row moves an actual
   amount: a deposit comes out of your balance, a withdrawal goes back
   into it. There are no credit limits and nothing to "settle" — the
   P&L columns are read-only lifetime figures, shown for context only.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const TransferTab: React.FC = () => {
  const { canAny, isSuper } = usePermissions();
  const canMoveFunds = canAny(DEPOSIT_WITHDRAW_KEYS);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [direction, setDirection] = useState<Direction>("deposit");
  const [txnPwd, setTxnPwd] = useState("");
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: "", severity: "info" });
  // Own balance caps what you can hand out. SuperAdmin is the house source
  // of funds, so it is uncapped (null).
  const [myBalance, setMyBalance] = useState<number | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      // `{data, pagination, meta}` — `.users` has never been on this response.
      const res = await lordsApi.getAllDetails({ page: 1, limit: 100 });
      const rows = (res.data ?? []) as Agent[];
      setAgents(rows);
      const init: Record<string, RowState> = {};
      rows.forEach((a: Agent) => {
        init[`${a.account_type}-${a.id}`] = { ...emptyRow };
      });
      setRowStates(init);
    } catch (e) {
      setSnack({ open: true, msg: "Failed to load accounts", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyBalance = useCallback(async () => {
    if (isSuper) { setMyBalance(null); return; }
    try {
      const res: any = await lordsApi.updateCurrent();
      setMyBalance(Number(res?.data?.balance ?? 0));
    } catch {
      setMyBalance(null);
    }
  }, [isSuper]);

  useEffect(() => { fetchAgents(); fetchMyBalance(); }, [fetchAgents, fetchMyBalance]);

  const getKey = (a: Agent) => `${a.account_type}-${a.id}`;

  const setRowAmount = (a: Agent, val: string) => {
    setRowStates((s) => ({ ...s, [getKey(a)]: { ...(s[getKey(a)] ?? emptyRow), amount: val, status: "idle", msg: "" } }));
  };

  /** Withdrawals can be pre-filled with the account's whole balance. */
  const fillAll = (a: Agent) => {
    setRowStates((s) => ({ ...s, [getKey(a)]: { ...(s[getKey(a)] ?? emptyRow), amount: String(a.balance ?? 0) } }));
  };

  const pendingTotal = useMemo(
    () => agents.reduce((sum, a) => sum + (Number(rowStates[getKey(a)]?.amount) || 0), 0),
    [agents, rowStates]
  );

  const overBudget = direction === "deposit" && myBalance != null && pendingTotal > myBalance;

  const submitRow = async (a: Agent): Promise<boolean> => {
    const key = getKey(a);
    const amt = Number(rowStates[key]?.amount) || 0;
    if (amt <= 0) return false;

    if (direction === "withdraw" && amt > Number(a.balance || 0)) {
      setRowStates((s) => ({ ...s, [key]: { ...s[key], status: "error", msg: "More than they hold" } }));
      return false;
    }

    setRowStates((s) => ({ ...s, [key]: { ...s[key], status: "loading", msg: "" } }));
    try {
      await lordsApi.transferFunds({
        userId: a.id,
        userType: a.account_type === "USER" ? "USER" : "STAFF",
        amount: amt,
        direction,
        transactionPassword: txnPwd,
      });
      setRowStates((s) => ({ ...s, [key]: { amount: "", status: "success", msg: "Done" } }));
      return true;
    } catch (e: any) {
      setRowStates((s) => ({ ...s, [key]: { ...s[key], status: "error", msg: e?.message || "Failed" } }));
      return false;
    }
  };

  const guard = () => {
    if (!canMoveFunds) {
      setSnack({ open: true, msg: "You don't have permission to move funds", severity: "error" });
      return false;
    }
    if (!txnPwd) {
      setSnack({ open: true, msg: "Enter transaction password", severity: "error" });
      return false;
    }
    return true;
  };

  const handleRow = async (a: Agent) => {
    if (!guard()) return;
    await submitRow(a);
    setTimeout(() => { fetchAgents(); fetchMyBalance(); }, 1200);
  };

  const [batchLoading, setBatchLoading] = useState(false);

  const handleSubmitAll = async () => {
    if (!guard()) return;
    if (overBudget) {
      setSnack({ open: true, msg: "Total exceeds your balance", severity: "error" });
      return;
    }
    setBatchLoading(true);
    // Sequential on purpose: each movement debits the same balance, so running
    // them in parallel would race the check the server does on every request.
    for (const a of agents) {
      if ((Number(rowStates[getKey(a)]?.amount) || 0) > 0) await submitRow(a);
    }
    setBatchLoading(false);
    setTimeout(() => { fetchAgents(); fetchMyBalance(); }, 1200);
  };

  const isDeposit = direction === "deposit";
  const accent = isDeposit ? "#0ECC68" : "#E01B4F";

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
            Deposit / Withdraw
          </Typography>
          <Typography sx={{ color: "#8384A5", fontSize: 12, mt: 0.5 }}>
            {myBalance != null
              ? `Your balance: ${fmt(myBalance)}`
              : "You are the house source of funds — deposits are uncapped"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <ToggleButtonGroup exclusive size="small" value={direction}
            onChange={(_, v: Direction | null) => v && setDirection(v)}
            sx={{
              "& .MuiToggleButton-root": { color: "#8384A5", borderColor: "#1E2D55", textTransform: "none", fontSize: 13, px: 2 },
              "& .Mui-selected": { color: "#F9F9F9 !important", bgcolor: `${accent}22 !important` },
            }}>
            <ToggleButton value="deposit">Deposit</ToggleButton>
            <ToggleButton value="withdraw">Withdraw</ToggleButton>
          </ToggleButtonGroup>
          <TextField size="small" label="Transaction Password" type="password"
            value={txnPwd} onChange={(e) => setTxnPwd(e.target.value)}
            sx={{ width: 220, "& .MuiInputBase-root": { bgcolor: "#10182E" } }} />
          <Tooltip title={canMoveFunds ? "" : "No permission"}>
            <span>
              <Button variant="contained" onClick={handleSubmitAll}
                disabled={batchLoading || !canMoveFunds || pendingTotal <= 0 || overBudget}
                startIcon={!canMoveFunds ? <Lock sx={{ fontSize: 14 }} /> : undefined}
                sx={{ bgcolor: accent, "&:hover": { bgcolor: accent, filter: "brightness(1.1)" }, textTransform: "none" }}>
                {batchLoading
                  ? <CircularProgress size={20} />
                  : `${isDeposit ? "Deposit" : "Withdraw"} All${pendingTotal > 0 ? ` (${fmt(pendingTotal)})` : ""}`}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { fetchAgents(); fetchMyBalance(); }} sx={{ color: "#8384A5" }}><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {overBudget && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The amounts entered total {fmt(pendingTotal)}, more than your balance of {fmt(myBalance)}.
        </Alert>
      )}

      {/* Table */}
      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#0A0F1F" }}>
                {["Username", "Role", "Balance", "Exposure", "Sports P&L", "Casino P&L",
                  `Amount to ${isDeposit ? "deposit" : "withdraw"}`, "Action", "Status"].map((h) => (
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
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j} sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Skeleton variant="text" sx={{ bgcolor: "#1E2D55" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: "#8384A5", py: 4, borderBottom: "1px solid #1E2D55" }}>
                    No accounts found
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((a) => {
                  const key = getKey(a);
                  const rs = rowStates[key] || emptyRow;
                  const balance = Number(a.balance || 0);
                  const amt = Number(rs.amount) || 0;
                  const rowInvalid = !isDeposit && amt > balance;
                  return (
                    <TableRow key={key} sx={{ "&:hover": { bgcolor: "#162140" } }}>
                      <TableCell sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55", fontSize: 13, fontWeight: 600 }}>
                        {a.username}
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Chip label={a.role} size="small" sx={{ fontSize: 11 }} />
                      </TableCell>
                      <TableCell sx={{ color: "#F9F9F9", borderBottom: "1px solid #1E2D55", fontSize: 13, fontWeight: 600 }}>
                        {fmt(balance)}
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55", fontSize: 13 }}>
                        <Typography sx={{ color: (a.exposure || 0) > 0 ? "#FFC23F" : "#8384A5", fontSize: 13 }}>
                          {fmt(a.exposure || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Typography sx={{ color: Number(a.sports_pnl) >= 0 ? "#0ECC68" : "#E01B4F", fontWeight: 600, fontSize: 13 }}>
                          {fmt(a.sports_pnl ?? 0)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Typography sx={{ color: Number(a.casino_pnl) >= 0 ? "#0ECC68" : "#E01B4F", fontWeight: 600, fontSize: 13 }}>
                          {fmt(a.casino_pnl ?? 0)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                          <TextField size="small" type="number" value={rs.amount}
                            onChange={(e) => setRowAmount(a, e.target.value)}
                            error={rowInvalid}
                            placeholder="Amount"
                            sx={{ width: 120, "& .MuiInputBase-root": { bgcolor: "#10182E", height: 32, fontSize: 13 } }} />
                          {!isDeposit && balance > 0 && (
                            <Button size="small" onClick={() => fillAll(a)}
                              sx={{ color: "#886CFF", minWidth: 40, fontSize: 11, textTransform: "none" }}>
                              All
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        <Tooltip title={canMoveFunds ? "" : "No permission"}>
                          <span>
                            <Button size="small" variant="contained" onClick={() => handleRow(a)}
                              disabled={amt <= 0 || rowInvalid || rs.status === "loading" || !canMoveFunds}
                              sx={{ bgcolor: accent, "&:hover": { bgcolor: accent, filter: "brightness(1.1)" }, fontSize: 11, textTransform: "none", minWidth: 76 }}>
                              {rs.status === "loading" ? <CircularProgress size={16} /> : isDeposit ? "Deposit" : "Withdraw"}
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid #1E2D55" }}>
                        {rs.status === "success" && (
                          <Chip size="small" icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Done"
                            sx={{ bgcolor: "rgba(14,204,104,0.12)", color: "#0ECC68", fontSize: 11 }} />
                        )}
                        {rs.status === "error" && (
                          <Chip size="small" icon={<ErrorIcon sx={{ fontSize: 14 }} />} label={rs.msg}
                            sx={{ bgcolor: "rgba(224,27,79,0.12)", color: "#E01B4F", fontSize: 11 }} />
                        )}
                        {rowInvalid && rs.status === "idle" && (
                          <Typography sx={{ color: "#E01B4F", fontSize: 11 }}>Exceeds balance</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

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

export default TransferTab;
