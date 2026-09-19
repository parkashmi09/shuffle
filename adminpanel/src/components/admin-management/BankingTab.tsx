import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, Typography, TextField, InputAdornment, Avatar, Chip,
  IconButton, Tooltip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Select, MenuItem, FormControl,
  Snackbar, Alert, AlertColor, CircularProgress, Skeleton,
} from "@mui/material";
import {
  Search, Refresh, TrendingUp, TrendingDown, AccountBalanceWallet,
  FilterList, ClearAll, People,
} from "@mui/icons-material";
import { apiFetch, buildPath } from "../../utils/api";
import { ENDPOINTS } from "../../services/endpoints";

/* ─────────────────────── CONSTANTS */
export const ROLE_HIERARCHY = {
  SuperAdmin: { level: 0, color: "#F9F9F9",  bg: "rgba(249,249,249,0.08)" },
  Admin:      { level: 1, color: "#E01B4F",  bg: "rgba(224,27,79,0.12)"   },
  SubAdmin:   { level: 2, color: "#FFC23F",  bg: "rgba(255,194,63,0.12)"  },
  Master:     { level: 3, color: "#886CFF",  bg: "rgba(136,108,255,0.12)"  },
  Agent:      { level: 4, color: "#0ECC68",  bg: "rgba(14,204,104,0.12)"  },
  SubAgent:   { level: 5, color: "#7B5EF5",  bg: "rgba(123,94,245,0.12)"  },
  User:       { level: 6, color: "#8384A5",  bg: "rgba(131,132,165,0.12)" },
} as const;

/* ─────────────────────── TYPES */
export interface Row {
  id: number;
  name: string;
  role: keyof typeof ROLE_HIERARCHY;
  balance: number;
  parent_id: number | null;
  phone?: string | null;
  country?: string | null;
}

/** `GET /admin/staff/rollup/:staffId` — `balance` is a decimal string, not a number. */
interface Rollup {
  staffId: number;
  includesSubtree: boolean;
  staffAccounts: number;
  players: number;
  balance: string;
  currency: string;
}

const toArray = (x: any) =>
  Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : [];

