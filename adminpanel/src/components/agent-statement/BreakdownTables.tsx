/* Everything behind the headline number: day by day, sports, casino, and who
   the money came from. Each panel is a plain table — no chart needed to answer
   "which day did I lose it on". */
import React from "react";
import {
  Box, Card, Chip, CircularProgress, Pagination as MuiPagination, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { AgentStatement, CasinoTxnRow, Pagination, SportsBetRow, SubjectType } from "./types";
import { C, cardSx, headCellSx, bodyCellSx, money, n, signed, pnlColor, dayLabel, stamp, Range } from "./ui";
import { useBetPage } from "./useBetPage";

/** Props every gaming panel needs to page its own bet list. */
export interface PanelProps {
  data: AgentStatement;
  subjectType: SubjectType;
  subjectId: string;
  range: Range;
}

const Panel: React.FC<{
  title: string; note?: string; busy?: boolean; children: React.ReactNode;
}> = ({ title, note, busy, children }) => (
  <Card sx={{ ...cardSx, mb: 2 }}>
    <Box sx={{ p: 2, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ color: C.text, fontWeight: 600 }}>{title}</Typography>
        {note && <Typography sx={{ color: C.muted, fontSize: 11.5 }}>{note}</Typography>}
      </Box>
      {busy && <CircularProgress size={16} sx={{ color: C.primary }} />}
    </Box>
    {children}
  </Card>
);

/** Page control shown under a bet list; hidden when everything fits on one page. */
const Pager: React.FC<{ pagination: Pagination; onPage: (p: number) => void }> = ({ pagination, onPage }) =>
  pagination.totalPages <= 1 ? null : (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2, p: 2, flexWrap: "wrap" }}>
      <Typography sx={{ color: C.muted, fontSize: 11.5 }}>
        {(pagination.page - 1) * pagination.limit + 1}–
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString("en-IN")}
      </Typography>
      <MuiPagination
        count={pagination.totalPages}
        page={pagination.page}
        onChange={(_, p) => onPage(p)}
        size="small"
        siblingCount={1}
        sx={{
          "& .MuiPaginationItem-root": { color: C.sub },
          "& .Mui-selected": { bgcolor: `${C.primary} !important`, color: "#fff" },
        }}
      />
    </Box>
  );

const Head: React.FC<{ cols: { label: string; right?: boolean }[] }> = ({ cols }) => (
  <TableHead>
    <TableRow>
      {cols.map((c) => (
        <TableCell key={c.label} sx={{ ...headCellSx, textAlign: c.right ? "right" : "left" }}>
          {c.label}
        </TableCell>
      ))}
    </TableRow>
  </TableHead>
);

const Empty: React.FC<{ span: number; text: string }> = ({ span, text }) => (
  <TableRow>
    <TableCell colSpan={span} sx={{ ...bodyCellSx, textAlign: "center", py: 4, color: C.sub }}>
      {text}
    </TableCell>
  </TableRow>
);

const num = { ...bodyCellSx, textAlign: "right" as const };

