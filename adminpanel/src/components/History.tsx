import { useCallback, useEffect, useState } from "react";
import {
    Activity, DollarSign,
    Search, RefreshCw, ChevronLeft, ChevronRight,
    Trophy, Users, BarChart3, Calendar, X, Filter,
    ArrowUpRight, ArrowDownRight, AlertCircle,
} from "lucide-react";
import { ENDPOINTS } from "../services/endpoints";
import { api, apiFetchPage, ApiError } from "../utils/api";

/**
 * Casino bet history and analytics.
 *
 * ── WHY THIS SCREEN WAS BLANK ────────────────────────────────────────────
 *
 * It called the LEGACY paths (`/betHistory/transactions`, `/betHistory/admin/
 * analytics`) with raw axios and read the response body as if it were the
 * payload. Three things were wrong at once, and each one alone was enough:
 *
 *   1. THE ENVELOPE. Every route answers `{success, data, meta}` now, so
 *      `body.transactions` was `undefined` — the table rendered "No
 *      transactions found" against a 200 that carried rows. `setAnalytics(body)`
 *      then stored the envelope, and the first render of `analytics.totals.total`
 *      threw on `undefined`, which is what actually blanked the page.
 *   2. THE ANALYTICS SHAPE. `total_bets`, `total_payouts`, `typeBreakdown`,
 *      `topUsers[].bet_count` are legacy field names. The service reports
 *      `wins`/`losses`/`pushes`, `net`, `bySource` and `topUsers[].bets`.
 *   3. THE USER DRILL-DOWN. `GET /betHistory/transactions/user/:userId` is NOT
 *      in the gateway's legacy map (a rewrite cannot fill a path parameter), so
 *      it 404'd — and `?game_type=all` would have been a 400 anyway, because the
 *      listing validator is `.strict()`.
 *
 * All three go away by calling the canonical paths from `ENDPOINTS` through
 * `apiFetch`, which unwraps the envelope once for the whole panel. The user
 * drill-down is `?userId=` on the listing route — `listForUser` is that same
 * call with the id moved into the path, so one code path covers both.
 *
 * The old `x-staff-id` header is gone: the gateway strips it, and the scope is
 * resolved from the verified token.
 */

/** One movement, as `betHistory.service.js` normalises all four sources. */
interface Transaction {
    id: number | null;
    transaction_id: string;
    round_id: string;
    user_id: number;
    user_name: string | null;
    transaction_type: "BET" | "WIN" | "REFUND" | "ROLLBACK" | "ROUND" | "NET";
    outcome: "WIN" | "LOSS" | "PUSH";
    amount: string;
    profit: string;
    currency_code: string | null;
    transaction_timestamp: string;
    game_title: string | null;
    game_vendor: string | null;
    source_key: string;
}

interface PaginationState {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
}

/**
 * `stats().totals` — counts are rows, money is a decimal string.
 *
 * `bets`/`wagered` are STAKES ONLY. The service used to classify by the sign
 * of the amount column, which is unsigned on every provider source, so a
 * payout read as a win and turnover counted the payouts a second time — the
 * card read ₹64 crore wagered against ₹33 crore actually staked. See
 * `statExpressions` in `betHistory.constants.js`.
 */
interface Totals {
    total: number;
    /** Rows that staked money. */
    bets: number;
    /** Every win row, zero-value ones included — legacy's `total_wins`. */
    wins: number;
    /** The subset of `wins` that actually paid. */
    paidWins: number;
    /** Win rows worth nothing: the round closed and paid zero. */
    pushes: number;
    losses: number;
    refunds: number;
    wagered: string;
    payouts: string;
    refunded: string;
    /** Signed, from the PLAYER's side: positive means the players are up. */
    net: string;
}

/** One line of the Transaction Breakdown — legacy's `typeBreakdown`. */
interface TypeRow {
    type: string;
    count: number;
    amount: string;
}

interface TopUser {
    userId: number;
    userName: string | null;
    bets: number;
    wagered: string;
    won: string;
    /** Which sources the figures were summed over, stated rather than assumed. */
    scope: string;
}

