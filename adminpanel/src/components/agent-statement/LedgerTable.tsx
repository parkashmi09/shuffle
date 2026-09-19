/* The statement itself: every action on the account in the period, oldest at the
   bottom, with the balance after each one. This is the "hisab" — what was done,
   how much, and what was left. */
import React from "react";
import {
  Box, Card, Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography, Pagination, Skeleton,
} from "@mui/material";
import { LedgerRow, LedgerKind, Category, Money } from "./types";
import { C, cardSx, headCellSx, bodyCellSx, money, n, stamp } from "./ui";

/* Colour per action so a column of rows is scannable without reading labels. */
const KIND_STYLE: Record<LedgerKind, { color: string; short: string }> = {
  DEPOSIT_UPLINE: { color: C.green, short: "Deposit in" },
  COLLECTED_AGENT: { color: C.green, short: "Collected" },
  COLLECTED_PLAYER: { color: C.green, short: "Collected" },
  BANK_DEPOSIT: { color: C.green, short: "Bank in" },
  GATEWAY_DEPOSIT: { color: C.green, short: "Gateway in" },
  WITHDRAW_UPLINE: { color: C.red, short: "Withdraw out" },
  DEPOSIT_AGENT: { color: C.red, short: "Given out" },
  DEPOSIT_PLAYER: { color: C.red, short: "Given out" },
  BANK_WITHDRAW: { color: C.red, short: "Bank out" },
  GATEWAY_WITHDRAW: { color: C.red, short: "Gateway out" },
  SPORTS: { color: C.info, short: "Sports" },
  CASINO: { color: "#7B5EF5", short: "Casino" },
};

const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "money", label: "Deposit / Withdraw" },
  { key: "sports", label: "Sports" },
  { key: "casino", label: "Casino" },
];

interface Props {
  rows: LedgerRow[];
  loading: boolean;
  page: number;
  pages: number;
  total: number;
  category: Category;
  /** A player's ledger carries bet rows; an agent's carries only transfers. */
  showCategoryTabs: boolean;
  openingBalance: Money;
  onPage: (p: number) => void;
  onCategory: (c: Category) => void;
}

const LedgerTable: React.FC<Props> = ({
  rows, loading, page, pages, total, category, showCategoryTabs,
  openingBalance, onPage, onCategory,
}) => (
  <Card sx={cardSx}>
    <Box
      sx={{
        p: 2, borderBottom: `1px solid ${C.border}`, display: "flex",
        alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap",
      }}
    >
      <Box>
        <Typography sx={{ color: C.text, fontWeight: 600 }}>Account statement</Typography>
        <Typography sx={{ color: C.muted, fontSize: 11.5 }}>
          {total} entr{total === 1 ? "y" : "ies"} · newest first · balance shown after each action
        </Typography>
      </Box>
      {showCategoryTabs && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {CATEGORY_TABS.map((t) => (
            <Chip
              key={t.key} label={t.label} size="small"
              onClick={() => onCategory(t.key)}
              sx={{
                bgcolor: category === t.key ? "rgba(136,108,255,0.18)" : C.input,
                color: category === t.key ? C.text : C.sub,
                border: `1px solid ${category === t.key ? C.primary : C.border}`,
              }}
            />
          ))}
        </Box>
      )}
    </Box>

    <TableContainer sx={{ maxHeight: 620 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            {["Date & time", "Action", "With", "Details", "In", "Out", "Balance after"].map((h, i) => (
              <TableCell key={h} sx={{ ...headCellSx, textAlign: i >= 4 ? "right" : "left" }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            [...Array(8)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((__, j) => (
                  <TableCell key={j} sx={bodyCellSx}>
                    <Skeleton variant="text" sx={{ bgcolor: C.border }} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} sx={{ ...bodyCellSx, textAlign: "center", py: 5, color: C.sub }}>
                Nothing happened on this account in the selected period.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const style = KIND_STYLE[r.kind] || { color: C.sub, short: r.kind };
              // `direction` is the server's own reading of the sign; fall back
              // to the amount for a row that predates the field.
              const isIn = r.direction ? r.direction === "IN" : n(r.amount) >= 0;
              return (
                <TableRow key={`${r.kind}-${r.id}-${r.ts}`} hover sx={{ "&:hover": { bgcolor: C.cardHover } }}>
                  <TableCell sx={{ ...bodyCellSx, color: C.sub }}>{stamp(r.ts)}</TableCell>
                  <TableCell sx={bodyCellSx}>
                    <Chip
                      size="small" label={style.short}
                      sx={{
                        height: 22, fontSize: 11, fontWeight: 600, color: style.color,
                        bgcolor: `${style.color}1F`, border: `1px solid ${style.color}55`,
                      }}
                    />
                    {r.legacy && (
                      <Chip
                        size="small" label={r.legacy}
                        sx={{ ml: 0.5, height: 22, fontSize: 10, color: C.amber, bgcolor: "rgba(255,194,63,0.12)" }}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={bodyCellSx}>{r.party || "—"}</TableCell>
                  <TableCell
                    sx={{
                      ...bodyCellSx, color: C.muted, maxWidth: 320,
                      whiteSpace: "normal", wordBreak: "break-word", fontSize: 12,
                    }}
                    title={r.note || r.label}
                  >
                    {r.note || r.label}
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, textAlign: "right", color: C.green, fontWeight: 600 }}>
                    {isIn ? money(r.amount) : "—"}
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, textAlign: "right", color: C.red, fontWeight: 600 }}>
                    {isIn ? "—" : money(Math.abs(n(r.amount)))}
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, textAlign: "right", fontWeight: 700 }}>
                    {money(r.balance)}
                  </TableCell>
                </TableRow>
              );
            })
          )}

          {/* Closing the loop: the row every statement ends on. Only meaningful
              on an unfiltered view — with a category filter the visible rows no
              longer chain back to it (the balance column stays true either way). */}
          {!loading && page === pages && category === "all" && (
            <TableRow>
              <TableCell colSpan={6} sx={{ ...bodyCellSx, color: C.sub, fontWeight: 600 }}>
                Previous balance (brought forward)
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, textAlign: "right", fontWeight: 700, color: C.info }}>
                {money(openingBalance)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>

    {pages > 1 && (
      <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
        <Pagination
          count={pages} page={page} onChange={(_, p) => onPage(p)} size="small"
          sx={{
            "& .MuiPaginationItem-root": { color: C.sub },
            "& .Mui-selected": { bgcolor: `${C.primary} !important`, color: "#fff" },
          }}
        />
      </Box>
    )}
  </Card>
);

export default LedgerTable;
