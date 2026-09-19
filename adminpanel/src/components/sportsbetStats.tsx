import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
    Activity,
    TrendingUp,
    ArrowDownCircle,
    Layers,
    Wallet,
    DollarSign,
    Search,
    BarChart3,
    PieChart,
    LayoutDashboard,
    ListOrdered,
    RefreshCw,
    Eye,
    ArrowLeft,
    Lock,
    Unlock,
    Shield,
    Users,
    XCircle,
    AlertTriangle,
} from "lucide-react";
import { apiFetch, apiFetchPage, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE SHAPES ON THIS SCREEN ARE sports-service's, NOT `sports_bets` ROWS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every tab here was written against the monolith, which returned database
 * rows and hand-rolled envelopes (`{list, stats}`, `{success, data}`). None of
 * that survives:
 *
 *   - the envelope is `{success, data, meta}` uniformly, and `apiFetch`
 *     unwraps it — reading `data.list` / `data.stats` / `Array.isArray(data)`
 *     produced empty tabs against perfectly good responses
 *   - bets are SHAPED: `matchTitle`, `selection`, `side`, `stake`,
 *     `resultStatus` — not `match_title`, `selection_name`, `bet_type`,
 *     `stake_amount`, `result_status`
 *   - money arrives as DECIMAL STRINGS, so every arithmetic use needs `Number`
 *   - auth is the staff TOKEN. The `x-staff-id` header this screen sent is
 *     the thing the rewrite removed: it let the caller name its own authority
 *
 * `Stats` is now derived from the page in hand — the endpoint returns bets and
 * a total, and never had a stats block to read.
 */

/** One bet, as `/admin/sports/bet-admin/bets` and `/bets/ticker` shape it. */
interface Bet {
    id: number;
    userId: number;
    username: string | null;
    matchId: string;
    matchTitle: string;
    gameType: string;
    selection: string;
    side: string;
    odds: string;
    stake: string;
    liability: string;
    status: string;
    resultStatus: string | null;
    ipAddress: string | null;
    createdAt: string;
}

interface Stats {
    totalBets: number;
    totalWins: number;
    totalLosses: number;
    totalPending: number;
}

/** The ticker and the P&L tab read the same shape. */
type TickerBet = Bet;
type BetListItem = Bet;

/**
 * One match's net exposure, from `/bet-admin/exposure`.
 *
 * The old `ExposureEvent`/`ExposureMarket` pair modelled per-market exposure
 * broken down by runner. `user_exposures` has no market column, so that
 * breakdown was never in the data — the endpoint groups by MATCH and reports
 * the worst-case liability, which is the number that is actually at risk.
 */
interface ExposureRow {
    matchId: string;
    matchTitle: string | null;
    liability: string;
    players: number;
}

/** One match's per-outcome book, from `/bet-admin/exposure/match/:matchId`. */
interface MarketBook {
    matchId: string;
    matchTitle: string | null;
    players: number;
    /** Signed from the PLAYER's side: positive is what the platform pays out. */
    outcomes: Record<string, string>;
    worstCase: string;
}

interface SettledMarket {
    matchId: string;
    marketType: string;
    sportId: string;
    eventId: string;
    description: string;
    matchTitle: string;
    teamOne: string;
    teamTwo: string;
    gameType: string;
    totalEntries: number;
    totalUsers: number;
    totalNetAmount: number;
    lastSettledAt: string;
}

interface SettledBet {
    ledgerId: number;
    betId: number;
    userId: number;
    username: string;
    amount: number;
    netamount: number;
    profit: number;
    loss: number;
    commission: number;
    description: string;
    marketType: string;
    sportId: string;
    matchId: string;
    eventId: string;
    jobId: string;
    createdAt: string;
    betType: string;
    selectionName: string;
    odds: number | null;
    stakeAmount: number | null;
    gameType: string;
    resultStatus: string;
}

type Tab = "dashboard" | "ticker" | "profitloss" | "market" | "betlock" | "settledvoid";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { key: "ticker", label: "Bet Ticker", icon: <ListOrdered size={16} /> },
    { key: "profitloss", label: "Profit & Loss", icon: <BarChart3 size={16} /> },
    { key: "market", label: "Net Exposure", icon: <PieChart size={16} /> },
    { key: "betlock", label: "Bet Lock", icon: <Lock size={16} /> },
    { key: "settledvoid", label: "Settled Void", icon: <XCircle size={16} /> },
];

const SPORT_LIST = [
    { value: "All", label: "All" },
    { value: "4", label: "Cricket" },
    { value: "1", label: "Football" },
    { value: "2", label: "Tennis" },
    { value: "8", label: "Table Tennis" },
    { value: "15", label: "Basketball" },
    { value: "66", label: "Kabaddi" },
];