interface Analytics {
    totals: Totals;
    bySource: Record<string, Totals>;
    byType: TypeRow[];
    /** Null when the caller's tree is empty — there is no "today" to report. */
    today: Totals | null;
    topUsers: TopUser[];
}

const fmtNum = (n: string | number) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCount = (n: number) => Number(n || 0).toLocaleString("en-IN");

const fmtDate = (d: string) => {
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime())
        ? "—"
        : parsed.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const TYPE_COLORS: Record<string, string> = {
    BET: "bg-[#886CFF]/20 text-[#9B82FF]",
    WIN: "bg-emerald-500/20 text-emerald-400",
    ROUND: "bg-[#8B5CF6]/20 text-[#A78BFA]",
    NET: "bg-[#8B5CF6]/20 text-[#A78BFA]",
    REFUND: "bg-[#FFC23F]/20 text-[#FFC23F]",
    ROLLBACK: "bg-[#FFC23F]/20 text-[#FFC23F]",
};

const OUTCOME_COLORS: Record<string, string> = {
    WIN: "text-emerald-400",
    LOSS: "text-[#E01B4F]",
    PUSH: "text-[#8384A5]",
};

const EMPTY_PAGINATION: PaginationState = { total: 0, totalPages: 0, page: 1, limit: 15 };

const errorMessage = (e: unknown) =>
    e instanceof ApiError ? e.message : "Something went wrong loading this report";