/* ─── Day by day ────────────────────────────────────────────────────────── */
export const DailyPanel: React.FC<{ data: AgentStatement }> = ({ data }) => (
  <Panel
    title="Day by day"
    note="Money moved and betting result for each day in the period."
  >
    <TableContainer sx={{ maxHeight: 520 }}>
      <Table stickyHeader size="small">
        <Head cols={[
          { label: "Date" }, { label: "Deposits", right: true }, { label: "Withdrawals", right: true },
          { label: "Net money", right: true }, { label: "Sports", right: true },
          { label: "Casino", right: true }, { label: "Day P&L", right: true },
        ]} />
        <TableBody>
          {data.daily.length === 0 ? (
            <Empty span={7} text="No activity in this period." />
          ) : data.daily.map((d) => {
            const pnl = n(d.sportsPnl) + n(d.casinoPnl);
            return (
              <TableRow key={d.date} hover sx={{ "&:hover": { bgcolor: C.cardHover } }}>
                <TableCell sx={bodyCellSx}>{dayLabel(d.date)}</TableCell>
                <TableCell sx={{ ...num, color: n(d.deposit) ? C.green : C.sub }}>{money(d.deposit)}</TableCell>
                <TableCell sx={{ ...num, color: n(d.withdraw) ? C.red : C.sub }}>{money(d.withdraw)}</TableCell>
                <TableCell sx={{ ...num, color: pnlColor(d.net) }}>{signed(d.net)}</TableCell>
                <TableCell sx={{ ...num, color: pnlColor(d.sportsPnl) }}>{signed(d.sportsPnl)}</TableCell>
                <TableCell sx={{ ...num, color: pnlColor(d.casinoPnl) }}>{signed(d.casinoPnl)}</TableCell>
                <TableCell sx={{ ...num, color: pnlColor(pnl), fontWeight: 700 }}>{signed(pnl)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  </Panel>
);

/* ─── Sports ────────────────────────────────────────────────────────────── */
export const SportsPanel: React.FC<PanelProps> = ({ data, subjectType, subjectId, range }) => {
  const s = data.gaming.sports;
  const mine = data.gaming.total.headlineFor === "AGENT";
  const bets = useBetPage<SportsBetRow>("sports", subjectType, subjectId, range);
  return (
    <>
      <Card sx={{ ...cardSx, p: 2, mb: 2, display: "flex", flexWrap: "wrap", gap: 3 }}>
        {[
          { k: "Bets placed", v: String(s.placedBets) },
          { k: "Bets settled", v: String(s.settledBets) },
          { k: "Total staked", v: money(s.turnover) },
          { k: "Open bets", v: `${s.openBets} · ${money(s.openStake)} held` },
          {
            k: mine ? "Your sports P&L" : "Player sports P&L",
            v: signed(mine ? s.agentPnl : s.playerPnl),
            c: pnlColor(mine ? s.agentPnl : s.playerPnl),
          },
        ].map((x) => (
          <Box key={x.k}>
            <Typography sx={{ color: C.sub, fontSize: 11.5 }}>{x.k}</Typography>
            <Typography sx={{ color: x.c || C.text, fontSize: 17, fontWeight: 700 }}>{x.v}</Typography>
          </Box>
        ))}
      </Card>

      <Panel title="Sports — day by day">
        <TableContainer sx={{ maxHeight: 340 }}>
          <Table stickyHeader size="small">
            <Head cols={[{ label: "Date" }, { label: "Settled bets", right: true }, { label: "P&L", right: true }]} />
            <TableBody>
              {data.sportsDaily.length === 0 ? (
                <Empty span={3} text="No settled sports bets in this period." />
              ) : data.sportsDaily.map((d) => {
                const v = mine ? d.agentPnl : d.playerPnl;
                return (
                  <TableRow key={d.date} hover>
                    <TableCell sx={bodyCellSx}>{dayLabel(d.date)}</TableCell>
                    <TableCell sx={num}>{d.bets}</TableCell>
                    <TableCell sx={{ ...num, color: pnlColor(v), fontWeight: 600 }}>{signed(v)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>

      <Panel
        title="Sports bets"
        busy={bets.loading}
        note={bets.error
          ? bets.error
          : `${bets.pagination.total.toLocaleString("en-IN")} bet${bets.pagination.total === 1 ? "" : "s"} in this period`}
      >
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table stickyHeader size="small">
            <Head cols={[
              { label: "Placed" }, { label: "Player" }, { label: "Match" }, { label: "Selection" },
              { label: "Market" }, { label: "Side" }, { label: "Odds", right: true },
              { label: "Stake", right: true }, { label: "Status" },
            ]} />
            <TableBody>
              {bets.loading && bets.rows.length === 0 ? (
                <Empty span={9} text="Loading bets…" />
              ) : bets.rows.length === 0 ? (
                <Empty span={9} text="No sports bets in this period." />
              ) : bets.rows.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ ...bodyCellSx, color: C.sub }}>{stamp(b.ts)}</TableCell>
                  <TableCell sx={bodyCellSx}>{b.user}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, maxWidth: 240, whiteSpace: "normal" }}>{b.match}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, maxWidth: 200, whiteSpace: "normal" }}>{b.selection}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, color: C.sub }}>{b.market}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, color: b.side === "lay" ? "#F5A0B5" : "#8FB6FF" }}>{b.side}</TableCell>
                  <TableCell sx={num}>{b.odds}</TableCell>
                  <TableCell sx={{ ...num, fontWeight: 600 }}>{money(b.stake)}</TableCell>
                  <TableCell sx={bodyCellSx}>
                    <Chip
                      size="small" label={b.result || b.status}
                      sx={{
                        height: 20, fontSize: 10.5,
                        color: b.status === "open" ? C.amber : C.sub,
                        bgcolor: b.status === "open" ? "rgba(255,194,63,0.12)" : C.input,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Pager pagination={bets.pagination} onPage={bets.setPage} />
      </Panel>
    </>
  );
};

/* ─── Casino ────────────────────────────────────────────────────────────── */
export const CasinoPanel: React.FC<PanelProps> = ({ data, subjectType, subjectId, range }) => {
  const c = data.gaming.casino;
  const mine = data.gaming.total.headlineFor === "AGENT";
  const txns = useBetPage<CasinoTxnRow>("casino", subjectType, subjectId, range);
  return (
    <>
      <Card sx={{ ...cardSx, p: 2, mb: 2, display: "flex", flexWrap: "wrap", gap: 3 }}>
        {[
          { k: "Bets", v: String(c.bets) },
          { k: "Staked", v: money(c.staked) },
          { k: "Wins paid", v: `${c.wins} · ${money(c.won)}` },
          { k: "Transactions", v: String(c.txns) },
          {
            k: mine ? "Your casino P&L" : "Player casino P&L",
            v: signed(mine ? c.agentPnl : c.playerPnl),
            col: pnlColor(mine ? c.agentPnl : c.playerPnl),
          },
        ].map((x) => (
          <Box key={x.k}>
            <Typography sx={{ color: C.sub, fontSize: 11.5 }}>{x.k}</Typography>
            <Typography sx={{ color: x.col || C.text, fontSize: 17, fontWeight: 700 }}>{x.v}</Typography>
          </Box>
        ))}
      </Card>

      <Panel title="Casino — day by day">
        <TableContainer sx={{ maxHeight: 340 }}>
          <Table stickyHeader size="small">
            <Head cols={[
              { label: "Date" }, { label: "Bets", right: true }, { label: "Staked", right: true },
              { label: "Won", right: true }, { label: "P&L", right: true },
            ]} />
            <TableBody>
              {data.casinoDaily.length === 0 ? (
                <Empty span={5} text="No casino play in this period." />
              ) : data.casinoDaily.map((d) => {
                const v = mine ? d.agentPnl : d.playerPnl;
                return (
                  <TableRow key={d.date} hover>
                    <TableCell sx={bodyCellSx}>{dayLabel(d.date)}</TableCell>
                    <TableCell sx={num}>{d.bets}</TableCell>
                    <TableCell sx={num}>{money(d.staked)}</TableCell>
                    <TableCell sx={num}>{money(d.won)}</TableCell>
                    <TableCell sx={{ ...num, color: pnlColor(v), fontWeight: 600 }}>{signed(v)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>

      <Panel
        title="Casino transactions"
        busy={txns.loading}
        note={txns.error
          ? txns.error
          : `${txns.pagination.total.toLocaleString("en-IN")} transaction${txns.pagination.total === 1 ? "" : "s"} in this period`}
      >
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table stickyHeader size="small">
            <Head cols={[
              { label: "Time" }, { label: "Player" }, { label: "Game" }, { label: "Action" },
              { label: "Round" }, { label: "Amount", right: true },
            ]} />
            <TableBody>
              {txns.loading && txns.rows.length === 0 ? (
                <Empty span={6} text="Loading transactions…" />
              ) : txns.rows.length === 0 ? (
                <Empty span={6} text="No casino transactions in this period." />
              ) : txns.rows.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ ...bodyCellSx, color: C.sub }}>{stamp(t.ts)}</TableCell>
                  <TableCell sx={bodyCellSx}>{t.user}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, maxWidth: 240, whiteSpace: "normal" }}>{t.game}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, color: t.action === "bet" ? C.red : C.green }}>{t.action}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, color: C.muted, fontSize: 11 }}>{t.round || "—"}</TableCell>
                  <TableCell sx={{ ...num, color: pnlColor(t.amount), fontWeight: 600 }}>{signed(t.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Pager pagination={txns.pagination} onPage={txns.setPage} />
      </Panel>
    </>
  );
};

/* ─── Who it came from ──────────────────────────────────────────────────── */
export const PeoplePanel: React.FC<{ data: AgentStatement }> = ({ data }) => (
  <>
    {data.downline.length > 1 && (
      <Panel title="By sub-agent" note="Rolled up over each sub-agent's own players.">
        <TableContainer sx={{ maxHeight: 380 }}>
          <Table stickyHeader size="small">
            <Head cols={[
              { label: "Account" }, { label: "Role" }, { label: "Players", right: true },
              { label: "Own balance", right: true }, { label: "Given out", right: true },
              { label: "Collected", right: true }, { label: "Sports", right: true },
              { label: "Casino", right: true }, { label: "Your P&L", right: true },
            ]} />
            <TableBody>
              {data.downline.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ ...bodyCellSx, pl: 2 + s.depth * 2 }}>
                    {s.depth > 0 && <span style={{ color: C.muted }}>└ </span>}{s.name}
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, color: C.sub }}>{s.role || "—"}</TableCell>
                  <TableCell sx={num}>{s.players}</TableCell>
                  <TableCell sx={num}>{money(s.balance)}</TableCell>
                  <TableCell sx={{ ...num, color: C.red }}>{money(s.funded)}</TableCell>
                  <TableCell sx={{ ...num, color: C.green }}>{money(s.collected)}</TableCell>
                  <TableCell sx={{ ...num, color: pnlColor(s.sportsPnl) }}>{signed(s.sportsPnl)}</TableCell>
                  <TableCell sx={{ ...num, color: pnlColor(s.casinoPnl) }}>{signed(s.casinoPnl)}</TableCell>
                  <TableCell sx={{ ...num, color: pnlColor(s.agentPnl), fontWeight: 700 }}>{signed(s.agentPnl)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    )}

    <Panel
      title="By player"
      note="Deposits given, withdrawals collected, and what each player's betting did for you."
    >
      <TableContainer sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <Head cols={[
            { label: "Player" }, { label: "Agent" }, { label: "Wallet", right: true },
            { label: "Deposited", right: true }, { label: "Collected", right: true },
            { label: "Sports bets", right: true }, { label: "Casino bets", right: true },
            { label: "Your P&L", right: true },
          ]} />
          <TableBody>
            {data.players.length === 0 ? (
              <Empty span={8} text="No players under this account." />
            ) : [...data.players]
              .sort((a, b) => n(b.agentPnl) - n(a.agentPnl))
              .map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={bodyCellSx}>{p.name}</TableCell>
                  <TableCell sx={{ ...bodyCellSx, color: C.sub }}>{p.staffName || "—"}</TableCell>
                  <TableCell sx={num}>{money(p.wallet)}</TableCell>
                  <TableCell sx={{ ...num, color: C.red }}>{money(p.funded)}</TableCell>
                  <TableCell sx={{ ...num, color: C.green }}>{money(p.collected)}</TableCell>
                  <TableCell sx={num}>{p.sportsBets}</TableCell>
                  <TableCell sx={num}>{p.casinoBets}</TableCell>
                  <TableCell sx={{ ...num, color: pnlColor(p.agentPnl), fontWeight: 700 }}>
                    {signed(p.agentPnl)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Panel>
  </>
);
