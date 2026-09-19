/* ═══════════════════════════════════════════════════════════════════════════
   ACCOUNT REPORT  —  /account-report/:subject/:id     (subject = staff | user)

   The full "hisab" for one agent or one player: profit or loss for the chosen
   period split into sports and casino, the balance walk from previous to
   current, and every deposit / withdrawal with the balance after it.

   Opened in its own browser tab from the report icon in the agent listing, so
   an operator can keep the listing open and compare accounts side by side.
   ═══════════════════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Tab, Tabs, Typography,
} from "@mui/material";
import { Refresh, PictureAsPdf, Person, AccountTree } from "@mui/icons-material";
import * as lordsApi from "../../services/lordsApi";
import { AgentStatement, Category, SubjectType } from "./types";
import { C, cardSx, cleanError, money, PRESETS, Range, rangeLabel } from "./ui";
import PeriodBar from "./PeriodBar";
import SummaryHeader from "./SummaryHeader";
import LedgerTable from "./LedgerTable";
import { DailyPanel, SportsPanel, CasinoPanel, PeoplePanel } from "./BreakdownTables";

const DEFAULT_PRESET = "7d";
const PAGE_SIZE = 100;

const AccountReport: React.FC = () => {
  const { subject: subjectParam, id } = useParams<{ subject: string; id: string }>();
  const [searchParams] = useSearchParams();
  const subjectType: SubjectType = subjectParam === "user" ? "USER" : "STAFF";

  // The listing passes ?name= so the tab has a title before the fetch lands.
  const passedName = searchParams.get("name") || "";

  const initialKey = searchParams.get("preset") || DEFAULT_PRESET;
  const [presetKey, setPresetKey] = useState(initialKey);
  const [range, setRange] = useState<Range>(
    () => (PRESETS.find((p) => p.key === initialKey) || PRESETS[2]).range()
  );
  const [category, setCategory] = useState<Category>("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState(0);

  const [data, setData] = useState<AgentStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await lordsApi.getAccountStatement(subjectType, id, {
        from: range.from || undefined,
        to: range.to || undefined,
        page,
        limit: PAGE_SIZE,
        category,
      });
      setData(res);
    } catch (e: any) {
      setError(cleanError(e, "Could not load this report"));
    } finally {
      setLoading(false);
    }
  }, [id, subjectType, range.from, range.to, page, category]);

  useEffect(() => { load(); }, [load]);

  const title = data?.subject.name || passedName || "Account";
  useEffect(() => {
    document.title = `${title} — Account report`;
  }, [title]);

  // Changing the question always starts the answer from page one, set in the
  // same tick as the filter so only one fetch goes out.
  const applyRange = (r: Range, key: string) => { setRange(r); setPresetKey(key); setPage(1); };
  const applyCategory = (c: Category) => { setCategory(c); setPage(1); };

  /* Printing means "give me this report as a PDF", not "render the browser
     page" — the PDF is laid out for paper and carries every ledger row. */
  const downloadPdf = async () => {
    if (!id) return;
    setPdfBusy(true);
    try {
      const blob = await lordsApi.downloadAccountStatementPdf(subjectType, id, {
        from: range.from || undefined,
        to: range.to || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statement_${title}_${range.from || "all"}_${range.to || "now"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(cleanError(e, "Could not generate the PDF"));
    } finally {
      setPdfBusy(false);
    }
  };

  const tabs = useMemo(() => {
    const base = ["Statement", "Day by day", "Sports", "Casino"];
    return subjectType === "STAFF" ? [...base, "Players & agents"] : base;
  }, [subjectType]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: C.bg, minHeight: "100vh" }}>
      {/* ── Who this report is about ─────────────────────────────────── */}
      <Card sx={{ ...cardSx, p: 2.5, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {subjectType === "USER"
              ? <Person sx={{ color: C.info, fontSize: 30 }} />
              : <AccountTree sx={{ color: C.info, fontSize: 30 }} />}
            <Box>
              <Typography sx={{ color: C.text, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                {title}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 0.5 }}>
                <Chip
                  size="small" label={data?.subject.role || (subjectType === "USER" ? "User" : "Agent")}
                  sx={{ height: 20, fontSize: 11, color: C.info, bgcolor: "rgba(85,129,247,0.12)" }}
                />
                {data?.subject.parentName && (
                  <Typography sx={{ color: C.sub, fontSize: 12 }}>under {data.subject.parentName}</Typography>
                )}
                {data?.subject.agentCode && (
                  <Typography sx={{ color: C.muted, fontSize: 12 }}>code {data.subject.agentCode}</Typography>
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ textAlign: "right", mr: 1 }}>
              <Typography sx={{ color: C.sub, fontSize: 11 }}>Balance now</Typography>
              <Typography sx={{ color: C.text, fontSize: 20, fontWeight: 700 }}>
                ₹ {money(data?.balance.live)}
              </Typography>
            </Box>
            <Button
              size="small" startIcon={<Refresh />} onClick={load} disabled={loading}
              sx={{ color: C.sub, border: `1px solid ${C.border}` }}
            >
              Refresh
            </Button>
            <Button
              size="small" startIcon={pdfBusy ? <CircularProgress size={14} /> : <PictureAsPdf />}
              onClick={downloadPdf} disabled={pdfBusy || loading}
              sx={{ color: C.sub, border: `1px solid ${C.border}` }}
            >
              Print / PDF
            </Button>
          </Box>
        </Box>
      </Card>

      {/* ── Period ───────────────────────────────────────────────────── */}
      <Card sx={{ ...cardSx, p: 2, mb: 2 }}>
        <PeriodBar value={range} activeKey={presetKey} disabled={loading} onChange={applyRange} />
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${C.border}`, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ color: C.sub, fontSize: 12 }}>
            Showing: <span style={{ color: C.text, fontWeight: 600 }}>{rangeLabel(range)}</span>
          </Typography>
          {loading && <CircularProgress size={16} sx={{ color: C.primary }} />}
        </Box>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {data && (
        <>
          <SummaryHeader data={data} />

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mt: 3, mb: 2, borderBottom: `1px solid ${C.border}`, minHeight: 40,
              "& .MuiTab-root": { color: C.sub, textTransform: "none", fontSize: 13, minHeight: 40 },
              "& .Mui-selected": { color: `${C.text} !important` },
              "& .MuiTabs-indicator": { bgcolor: C.primary },
            }}
          >
            {tabs.map((t) => <Tab key={t} label={t} />)}
          </Tabs>

          {tab === 0 && (
            <LedgerTable
              rows={data.rows}
              loading={loading}
              page={data.pagination.page}
              pages={data.pagination.totalPages}
              total={data.pagination.total}
              category={category}
              showCategoryTabs={subjectType === "USER"}
              openingBalance={data.balance.opening}
              onPage={setPage}
              onCategory={applyCategory}
            />
          )}
          {tab === 1 && <DailyPanel data={data} />}
          {tab === 2 && <SportsPanel data={data} subjectType={subjectType} subjectId={id!} range={range} />}
          {tab === 3 && <CasinoPanel data={data} subjectType={subjectType} subjectId={id!} range={range} />}
          {tab === 4 && subjectType === "STAFF" && <PeoplePanel data={data} />}
        </>
      )}

      {!data && loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: C.primary }} />
        </Box>
      )}

    </Box>
  );
};

export default AccountReport;
