import React, { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch, apiFetchPage, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import { format } from "date-fns";
import {
  Gift,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  X,
  TrendingUp,
  Users,
  CheckCircle,
  DollarSign,
  CreditCard,
} from "lucide-react";

/* ─── types ─── */
/** Money arrives as an exact decimal string, never a float. */
interface GiftCard {
  id: number;
  uniqueKey: string;
  description: string | null;
  amount: string | null;
  currency: string;
  periodDays: number | null;
  endDate: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
  wagerRequired: boolean;
  wagerTimes: number | null;
  allUsers: boolean;
  isActive: boolean;
}

interface AnalyticsStats {
  totalCards: number;
  activated: number;
  claimed: number;
  expired: number;
}

interface AnalyticsCard {
  id: number;
  uniqueKey: string;
  amount: string | null;
  createdAt: string | null;
  activations: number;
  claims: number;
}

/** `analytics` returns the counters and the per-card breakdown in one body. */
interface AnalyticsResponse extends AnalyticsStats {
  cards: AnalyticsCard[];
}

/** One player's card. The card itself is nested, not flattened onto the row. */
interface Record {
  id: number;
  userId: number;
  status: string;
  startDate: string | null;
  card: GiftCard | null;
}

type Tab = "cards" | "records" | "analytics";

/** Both listings are capped at 200 by their validators. */
const PAGE_SIZE = 200;
const RECORDS_PER_PAGE = 25;

const fmt = (iso: string) => {
  try { return format(new Date(iso), "yyyy-MM-dd HH:mm"); }
  catch { return iso; }
};

/* ─── component ─── */
export default function GiftCardAdmin() {
  const [tab, setTab] = useState<Tab>("cards");

  /* cards */
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);

  /* analytics */
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [analyticsCards, setAnalyticsCards] = useState<AnalyticsCard[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  /* records */
  const [records, setRecords] = useState<Record[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordPage, setRecordPage] = useState(1);
  const [recordStatus, setRecordStatus] = useState("all");
  const [recordSearch, setRecordSearch] = useState("");

  /* create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({
    uniqueKey: "", description: "", periodDays: "", endDate: "",
    depositStatus: false, depositAmount: "", wagerStatus: false,
    wagerTimes: "", allUserStatus: false, amount: "",
  });

  /* ─── fetchers ─── */
  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const data = await apiFetch<GiftCard[]>(ENDPOINTS.giftCards.list, { query: { limit: PAGE_SIZE } });
      setCards(data || []);
    } catch { /* */ }
    finally { setCardsLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const { cards, ...counters } = await apiFetch<AnalyticsResponse>(ENDPOINTS.giftCards.analytics);
      setStats(counters);
      setAnalyticsCards(cards ?? []);
    } catch { /* */ }
    finally { setAnalyticsLoading(false); }
  }, []);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      /**
       * `limit`/`offset`, not `page`. The search box filters by PLAYER ID —
       * the service has no free-text search over records, and a term it does
       * not understand was silently ignored, so the box looked broken.
       */
      const { data, pagination } = await apiFetchPage<Record>(ENDPOINTS.giftCards.records, {
        query: {
          limit: RECORDS_PER_PAGE,
          offset: (recordPage - 1) * RECORDS_PER_PAGE,
          ...(recordStatus !== "all" ? { status: recordStatus } : {}),
          ...(/^\d+$/.test(recordSearch.trim()) ? { userId: recordSearch.trim() } : {}),
        },
      });
      setRecords(data);
      setRecordsTotal(pagination?.total ?? data.length);
    } catch { /* */ }
    finally { setRecordsLoading(false); }
  }, [recordPage, recordStatus, recordSearch]);

  useEffect(() => { fetchCards(); fetchAnalytics(); }, []);
  useEffect(() => { if (tab === "records") fetchRecords(); }, [tab, recordPage, recordStatus]);

  /* ─── actions ─── */
  const createGiftCard = async () => {
    try {
      /**
       * The body is camelCase and `.strict()`, and its optionals do not accept
       * null — an unset field is OMITTED, not sent as null. `depositRequired`
       * without a `depositAmount` is refused server-side, because a condition
       * with no figure behind it is always met, which turns a "deposit ₹100
       * first" card into a free one.
       */
      await apiFetch(ENDPOINTS.giftCards.create, {
        method: "POST",
        body: {
          uniqueKey: form.uniqueKey,
          amount: String(form.amount),
          depositRequired: form.depositStatus,
          wagerRequired: form.wagerStatus,
          allUsers: form.allUserStatus,
          ...(form.description ? { description: form.description } : {}),
          ...(form.periodDays ? { periodDays: Number(form.periodDays) } : {}),
          ...(form.endDate ? { endDate: form.endDate } : {}),
          ...(form.depositStatus && form.depositAmount ? { depositAmount: String(form.depositAmount) } : {}),
          ...(form.wagerStatus && form.wagerTimes ? { wagerTimes: Number(form.wagerTimes) } : {}),
        },
      });
      setShowCreate(false);
      setForm({
        uniqueKey: "", description: "", periodDays: "", endDate: "",
        depositStatus: false, depositAmount: "", wagerStatus: false,
        wagerTimes: "", allUserStatus: false, amount: "",
      });
      fetchCards();
      fetchAnalytics();
    } catch (e: any) {
      alert(e.message || "Failed to create gift card");
    }
  };

  const deleteGiftCard = async (id: number) => {
    if (!window.confirm("Delete this gift card?")) return;
    try {
      await apiFetch(buildPath(ENDPOINTS.giftCards.remove, { id }), { method: "DELETE" });
      fetchCards();
      fetchAnalytics();
    } catch (e: any) {
      // A card players have already activated is refused — deleting it would
      // orphan their rows. The old code swallowed that and looked like a no-op.
      alert(e?.message || "Failed to delete gift card");
    }
  };

  const searchRecords = () => { setRecordPage(1); fetchRecords(); };

  const totalPages = Math.ceil(recordsTotal / RECORDS_PER_PAGE) || 1;

  /* ─── tab button helper ─── */
  const tabBtn = (t: Tab, label: string, Icon: any) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
        tab === t
          ? "bg-[#886CFF] text-[#F9F9F9] shadow-lg shadow-[#886CFF]/25"
          : "text-[#878AA2] hover:text-[#F9F9F9] hover:bg-[#0E1831]"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  /* ─── stat card helper ─── */
  const statCard = (label: string, value: string | number, Icon: any, color: string) => (
    <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#878AA2] text-sm">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#F9F9F9]">{value}</div>
    </div>
  );

  /* ─── render ─── */
  return (
    <div className="p-4 space-y-6 min-h-screen" style={{ backgroundColor: "#0C0D1D" }}>

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F9F9F9] flex items-center gap-2">
            <Gift size={22} /> Gift Cards
          </h1>
          <p className="text-sm text-[#878AA2] mt-1">Manage gift cards, track claims & analytics</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#886CFF]/25"
        >
          <Plus size={16} /> Create Gift Card
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-2 bg-[#0C0D1D] p-1.5 rounded-xl w-fit border border-[#1E2D55]">
        {tabBtn("cards", "Gift Cards", CreditCard)}
        {tabBtn("records", "Records", Users)}
        {tabBtn("analytics", "Analytics", TrendingUp)}
      </div>

      {/* ═══════════ ANALYTICS SECTION (always visible as summary) ═══════════ */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCard("Total Cards", stats.totalCards, CreditCard, "#6366f1")}
          {statCard("Total Activated", stats.activated, Users, "#f59e0b")}
          {statCard("Total Claimed", stats.claimed, CheckCircle, "#10b981")}
          {statCard("Expired", stats.expired, DollarSign, "#ef4444")}
        </div>
      )}

      {/* ═══════════ CARDS TAB ═══════════ */}
      {tab === "cards" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#878AA2]">{cards.length} gift cards</span>
            <button onClick={fetchCards} className="flex items-center gap-1 text-xs text-[#878AA2] hover:text-[#8384A5]">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {cardsLoading ? (
            <div className="text-center py-16 text-[#878AA2]">Loading...</div>
          ) : cards.length === 0 ? (
            <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl p-12 text-center">
              <Gift size={48} className="mx-auto text-[#878AA2] mb-3" />
              <p className="text-[#878AA2]">No gift cards created yet</p>
            </div>
          ) : (
            <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2D55]">
                    {["Code", "Description", "Amount", "Period", "End Date", "Deposit", "Wager", "Users", "Status", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cards.map(g => (
                    <tr key={g.id} className="border-b border-[#1E2D55] hover:bg-[#162140] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-[#F9F9F9] font-medium">{g.uniqueKey}</span>
                      </td>
                      <td className="px-4 py-3 text-[#8384A5] max-w-[200px] truncate">
                        {g.description || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {g.amount != null ? (
                          <span className="text-[#0ECC68] font-semibold">${g.amount}</span>
                        ) : (
                          <span className="text-[#878AA2]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#8384A5]">
                        {g.periodDays ? `${g.periodDays}d` : "-"}
                      </td>
                      <td className="px-4 py-3 text-[#8384A5]">
                        {g.endDate ? fmt(g.endDate) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {g.depositRequired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FFC23F]/10 text-[#FFC23F]">
                            ${g.depositAmount}
                          </span>
                        ) : (
                          <span className="text-[#878AA2] text-xs">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {g.wagerRequired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#886CFF]/10 text-[#9B82FF]">
                            {g.wagerTimes}x
                          </span>
                        ) : (
                          <span className="text-[#878AA2] text-xs">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                          g.allUsers
                            ? "bg-[#0ECC68]/10 text-[#0ECC68]"
                            : "bg-[#1E2D55]/10 text-[#878AA2]"
                        }`}>
                          {g.allUsers ? "All" : "Selected"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                          g.isActive
                            ? "bg-[#0ECC68]/10 text-[#0ECC68]"
                            : "bg-[#E01B4F]/10 text-[#E01B4F]"
                        }`}>
                          {g.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteGiftCard(g.id)}
                          className="p-1.5 rounded-lg text-[#878AA2] hover:text-[#E01B4F] hover:bg-[#E01B4F]/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ RECORDS TAB ═══════════ */}
      {tab === "records" && (
        <div className="space-y-4">
          {/* filters */}
          <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                <input
                  className="w-full pl-9 pr-3 py-2 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                  placeholder="Search by User ID or Gift Code"
                  value={recordSearch}
                  onChange={e => setRecordSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchRecords()}
                />
              </div>
              <select
                className="px-3 py-2 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] focus:outline-none focus:border-[#886CFF]"
                value={recordStatus}
                onChange={e => { setRecordStatus(e.target.value); setRecordPage(1); }}
              >
                <option value="all">All Status</option>
                <option value="Activated">Activated</option>
                <option value="Claimed">Claimed</option>
              </select>
              <button
                onClick={searchRecords}
                className="px-4 py-2 bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] rounded-lg text-sm font-medium transition-all"
              >
                Search
              </button>
              <button
                onClick={() => { setRecordSearch(""); setRecordStatus("all"); setRecordPage(1); fetchRecords(); }}
                className="px-4 py-2 bg-[#162140] hover:bg-[#1E2D55] text-[#8384A5] rounded-lg text-sm transition-all"
              >
                Clear
              </button>
            </div>
          </div>

          {/* table */}
          <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E2D55]">
                  {["ID", "User ID", "Gift Code", "Amount", "Status", "Activated", "Window"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recordsLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-[#878AA2]">Loading...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-[#878AA2]">No records found</td></tr>
                ) : records.map(r => (
                  <tr key={r.id} className="border-b border-[#1E2D55] hover:bg-[#162140] transition-colors">
                    <td className="px-4 py-3 text-[#878AA2]">#{r.id}</td>
                    <td className="px-4 py-3 text-[#F9F9F9] font-mono text-xs">{r.userId}</td>
                    <td className="px-4 py-3 text-[#F9F9F9] font-medium">{r.card?.uniqueKey ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.card?.amount != null ? (
                        <span className="text-[#0ECC68] font-semibold">${r.card.amount}</span>
                      ) : (
                        <span className="text-[#878AA2]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        r.status === "Claimed"
                          ? "bg-[#0ECC68]/10 text-[#0ECC68]"
                          : "bg-[#FFC23F]/10 text-[#FFC23F]"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          r.status === "Claimed" ? "bg-[#0ECC68]" : "bg-[#FFC23F]"
                        }`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#878AA2] text-xs">{r.startDate ? fmt(r.startDate) : "—"}</td>
                    <td className="px-4 py-3 text-[#878AA2] text-xs">
                      {r.card?.periodDays != null ? `${r.card.periodDays} days` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E2D55]">
              <span className="text-xs text-[#878AA2]">{recordsTotal} total records</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={recordPage === 1}
                  onClick={() => setRecordPage(p => p - 1)}
                  className="p-1.5 rounded-lg text-[#878AA2] hover:bg-[#162140] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-[#8384A5] min-w-[80px] text-center">
                  Page {recordPage} / {totalPages}
                </span>
                <button
                  disabled={recordPage >= totalPages}
                  onClick={() => setRecordPage(p => p + 1)}
                  className="p-1.5 rounded-lg text-[#878AA2] hover:bg-[#162140] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ANALYTICS TAB ═══════════ */}
      {tab === "analytics" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#878AA2]">Per-card breakdown</span>
            <button onClick={fetchAnalytics} className="flex items-center gap-1 text-xs text-[#878AA2] hover:text-[#8384A5]">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {analyticsLoading ? (
            <div className="text-center py-16 text-[#878AA2]">Loading...</div>
          ) : (
            <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2D55]">
                    {["Gift Code", "Claim Amount", "Activations", "Claims", "Conversion", "Created"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analyticsCards.map(c => {
                    const rate = c.activations > 0 ? ((c.claims / c.activations) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={c.id} className="border-b border-[#1E2D55] hover:bg-[#162140] transition-colors">
                        <td className="px-4 py-3 text-[#F9F9F9] font-medium">{c.uniqueKey}</td>
                        <td className="px-4 py-3">
                          {c.amount != null ? (
                            <span className="text-[#0ECC68] font-semibold">${c.amount}</span>
                          ) : (
                            <span className="text-[#878AA2]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFC23F]/10 text-[#FFC23F]">
                            {c.activations}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#0ECC68]/10 text-[#0ECC68]">
                            {c.claims}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-[#1E2D55] rounded-full max-w-[80px]">
                              <div
                                className="h-2 bg-[#886CFF] rounded-full transition-all"
                                style={{ width: `${Math.min(Number(rate), 100)}%` }}
                              />
                            </div>
                            <span className="text-[#8384A5] text-xs">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#878AA2] text-xs">{c.createdAt ? fmt(c.createdAt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ CREATE MODAL ═══════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-[#0C0D1D] border border-[#1E2D55] rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#F9F9F9]">Create Gift Card</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-[#878AA2] hover:bg-[#162140]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#878AA2] mb-1.5">Unique Gift Code</label>
                <input
                  className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                  placeholder="e.g. WELCOME100"
                  value={form.uniqueKey}
                  onChange={e => setForm({ ...form, uniqueKey: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs text-[#878AA2] mb-1.5">Description</label>
                <textarea
                  rows={3}
                  className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] resize-none focus:outline-none focus:border-[#886CFF]"
                  placeholder="Gift card description"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs text-[#878AA2] mb-1.5">Claim Amount (USD)</label>
                <input
                  type="number"
                  className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                  placeholder="Amount credited to user on claim"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#878AA2] mb-1.5">Period (days)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                    placeholder="Leave empty = unlimited"
                    value={form.periodDays}
                    onChange={e => setForm({ ...form, periodDays: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#878AA2] mb-1.5">End Date</label>
                  <input
                    type="date"
                    className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-[#0C0D1D] border border-[#1E2D55] rounded-lg p-4 space-y-4">
                <p className="text-xs text-[#878AA2] font-medium uppercase tracking-wider">Conditions</p>

                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#1E2D55] text-[#886CFF] focus:ring-[#886CFF] bg-[#0C0D1D]"
                      checked={form.depositStatus}
                      onChange={e => setForm({ ...form, depositStatus: e.target.checked })}
                    />
                    <span className="text-sm text-[#8384A5]">Deposit Condition</span>
                  </label>
                  {form.depositStatus && (
                    <input
                      type="number"
                      className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                      placeholder="Min deposit amount (USD)"
                      value={form.depositAmount}
                      onChange={e => setForm({ ...form, depositAmount: e.target.value })}
                    />
                  )}

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#1E2D55] text-[#886CFF] focus:ring-[#886CFF] bg-[#0C0D1D]"
                      checked={form.wagerStatus}
                      onChange={e => setForm({ ...form, wagerStatus: e.target.checked })}
                    />
                    <span className="text-sm text-[#8384A5]">Wager Condition</span>
                  </label>
                  {form.wagerStatus && (
                    <input
                      type="number"
                      className="w-full p-2.5 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg text-sm text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-[#886CFF]"
                      placeholder="Wager multiplier (e.g. 2, 3)"
                      value={form.wagerTimes}
                      onChange={e => setForm({ ...form, wagerTimes: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-[#1E2D55] text-[#886CFF] focus:ring-[#886CFF] bg-[#0C0D1D]"
                  checked={form.allUserStatus}
                  onChange={e => setForm({ ...form, allUserStatus: e.target.checked })}
                />
                <span className="text-sm text-[#8384A5]">Applicable to all users</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#1E2D55]">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 bg-[#162140] hover:bg-[#1E2D55] text-[#8384A5] rounded-lg text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createGiftCard}
                className="px-5 py-2.5 bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#886CFF]/25"
              >
                Create Gift Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
