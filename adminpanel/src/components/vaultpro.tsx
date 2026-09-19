import React, { useState, useEffect } from 'react';
import { apiFetch, apiFetchPage } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';
import {
    Users,
    Landmark,
    TrendingUp,
    Search,
    X,
    ChevronUp,
    ChevronDown,
    Calendar,
    RefreshCw,
    Settings,
    Lock,
    Unlock,
    Clock,
    Save,
    Plus,
    Trash2,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip,
    ResponsiveContainer,
    Area, AreaChart,
} from 'recharts';

/* ─── types ─── */
interface VaultStats {
    totalUsers: number;
    totalBalance: number;
    todayInterest: number;
}

interface VaultUser {
    id: number;
    userid: number;
    coin: string;
    vaultBalance: number;
    name: string;
    interest_rate: number;
    lock_period: string;
    startTime: string;
    endTime: string;
    status: string;
    locked: boolean;
    remaining: { days: number; hours: number; minutes: number; seconds: number } | null;
    createdAt: string;
    updatedAt: string;
}

interface InterestRecord {
    userid: number;
    coin: string;
    principal: number;
    interest: number;
    rate: number;
    deposit_id: number;
    createdAt: string;
    name: string;
}

interface LockOption {
    value: string;
    label: string;
    days: number;
    rate: number;
    earlyPenaltyRate?: string;
}

/* ─── small helpers ─── */
const fmtNum = (n: number) =>
    n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00';

const fmtDate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const lockPeriodColor: Record<string, string> = {
    '7d': 'bg-[#886CFF]/20 text-[#9B82FF]',
    '30d': 'bg-purple-500/20 text-purple-400',
    '6m': 'bg-cyan-500/20 text-cyan-400',
    '1y': 'bg-amber-500/20 text-amber-400',
};

const lockCardGradient: Record<string, string> = {
    '7d': 'from-[#886CFF]/20 to-blue-800/10',
    '30d': 'from-purple-600/20 to-purple-800/10',
    '6m': 'from-cyan-600/20 to-cyan-800/10',
    '1y': 'from-amber-600/20 to-amber-800/10',
};

const lockIconColor: Record<string, string> = {
    '7d': 'text-[#9B82FF]',
    '30d': 'text-purple-400',
    '6m': 'text-cyan-400',
    '1y': 'text-amber-400',
};

const fmtRemaining = (remaining: VaultUser['remaining']) => {
    if (!remaining) return 'Matured';
    const parts = [];
    if (remaining.days > 0) parts.push(`${remaining.days}d`);
    if (remaining.hours > 0) parts.push(`${remaining.hours}h`);
    if (remaining.minutes > 0) parts.push(`${remaining.minutes}m`);
    return parts.join(' ') || '< 1m';
};

const safeNum = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/** Accepts the aggregated stats object or the legacy per-coin array. */
const normalizeVaultStats = (raw: unknown): VaultStats => {
    if (!raw) return { totalUsers: 0, totalBalance: 0, todayInterest: 0 };

    if (Array.isArray(raw)) {
        return {
            totalUsers: raw.reduce((sum, row) => sum + safeNum(row?.totalUsers), 0),
            totalBalance: raw.reduce((sum, row) => sum + safeNum(row?.totalBalance), 0),
            todayInterest: raw.reduce((sum, row) => sum + safeNum(row?.todayInterest), 0),
        };
    }

    const row = raw as Record<string, unknown>;
    return {
        totalUsers: safeNum(row.totalUsers),
        totalBalance: safeNum(row.totalBalance),
        todayInterest: safeNum(row.todayInterest),
    };
};

/* ================================================================
   COMPONENT
   ================================================================ */