const History: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [userId, setUserId] = useState("");
    const [pagination, setPagination] = useState<PaginationState>(EMPTY_PAGINATION);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");

    /**
     * The listing validator is `.strict()` and wants a positive integer, so a
     * half-typed id must not reach the wire — it would 400 the whole page.
     */
    const scopedUserId = /^\d+$/.test(userId.trim()) ? Number(userId.trim()) : undefined;

    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
        try {
            setAnalytics(await api.get<Analytics>(ENDPOINTS.casinoBetHistory.analytics));
        } catch (e) {
            setAnalytics(null);
            setAnalyticsError(errorMessage(e));
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setTxError(null);
        try {
            const { data, pagination: meta } = await apiFetchPage<Transaction>(
                ENDPOINTS.casinoBetHistory.transactions,
                {
                    query: {
                        page,
                        limit: pagination.limit,
                        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
                        ...(scopedUserId ? { userId: scopedUserId } : {}),
                    },
                }
            );
            setTransactions(data);
            setPagination((p) => (meta ? { ...meta, limit: meta.limit || p.limit } : { ...p, total: data.length, totalPages: 1 }));
        } catch (e) {
            setTransactions([]);
            setPagination((p) => ({ ...p, total: 0, totalPages: 0 }));
            setTxError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [page, pagination.limit, searchTerm, scopedUserId]);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    /**
     * One effect, debounced, for every input that changes the query. The search
     * box used to have an effect of its own that fired on mount alongside the
     * page effect, so the screen issued the same request twice before an
     * operator had typed anything.
     */
    useEffect(() => {
        const timer = setTimeout(fetchTransactions, 300);
        return () => clearTimeout(timer);
    }, [fetchTransactions]);

    /** A new filter invalidates the page number — page 7 of the old result set. */
    useEffect(() => { setPage(1); }, [searchTerm, scopedUserId]);

    const handleClear = () => { setSearchTerm(""); setUserId(""); setPage(1); };

    const totals = analytics?.totals;
    const today = analytics?.today;

    const statCards = totals ? [
        { label: "Total Transactions", value: fmtCount(totals.total), icon: <Activity size={22} />, gradient: "from-[#886CFF] to-[#8B5CF6]", glow: "shadow-[0_0_30px_rgba(100,110,205,0.3)]" },
        { label: "Total Bets", value: fmtCount(totals.bets), icon: <BarChart3 size={22} />, gradient: "from-[#0EA5E9] to-[#06B6D4]", glow: "shadow-[0_0_30px_rgba(14,165,233,0.3)]" },
        { label: "Total Wins", value: fmtCount(totals.wins), icon: <Trophy size={22} />, gradient: "from-[#10B981] to-[#059669]", glow: "shadow-[0_0_30px_rgba(16,185,129,0.3)]" },
        { label: "Total Wagered", value: `₹${fmtNum(totals.wagered)}`, icon: <DollarSign size={22} />, gradient: "from-[#F59E0B] to-[#EF4444]", glow: "shadow-[0_0_30px_rgba(245,158,11,0.3)]" },
    ] : [];

    const todayCards = today ? [
        { label: "Today Bets", value: fmtCount(today.bets), color: "text-[#9B82FF]" },
        { label: "Today Wins", value: fmtCount(today.wins), color: "text-emerald-400" },
        { label: "Today Wagered", value: `₹${fmtNum(today.wagered)}`, color: "text-amber-400" },
        { label: "Today Total", value: fmtCount(today.total), color: "text-purple-400" },
    ] : [];

    /**
     * `bySource` is still in the payload but is NOT drawn: on a deployment
     * running one provider it is three zero rows and one row repeating the
     * totals above it, which is noise dressed as a breakdown.
     */

    /** Legacy's `typeBreakdown`: how the movements split by what they were. */
    const typeRows = analytics?.byType ?? [];

    /**
     * The house keeps what the players staked and did not win back.
     *
     * `net` is the players' side, so this is its negation. It used to be
     * derived from a `net` that summed an unsigned column, which is why the
     * card read minus the entire turnover.
     */
    const houseNet = totals ? -Number(totals.net) : 0;

    const barWidth = (count: number, rows: { count: number }[]) => {
        const peak = Math.max(1, ...rows.map((r) => r.count));
        return `${Math.max(2, (count / peak) * 100)}%`;
    };

    return (
        <div className="p-4 md:p-6 min-h-screen text-[#F9F9F9] space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bet History &amp; Analytics</h1>
                    <p className="text-[#878AA2] text-sm mt-1">Transaction history, analytics &amp; user insights</p>
                </div>
                <button onClick={() => { fetchAnalytics(); fetchTransactions(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0E1831] hover:bg-[#162140] border border-[#1E2D55] rounded-lg text-sm transition-all">
                    <RefreshCw size={14} className={loading || analyticsLoading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {analyticsError && (
                <div className="flex items-center gap-2 bg-[#E01B4F]/10 border border-[#E01B4F]/40 text-[#E01B4F] rounded-lg px-4 py-3 text-sm">
                    <AlertCircle size={16} /> {analyticsError}
                </div>
            )}

            {/* Stat Cards */}
            {totals && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((c, i) => (
                        <div key={i} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${c.gradient} ${c.glow} p-5 transition-transform hover:scale-[1.02]`}>
                            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                            <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10" />
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-[#F9F9F9]/70 text-xs uppercase tracking-wider font-medium">{c.label}</p>
                                    <p className="text-3xl font-extrabold mt-2 tracking-tight">{c.value}</p>
                                </div>
                                <div className="bg-white/20 p-2.5 rounded-lg backdrop-blur-sm">{c.icon}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-[#0E1831] rounded-lg p-1 border border-[#1E2D55] w-fit">
                {([
                    { key: "overview" as const, label: "Overview", icon: <BarChart3 size={14} /> },
                    { key: "transactions" as const, label: "Transactions", icon: <Activity size={14} /> },
                ]).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.key
                            ? "bg-[#886CFF] text-[#F9F9F9] shadow-lg shadow-[#886CFF]/20"
                            : "text-[#878AA2] hover:text-[#F9F9F9] hover:bg-[#162140]"}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && analytics && totals && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Today's Stats */}
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar size={16} className="text-[#886CFF]" />
                            <h3 className="font-semibold">Today's Activity</h3>
                        </div>
                        {today ? (
                            <div className="grid grid-cols-2 gap-3">
                                {todayCards.map((c, i) => (
                                    <div key={i} className="bg-[#0C0D1D] rounded-lg border border-[#1E2D55] p-4">
                                        <p className="text-[#878AA2] text-xs uppercase tracking-wider">{c.label}</p>
                                        <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[#878AA2] text-sm py-8 text-center">No players in your tree yet</p>
                        )}
                    </div>

                    {/* Transaction breakdown — legacy's typeBreakdown. */}
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter size={16} className="text-[#886CFF]" />
                            <h3 className="font-semibold">Transaction Breakdown</h3>
                        </div>
                        <div className="space-y-3">
                            {typeRows.map((row) => (
                                <div key={row.type} className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded w-20 text-center ${TYPE_COLORS[row.type.toUpperCase()] ?? "bg-[#8384A5]/20 text-[#8384A5]"}`}>
                                        {row.type}
                                    </span>
                                    <div className="flex-1 bg-[#0C0D1D] rounded-full h-2 overflow-hidden">
                                        <div className="h-full bg-[#886CFF] rounded-full transition-all" style={{ width: barWidth(row.count, typeRows) }} />
                                    </div>
                                    <span className="text-xs text-[#878AA2] w-16 text-right">{fmtCount(row.count)}</span>
                                    <span className="text-xs text-[#878AA2] w-28 text-right">₹{fmtNum(row.amount)}</span>
                                </div>
                            ))}
                            {typeRows.length === 0 && (
                                <p className="text-center py-8 text-[#878AA2] text-sm">No activity yet</p>
                            )}
                        </div>

                    </div>

                    {/* P&L Summary */}
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign size={16} className="text-[#886CFF]" />
                            <h3 className="font-semibold">P&amp;L Summary</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[#878AA2] text-sm">Total Wagered</span>
                                <span className="text-lg font-bold text-[#9B82FF]">₹{fmtNum(totals.wagered)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#878AA2] text-sm">Total Payouts</span>
                                <span className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                                    <ArrowUpRight size={16} />₹{fmtNum(totals.payouts)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#878AA2] text-sm">Refunded</span>
                                <span className="text-lg font-bold text-[#FFC23F] flex items-center gap-1">
                                    <ArrowDownRight size={16} />₹{fmtNum(totals.refunded)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#878AA2] text-sm">
                                    Paid wins <span className="text-[#878AA2]/60">/ pushes</span>
                                </span>
                                <span className="text-lg font-bold text-[#8384A5]">
                                    {fmtCount(totals.paidWins)} <span className="text-[#878AA2]/60">/ {fmtCount(totals.pushes)}</span>
                                </span>
                            </div>
                            <div className="border-t border-[#1E2D55] pt-3 flex justify-between items-center">
                                <span className="text-[#8384A5] text-sm font-semibold">House Edge</span>
                                <span className={`text-lg font-bold ${houseNet >= 0 ? "text-emerald-400" : "text-[#E01B4F]"}`}>
                                    {houseNet < 0 ? "-" : ""}₹{fmtNum(Math.abs(houseNet))}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Top Users */}
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Users size={16} className="text-[#886CFF]" />
                            <h3 className="font-semibold">Top Users by Bets</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[#878AA2] text-xs uppercase border-b border-[#1E2D55]">
                                        <th className="pb-2 text-left">#</th>
                                        <th className="pb-2 text-left">User</th>
                                        <th className="pb-2 text-right">Bets</th>
                                        <th className="pb-2 text-right">Wagered</th>
                                        <th className="pb-2 text-right">Won</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics.topUsers.map((u, i) => (
                                        <tr key={u.userId} className="border-b border-[#1E2D55]/50 hover:bg-[#162140] transition cursor-pointer"
                                            onClick={() => { setUserId(String(u.userId)); setActiveTab("transactions"); }}>
                                            <td className="py-2 text-[#878AA2] text-xs">{i + 1}</td>
                                            <td className="py-2">
                                                <span className="font-medium">{u.userName || "—"}</span>
                                                <span className="text-[#878AA2] text-xs ml-2">#{u.userId}</span>
                                            </td>
                                            <td className="py-2 text-right font-mono text-[#8384A5]">{fmtCount(u.bets)}</td>
                                            <td className="py-2 text-right font-mono text-[#9B82FF]">₹{fmtNum(u.wagered)}</td>
                                            <td className="py-2 text-right font-mono text-emerald-400">₹{fmtNum(u.won)}</td>
                                        </tr>
                                    ))}
                                    {analytics.topUsers.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-8 text-[#878AA2]">No data yet</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* The service says so itself: summing across currencies would rank nobody. */}
                        {analytics.topUsers.length > 0 && (
                            <p className="text-[#878AA2] text-xs mt-3">{analytics.topUsers[0].scope}</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── TRANSACTIONS TAB ── */}
            {activeTab === "transactions" && (
                <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-[#1E2D55] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">
                            Transactions
                            <span className="text-sm text-[#878AA2] font-normal ml-2">({fmtCount(pagination.total)} total)</span>
                        </h2>
                        <div className="flex flex-wrap gap-3 items-center">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search transaction ref..."
                                    className="bg-[#0C0D1D] border border-[#1E2D55] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-[#878AA2] w-52" />
                            </div>
                            <div className="relative">
                                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                                <input value={userId} inputMode="numeric" onChange={e => setUserId(e.target.value)}
                                    placeholder="User ID"
                                    className="bg-[#0C0D1D] border border-[#1E2D55] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-[#878AA2] w-40" />
                            </div>
                            {(searchTerm || userId) && (
                                <button onClick={handleClear}
                                    className="flex items-center gap-1 text-xs text-[#878AA2] hover:text-[#F9F9F9] bg-[#162140] px-3 py-2 rounded-lg transition">
                                    <X size={12} /> Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {txError && (
                        <div className="flex items-center gap-2 bg-[#E01B4F]/10 border-b border-[#E01B4F]/40 text-[#E01B4F] px-4 py-3 text-sm">
                            <AlertCircle size={16} /> {txError}
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[#878AA2] text-xs uppercase tracking-wider bg-[#0C0D1D]">
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Game</th>
                                    <th className="px-4 py-3">Coin</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right">Profit</th>
                                    <th className="px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-[#878AA2]">Loading...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-[#878AA2]">No transactions found</td></tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={`${tx.source_key}:${tx.transaction_id}`} className="border-t border-[#1E2D55] hover:bg-[#162140] transition">
                                            <td className="px-4 py-3">
                                                <span className="font-medium">{tx.user_name || "—"}</span>
                                                <span className="text-[#878AA2] text-xs block">#{tx.user_id}</span>
                                            </td>
                                            <td className="px-4 py-3 text-[#8384A5]">
                                                {tx.game_title || "—"}
                                                {tx.game_vendor && <span className="text-[#878AA2] text-xs block">{tx.game_vendor}</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="bg-[#886CFF]/20 text-[#886CFF] text-xs font-semibold px-2 py-0.5 rounded">{tx.currency_code || "—"}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[tx.transaction_type] || "bg-[#1E2D55]/20 text-[#878AA2]"}`}>
                                                    {tx.transaction_type}
                                                </span>
                                            </td>
                                            {/* `amount` is a magnitude — direction lives in `transaction_type`. */}
                                            <td className="px-4 py-3 text-right font-mono text-[#8384A5]">₹{fmtNum(tx.amount)}</td>
                                            <td className={`px-4 py-3 text-right font-mono ${OUTCOME_COLORS[tx.outcome] || "text-[#8384A5]"}`}>
                                                {Number(tx.profit) > 0 ? "+" : ""}₹{fmtNum(tx.profit)}
                                            </td>
                                            <td className="px-4 py-3 text-[#878AA2] text-xs">{fmtDate(tx.transaction_timestamp)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E2D55]">
                            <span className="text-xs text-[#878AA2]">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={pagination.page <= 1}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#162140] hover:bg-[#1E2D55] rounded-lg text-xs transition disabled:opacity-40">
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#162140] hover:bg-[#1E2D55] rounded-lg text-xs transition disabled:opacity-40">
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default History;
