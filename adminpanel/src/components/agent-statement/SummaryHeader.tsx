/* The answer-first part of the report: profit or loss for the selected range,
   split into sports and casino, followed by the balance walk
   (previous → in → out → closing) and the money-movement breakdown. */
import React from "react";
import { Box, Card, Typography, Tooltip, Chip } from "@mui/material";
import { TrendingUp, TrendingDown, SportsSoccer, Casino, InfoOutlined } from "@mui/icons-material";
import { AgentStatement } from "./types";
import { C, cardSx, money, n, signed, pnlColor, rangeLabel } from "./ui";

const Stat: React.FC<{
  label: string; value: string; color?: string; hint?: string; sub?: string;
}> = ({ label, value, color, hint, sub }) => (
  <Card sx={{ ...cardSx, p: 2, flex: "1 1 170px", minWidth: 160 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography sx={{ color: C.sub, fontSize: 12 }}>{label}</Typography>
      {hint && (
        <Tooltip title={hint}>
          <InfoOutlined sx={{ fontSize: 13, color: C.muted }} />
        </Tooltip>
      )}
    </Box>
    <Typography sx={{ color: color || C.text, fontSize: 20, fontWeight: 700, mt: 0.5 }}>{value}</Typography>
    {sub && <Typography sx={{ color: C.muted, fontSize: 11, mt: 0.25 }}>{sub}</Typography>}
  </Card>
);

const SummaryHeader: React.FC<{ data: AgentStatement }> = ({ data }) => {
  const { balance, gaming, subject, period } = data;
  const t = gaming.total;
  const isAgent = subject.type === "STAFF";

  const headline = n(t.headlinePnl);
  const profit = headline >= 0;
  const bannerColor = profit ? C.green : C.red;
  const bannerBg = profit ? "rgba(14,204,104,0.10)" : "rgba(224,27,79,0.10)";

  const split = [
    {
      icon: <SportsSoccer sx={{ fontSize: 18 }} />,
      name: "Sports",
      value: t.headlineSports,
      detail: `${gaming.sports.settledBets} settled · ${money(gaming.sports.turnover)} staked`,
    },
    {
      icon: <Casino sx={{ fontSize: 18 }} />,
      name: "Casino",
      value: t.headlineCasino,
      detail: `${gaming.casino.bets} bets · ${money(gaming.casino.staked)} staked`,
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* ── Headline: profit or loss for the range ─────────────────────── */}
      <Card sx={{ ...cardSx, borderColor: bannerColor, bgcolor: bannerBg, p: 2.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
          <Box sx={{ flex: "1 1 280px" }}>
            <Typography sx={{ color: C.sub, fontSize: 12, letterSpacing: 0.5 }}>
              {rangeLabel(period)} — {isAgent ? "your" : "player"} result
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              {profit
                ? <TrendingUp sx={{ color: bannerColor, fontSize: 32 }} />
                : <TrendingDown sx={{ color: bannerColor, fontSize: 32 }} />}
              <Box>
                <Typography sx={{ color: bannerColor, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
                  {profit ? "TOTAL PROFIT" : "TOTAL LOSS"}
                </Typography>
                <Typography sx={{ color: bannerColor, fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
                  ₹ {money(Math.abs(headline))}
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ color: C.muted, fontSize: 11, mt: 0.75 }}>
              {isAgent
                ? "What the downline's betting earned you. A player's loss is your gain."
                : "This player's own betting result. Positive means the player is ahead."}
            </Typography>
          </Box>

          {/* Sports / casino split */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", flex: "1 1 340px" }}>
            {split.map((s) => (
              <Box
                key={s.name}
                sx={{
                  flex: "1 1 150px", p: 1.75, borderRadius: 1.5,
                  bgcolor: C.card, border: `1px solid ${C.border}`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: C.sub }}>
                  {s.icon}
                  <Typography sx={{ color: C.sub, fontSize: 12, fontWeight: 600 }}>{s.name}</Typography>
                </Box>
                <Typography sx={{ color: pnlColor(s.value), fontSize: 22, fontWeight: 700, mt: 0.5 }}>
                  {signed(s.value)}
                </Typography>
                <Typography sx={{ color: C.muted, fontSize: 11 }}>{s.detail}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

      </Card>

      {/* ── Balance walk: previous → movement → closing → actual ───────── */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Stat
          label="Previous balance"
          value={money(balance.opening)}
          hint="What the account held when this period started — brought forward from everything before it."
        />
        <Stat
          label="Money in"
          value={`+ ${money(balance.totalIn)}`}
          color={C.green}
          hint={isAgent
            ? "Deposits received from your upline plus anything you withdrew back from your downline."
            : "Deposits from the agent plus bank and gateway deposits."}
        />
        <Stat
          label="Money out"
          value={`− ${money(balance.totalOut)}`}
          color={C.red}
          hint={isAgent
            ? "Deposits you gave to your downline plus anything your upline withdrew from you."
            : "Withdrawals by the agent plus bank and gateway withdrawals."}
        />
        <Stat
          label="Net change"
          value={signed(balance.movement)}
          color={pnlColor(balance.movement)}
          hint="Closing balance minus previous balance."
        />
        <Stat
          label="Closing balance"
          value={money(balance.closing)}
          color={C.info}
          hint="Balance at the end of the selected period."
        />
        <Stat
          label="Actual balance now"
          value={money(balance.live)}
          color={C.text}
          sub={period.to ? "live wallet, today" : undefined}
          hint="The real wallet balance right now. Equal to the closing balance when the period runs to today."
        />
      </Box>

      {/* ── What was actually done with the money ──────────────────────── */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {isAgent ? (
          <>
            <Stat label="Deposit received from upline" value={money(balance.depositIn)} color={C.green} />
            <Stat label="Withdrawn by upline" value={money(balance.withdrawOut)} color={C.red} />
            <Stat
              label="Deposits you gave out"
              value={money(balance.givenDownline)}
              color={C.red}
              sub={`players ${money(balance.givenPlayers)} · agents ${money(balance.givenAgents)}`}
            />
            <Stat
              label="Withdrawals you collected"
              value={money(balance.collectedDownline)}
              color={C.green}
              sub={`players ${money(balance.collectedPlayers)} · agents ${money(balance.collectedAgents)}`}
            />
          </>
        ) : (
          <>
            <Stat label="Deposit by agent" value={money(balance.depositIn)} color={C.green} />
            <Stat label="Withdrawn by agent" value={money(balance.withdrawOut)} color={C.red} />
            <Stat label="Bank / gateway in" value={money(balance.bankIn)} color={C.green} />
            <Stat label="Bank / gateway out" value={money(balance.bankOut)} color={C.red} />
            <Stat
              label="Held in open bets"
              value={money(balance.openExposure)}
              color={C.amber}
              hint="Stake sitting in unsettled bets. It has left the wallet but has no result yet."
            />
          </>
        )}
      </Box>

      {/* Honesty line: the wallet does not always equal what the ledger explains. */}
      {Math.abs(n(balance.unexplained)) >= 1 && (
        <Chip
          size="small"
          label={`${money(Math.abs(n(balance.unexplained)))} of the balance predates this ledger and is carried in "Previous balance" (old settlement postings). Deposits and withdrawals below are exact.`}
          sx={{
            alignSelf: "flex-start", height: "auto", py: 0.75,
            bgcolor: "rgba(255,194,63,0.10)", color: C.amber,
            border: `1px solid rgba(255,194,63,0.35)`,
            "& .MuiChip-label": { whiteSpace: "normal", fontSize: 11.5, lineHeight: 1.5 },
          }}
        />
      )}
    </Box>
  );
};

export default SummaryHeader;