// ==================== MAIN COMPONENT ====================
const SportsDashboard: React.FC = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<Tab>(
        location.pathname === "/sports-lock" ? "betlock" : "dashboard"
    );

    useEffect(() => {
        if (location.pathname === "/sports-lock") setActiveTab("betlock");
    }, [location.pathname]);

    // ===== DASHBOARD STATE =====
    const [bets, setBets] = useState<Bet[]>([]);
    const [stats, setStats] = useState<Stats>({ totalBets: 0, totalWins: 0, totalLosses: 0, totalPending: 0 });
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // User lookup
    const [userId, setUserId] = useState("");
    const [userBets, setUserBets] = useState<Bet[]>([]);
    const [userStats, setUserStats] = useState<Stats>({ totalBets: 0, totalWins: 0, totalLosses: 0, totalPending: 0 });
    const [userPage, setUserPage] = useState(1);
    const [userLimit] = useState(10);
    const [userLoading, setUserLoading] = useState(false);
    const [userSearched, setUserSearched] = useState(false);

    // ===== BET LOCK STATE =====
    const [lockUsers, setLockUsers] = useState<any[]>([]);
    const [lockStaff, setLockStaff] = useState<any[]>([]);
    const [lockSubTab, setLockSubTab] = useState<"users" | "staff">("users");
    const [lockSearch, setLockSearch] = useState("");
    const [lockLoading, setLockLoading] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    // ===== BET TICKER STATE =====
    const [tickerData, setTickerData] = useState<TickerBet[]>([]);
    const [tickerLoading, setTickerLoading] = useState(false);
    const [tickerSport, setTickerSport] = useState("All");
    const [tickerSearch, setTickerSearch] = useState("");
    const [tickerTimer, setTickerTimer] = useState(10);

    // ===== PROFIT & LOSS STATE =====
    const [plData, setPlData] = useState<BetListItem[]>([]);
    const [plLoading, setPlLoading] = useState(false);
    const [plSport, setPlSport] = useState("All");
    const [plSearch, setPlSearch] = useState("");
    const [plFromDate, setPlFromDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().split("T")[0];
    });
    const [plToDate, setPlToDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [plPage, setPlPage] = useState(1);
    const [plLimit, setPlLimit] = useState(50);
    const [plTotal, setPlTotal] = useState(0);
    const [plSelectedBets, setPlSelectedBets] = useState<BetListItem[] | null>(null);
    const [plSelectedName, setPlSelectedName] = useState("");

    // ===== NET EXPOSURE STATE =====
    const [exposureData, setExposureData] = useState<ExposureRow[]>([]);
    const [exposureLoading, setExposureLoading] = useState(false);
    const [exposureMeta, setExposureMeta] = useState({ totalEvents: 0, totalExposure: 0 });
    const [exposureTimer, setExposureTimer] = useState(10);
    const [marketBook, setMarketBook] = useState<MarketBook | null>(null);
    const [marketBookTitle, setMarketBookTitle] = useState("");
    const [marketBookLoading, setMarketBookLoading] = useState(false);

    // ===== SETTLED VOID STATE =====
    const [svMarkets, setSvMarkets] = useState<SettledMarket[]>([]);
    const [svLoading, setSvLoading] = useState(false);
    const [svSearch, setSvSearch] = useState("");
    const [svSelectedMarket, setSvSelectedMarket] = useState<SettledMarket | null>(null);
    const [svBets, setSvBets] = useState<SettledBet[]>([]);
    const [svBetsLoading, setSvBetsLoading] = useState(false);
    const [svVoidingMarket, setSvVoidingMarket] = useState(false);
    const [svVoidingBetId, setSvVoidingBetId] = useState<number | null>(null);

    const formatCurrency = (num: number) =>
        num.toLocaleString("en-IN", { style: "currency", currency: "INR" });

    // ==================== DASHBOARD FETCHES ====================

    /**
     * Wins / losses / pending, counted from the rows in hand.
     *
     * The monolith returned a `stats` block alongside the list. sports-service
     * returns bets and a total and nothing else, so reading `data.stats` left
     * all four cards at zero forever. These describe the CURRENT PAGE, which is
     * what the numbers beside a paginated table should describe anyway.
     */
    const statsFrom = (rows: Bet[]): Stats => ({
        totalBets: rows.length,
        totalWins: rows.filter((b) => ["won", "win"].includes(String(b.resultStatus).toLowerCase())).length,
        totalLosses: rows.filter((b) => ["lost", "loss"].includes(String(b.resultStatus).toLowerCase())).length,
        totalPending: rows.filter((b) => b.status === "open" || b.resultStatus === "pending" || !b.resultStatus).length,
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // `limit`/`offset` — `page` is not in the query schema and was
                // stripped, so every page of this table showed the first page.
                const { data } = await apiFetchPage<Bet>(ENDPOINTS.sportsBetAdmin.bets, {
                    query: { limit, offset: (page - 1) * limit },
                });
                setBets(data);
                setStats(statsFrom(data));
            } catch (err) { console.error("API Error:", err); }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit]);

    /**
     * One player's bets.
     *
     * This used to call `/bets/by-user`, which returns TOTALS PER PLAYER
     * (`{userId, username, bets, staked, liability}`) — never a bet list. The
     * list endpoint takes `userId` as a filter, which is what this wants.
     */
    const fetchUserBets = async (p = userPage, l = userLimit) => {
        if (!userId.trim()) return;
        setUserLoading(true);
        setUserSearched(true);
        try {
            const { data } = await apiFetchPage<Bet>(ENDPOINTS.sportsBetAdmin.bets, {
                query: { limit: l, offset: (p - 1) * l, userId: userId.trim() },
            });
            setUserBets(data);
            setUserStats(statsFrom(data));
        } catch (err) { console.error("User API Error:", err); }
        finally { setUserLoading(false); }
    };

    useEffect(() => {
        if (userSearched) fetchUserBets(userPage, userLimit);
    }, [userPage, userLimit]);

    // Money is a decimal STRING on the wire — `+` on strings concatenates.
    const sumBy = (rows: Bet[], key: "stake" | "liability") =>
        rows.reduce((total, b) => total + (Number(b[key]) || 0), 0);

    const totalStake = sumBy(bets, "stake");
    const totalLiability = sumBy(bets, "liability");
    const userTotalStake = sumBy(userBets, "stake");
    const userTotalLiability = sumBy(userBets, "liability");

    // ==================== BET TICKER FETCHES ====================
    const fetchTicker = async (silent = false) => {
        if (!silent) setTickerLoading(true);
        try {
            // `limit` is the only parameter the ticker accepts. The `sport`
            // filter has no server side, so it narrows what arrived.
            const rows = await apiFetch<TickerBet[]>(ENDPOINTS.sportsBetAdmin.ticker, {
                query: { limit: 50 },
            });
            setTickerData(Array.isArray(rows) ? rows : []);
        } catch (err) { console.error("Ticker Error:", err); }
        finally { if (!silent) setTickerLoading(false); }
    };

    useEffect(() => {
        if (activeTab === "ticker") fetchTicker();
    }, [activeTab, tickerSport]);

    // Auto-refresh ticker
    useEffect(() => {
        if (activeTab !== "ticker") return;
        const interval = setInterval(() => {
            setTickerTimer((prev) => {
                if (prev <= 1) { fetchTicker(true); return 10; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [activeTab, tickerSport]);

    const filteredTicker = useMemo(() => {
        if (!tickerSearch.trim()) return tickerData;
        const term = tickerSearch.toLowerCase();
        return tickerData.filter(
            (b) =>
                (b.username || "").toLowerCase().includes(term) ||
                (b.matchTitle || "").toLowerCase().includes(term) ||
                (b.selection || "").toLowerCase().includes(term)
        );
    }, [tickerData, tickerSearch]);

    // ==================== PROFIT & LOSS FETCHES ====================
    const fetchPL = async () => {
        setPlLoading(true);
        try {
            const { data } = await apiFetchPage<BetListItem>(ENDPOINTS.sportsBetAdmin.bets, {
                query: {
                    limit: plLimit,
                    offset: (plPage - 1) * plLimit,
                    status: "closed",
                    from: new Date(plFromDate).toISOString(),
                    to: new Date(`${plToDate}T23:59:59`).toISOString(),
                },
            });
            // The date range and `closed` are server-side filters now; only the
            // "not still pending a result" check has to happen here.
            const settled = data.filter((b) => b.resultStatus && b.resultStatus !== "pending");
            setPlData(settled);
            setPlTotal(settled.length);
        } catch (err) { console.error("P&L Error:", err); }
        finally { setPlLoading(false); }
    };

    useEffect(() => {
        if (activeTab === "profitloss") fetchPL();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, plPage, plLimit, plFromDate, plToDate]);

    // Calculate P&L for a single bet
    const calcBetPL = (bet: BetListItem): number => {
        const stake = Number(bet.stake) || 0;
        const odds = Number(bet.odds) || 0;
        const result = String(bet.resultStatus || "").toLowerCase();
        const isBack = bet.side === "back" || bet.side === "yes";

        if (result === "won" || result === "win") return isBack ? stake * (odds - 1) : stake;
        if (result === "loss" || result === "lost") return isBack ? -stake : -(stake * (odds - 1));
        return 0; // refund, void, or not yet settled
    };

    // Filter P&L data by search and sport
    const plFiltered = useMemo(() => {
        // `sport_id` is not on the staff bet payload, so the sport selector has
        // nothing to filter on — `gameType` (MO/BM/FAN) is the only market
        // dimension available here.
        let filtered = plData;
        if (plSearch.trim()) {
            const term = plSearch.toLowerCase();
            filtered = filtered.filter((b) =>
                String(b.userId).includes(term) ||
                (b.username || "").toLowerCase().includes(term) ||
                (b.matchTitle || "").toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [plData, plSearch]);

    // Group P&L data by date -> event -> market
    const plGrouped = useMemo(() => {
        const grouped: Record<string, Record<string, { marketName: string; pl: number; bets: BetListItem[] }[]>> = {};
        plFiltered.forEach((bet) => {
            const date = bet.createdAt ? new Date(bet.createdAt).toLocaleDateString() : "Unknown";
            const eventName = (bet.matchTitle || bet.matchId || "Unknown Event").trim();
            const marketName = bet.gameType || "Unknown Market";

            if (!grouped[date]) grouped[date] = {};
            if (!grouped[date][eventName]) grouped[date][eventName] = [];

            const existing = grouped[date][eventName].find((m) => m.marketName === marketName);
            const plAmount = calcBetPL(bet);

            if (existing) {
                existing.pl += plAmount;
                existing.bets.push(bet);
            } else {
                grouped[date][eventName].push({ marketName, pl: plAmount, bets: [bet] });
            }
        });
        return grouped;
    }, [plFiltered]);

    const plGrandTotal = useMemo(() => {
        let total = 0;
        Object.values(plGrouped).forEach((events) => {
            Object.values(events).forEach((markets) => {
                markets.forEach((m) => { total += m.pl; });
            });
        });
        return total;
    }, [plGrouped]);

    // ==================== NET EXPOSURE FETCHES ====================
    const fetchExposure = async (silent = false) => {
        if (!silent) setExposureLoading(true);
        try {
            const { data, pagination } = await apiFetchPage<ExposureRow>(
                ENDPOINTS.sportsBetAdmin.exposure,
                { query: { limit: 200, offset: 0 } }
            );
            setExposureData(data);
            setExposureMeta({
                totalEvents: pagination?.total ?? data.length,
                // `meta` carries pagination, not totals — the platform's exposure
                // is the sum of each match's worst case, which is what the rows
                // already report.
                totalExposure: data.reduce((t, r) => t + (Number(r.liability) || 0), 0),
            });
        } catch (err) { console.error("Exposure Error:", err); }
        finally { if (!silent) setExposureLoading(false); }
    };

    useEffect(() => {
        if (activeTab === "market") fetchExposure();
    }, [activeTab]);

    // Auto-refresh exposure
    useEffect(() => {
        if (activeTab !== "market") return;
        const interval = setInterval(() => {
            setExposureTimer((prev) => {
                if (prev <= 1) { fetchExposure(true); return 10; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [activeTab]);

    /**
     * One match's book.
     *
     * Answers a single OBJECT — `{matchId, matchTitle, players, outcomes,
     * worstCase}` — not the per-user rows this screen used to render. There is
     * no `marketType` parameter; the route takes the match and nothing else.
     */
    const fetchMarketBook = async (matchId: string, title: string) => {
        setMarketBookLoading(true);
        setMarketBookTitle(title);
        try {
            const book = await apiFetch<MarketBook>(
                buildPath(ENDPOINTS.sportsBetAdmin.exposureByMatch, { matchId })
            );
            setMarketBook(book ?? null);
        } catch (err) { console.error("Market Book Error:", err); setMarketBook(null); }
        finally { setMarketBookLoading(false); }
    };

    const formatExposure = (value: number) => {
        const num = Number(value) || 0;
        return num < 0 ? Math.abs(num).toFixed(2) : num.toFixed(2);
    };

    // ===== BET LOCK FETCHERS =====
    /**
     * Players and staff, with their sports-betting lock state.
     *
     * Both used to test `Array.isArray(data)` on the RAW RESPONSE, which is the
     * `{success, data, meta}` envelope — never an array — so both lists were
     * silently empty and every operator saw "no accounts". `apiFetch*` unwraps.
     *
     * The rows are `{userId, username, sportsLocked, accountLocked}` and
     * `{staffId, name, sportsLocked, accountLocked}`.
     */
    const fetchLockUsers = async () => {
        try {
            const { data } = await apiFetchPage<any>(ENDPOINTS.sportsBetAdmin.userLocks, {
                query: { limit: 200, offset: 0 },
            });
            setLockUsers(data);
        } catch (e) { console.error(e); }
    };

    const fetchLockStaff = async () => {
        try {
            const rows = await apiFetch<any[]>(ENDPOINTS.sportsBetAdmin.staffLocks);
            setLockStaff(Array.isArray(rows) ? rows : []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (activeTab === "betlock") {
            setLockLoading(true);
            Promise.all([fetchLockUsers(), fetchLockStaff()]).finally(() => setLockLoading(false));
        }
    }, [activeTab]);

    /**
     * The bodies are `{userId, locked}` and `{staffId, locked}`, both `.strict()`.
     *
     * These sent `user_id` / `staff_id`, which a strict schema REJECTS — so the
     * toggles 422'd while the UI flipped the switch optimistically and showed a
     * lock that had not happened.
     */
    const toggleUserLock = async (targetUserId: number, locked: boolean) => {
        setTogglingId(targetUserId);
        try {
            await apiFetch(ENDPOINTS.sportsBetAdmin.userLocks, {
                method: "POST",
                body: { userId: targetUserId, locked },
            });
            setLockUsers(prev => prev.map(u => u.userId === targetUserId ? { ...u, sportsLocked: locked } : u));
        } catch (e) { console.error(e); }
        finally { setTogglingId(null); }
    };

    const toggleStaffLock = async (sid: number, locked: boolean) => {
        setTogglingId(sid);
        try {
            await apiFetch(ENDPOINTS.sportsBetAdmin.staffLocks, {
                method: "POST",
                body: { staffId: sid, locked },
            });
            setLockStaff(prev => prev.map(s => s.staffId === sid ? { ...s, sportsLocked: locked } : s));
        } catch (e) { console.error(e); }
        finally { setTogglingId(null); }
    };

    const filteredLockUsers = lockUsers.filter(u => {
        const q = lockSearch.toLowerCase();
        return String(u.userId).includes(q) || (u.username || "").toLowerCase().includes(q);
    });

    const filteredLockStaff = lockStaff.filter(s => {
        const q = lockSearch.toLowerCase();
        return String(s.staffId).includes(q) || (s.name || "").toLowerCase().includes(q);
    });

    // ==================== SETTLED VOID FETCHES ====================
    const fetchSettledMarkets = async () => {
        setSvLoading(true);
        try {
            // `/api/internalsettle/*` is a monolith path that the gateway does
            // not route — all four calls in this tab 404'd.
            const markets = await apiFetch<SettledMarket[]>(ENDPOINTS.sportsSettlement.settledMarkets, {
                query: { limit: 100, offset: 0, ...(svSearch.trim() && { search: svSearch.trim() }) },
            });
            setSvMarkets(Array.isArray(markets) ? markets : []);
        } catch (err) { console.error("Settled Markets Error:", err); }
        finally { setSvLoading(false); }
    };

    const fetchSettledBets = async (matchId: string, marketType: string) => {
        setSvBetsLoading(true);
        try {
            const rows = await apiFetch<SettledBet[]>(ENDPOINTS.sportsSettlement.settledBets, {
                query: { match_id: matchId, market_type: marketType },
            });
            setSvBets(Array.isArray(rows) ? rows : []);
        } catch (err) { console.error("Settled Bets Error:", err); }
        finally { setSvBetsLoading(false); }
    };

    const voidMarketAfterSettlement = async (matchId: string, marketType: string) => {
        if (!window.confirm(`Are you sure you want to void the entire market "${marketType}" for match "${matchId}"? This will reverse all settlements.`)) return;
        setSvVoidingMarket(true);
        try {
            const result = await apiFetch<any>(ENDPOINTS.sportsSettlement.voidMarketPostSettlement, {
                method: "POST",
                body: { match_id: matchId, market_type: marketType },
            });
            alert(
                `Market voided. ${result?.processedEntries ?? 0} entries reversed, ` +
                `${result?.affectedUsers ?? 0} users affected.`
            );
            fetchSettledMarkets();
            setSvSelectedMarket(null);
            setSvBets([]);
        } catch (err: any) {
            console.error("Void Market Error:", err);
            alert(`Failed to void market: ${err?.message || "unknown error"}`);
        }
        finally { setSvVoidingMarket(false); }
    };

    const voidSingleBetAfterSettlement = async (ledgerId: number) => {
        if (!window.confirm(`Are you sure you want to void bet (ledger #${ledgerId})? This will reverse the settlement for this bet.`)) return;
        setSvVoidingBetId(ledgerId);
        try {
            const result = await apiFetch<any>(ENDPOINTS.sportsSettlement.voidBetPostSettlement, {
                method: "POST",
                body: { ledger_id: ledgerId },
            });
            alert(`Bet voided. Bet #${result?.betId ?? "?"} for user ${result?.userId ?? "?"}.`);
            if (svSelectedMarket) {
                fetchSettledBets(svSelectedMarket.matchId, svSelectedMarket.marketType);
            }
        } catch (err: any) {
            console.error("Void Bet Error:", err);
            alert(`Failed to void bet: ${err?.message || "unknown error"}`);
        }
        finally { setSvVoidingBetId(null); }
    };

    useEffect(() => {
        if (activeTab === "settledvoid") fetchSettledMarkets();
    }, [activeTab]);

    // Group settled markets by market type
    const svGrouped = useMemo(() => {
        const grouped: Record<string, SettledMarket[]> = {};
        svMarkets.forEach((m) => {
            const key = m.marketType || "Unknown";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(m);
        });
        return grouped;
    }, [svMarkets]);

    // ==================== RENDER ====================
    return (
        <div className="bg-[#0C0D1D] text-[#F9F9F9] min-h-screen p-6">
            <div className="">
                <h1 className="text-3xl font-bold mb-6">Sports Analytics</h1>

                {/* TABS */}
                <div className="flex gap-1 mb-8 border-b border-[#1E2D55]">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all ${activeTab === tab.key
                                ? "bg-[#0E1831] text-[#F9F9F9] border-b-2 border-indigo-500"
                                : "text-[#878AA2] hover:text-[#F9F9F9] hover:bg-[#0E1831]/50"
                                }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* ==================== DASHBOARD TAB ==================== */}
                {activeTab === "dashboard" && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <Card title="Total Bets" value={stats.totalBets} icon={<Activity />} />
                            <Card title="Wins" value={stats.totalWins} icon={<TrendingUp />} color="green" />
                            <Card title="Losses" value={stats.totalLosses} icon={<ArrowDownCircle />} color="red" />
                            <Card title="Pending" value={stats.totalPending} icon={<Layers />} color="yellow" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <Card title="Total Stake" value={formatCurrency(totalStake)} icon={<Wallet />} />
                            <Card title="Liability" value={formatCurrency(totalLiability)} icon={<DollarSign />} />
                        </div>

                        {/* All Bets Table */}
                        <div className="bg-[#0E1831]/60 backdrop-blur rounded-xl border border-[#1E2D55]/50 mb-8">
                            <div className="p-5 border-b border-[#1E2D55]/50 flex items-center justify-between">
                                <h2 className="text-xl font-semibold">All Bets</h2>
                                <select
                                    value={limit}
                                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                    className="bg-[#162140]/50 border border-[#1E2D55] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                                >
                                    <option value={10}>10 per page</option>
                                    <option value={25}>25 per page</option>
                                    <option value={50}>50 per page</option>
                                </select>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                                            <th className="px-4 py-3 text-left">User ID</th>
                                            <th className="px-4 py-3 text-left">Match</th>
                                            <th className="px-4 py-3 text-left">Selection</th>
                                            <th className="px-4 py-3 text-center">Type</th>
                                            <th className="px-4 py-3 text-center">Market</th>
                                            <th className="px-4 py-3 text-center">Odds</th>
                                            <th className="px-4 py-3 text-center">Stake</th>
                                            <th className="px-4 py-3 text-center">Liability</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-center">Result</th>
                                            <th className="px-4 py-3 text-center">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bets.length === 0 ? (
                                            <tr><td colSpan={11} className="px-4 py-8 text-center text-[#878AA2]">No bets found</td></tr>
                                        ) : (
                                            bets.map((b, idx) => (
                                                <tr key={b.id} className={`border-b border-[#1E2D55]/30 hover:bg-[#162140]/20 transition-colors ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                                                    <td className="px-4 py-3 font-mono text-xs">{b.userId}</td>
                                                    <td className="px-4 py-3 max-w-[200px] truncate" title={b.matchTitle}>{b.matchTitle}</td>
                                                    <td className="px-4 py-3">{b.selection}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${["back", "yes"].includes((b.side || "").toLowerCase())
                                                            ? "bg-blue-400/20 text-blue-300"
                                                            : ["lay", "no"].includes((b.side || "").toLowerCase())
                                                                ? "bg-pink-400/20 text-pink-300"
                                                                : "bg-[#1E2D55]/30 text-[#8384A5]"
                                                            }`}>{b.side}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-[#8384A5]">{b.gameType}</td>
                                                    <td className="px-4 py-3 text-center font-bold">{b.odds}</td>
                                                    <td className="px-4 py-3 text-center">{formatCurrency(Number(b.stake) || 0)}</td>
                                                    <td className="px-4 py-3 text-center">{formatCurrency(Number(b.liability) || 0)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 text-xs rounded ${b.status === "closed" ? "bg-[#1E2D55]/30 text-[#8384A5]" :
                                                            b.status === "open" ? "bg-[#FFC23F]/20 text-yellow-300" :
                                                                b.status === "manual" ? "bg-orange-500/20 text-orange-300" : "bg-[#1E2D55]/30 text-[#878AA2]"
                                                            }`}>{b.status}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 text-xs rounded ${b.resultStatus === "won" ? "bg-[#0ECC68]/20 text-green-300" :
                                                            b.resultStatus === "lost" || b.resultStatus === "loss" ? "bg-[#E01B4F]/20 text-red-300" :
                                                                b.resultStatus === "refund" ? "bg-[#886CFF]/20 text-blue-300" :
                                                                    b.resultStatus === "pending" ? "bg-[#FFC23F]/20 text-yellow-300" : "bg-[#1E2D55]/30 text-[#878AA2]"
                                                            }`}>{b.resultStatus}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-[#878AA2] whitespace-nowrap">
                                                        {b.createdAt ? new Date(b.createdAt).toLocaleString() : "-"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-[#1E2D55]/50">
                                <Pagination page={page} setPage={setPage} />
                            </div>
                        </div>

                        {/* User Lookup */}
                        <div className="bg-[#0E1831]/60 backdrop-blur p-6 rounded-xl border border-[#1E2D55]/50">
                            <h2 className="text-xl font-semibold mb-4">User Bet Lookup</h2>
                            <div className="flex gap-4 mb-6">
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { setUserPage(1); fetchUserBets(1, userLimit); } }}
                                    placeholder="Enter User ID"
                                    className="bg-[#162140]/50 border border-[#1E2D55] p-3 rounded-lg flex-1 text-[#F9F9F9] placeholder-[#878AA2] focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <button
                                    onClick={() => { setUserPage(1); fetchUserBets(1, userLimit); }}
                                    className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                >
                                    <Search size={16} /> Search
                                </button>
                            </div>

                            {userSearched && (
                                userLoading ? (
                                    <p className="text-[#878AA2] text-center py-8">Loading...</p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                            <Card title="Total Bets" value={userStats.totalBets} icon={<Activity />} />
                                            <Card title="Wins" value={userStats.totalWins} icon={<TrendingUp />} color="green" />
                                            <Card title="Losses" value={userStats.totalLosses} icon={<ArrowDownCircle />} color="red" />
                                            <Card title="Pending" value={userStats.totalPending} icon={<Layers />} color="yellow" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                            <Card title="Total Stake" value={formatCurrency(userTotalStake)} icon={<Wallet />} />
                                            <Card title="Liability" value={formatCurrency(userTotalLiability)} icon={<DollarSign />} />
                                        </div>
                                        <DashboardBetTable bets={userBets} formatCurrency={formatCurrency} emptyMessage="No bets found for this user" />
                                        <Pagination page={userPage} setPage={setUserPage} />
                                    </>
                                )
                            )}
                        </div>
                    </>
                )}

                {/* ==================== BET TICKER TAB ==================== */}
                {activeTab === "ticker" && (
                    <div className="bg-[#0E1831]/60 backdrop-blur rounded-xl border border-[#1E2D55]/50">
                        {/* Ticker Header */}
                        <div className="p-5 border-b border-[#1E2D55]/50">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">Bet Ticker</h2>
                                <div className="flex items-center gap-3">
                                    <span className="bg-indigo-600/30 text-indigo-300 px-3 py-1 rounded-full text-sm font-mono">
                                        {tickerTimer}s
                                    </span>
                                    <button
                                        onClick={() => { setTickerTimer(10); fetchTicker(); }}
                                        disabled={tickerLoading}
                                        className="bg-[#162140] hover:bg-[#1E2D55] px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <RefreshCw size={14} className={tickerLoading ? "animate-spin" : ""} />
                                        {tickerLoading ? "Refreshing..." : "Refresh"}
                                    </button>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={tickerSport}
                                    onChange={(e) => setTickerSport(e.target.value)}
                                    className="bg-[#162140]/50 border border-[#1E2D55] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                                >
                                    {SPORT_LIST.map((s) => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                <div className="relative flex-1 max-w-xs">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                                    <input
                                        type="text"
                                        value={tickerSearch}
                                        onChange={(e) => setTickerSearch(e.target.value)}
                                        placeholder="Search member, event, selection..."
                                        className="bg-[#162140]/50 border border-[#1E2D55] pl-9 pr-3 py-2 rounded-lg text-sm w-full focus:outline-none focus:border-indigo-500 placeholder-[#878AA2]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Ticker Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left">Member</th>
                                        <th className="px-4 py-3 text-left">Event Name</th>
                                        <th className="px-4 py-3 text-left">Market</th>
                                        <th className="px-4 py-3 text-left">Selection</th>
                                        <th className="px-4 py-3 text-center">Odds</th>
                                        <th className="px-4 py-3 text-center">Matched</th>
                                        <th className="px-4 py-3 text-center">Liability</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-center">Last Update</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTicker.length === 0 ? (
                                        <tr><td colSpan={9} className="px-4 py-8 text-center text-[#878AA2]">No bets found</td></tr>
                                    ) : (
                                        filteredTicker.map((bet, idx) => (
                                            <tr key={bet.id} className={`border-b border-[#1E2D55]/30 hover:bg-[#162140]/20 transition-colors ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                                                <td className="px-4 py-3 font-medium">{bet.username || bet.userId}</td>
                                                <td className="px-4 py-3 text-[#8384A5] max-w-[200px] truncate">{bet.matchTitle}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-semibold capitalize">{bet.gameType || "-"}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${["back", "yes"].includes((bet.side || "").toLowerCase())
                                                        ? "bg-blue-400/20 text-blue-300"
                                                        : ["lay", "no"].includes((bet.side || "").toLowerCase())
                                                            ? "bg-pink-400/20 text-pink-300"
                                                            : "bg-[#1E2D55]/30 text-[#8384A5]"
                                                        }`}>
                                                        {bet.selection}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold">{parseFloat(String(bet.odds || 0)).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-center font-bold">{formatCurrency(Number(bet.stake) || 0)}</td>
                                                <td className="px-4 py-3 text-center text-[#0ECC68] font-bold">
                                                    {parseFloat(String(bet.liability || 0)).toFixed(2)}
                                                </td>
                                                {/* `source` was never on the payload — the column is the bet's
                                                    STATUS, which is what an operator watching a ticker needs. */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs ${bet.status === "open" ? "bg-emerald-500/20 text-emerald-300" : "bg-purple-500/20 text-purple-300"}`}>
                                                        {bet.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-[#878AA2] text-xs whitespace-nowrap">
                                                    {bet.createdAt ? new Date(bet.createdAt).toLocaleString() : "-"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ==================== PROFIT & LOSS TAB ==================== */}
                {activeTab === "profitloss" && (
                    <div className="bg-[#0E1831]/60 backdrop-blur rounded-xl border border-[#1E2D55]/50">
                        {/* P&L Header */}
                        <div className="p-5 border-b border-[#1E2D55]/50">
                            <h2 className="text-xl font-semibold mb-4">P&L Report by Market</h2>

                            {/* Filters */}
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[#878AA2] text-xs font-medium">Sport</label>
                                    <select value={plSport} onChange={(e) => setPlSport(e.target.value)}
                                        className="bg-[#162140]/50 border border-[#1E2D55] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
                                        {SPORT_LIST.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[#878AA2] text-xs font-medium">From</label>
                                    <input type="date" value={plFromDate} onChange={(e) => setPlFromDate(e.target.value)}
                                        className="bg-[#162140]/50 border border-[#1E2D55] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[#878AA2] text-xs font-medium">To</label>
                                    <input type="date" value={plToDate} onChange={(e) => setPlToDate(e.target.value)}
                                        className="bg-[#162140]/50 border border-[#1E2D55] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[#878AA2] text-xs font-medium">Search User</label>
                                    <input type="text" value={plSearch} onChange={(e) => setPlSearch(e.target.value)}
                                        placeholder="Username"
                                        className="bg-[#162140]/50 border border-[#1E2D55] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 placeholder-[#878AA2]" />
                                </div>
                                <button
                                    onClick={() => { setPlPage(1); fetchPL(); }}
                                    disabled={plLoading}
                                    className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                >
                                    <Search size={14} /> {plLoading ? "Searching..." : "Search"}
                                </button>
                            </div>
                        </div>

                        {/* P&L Content */}
                        <div className="p-5">
                            {plSelectedBets ? (
                                <>
                                    <button
                                        onClick={() => { setPlSelectedBets(null); setPlSelectedName(""); }}
                                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 text-sm font-medium mb-4 transition-colors"
                                    >
                                        <ArrowLeft size={14} /> Back to Report
                                    </button>
                                    <h3 className="text-lg font-semibold mb-3">Bets for {plSelectedName}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                                                    <th className="px-3 py-2 text-left">User ID</th>
                                                    <th className="px-3 py-2 text-left">Selection</th>
                                                    <th className="px-3 py-2 text-left">Type</th>
                                                    <th className="px-3 py-2 text-center">Odds</th>
                                                    <th className="px-3 py-2 text-center">Stake</th>
                                                    <th className="px-3 py-2 text-center">Result</th>
                                                    <th className="px-3 py-2 text-center">P&L</th>
                                                    <th className="px-3 py-2 text-center">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plSelectedBets.map((bet, idx) => {
                                                    const pl = calcBetPL(bet);
                                                    return (
                                                        <tr key={bet.id} className={`border-b border-[#1E2D55]/30 ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                                                            <td className="px-3 py-2">{bet.userId}</td>
                                                            <td className="px-3 py-2">{bet.selection}</td>
                                                            <td className="px-3 py-2 capitalize">{bet.side || "-"}</td>
                                                            <td className="px-3 py-2 text-center">{parseFloat(String(bet.odds)).toFixed(2)}</td>
                                                            <td className="px-3 py-2 text-center">{formatCurrency(Number(bet.stake) || 0)}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                <span className={`px-2 py-1 rounded text-xs ${bet.resultStatus === "won" ? "bg-[#0ECC68]/20 text-green-300" :
                                                                    bet.resultStatus === "loss" || bet.resultStatus === "lost" ? "bg-[#E01B4F]/20 text-red-300" :
                                                                        bet.resultStatus === "refund" ? "bg-[#886CFF]/20 text-blue-300" :
                                                                            "bg-[#FFC23F]/20 text-yellow-300"
                                                                    }`}>{bet.resultStatus}</span>
                                                            </td>
                                                            <td className={`px-3 py-2 text-center font-bold ${pl >= 0 ? "text-[#0ECC68]" : "text-[#E01B4F]"}`}>
                                                                {pl >= 0 ? "+" : ""}{pl.toFixed(2)}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-xs text-[#878AA2] whitespace-nowrap">
                                                                {bet.createdAt ? new Date(bet.createdAt).toLocaleString() : "-"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-[#1E2D55]/50">
                                                    <th className="px-4 py-3 text-left text-[#8384A5] font-semibold">Market</th>
                                                    <th className="px-4 py-3 text-right text-[#8384A5] font-semibold">P&L</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.keys(plGrouped).length === 0 ? (
                                                    <tr><td colSpan={2} className="px-4 py-8 text-center text-[#878AA2]">No data found</td></tr>
                                                ) : (
                                                    Object.entries(plGrouped).map(([date, events]) => (
                                                        <React.Fragment key={date}>
                                                            <tr>
                                                                <td colSpan={2} className="px-4 py-2 text-[#F9F9F9] font-bold bg-[#162140]/40">{date}</td>
                                                            </tr>
                                                            {Object.entries(events).map(([eventName, markets]) => (
                                                                <React.Fragment key={eventName}>
                                                                    <tr>
                                                                        <td colSpan={2} className="px-4 py-2 pl-6 text-[#8384A5] font-semibold bg-[#162140]/20">{eventName}</td>
                                                                    </tr>
                                                                    {markets.map((market, mIdx) => (
                                                                        <tr key={mIdx} className={`border-b border-[#1E2D55]/20 hover:bg-[#162140]/10 ${mIdx % 2 === 0 ? "bg-[#0E1831]/20" : ""}`}>
                                                                            <td className="px-4 py-2 pl-10 text-[#8384A5]">
                                                                                {market.marketName}
                                                                                <button
                                                                                    onClick={() => { setPlSelectedBets(market.bets); setPlSelectedName(market.marketName); }}
                                                                                    className="text-indigo-400 hover:text-indigo-300 ml-3 text-xs font-medium transition-colors"
                                                                                >
                                                                                    <Eye size={12} className="inline mr-1" /> View Bets
                                                                                </button>
                                                                            </td>
                                                                            <td className={`px-4 py-2 text-right font-bold ${market.pl >= 0 ? "text-[#0ECC68]" : "text-[#E01B4F]"}`}>
                                                                                {market.pl >= 0 ? "+" : ""}{market.pl.toFixed(2)}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                    {/* Event Total */}
                                                                    <tr className="bg-[#162140]/10">
                                                                        <td className="px-4 py-2 text-right text-[#878AA2] font-medium">Subtotal</td>
                                                                        <td className={`px-4 py-2 text-right font-bold ${markets.reduce((s, m) => s + m.pl, 0) >= 0 ? "text-[#0ECC68]" : "text-[#E01B4F]"
                                                                            }`}>
                                                                            {markets.reduce((s, m) => s + m.pl, 0) >= 0 ? "+" : ""}
                                                                            {markets.reduce((s, m) => s + m.pl, 0).toFixed(2)}
                                                                        </td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            ))}
                                                        </React.Fragment>
                                                    ))
                                                )}
                                                {Object.keys(plGrouped).length > 0 && (
                                                    <tr className="bg-[#162140]/30">
                                                        <td className="px-4 py-3 text-right text-[#F9F9F9] font-bold">Grand Total</td>
                                                        <td className={`px-4 py-3 text-right font-bold text-lg ${plGrandTotal >= 0 ? "text-[#0ECC68]" : "text-[#E01B4F]"}`}>
                                                            {plGrandTotal >= 0 ? "+" : ""}{plGrandTotal.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* P&L Pagination */}
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1E2D55]/50">
                                        <span className="text-[#878AA2] text-sm">Total: {plTotal} records</span>
                                        <div className="flex items-center gap-3">
                                            <select value={plLimit} onChange={(e) => setPlLimit(Number(e.target.value))}
                                                className="bg-[#162140]/50 border border-[#1E2D55] px-2 py-1 rounded text-sm">
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </select>
                                            <Pagination page={plPage} setPage={setPlPage} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ==================== NET EXPOSURE TAB ==================== */}
                {/*
                    Per MATCH, not per market.

                    This tab used to render an events → markets → runners tree
                    with a 1 / X / 2 grid. `user_exposures` has no market column,
                    so that tree was never in the response — the endpoint reports
                    each match's WORST-CASE liability and how many players hold a
                    position on it, and the per-outcome breakdown comes from the
                    match's book, which the eye icon opens.
                */}
                {activeTab === "market" && (
                    <div className="bg-[#0E1831]/60 backdrop-blur rounded-xl border border-[#1E2D55]/50">
                        {/* Exposure Header */}
                        <div className="p-5 border-b border-[#1E2D55]/50">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Net Exposure</h2>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-sm text-[#878AA2]">
                                        <span>Matches: <strong className="text-[#F9F9F9]">{exposureMeta.totalEvents}</strong></span>
                                        <span className="text-gray-600">|</span>
                                        <span>Total Exposure: <strong className="text-[#F9F9F9]">{formatCurrency(exposureMeta.totalExposure)}</strong></span>
                                    </div>
                                    <span className="bg-indigo-600/30 text-indigo-300 px-3 py-1 rounded-full text-sm font-mono">
                                        {exposureTimer}s
                                    </span>
                                    <button
                                        onClick={() => { setExposureTimer(10); fetchExposure(); }}
                                        disabled={exposureLoading}
                                        className="bg-[#162140] hover:bg-[#1E2D55] px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <RefreshCw size={14} className={exposureLoading ? "animate-spin" : ""} />
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>

                        {marketBook ? (
                            /* One match's book, per outcome */
                            <div className="p-5">
                                <button
                                    onClick={() => { setMarketBook(null); setMarketBookTitle(""); }}
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 text-sm font-medium mb-4 transition-colors"
                                >
                                    <ArrowLeft size={14} /> Back to Exposure
                                </button>
                                <h3 className="text-lg font-semibold mb-1">Book — {marketBookTitle}</h3>
                                <p className="text-[#878AA2] text-sm mb-4">
                                    {marketBook.players} player{marketBook.players === 1 ? "" : "s"} ·
                                    worst case {formatCurrency(Number(marketBook.worstCase) || 0)}
                                </p>

                                {marketBookLoading ? (
                                    <p className="text-[#878AA2] text-center py-8">Loading...</p>
                                ) : Object.keys(marketBook.outcomes || {}).length === 0 ? (
                                    <p className="text-[#878AA2] text-center py-8">No open exposure on this match</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                                                    <th className="px-4 py-3 text-left">Outcome</th>
                                                    <th className="px-4 py-3 text-right">If it happens</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(marketBook.outcomes).map(([runner, value], idx) => {
                                                    const amount = Number(value) || 0;
                                                    return (
                                                        <tr key={runner} className={`border-b border-[#1E2D55]/30 ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                                                            <td className="px-4 py-2 font-medium">{runner}</td>
                                                            {/* Signed from the player's side: positive is a payout. */}
                                                            <td className={`px-4 py-2 text-right font-bold ${amount > 0 ? "text-[#E01B4F]" : "text-[#0ECC68]"}`}>
                                                                {amount > 0 ? "-" : "+"}{formatExposure(amount)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                                            <th className="px-4 py-3 text-left">Match</th>
                                            <th className="px-4 py-3 text-center">Players</th>
                                            <th className="px-4 py-3 text-right">Worst-case liability</th>
                                            <th className="px-4 py-3 text-center">Book</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {exposureLoading ? (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-[#878AA2]">Loading...</td></tr>
                                        ) : exposureData.length === 0 ? (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-[#878AA2]">No open exposure</td></tr>
                                        ) : (
                                            exposureData.map((row, idx) => (
                                                <tr key={row.matchId} className={`border-b border-[#1E2D55]/30 hover:bg-[#162140]/20 transition-colors ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{row.matchTitle || row.matchId}</div>
                                                        <div className="text-xs text-[#878AA2] font-mono">{row.matchId}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">{row.players}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-[#E01B4F]">
                                                        {formatCurrency(Number(row.liability) || 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => fetchMarketBook(row.matchId, row.matchTitle || row.matchId)}
                                                            className="text-indigo-400 hover:text-indigo-300 transition-colors"
                                                            title="View the per-outcome book"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== BET LOCK TAB ==================== */}
                {activeTab === "betlock" && (
                    <div className="space-y-6">
                        {/* Sub tabs: Users | Staff */}
                        <div className="flex gap-1 bg-[#0E1831]/60 rounded-lg p-1 border border-[#1E2D55]/50 w-fit">
                            <button
                                onClick={() => setLockSubTab("users")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${lockSubTab === "users" ? "bg-indigo-600 text-[#F9F9F9] shadow" : "text-[#878AA2] hover:text-[#F9F9F9] hover:bg-[#162140]"}`}
                            >
                                <Users size={14} /> Users ({lockUsers.length})
                            </button>
                            <button
                                onClick={() => setLockSubTab("staff")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${lockSubTab === "staff" ? "bg-indigo-600 text-[#F9F9F9] shadow" : "text-[#878AA2] hover:text-[#F9F9F9] hover:bg-[#162140]"}`}
                            >
                                <Shield size={14} /> Staff ({lockStaff.length})
                            </button>
                        </div>

                        {/* Info banner for staff */}
                        {lockSubTab === "staff" && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                                <Lock size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-amber-400 text-sm font-semibold">Staff Bet Lock</p>
                                    <p className="text-[#878AA2] text-xs mt-1">Locking a staff member will block all users under them and their entire downline from placing bets.</p>
                                </div>
                            </div>
                        )}

                        {/* Search + Refresh */}
                        <div className="flex gap-3 items-center">
                            <div className="relative w-full sm:w-72">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                                <input
                                    value={lockSearch}
                                    onChange={e => setLockSearch(e.target.value)}
                                    placeholder={`Search ${lockSubTab}...`}
                                    className="w-full bg-[#0E1831]/60 border border-[#1E2D55]/50 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[#F9F9F9] placeholder-[#878AA2]"
                                />
                            </div>
                            <button
                                onClick={() => { setLockLoading(true); Promise.all([fetchLockUsers(), fetchLockStaff()]).finally(() => setLockLoading(false)); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#0E1831]/60 hover:bg-[#162140] border border-[#1E2D55]/50 rounded-lg text-sm transition"
                            >
                                <RefreshCw size={14} className={lockLoading ? "animate-spin" : ""} /> Refresh
                            </button>
                        </div>

                        {/* Users Table */}
                        {lockSubTab === "users" && (
                            <div className="bg-[#0E1831]/40 rounded-xl border border-[#1E2D55]/50 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[#878AA2] text-xs uppercase tracking-wider bg-[#0E1831]/60">
                                                <th className="px-4 py-3">ID</th>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">Email</th>
                                                <th className="px-4 py-3">Staff</th>
                                                <th className="px-4 py-3">Bet Status</th>
                                                <th className="px-4 py-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lockLoading ? (
                                                <tr><td colSpan={6} className="text-center py-12 text-[#878AA2]">Loading...</td></tr>
                                            ) : filteredLockUsers.length === 0 ? (
                                                <tr><td colSpan={6} className="text-center py-12 text-[#878AA2]">No users found</td></tr>
                                            ) : (
                                                filteredLockUsers.map((u: any, idx: number) => (
                                                    <tr key={u.userId} className={`border-t border-[#1E2D55]/50 hover:bg-[#162140]/30 transition ${idx % 2 === 0 ? "" : "bg-[#0E1831]/20"}`}>
                                                        <td className="px-4 py-3 font-mono text-xs text-[#8384A5]">{u.userId}</td>
                                                        <td className="px-4 py-3 font-medium">{u.username || "—"}</td>
                                                        <td className="px-4 py-3 text-[#878AA2] text-xs">{u.accountLocked ? "account locked" : "—"}</td>
                                                        <td className="px-4 py-3 text-xs text-[#878AA2]">{u.staffId ?? "—"}</td>
                                                        <td className="px-4 py-3">
                                                            {u.sportsLocked ? (
                                                                <span className="flex items-center gap-1 text-xs font-semibold text-[#E01B4F]">
                                                                    <Lock size={12} /> Locked
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                                                    <Unlock size={12} /> Allowed
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button
                                                                onClick={() => toggleUserLock(u.userId, !u.sportsLocked)}
                                                                disabled={togglingId === u.userId}
                                                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${u.sportsLocked
                                                                    ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                                                                    : "bg-[#E01B4F]/15 text-[#E01B4F] hover:bg-[#E01B4F]/25 border border-[#E01B4F]/30"
                                                                    }`}
                                                            >
                                                                {togglingId === u.userId ? "..." : u.sportsLocked ? "Unlock" : "Lock"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Staff Table */}
                        {lockSubTab === "staff" && (
                            <div className="bg-[#0E1831]/40 rounded-xl border border-[#1E2D55]/50 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[#878AA2] text-xs uppercase tracking-wider bg-[#0E1831]/60">
                                                <th className="px-4 py-3">ID</th>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">Email</th>
                                                <th className="px-4 py-3">Parent ID</th>
                                                <th className="px-4 py-3">Bet Status</th>
                                                <th className="px-4 py-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lockLoading ? (
                                                <tr><td colSpan={6} className="text-center py-12 text-[#878AA2]">Loading...</td></tr>
                                            ) : filteredLockStaff.length === 0 ? (
                                                <tr><td colSpan={6} className="text-center py-12 text-[#878AA2]">No staff found</td></tr>
                                            ) : (
                                                filteredLockStaff.map((s: any, idx: number) => (
                                                    <tr key={s.staffId} className={`border-t border-[#1E2D55]/50 hover:bg-[#162140]/30 transition ${idx % 2 === 0 ? "" : "bg-[#0E1831]/20"}`}>
                                                        <td className="px-4 py-3 font-mono text-xs text-[#8384A5]">{s.staffId}</td>
                                                        <td className="px-4 py-3 font-medium">{s.name || "—"}</td>
                                                        <td className="px-4 py-3 text-[#878AA2] text-xs">{s.accountLocked ? "account locked" : "—"}</td>
                                                        <td className="px-4 py-3 text-xs text-[#878AA2]">{s.parentId ?? "Root"}</td>
                                                        <td className="px-4 py-3">
                                                            {s.sportsLocked ? (
                                                                <span className="flex items-center gap-1 text-xs font-semibold text-[#E01B4F]">
                                                                    <Lock size={12} /> Locked
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                                                    <Unlock size={12} /> Allowed
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button
                                                                onClick={() => toggleStaffLock(s.staffId, !s.sportsLocked)}
                                                                disabled={togglingId === s.staffId}
                                                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${s.sportsLocked
                                                                    ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                                                                    : "bg-[#E01B4F]/15 text-[#E01B4F] hover:bg-[#E01B4F]/25 border border-[#E01B4F]/30"
                                                                    }`}
                                                            >
                                                                {togglingId === s.staffId ? "..." : s.sportsLocked ? "Unlock" : "Lock"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== SETTLED VOID TAB ==================== */}
                {activeTab === "settledvoid" && (
                    <div className="bg-[#0E1831]/60 backdrop-blur rounded-xl border border-[#1E2D55]/50">
                        {/* Header */}
                        <div className="p-5 border-b border-[#1E2D55]/50">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-amber-400" /> Settled Void
                                </h2>
                                <button
                                    onClick={() => fetchSettledMarkets()}
                                    disabled={svLoading}
                                    className="bg-[#162140] hover:bg-[#1E2D55] px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
                                >
                                    <RefreshCw size={14} className={svLoading ? "animate-spin" : ""} />
                                    {svLoading ? "Loading..." : "Refresh"}
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                                    <input
                                        type="text"
                                        value={svSearch}
                                        onChange={(e) => setSvSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") fetchSettledMarkets(); }}
                                        placeholder="Search match, market type..."
                                        className="bg-[#162140]/50 border border-[#1E2D55] pl-9 pr-3 py-2 rounded-lg text-sm w-full focus:outline-none focus:border-indigo-500 placeholder-[#878AA2]"
                                    />
                                </div>
                                <button
                                    onClick={() => fetchSettledMarkets()}
                                    className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Search
                                </button>
                            </div>
                        </div>

                        <div className="p-5">
                            {/* Bets Detail View */}
                            {svSelectedMarket ? (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            onClick={() => { setSvSelectedMarket(null); setSvBets([]); }}
                                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 text-sm font-medium transition-colors"
                                        >
                                            <ArrowLeft size={14} /> Back to Markets
                                        </button>
                                        <button
                                            onClick={() => voidMarketAfterSettlement(svSelectedMarket.matchId, svSelectedMarket.marketType)}
                                            disabled={svVoidingMarket}
                                            className="bg-[#E01B4F] hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            <XCircle size={14} /> {svVoidingMarket ? "Voiding..." : "Void Entire Market"}
                                        </button>
                                    </div>

                                    <div className="bg-[#162140]/30 rounded-lg p-4 mb-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div><span className="text-[#878AA2]">Match:</span> <span className="font-medium">{svSelectedMarket.matchTitle || svSelectedMarket.matchId}</span></div>
                                            <div><span className="text-[#878AA2]">Market:</span> <span className="font-medium">{svSelectedMarket.marketType}</span></div>
                                            <div><span className="text-[#878AA2]">Teams:</span> <span className="font-medium">{svSelectedMarket.teamOne} vs {svSelectedMarket.teamTwo}</span></div>
                                            <div><span className="text-[#878AA2]">Total Entries:</span> <span className="font-medium">{svSelectedMarket.totalEntries}</span></div>
                                        </div>
                                    </div>

                                    {svBetsLoading ? (
                                        <p className="text-[#878AA2] text-center py-8">Loading bets...</p>
                                    ) : svBets.length === 0 ? (
                                        <p className="text-[#878AA2] text-center py-8">No settled bets found</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                                                        <th className="px-3 py-3 text-left">Ledger ID</th>
                                                        <th className="px-3 py-3 text-left">User</th>
                                                        <th className="px-3 py-3 text-left">Selection</th>
                                                        <th className="px-3 py-3 text-center">Type</th>
                                                        <th className="px-3 py-3 text-center">Odds</th>
                                                        <th className="px-3 py-3 text-center">Stake</th>
                                                        <th className="px-3 py-3 text-center">Net Amount</th>
                                                        <th className="px-3 py-3 text-center">Profit</th>
                                                        <th className="px-3 py-3 text-center">Loss</th>
                                                        <th className="px-3 py-3 text-center">Result</th>
                                                        <th className="px-3 py-3 text-center">Date</th>
                                                        <th className="px-3 py-3 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {svBets.map((bet, idx) => (
                                                        <tr key={bet.ledgerId} className={`border-b border-[#1E2D55]/30 hover:bg-[#162140]/20 transition-colors ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                                                            <td className="px-3 py-2 font-mono text-xs">{bet.ledgerId}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="font-medium">{bet.username}</div>
                                                                <div className="text-xs text-[#878AA2]">ID: {bet.userId}</div>
                                                            </td>
                                                            <td className="px-3 py-2">{bet.selectionName || "-"}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${["back", "yes"].includes((bet.betType || "").toLowerCase())
                                                                    ? "bg-blue-400/20 text-blue-300"
                                                                    : ["lay", "no"].includes((bet.betType || "").toLowerCase())
                                                                        ? "bg-pink-400/20 text-pink-300"
                                                                        : "bg-[#1E2D55]/30 text-[#8384A5]"
                                                                    }`}>{bet.betType || "-"}</span>
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-bold">{bet.odds?.toFixed(2) ?? "-"}</td>
                                                            <td className="px-3 py-2 text-center">{bet.stakeAmount != null ? formatCurrency(bet.stakeAmount) : "-"}</td>
                                                            <td className={`px-3 py-2 text-center font-bold ${bet.netamount >= 0 ? "text-[#0ECC68]" : "text-[#E01B4F]"}`}>
                                                                {formatCurrency(bet.netamount)}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-[#0ECC68]">{formatCurrency(bet.profit)}</td>
                                                            <td className="px-3 py-2 text-center text-[#E01B4F]">{formatCurrency(bet.loss)}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                <span className={`px-2 py-1 text-xs rounded ${bet.resultStatus === "won" ? "bg-[#0ECC68]/20 text-green-300" :
                                                                    bet.resultStatus === "lost" || bet.resultStatus === "loss" ? "bg-[#E01B4F]/20 text-red-300" :
                                                                        bet.resultStatus === "voided_after_settlement" ? "bg-purple-500/20 text-purple-300" :
                                                                            "bg-[#1E2D55]/30 text-[#878AA2]"
                                                                    }`}>{bet.resultStatus || "-"}</span>
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-xs text-[#878AA2] whitespace-nowrap">
                                                                {bet.createdAt ? new Date(bet.createdAt).toLocaleString() : "-"}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                <button
                                                                    onClick={() => voidSingleBetAfterSettlement(bet.ledgerId)}
                                                                    disabled={svVoidingBetId === bet.ledgerId}
                                                                    className="bg-[#E01B4F]/15 text-[#E01B4F] hover:bg-[#E01B4F]/25 border border-[#E01B4F]/30 text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                                                                >
                                                                    {svVoidingBetId === bet.ledgerId ? "Voiding..." : "Void Bet"}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Markets List grouped by market type */
                                <>
                                    {svLoading ? (
                                        <p className="text-[#878AA2] text-center py-8">Loading settled markets...</p>
                                    ) : Object.keys(svGrouped).length === 0 ? (
                                        <p className="text-[#878AA2] text-center py-8">No settled markets found</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {Object.entries(svGrouped).map(([marketType, markets]) => (
                                                <div key={marketType} className="bg-[#162140]/20 rounded-lg overflow-hidden border border-[#1E2D55]/30">
                                                    <div className="px-4 py-3 bg-[#162140]/30 flex items-center justify-between">
                                                        <span className="font-semibold flex items-center gap-2">
                                                            {marketType}
                                                            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">{markets.length}</span>
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-[#1E2D55]/20">
                                                        {markets.map((market) => (
                                                            <div key={`${market.matchId}-${market.marketType}-${market.sportId}`} className="px-4 py-3 hover:bg-[#162140]/10 transition-colors">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-sm">{market.matchTitle || market.matchId}</div>
                                                                        <div className="text-xs text-[#878AA2] mt-1 flex flex-wrap gap-3">
                                                                            <span>{market.teamOne} vs {market.teamTwo}</span>
                                                                            <span>Entries: {market.totalEntries}</span>
                                                                            <span>Users: {market.totalUsers}</span>
                                                                            <span>Net: {formatCurrency(market.totalNetAmount)}</span>
                                                                            <span>{market.lastSettledAt ? new Date(market.lastSettledAt).toLocaleString() : ""}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 ml-4">
                                                                        <button
                                                                            onClick={() => {
                                                                                setSvSelectedMarket(market);
                                                                                fetchSettledBets(market.matchId, market.marketType);
                                                                            }}
                                                                            className="bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition"
                                                                        >
                                                                            <Eye size={12} /> View Bets
                                                                        </button>
                                                                        <button
                                                                            onClick={() => voidMarketAfterSettlement(market.matchId, market.marketType)}
                                                                            disabled={svVoidingMarket}
                                                                            className="bg-[#E01B4F]/15 text-[#E01B4F] hover:bg-[#E01B4F]/25 border border-[#E01B4F]/30 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition disabled:opacity-50"
                                                                        >
                                                                            <XCircle size={12} /> Void Market
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

// ==================== REUSABLE COMPONENTS ====================

const DashboardBetTable = ({
    bets,
    formatCurrency,
    emptyMessage = "No bets found",
}: {
    bets: Bet[];
    formatCurrency: (n: number) => string;
    emptyMessage?: string;
}) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-[#1E2D55]/50 text-[#878AA2] text-xs uppercase tracking-wider">
                    <th className="px-3 py-3 text-left">Match</th>
                    <th className="px-3 py-3">Selection</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Market</th>
                    <th className="px-3 py-3">Odds</th>
                    <th className="px-3 py-3">Stake</th>
                    <th className="px-3 py-3">Liability</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Bet Status</th>
                    <th className="px-3 py-3">Date</th>
                </tr>
            </thead>
            <tbody>
                {bets.length === 0 ? (
                    <tr><td colSpan={10} className="p-8 text-center text-[#878AA2]">{emptyMessage}</td></tr>
                ) : (
                    bets.map((b, idx) => (
                        <tr key={b.id} className={`border-b border-[#1E2D55]/30 ${idx % 2 === 0 ? "bg-[#0E1831]/30" : ""}`}>
                            <td className="px-3 py-2">{b.matchTitle}</td>
                            <td className="px-3 py-2">{b.selection}</td>
                            <td className="px-3 py-2 capitalize">{b.side}</td>
                            <td className="px-3 py-2">{b.gameType}</td>
                            <td className="px-3 py-2">{b.odds}</td>
                            <td className="px-3 py-2">{formatCurrency(Number(b.stake) || 0)}</td>
                            <td className="px-3 py-2">{formatCurrency(Number(b.liability) || 0)}</td>
                            <td className="px-3 py-2">
                                <span className={`px-2 py-1 text-xs rounded ${b.status === "closed" ? "bg-[#1E2D55]/30 text-[#8384A5]" :
                                    b.status === "open" ? "bg-[#FFC23F]/20 text-yellow-300" :
                                        b.status === "manual" ? "bg-orange-500/20 text-orange-300" : "bg-[#1E2D55]/30 text-[#878AA2]"
                                    }`}>{b.status}</span>
                            </td>
                            <td className="px-3 py-2">
                                <span className={`px-2 py-1 text-xs rounded ${b.resultStatus === "won" ? "bg-[#0ECC68]/20 text-green-300" :
                                    b.resultStatus === "lost" ? "bg-[#E01B4F]/20 text-red-300" :
                                        b.resultStatus === "pending" ? "bg-[#FFC23F]/20 text-yellow-300" : "bg-[#1E2D55]/30 text-[#878AA2]"
                                    }`}>{b.resultStatus}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-[#878AA2] whitespace-nowrap">
                                {b.createdAt ? new Date(b.createdAt).toLocaleString() : "-"}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

const Pagination = ({ page, setPage }: { page: number; setPage: React.Dispatch<React.SetStateAction<number>> }) => (
    <div className="flex items-center gap-2">
        <button onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="bg-[#162140] hover:bg-[#1E2D55] px-3 py-1.5 rounded-lg text-sm transition-colors">
            Prev
        </button>
        <span className="text-[#878AA2] text-sm px-2">Page {page}</span>
        <button onClick={() => setPage((p) => p + 1)}
            className="bg-[#162140] hover:bg-[#1E2D55] px-3 py-1.5 rounded-lg text-sm transition-colors">
            Next
        </button>
    </div>
);

const Card = ({ title, value, icon, color }: { title: string; value: any; icon: React.ReactNode; color?: string }) => {
    const colorMap: Record<string, string> = {
        green: "text-[#0ECC68]",
        red: "text-[#E01B4F]",
        yellow: "text-[#FFC23F]",
        default: "text-indigo-400",
    };
    return (
        <div className="bg-[#0E1831]/60 backdrop-blur p-5 rounded-xl border border-[#1E2D55]/50 flex justify-between items-center hover:border-[#1E2D55]/50 transition-colors">
            <div>
                <p className="text-[#878AA2] text-sm">{title}</p>
                <p className="text-xl font-bold mt-1">{value}</p>
            </div>
            <div className={colorMap[color || "default"]}>{icon}</div>
        </div>
    );
};

export default SportsDashboard;