const VaultPro: React.FC = () => {
    /* ── state ── */
    const [stats, setStats] = useState<VaultStats>({ totalUsers: 0, totalBalance: 0, todayInterest: 0 });
    const [users, setUsers] = useState<VaultUser[]>([]);
    const [history, setHistory] = useState<InterestRecord[]>([]);
    const [lockOptions, setLockOptions] = useState<LockOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'history' | 'charts' | 'settings'>('users');

    // search / sort
    const [userSearch, setUserSearch] = useState('');
    const [histSearch, setHistSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof VaultUser>('vaultBalance');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // settings tab — edit rates
    const [editRates, setEditRates] = useState<Record<string, string>>({});
    const [editEarlyPenalty, setEditEarlyPenalty] = useState<Record<string, string>>({});
    const [savingLock, setSavingLock] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    // settings tab — add new lock period
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLock, setNewLock] = useState({ lock_period: '', label: '', days: '', rate: '' });
    const [addingLock, setAddingLock] = useState(false);

    // settings tab — delete
    const [deletingLock, setDeletingLock] = useState<string | null>(null);

    /* ── fetch data ── */
    const fetchAll = async () => {
        setLoading(true);
        try {
            const listQuery = { query: { limit: 200, offset: 0 } };
            const [s, usersPage, historyPage, lo] = await Promise.all([
                apiFetch<VaultStats>(ENDPOINTS.vault.stats),
                apiFetchPage<VaultUser>(ENDPOINTS.vault.users, listQuery),
                apiFetchPage<InterestRecord>(ENDPOINTS.vault.interest, listQuery),
                // The staff-authenticated read. `/api/v1/user/vault/lock-options`
                // is the PLAYER route and answers 401 to a staff token.
                apiFetch<LockOption[]>(ENDPOINTS.vault.lockPeriods),
            ]);
            setStats(normalizeVaultStats(s));
            setUsers(usersPage.data);
            setHistory(historyPage.data);
            setLockOptions(lo);
            const rates: Record<string, string> = {};
            const penalties: Record<string, string> = {};
            lo.forEach(o => {
                rates[o.value] = String(o.rate);
                penalties[o.value] = String(o.earlyPenaltyRate ?? '0');
            });
            setEditRates(rates);
            setEditEarlyPenalty(penalties);
        } catch (err) {
            console.error('Vault fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleSaveLockPeriod = async (lockPeriod: string) => {
        const rate = parseFloat(editRates[lockPeriod]);
        const penalty = parseFloat(editEarlyPenalty[lockPeriod] ?? '0');
        if (isNaN(rate) || rate < 0 || isNaN(penalty) || penalty < 0) return;
        setSavingLock(lockPeriod);
        setSaveSuccess(null);
        try {
            await apiFetch(ENDPOINTS.vault.lockPeriodRate, {
                method: 'PUT',
                body: {
                    lockPeriod,
                    rate: String(rate),
                    earlyPenaltyRate: String(penalty),
                },
            });
            setSaveSuccess(lockPeriod);
            setTimeout(() => setSaveSuccess(null), 2000);
            fetchAll();
        } catch (err) {
            console.error('Update lock period error:', err);
        } finally {
            setSavingLock(null);
        }
    };

    /* ── add new lock period ── */
    const handleAddLockPeriod = async () => {
        if (!newLock.lock_period || !newLock.label || !newLock.days) return;
        setAddingLock(true);
        try {
            await apiFetch(ENDPOINTS.vault.lockPeriods, {
                method: 'POST',
                body: {
                    lockPeriod: newLock.lock_period,
                    label: newLock.label,
                    days: parseInt(newLock.days, 10),
                    rate: String(parseFloat(newLock.rate) || 0),
                },
            });
            setNewLock({ lock_period: '', label: '', days: '', rate: '' });
            setShowAddForm(false);
            fetchAll();
        } catch (err) {
            console.error('Add lock period error:', err);
        } finally {
            setAddingLock(false);
        }
    };

    /* ── delete lock period ── */
    const handleDeleteLockPeriod = async (lockPeriod: string) => {
        if (!window.confirm(`Delete lock period "${lockPeriod}"? This cannot be undone.`)) return;
        setDeletingLock(lockPeriod);
        try {
            await apiFetch(ENDPOINTS.vault.lockPeriods, {
                method: 'DELETE',
                body: { lockPeriod },
            });
            fetchAll();
        } catch (err) {
            console.error('Delete lock period error:', err);
            alert('Cannot delete: there may be active deposits using this period.');
        } finally {
            setDeletingLock(null);
        }
    };

    /* ── sort helper ── */
    const handleSort = (key: keyof VaultUser) => {
        if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('desc'); }
    };

    const sorted = [...users]
        .filter(u => {
            const q = userSearch.toLowerCase();
            return (
                u.name?.toLowerCase().includes(q) ||
                String(u.userid).includes(q) ||
                u.coin?.toLowerCase().includes(q) ||
                u.lock_period?.toLowerCase().includes(q) ||
                u.status?.toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            const av = a[sortKey] ?? 0;
            const bv = b[sortKey] ?? 0;
            return sortDir === 'asc'
                ? (av > bv ? 1 : -1)
                : (av < bv ? 1 : -1);
        });

    const filteredHistory = history.filter(h => {
        const q = histSearch.toLowerCase();
        return (
            h.name?.toLowerCase().includes(q) ||
            String(h.userid).includes(q) ||
            h.coin?.toLowerCase().includes(q)
        );
    });

    /* ── chart data ── */
    const topUsersChart = [...users]
        .sort((a, b) => b.vaultBalance - a.vaultBalance)
        .slice(0, 10)
        .map(u => ({ name: u.name || `#${u.userid}`, balance: Number(u.vaultBalance) }));

    const dailyMap = new Map<string, number>();
    history.forEach(h => {
        const day = fmtDate(h.createdAt);
        dailyMap.set(day, (dailyMap.get(day) || 0) + Number(h.interest));
    });
    const dailyInterestChart = Array.from(dailyMap.entries())
        .map(([date, interest]) => ({ date, interest: +interest.toFixed(4) }))
        .reverse()
        .slice(-30);

    /* ── stat card config ── */
    const statCards = [
        {
            label: 'Total Users',
            value: stats.totalUsers,
            fmt: (v: number) => String(v),
            icon: <Users size={22} />,
            gradient: 'from-[#886CFF] to-[#8B5CF6]',
            glow: 'shadow-[0_0_30px_rgba(100,110,205,0.3)]',
        },
        {
            label: 'Total Balance',
            value: stats.totalBalance,
            fmt: fmtNum,
            icon: <Landmark size={22} />,
            gradient: 'from-[#0EA5E9] to-[#06B6D4]',
            glow: 'shadow-[0_0_30px_rgba(14,165,233,0.3)]',
        },
        {
            label: "Today's Interest",
            value: stats.todayInterest,
            fmt: fmtNum,
            icon: <TrendingUp size={22} />,
            gradient: 'from-[#F59E0B] to-[#EF4444]',
            glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]',
        },
    ];

    /* ================================================================
       RENDER
       ================================================================ */
    return (
        <div className="p-4 md:p-6 min-h-screen text-[#F9F9F9] space-y-6">

            {/* ── header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Vault Pro Dashboard</h1>
                    <p className="text-[#878AA2] text-sm mt-1">Manage vault deposits, lock periods, interest rates &amp; analytics</p>
                </div>
                <button
                    onClick={fetchAll}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1E2640] hover:bg-[#2B3350] border border-[#1E2D55] rounded-lg text-sm transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {statCards.map((c, i) => (
                    <div
                        key={i}
                        className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${c.gradient} ${c.glow} p-5 transition-transform hover:scale-[1.02]`}
                    >
                        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                        <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[#F9F9F9]/70 text-xs uppercase tracking-wider font-medium">{c.label}</p>
                                <p className="text-3xl font-extrabold mt-2 tracking-tight">{c.fmt(safeNum(c.value))}</p>
                            </div>
                            <div className="bg-white/20 p-2.5 rounded-lg backdrop-blur-sm">{c.icon}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── tabs ── */}
            <div className="flex gap-1 bg-[#0E1831] rounded-lg p-1 border border-[#1E2D55] w-fit">
                {(['users', 'history', 'charts', 'settings'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-[#886CFF] text-[#F9F9F9] shadow-lg shadow-[#886CFF]/20'
                            : 'text-[#878AA2] hover:text-[#F9F9F9] hover:bg-[#2B3350]'
                            }`}
                    >
                        {tab === 'users' && <span className="flex items-center gap-1.5"><Users size={14} /> Deposits</span>}
                        {tab === 'history' && <span className="flex items-center gap-1.5"><Calendar size={14} /> History</span>}
                        {tab === 'charts' && <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Charts</span>}
                        {tab === 'settings' && <span className="flex items-center gap-1.5"><Settings size={14} /> Rate Settings</span>}
                    </button>
                ))}
            </div>

            {/* ──────────────── DEPOSITS TABLE ──────────────── */}
            {activeTab === 'users' && (
                <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] overflow-hidden">
                    <div className="p-4 border-b border-[#1E2D55] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Active Deposits ({sorted.length})</h2>
                        <div className="relative w-full sm:w-72">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                            <input
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                placeholder="Search by name, ID, coin, period..."
                                className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-[#878AA2]"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[#878AA2] text-xs uppercase tracking-wider bg-[#151B2D]">
                                    {[
                                        { key: 'id', label: 'Deposit ID' },
                                        { key: 'userid', label: 'User ID' },
                                        { key: 'name', label: 'Name' },
                                        { key: 'coin', label: 'Coin' },
                                        { key: 'vaultBalance', label: 'Balance' },
                                        { key: 'lock_period', label: 'Lock Period' },
                                        { key: 'interest_rate', label: 'Rate %' },
                                        { key: 'status', label: 'Status' },
                                        { key: 'endTime', label: 'Time Left' },
                                        { key: 'createdAt', label: 'Created' },
                                    ].map(col => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key as keyof VaultUser)}
                                            className="px-4 py-3 cursor-pointer hover:text-[#F9F9F9] transition select-none"
                                        >
                                            <span className="flex items-center gap-1">
                                                {col.label}
                                                {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-[#878AA2]">Loading...</td></tr>
                                ) : sorted.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-[#878AA2]">No deposits found</td></tr>
                                ) : (
                                    sorted.map((u, idx) => {
                                        const periodLabel = lockOptions.find(o => o.value === u.lock_period)?.label || u.lock_period;
                                        return (
                                            <tr
                                                key={u.id}
                                                className={`border-t border-[#1E2D55] hover:bg-[#1E2640] transition ${idx % 2 === 0 ? 'bg-[#0E1831]' : 'bg-[#171D2E]'}`}
                                            >
                                                <td className="px-4 py-3 font-mono text-xs text-[#878AA2]">#{u.id}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-[#8384A5]">{u.userid}</td>
                                                <td className="px-4 py-3 font-medium">{u.name}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-[#886CFF]/20 text-[#886CFF] text-xs font-semibold px-2 py-0.5 rounded">{u.coin}</span>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-emerald-400">{fmtNum(Number(u.vaultBalance))}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${lockPeriodColor[u.lock_period] || 'bg-[#1E2D55]/20 text-[#878AA2]'}`}>
                                                        {periodLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded">{u.interest_rate}%</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {u.locked ? (
                                                        <span className="flex items-center gap-1 text-xs font-semibold text-[#E01B4F]">
                                                            <Lock size={12} /> Locked
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                                            <Unlock size={12} /> Matured
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {u.locked && u.remaining ? (
                                                        <span className="flex items-center gap-1 text-xs text-orange-400 font-mono">
                                                            <Clock size={12} /> {fmtRemaining(u.remaining)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-emerald-400">Ready</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-[#878AA2] text-xs">{fmtDate(u.createdAt)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ──────────────── HISTORY TABLE ──────────────── */}
            {activeTab === 'history' && (
                <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] overflow-hidden">
                    <div className="p-4 border-b border-[#1E2D55] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Interest History ({filteredHistory.length})</h2>
                        <div className="relative w-full sm:w-72">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2]" />
                            <input
                                value={histSearch}
                                onChange={e => setHistSearch(e.target.value)}
                                placeholder="Search by name, ID or coin..."
                                className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-[#878AA2]"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[#878AA2] text-xs uppercase tracking-wider bg-[#151B2D]">
                                    <th className="px-4 py-3">User ID</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Coin</th>
                                    <th className="px-4 py-3">Deposit ID</th>
                                    <th className="px-4 py-3">Principal</th>
                                    <th className="px-4 py-3">Interest</th>
                                    <th className="px-4 py-3">Rate %</th>
                                    <th className="px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-[#878AA2]">Loading...</td></tr>
                                ) : filteredHistory.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-[#878AA2]">No records found</td></tr>
                                ) : (
                                    filteredHistory.map((h, idx) => (
                                        <tr
                                            key={idx}
                                            className={`border-t border-[#1E2D55] hover:bg-[#1E2640] transition ${idx % 2 === 0 ? 'bg-[#0E1831]' : 'bg-[#171D2E]'}`}
                                        >
                                            <td className="px-4 py-3 font-mono text-xs text-[#8384A5]">{h.userid}</td>
                                            <td className="px-4 py-3 font-medium">{h.name}</td>
                                            <td className="px-4 py-3">
                                                <span className="bg-[#886CFF]/20 text-[#886CFF] text-xs font-semibold px-2 py-0.5 rounded">{h.coin}</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-[#878AA2]">#{h.deposit_id}</td>
                                            <td className="px-4 py-3 text-[#8384A5]">{fmtNum(Number(h.principal))}</td>
                                            <td className="px-4 py-3 font-semibold text-emerald-400">+{fmtNum(Number(h.interest))}</td>
                                            <td className="px-4 py-3">
                                                <span className="bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded">{h.rate}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-[#878AA2] text-xs">{fmtDate(h.createdAt)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ──────────────── CHARTS ──────────────── */}
            {activeTab === 'charts' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5">
                        <h3 className="text-base font-semibold mb-4">Top 10 Users by Balance</h3>
                        {topUsersChart.length === 0 ? (
                            <p className="text-[#878AA2] text-sm py-20 text-center">No data yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topUsersChart} barSize={28}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2D334A" />
                                    <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D334A' }} />
                                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D334A' }} />
                                    <ReTooltip contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D334A', borderRadius: 8, color: '#fff' }} cursor={{ fill: 'rgba(100,110,205,0.08)' }} />
                                    <Bar dataKey="balance" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                                    <defs>
                                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#886CFF" />
                                            <stop offset="100%" stopColor="#8B5CF6" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5">
                        <h3 className="text-base font-semibold mb-4">Daily Interest Trend (last 30 days)</h3>
                        {dailyInterestChart.length === 0 ? (
                            <p className="text-[#878AA2] text-sm py-20 text-center">No data yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={dailyInterestChart}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2D334A" />
                                    <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D334A' }} />
                                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D334A' }} />
                                    <ReTooltip contentStyle={{ backgroundColor: '#1A2033', border: '1px solid #2D334A', borderRadius: 8, color: '#fff' }} />
                                    <defs>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="interest" stroke="#0EA5E9" strokeWidth={2} fill="url(#areaGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}

            {/* ──────────────── RATE SETTINGS TAB ──────────────── */}
            {activeTab === 'settings' && (
                <div className="space-y-6">

                    {/* header + add button */}
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-[#886CFF]/20 p-2.5 rounded-lg">
                                    <Settings size={20} className="text-[#886CFF]" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Lock Period Interest Rates</h2>
                                    <p className="text-[#878AA2] text-sm">Manage lock periods and set annual interest rates. Changes apply to new deposits only.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#886CFF] hover:bg-[#9B82FF] rounded-lg text-sm font-semibold transition"
                            >
                                {showAddForm ? <X size={16} /> : <Plus size={16} />}
                                {showAddForm ? 'Cancel' : 'Add Lock Period'}
                            </button>
                        </div>

                        {/* ── add new lock period form ── */}
                        {showAddForm && (
                            <div className="mb-6 bg-[#0C0D1D] border border-[#1E2D55] rounded-xl p-5">
                                <h3 className="text-sm font-semibold mb-4 text-[#8384A5]">Create New Lock Period</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-xs text-[#878AA2] mb-1 block">Period Key</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 3m, 2y, 14d"
                                            value={newLock.lock_period}
                                            onChange={e => setNewLock(p => ({ ...p, lock_period: e.target.value }))}
                                            className="w-full bg-[#0E1831] border border-[#1E2D55] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[#878AA2] mb-1 block">Display Label</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 3 Months"
                                            value={newLock.label}
                                            onChange={e => setNewLock(p => ({ ...p, label: e.target.value }))}
                                            className="w-full bg-[#0E1831] border border-[#1E2D55] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[#878AA2] mb-1 block">Duration (Days)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="e.g. 90"
                                            value={newLock.days}
                                            onChange={e => setNewLock(p => ({ ...p, days: e.target.value }))}
                                            className="w-full bg-[#0E1831] border border-[#1E2D55] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[#878AA2] mb-1 block">Annual Rate (%)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                placeholder="e.g. 10"
                                                value={newLock.rate}
                                                onChange={e => setNewLock(p => ({ ...p, rate: e.target.value }))}
                                                className="flex-1 bg-[#0E1831] border border-[#1E2D55] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#886CFF] text-[#F9F9F9] placeholder-gray-600"
                                            />
                                            <button
                                                onClick={handleAddLockPeriod}
                                                disabled={addingLock || !newLock.lock_period || !newLock.label || !newLock.days}
                                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {addingLock ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── lock period cards ── */}
                        {lockOptions.length === 0 ? (
                            <div className="text-center py-16 text-[#878AA2]">
                                <Lock size={40} className="mx-auto mb-3 opacity-30" />
                                <p>No lock periods configured yet.</p>
                                <p className="text-sm mt-1">Click "Add Lock Period" to create one.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {lockOptions.map(option => {
                                    const gradient = lockCardGradient[option.value] || 'from-gray-600/20 to-gray-800/10';
                                    const iconClr = lockIconColor[option.value] || 'text-[#878AA2]';
                                    return (
                                        <div
                                            key={option.value}
                                            className={`bg-gradient-to-br ${gradient} border border-[#1E2D55] rounded-xl p-5 space-y-4 relative group min-w-0 overflow-hidden`}
                                        >
                                            {/* delete button */}
                                            <button
                                                onClick={() => handleDeleteLockPeriod(option.value)}
                                                disabled={deletingLock === option.value}
                                                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-[#E01B4F]/20 text-[#878AA2] hover:text-[#E01B4F]"
                                                title="Delete lock period"
                                            >
                                                {deletingLock === option.value ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                            </button>

                                            {/* header */}
                                            <div className="flex items-center gap-2 pr-8 min-w-0">
                                                <Lock size={16} className={`${iconClr} shrink-0`} />
                                                <span className="font-semibold text-base truncate">{option.label}</span>
                                            </div>

                                            {/* days + current rate */}
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-xs text-[#878AA2] mb-0.5">{option.days} days lock</p>
                                                    <p className="text-3xl font-extrabold tracking-tight">
                                                        {option.rate}%
                                                        <span className="text-sm font-normal text-[#878AA2] ml-1">/ year</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-1 space-y-3 min-w-0">
                                                <div>
                                                    <label className="text-xs text-[#878AA2] mb-1 block">Annual rate (%)</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={editRates[option.value] ?? ''}
                                                        onChange={e => setEditRates(prev => ({ ...prev, [option.value]: e.target.value }))}
                                                        className="w-full min-w-0 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#886CFF] text-[#F9F9F9]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[#878AA2] mb-1 block">
                                                        Principal deduction on early exit (%)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={editEarlyPenalty[option.value] ?? '0'}
                                                        onChange={e =>
                                                            setEditEarlyPenalty(prev => ({
                                                                ...prev,
                                                                [option.value]: e.target.value,
                                                            }))
                                                        }
                                                        className="w-full min-w-0 bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#886CFF] text-[#F9F9F9]"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveLockPeriod(option.value)}
                                                    disabled={savingLock === option.value || !editRates[option.value]}
                                                    className="w-full px-3 py-2 bg-[#886CFF] hover:bg-[#9B82FF] rounded-lg text-sm font-medium transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                                                >
                                                    {savingLock === option.value ? (
                                                        <RefreshCw size={14} className="animate-spin" />
                                                    ) : saveSuccess === option.value ? (
                                                        <span className="text-emerald-300">Saved</span>
                                                    ) : (
                                                        <>
                                                            <Save size={14} className="shrink-0" />
                                                            <span>Save</span>
                                                        </>
                                                    )}
                                                </button>
                                                <p className="text-xs text-[#878AA2] leading-relaxed">
                                                    Early exit is always allowed; deduction is taken from principal and
                                                    accrued interest is forfeited.
                                                </p>
                                            </div>

                                            {/* daily breakdown */}
                                            <div className="pt-2 border-t border-white/10">
                                                <p className="text-xs text-[#878AA2]">
                                                    Daily: {((parseFloat(editRates[option.value] || '0') / 365)).toFixed(4)}% per day
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* info note */}
                    <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-5 flex items-start gap-3">
                        <div className="bg-amber-500/20 p-2 rounded-lg mt-0.5">
                            <Clock size={16} className="text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm mb-1">How Lock Periods Work</h3>
                            <ul className="text-[#878AA2] text-sm space-y-1">
                                <li>Players choose a lock period when depositing into the vault.</li>
                                <li>Early withdrawal is always available; set the principal deduction % per lock period (interest is not paid on early exit).</li>
                                <li>The interest rate is locked at deposit time based on the selected period.</li>
                                <li>Interest accrues daily and is added to the deposit balance.</li>
                                <li>Users can only withdraw after the lock period expires.</li>
                                <li>Changing rates here only affects <strong className="text-[#8384A5]">future deposits</strong>, not existing ones.</li>
                                <li>You can add custom lock periods (e.g. 3 Months, 2 Years) dynamically.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VaultPro;