const avatarColor = (name: string) => {
  const colors = ["#886CFF","#7B5EF5","#0ECC68","#FFC23F","#E01B4F"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

/* ── Stat card ── */
const StatCard: React.FC<{ title: string; balance: number; color?: string }> = ({
  title, balance, color = "#886CFF",
}) => (
  <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2, p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <AccountBalanceWallet sx={{ color, fontSize: 20 }} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ color: "#8384A5", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</Typography>
      <Typography sx={{ color: "#F9F9F9", fontSize: "1rem", fontWeight: 700, fontFamily: "monospace" }}>
        ₹{balance.toFixed(2)}
      </Typography>
    </Box>
  </Card>
);

/* ── Transfer cell ── */
const TransferCell: React.FC<{
  rowId: number;
  role: Row["role"];
  val: string;
  setVal: (v: string) => void;
  direction: "deposit" | "withdraw";
  onTransfer: (o: { toId: number; toRole: Row["role"]; amount: number; direction: "deposit" | "withdraw" }) => void;
}> = ({ rowId, role, val, setVal, direction, onTransfer }) => {
  const isDeposit = direction === "deposit";
  const color = isDeposit ? "#886CFF" : "#E01B4F";
  const hoverBg = isDeposit ? "rgba(136,108,255,0.18)" : "rgba(224,27,79,0.18)";
  return (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
      <TextField
        size="small"
        type="number"
        placeholder="0"
        value={val}
        onChange={e => setVal(e.target.value)}
        inputProps={{ min: 0 }}
        sx={{
          width: 80,
          "& .MuiOutlinedInput-root": {
            bgcolor: "#0C0D1D", borderRadius: 1.5, fontSize: "0.75rem",
            "& fieldset": { borderColor: "#1E2D55" },
            "&:hover fieldset": { borderColor: color },
            "&.Mui-focused fieldset": { borderColor: color },
          },
          "& input": { color: "#F9F9F9", py: "5px", px: 1 },
        }}
      />
      <Button
        size="small"
        variant="contained"
        disabled={!Number(val)}
        onClick={() => onTransfer({ toId: rowId, toRole: role, amount: Number(val), direction })}
        sx={{
          bgcolor: color, "&:hover": { bgcolor: hoverBg, color },
          "&.Mui-disabled": { bgcolor: "#1E2D55", color: "#8384A5" },
          borderRadius: 1.5, fontSize: "0.7rem", fontWeight: 700,
          minWidth: 0, px: 1.25, py: 0.6, whiteSpace: "nowrap",
        }}
      >
        {isDeposit ? "Deposit" : "Withdraw"}
      </Button>
    </Box>
  );
};

/* ── Main component ── */
export default function BankingTab() {
  const myRole = (localStorage.getItem("userRole") as keyof typeof ROLE_HIERARCHY) || "SuperAdmin";
  const myId   = Number(localStorage.getItem("currentUserId") || 1);
  const myLvl  = ROLE_HIERARCHY[myRole].level;

  const [rows,      setRows]      = useState<Row[]>([]);
  const [rollup,    setRollup]    = useState<Record<number, any>>({});
  const [myBal,     setMyBal]     = useState(0);
  const [depVal,    setDepVal]    = useState<Record<number, string>>({});
  const [wdVal,     setWdVal]     = useState<Record<number, string>>({});
  const [snack,     setSnack]     = useState<{ open: boolean; message: string; severity: AlertColor }>({ open: false, message: "", severity: "success" });
  const [loading,   setLoading]   = useState(true);
  const [plData,    setPlData]    = useState<Record<number, number>>({});
  const [plLoading, setPlLoading] = useState<Record<number, boolean>>({});
  const [q,         setQ]         = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  /* fetch */
  const refresh = async () => {
    try {
      setLoading(true);
      const [list, rollAll, self] = await Promise.all([
        apiFetch<Row[]>(ENDPOINTS.staff.list),
        apiFetch<any[]>(buildPath(ENDPOINTS.staff.rollup, { staffId: myId }), { query: { includeSubtree: true } }),
        apiFetch<Rollup>(buildPath(ENDPOINTS.staff.rollup, { staffId: myId })),
      ]);
      const rows1 = toArray(list);
      setRows(rows1);
      // `apiFetch` already unwraps the `{success, data}` envelope, so the fields
      // are on `self` itself — `self.data` read undefined and this rendered 0.00.
      setMyBal(Number(self.balance ?? 0));
      const arr = toArray(rollAll);
      setRollup(Object.fromEntries(arr.map((o: any) => [Number(o.staff_id), o])));

      if (rows1.length === 0) { setPlData({}); setPlLoading({}); return; }

      const plResults = await Promise.all(
        rows1.map(async (row: { id: any; role: string }) => {
          setPlLoading(p => ({ ...p, [Number(row.id)]: true }));
          const endpoint = row.role === "User" ? "/api/deposit/user-pl" : "/api/deposit/staff-pl";
          const body = row.role === "User" ? { userId: row.id } : { staffId: row.id };
          try {
            const res = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
            return { id: Number(row.id), profitLoss: Number(res?.data?.profitLoss ?? 0) };
          } catch { return { id: Number(row.id), profitLoss: 0 }; }
          finally { setPlLoading(p => ({ ...p, [Number(row.id)]: false })); }
        })
      );
      setPlData(Object.fromEntries(plResults.map(({ id, profitLoss }) => [id, profitLoss])));
    } catch (err: any) {
      setSnack({ open: true, severity: "error", message: err.message || "Server error" });
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  /* derived */
  const roleTotals = useMemo(() => {
    const tot: Record<string, number> = {};
    Object.keys(ROLE_HIERARCHY).forEach(r => (tot[r] = 0));
    rows.forEach(r => { tot[r.role] += r.balance; });
    return tot;
  }, [rows]);

  const myChildren = useMemo(() => rows.filter(r => r.parent_id === myId), [rows, myId]);
  const manageable = useMemo(() => rows.filter(r => ROLE_HIERARCHY[r.role].level > myLvl), [rows, myLvl]);

  const haveFunds = (amt: number) => Number(myBal) >= Number(amt);

  /* transfer */
  const doTransfer = async (opts: { toId: number; toRole: Row["role"]; amount: number; direction: "deposit" | "withdraw" }) => {
    const { toId, toRole, amount, direction } = opts;
    if (!amount || amount <= 0) return setSnack({ open: true, severity: "error", message: "Enter valid amount" });
    if (direction === "deposit" && !haveFunds(amount))
      return setSnack({ open: true, severity: "error", message: "Insufficient balance" });
    if (direction === "withdraw") {
      const child = rows.find(r => r.id === toId);
      if (child && amount > child.balance)
        return setSnack({ open: true, severity: "error", message: `${child.name} has only ₹${child.balance.toFixed(2)}` });
    }
    try {
      await apiFetch(ENDPOINTS.staff.transfer, { method: "POST", body: JSON.stringify({ toType: toRole === "User" ? "user" : "staff", toId, amount, direction }) });
      setSnack({ open: true, severity: "success", message: `${direction === "deposit" ? "Sent" : "Received"} ₹${amount}` });
      setDepVal(v => ({ ...v, [toId]: "" }));
      setWdVal(v => ({ ...v, [toId]: "" }));
      refresh();
      window.dispatchEvent(new Event("balance-changed"));
    } catch (err: any) {
      setSnack({ open: true, severity: "error", message: err.message || "Transfer failed" });
    }
  };

  /* filter */
  const matchesFilter = (r: Row) => {
    const nameMatch = q === "" || r.name.toLowerCase().includes(q.toLowerCase());
    const roleMatch = roleFilter === "All" || r.role === roleFilter;
    return nameMatch && roleMatch;
  };

  const visible = myRole === "SuperAdmin" ? rows.filter(r => r.role !== "SuperAdmin") : (myRole === "SubAdmin" ? myChildren : manageable);
  const filtered = visible.filter(matchesFilter);

  /* balance cards config */
  const isAdmin = myRole === "Admin";
  const statCards = isAdmin ? [
    { title: "Total Balance",       balance: roleTotals.User,     color: "#886CFF" },
    { title: "Remaining Balance",   balance: roleTotals.Admin,    color: "#7B5EF5" },
    { title: "Total Agent Balance", balance: roleTotals.Agent,    color: "#0ECC68" },
    { title: "Total Exposure",      balance: 0,                   color: "#FFC23F" },
    { title: "Total Admin",         balance: roleTotals.Admin,    color: "#E01B4F" },
  ] : [
    { title: "Your Balance",           balance: myBal,                color: "#886CFF" },
    { title: "Total User Balance",     balance: roleTotals.User,      color: "#0ECC68" },
    { title: "Total Agent Balance",    balance: roleTotals.Agent,     color: "#FFC23F" },
    { title: "Total Sub-Agent Bal.",   balance: roleTotals.SubAgent,  color: "#7B5EF5" },
    { title: "Total Master Balance",   balance: roleTotals.Master,    color: "#E01B4F" },
  ];

  const HEADER_CELLS = ["User", "Role", "Balance", "Downline Bal.", "Deposit", "Withdraw", "Ref P/L", "Exposure", "Remark"];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>

      {/* ── Stat cards ── */}
      {loading ? (
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={72} sx={{ bgcolor: "#1E2D55", flex: 1, minWidth: 140 }} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          {statCards.map(c => <StatCard key={c.title} {...c} />)}
        </Box>
      )}

      {/* ── Table card ── */}
      <Card sx={{ bgcolor: "#0E1831", border: "1px solid #1E2D55", borderRadius: 2 }}>

        {/* Toolbar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, borderBottom: "1px solid #1E2D55", flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: "auto" }}>
            <People sx={{ color: "#886CFF", fontSize: 20 }} />
            <Typography sx={{ color: "#F9F9F9", fontWeight: 700, fontSize: "0.9rem" }}>
              Client Banking
              <Typography component="span" sx={{ ml: 1, color: "#8384A5", fontWeight: 400, fontSize: "0.78rem" }}>
                ({filtered.length} clients)
              </Typography>
            </Typography>
          </Box>

          <TextField
            size="small"
            placeholder="Search by username…"
            value={q}
            onChange={e => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: "#8384A5", fontSize: 18 }} /></InputAdornment> }}
            sx={{
              width: 220,
              "& .MuiOutlinedInput-root": { bgcolor: "#0C0D1D", borderRadius: 1.5, "& fieldset": { borderColor: "#1E2D55" }, "&:hover fieldset": { borderColor: "#886CFF" }, "&.Mui-focused fieldset": { borderColor: "#886CFF" } },
              "& input": { color: "#F9F9F9", fontSize: "0.82rem" },
            }}
          />

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              startAdornment={<FilterList sx={{ color: "#8384A5", fontSize: 18, mr: 0.5 }} />}
              sx={{ bgcolor: "#0C0D1D", color: "#F9F9F9", fontSize: "0.82rem", borderRadius: 1.5, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#1E2D55" }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#886CFF" }, "& .MuiSvgIcon-root": { color: "#8384A5" } }}
              MenuProps={{ PaperProps: { sx: { bgcolor: "#0E1831", border: "1px solid #1E2D55", "& .MuiMenuItem-root": { color: "#F9F9F9", fontSize: "0.82rem", "&:hover": { bgcolor: "#121E38" } } } } }}
            >
              <MenuItem value="All">All Roles</MenuItem>
              {Object.keys(ROLE_HIERARCHY).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <Tooltip title="Clear filters">
            <IconButton size="small" onClick={() => { setQ(""); setRoleFilter("All"); }}
              sx={{ color: "#8384A5", border: "1px solid #1E2D55", borderRadius: 1.5, "&:hover": { color: "#F9F9F9", borderColor: "#886CFF" } }}>
              <ClearAll fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh">
            <IconButton size="small" onClick={refresh}
              sx={{ color: "#8384A5", border: "1px solid #1E2D55", borderRadius: 1.5, "&:hover": { color: "#886CFF", borderColor: "#886CFF" } }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Table */}
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#0C0D1D" }}>
                {HEADER_CELLS.map(h => (
                  <TableCell key={h} sx={{ color: "#8384A5", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #1E2D55", py: 1.25, whiteSpace: "nowrap" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {HEADER_CELLS.map((_, j) => (
                        <TableCell key={j} sx={{ borderBottom: "1px solid #1E2D5533", py: 1.5 }}>
                          <Skeleton variant="text" sx={{ bgcolor: "#1E2D55" }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.map(r => {
                    const roleCfg = ROLE_HIERARCHY[r.role];
                    const pl = plData[r.id];
                    const isPlLoading = plLoading[r.id];

                    return (
                      <TableRow key={r.id} sx={{ "&:hover": { bgcolor: "#121E38" }, "& td": { borderBottom: "1px solid #1E2D5533" } }}>

                        {/* User */}
                        <TableCell sx={{ py: 1.25 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Avatar sx={{ width: 30, height: 30, fontSize: "0.65rem", fontWeight: 700, bgcolor: avatarColor(r.name), flexShrink: 0 }}>
                              {r.name.slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Typography sx={{ color: "#A08FFF", fontSize: "0.78rem", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                              {r.name}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Role */}
                        <TableCell sx={{ py: 1.25 }}>
                          <Chip label={r.role} size="small"
                            sx={{ bgcolor: roleCfg.bg, color: roleCfg.color, fontWeight: 700, fontSize: "0.68rem", height: 20, border: `1px solid ${roleCfg.color}33` }}
                          />
                        </TableCell>

                        {/* Balance */}
                        <TableCell sx={{ py: 1.25 }}>
                          <Typography sx={{ color: "#F9F9F9", fontSize: "0.78rem", fontWeight: 700, fontFamily: "monospace" }}>
                            ₹{r.balance.toFixed(2)}
                          </Typography>
                        </TableCell>

                        {/* Downline */}
                        <TableCell sx={{ py: 1.25 }}>
                          <Typography sx={{ color: "#8384A5", fontSize: "0.75rem", fontFamily: "monospace" }}>
                            ₹{(rollup[r.id]?.downline_balance ?? 0).toFixed(2)}
                          </Typography>
                        </TableCell>

                        {/* Deposit */}
                        <TableCell sx={{ py: 1.25 }}>
                          <TransferCell rowId={r.id} role={r.role} direction="deposit"
                            val={depVal[r.id] || ""} setVal={v => setDepVal(p => ({ ...p, [r.id]: v }))}
                            onTransfer={doTransfer}
                          />
                        </TableCell>

                        {/* Withdraw */}
                        <TableCell sx={{ py: 1.25 }}>
                          <TransferCell rowId={r.id} role={r.role} direction="withdraw"
                            val={wdVal[r.id] || ""} setVal={v => setWdVal(p => ({ ...p, [r.id]: v }))}
                            onTransfer={doTransfer}
                          />
                        </TableCell>

                        {/* Ref P/L */}
                        <TableCell sx={{ py: 1.25 }}>
                          {isPlLoading ? (
                            <CircularProgress size={14} sx={{ color: "#8384A5" }} />
                          ) : pl !== undefined ? (
                            <Chip
                              label={`₹${pl.toFixed(2)}`}
                              size="small"
                              icon={pl >= 0 ? <TrendingUp sx={{ fontSize: "12px !important" }} /> : <TrendingDown sx={{ fontSize: "12px !important" }} />}
                              sx={{
                                bgcolor: pl >= 0 ? "rgba(14,204,104,0.12)" : "rgba(224,27,79,0.12)",
                                color: pl >= 0 ? "#0ECC68" : "#E01B4F",
                                fontWeight: 700, fontSize: "0.68rem", height: 20, fontFamily: "monospace",
                                border: `1px solid ${pl >= 0 ? "rgba(14,204,104,0.3)" : "rgba(224,27,79,0.3)"}`,
                                "& .MuiChip-icon": { color: "inherit", ml: "4px" },
                              }}
                            />
                          ) : (
                            <Typography sx={{ color: "#8384A5", fontSize: "0.72rem" }}>N/A</Typography>
                          )}
                        </TableCell>

                        {/* Exposure / Remark */}
                        <TableCell sx={{ py: 1.25 }} />
                        <TableCell sx={{ py: 1.25 }} />
                      </TableRow>
                    );
                  })}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 6, borderBottom: "none" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <People sx={{ fontSize: 40, color: "#1E2D55" }} />
                      <Typography sx={{ color: "#8384A5", fontSize: "0.85rem" }}>No clients found</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={snack.severity}
          sx={{ bgcolor: snack.severity === "success" ? "#0E2B1F" : "#2B0E1A", color: snack.severity === "success" ? "#0ECC68" : "#E01B4F", border: `1px solid ${snack.severity === "success" ? "#0ECC68" : "#E01B4F"}` }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
