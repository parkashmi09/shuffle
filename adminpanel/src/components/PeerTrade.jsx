import React, { useState, useEffect } from 'react';
import {
    CreditCard, Landmark, ShoppingBag, Package,
    Plus, X, Search, RefreshCw, Check, Upload,
    Star, ShieldCheck, BadgeCheck,
    ArrowUpRight, Eye, Ban, Edit3,
    Timer, AlertTriangle, MessageSquare
} from 'lucide-react';
import { apiDownload, apiFetch, buildPath, getStaffToken } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';


/**
 * Payment proofs are served FROM THE ROW now (migration 033), not from a public
 * `/uploads/` directory that anyone who guessed a filename could read — and
 * these are payment screenshots and KYC-adjacent QR codes.
 *
 * ── WHICH MEANS `<img src>` CANNOT FETCH THEM ──────────────────────────
 *
 * The route requires a staff token in the `Authorization` header, and a browser
 * will not attach one to an image request. Putting the token in the query
 * string does not help either: HTTP auth reads the header only — `auth_token`
 * in the query is a SOCKET handshake convention, not an HTTP one — and it would
 * put a live staff credential into browser history, the referrer and every
 * proxy log on the way.
 *
 * So the bytes are fetched with the token and rendered from an object URL.
 */
function useAuthedImage(path) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!path) { setSrc(null); return undefined; }

    let objectUrl = null;
    let cancelled = false;

    apiDownload(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((error) => {
        if (!cancelled) console.error('[p2p] could not load proof image:', error.message);
      });

    // An object URL not revoked is a leaked blob for the life of the document.
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return src;
}

/** Renders a proof image that needs the staff token to fetch. */
function ProofImage({ path, alt, ...rest }) {
  const src = useAuthedImage(path);
  if (!src) return <div style={{ padding: 24, opacity: 0.6 }}>Loading…</div>;
  return <img src={src} alt={alt} {...rest} />;
}

const authHeader = () => {
  const token = getStaffToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ─── helpers ─── */
const fmtNum = (n) =>
    Number(n)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00';

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_COLORS = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    PAID: 'bg-blue-500/20 text-blue-400',
    RELEASED: 'bg-emerald-500/20 text-emerald-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
    EXPIRED: 'bg-orange-500/20 text-orange-400',
};

const fmtTimeRemaining = (order) => {
    if (!order.expires_at) return null;
    if (order.status !== 'PENDING') return null;
    const now = Date.now();
    const end = new Date(order.expires_at).getTime();
    const diff = end - now;
    if (diff <= 0) return { expired: true, text: 'Expired' };
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { expired: false, text: `${mins}m ${secs}s` };
};

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
const PeerTrade = () => {
    /* ── tab state ── */
    const [activeTab, setActiveTab] = useState('types');

    /* ── data state ── */
    const [types, setTypes] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [offers, setOffers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    /* ── modal state ── */
    const [showModal, setShowModal] = useState(false);
    const [proofModal, setProofModal] = useState(null);
    const [statusModal, setStatusModal] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [sellOrders, setSellOrders] = useState([]);
    const [sellStatusFilter, setSellStatusFilter] = useState('ALL');

    const [disputes, setDisputes] = useState([]);
    const [disputeStatusFilter, setDisputeStatusFilter] = useState('ALL');
    const [disputeModal, setDisputeModal] = useState(null);
    const [disputeNewStatus, setDisputeNewStatus] = useState('');
    const [disputeAdminNote, setDisputeAdminNote] = useState('');

    const [sellDetailModal, setSellDetailModal] = useState(null);

    const [sellReleaseModal, setSellReleaseModal] = useState(null);
    const [sellProofFile, setSellProofFile] = useState(null);
    const [sellAdminNote, setSellAdminNote] = useState('');

    // Live countdown tick
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    /* ── form states ── */
    const [typeForm, setTypeForm] = useState({ name: '', code: '' });
    const [accountForm, setAccountForm] = useState({
        payment_type_id: '', account_name: '', account_number: '',
        ifsc_code: '', upi_id: '', extra_details: ''
    });
    const [qrFile, setQrFile] = useState(null);
    const [qrPreview, setQrPreview] = useState(null);
    const [offerForm, setOfferForm] = useState({
        username: '', coin: 'USDT', fiat: 'INR', price: '',
        min_limit: '', max_limit: '', available_amount: '',
        payment_account_ids: [], payment_time: 30,
        is_featured: false, is_verified: true, is_kyc_verified: true,
        segment: 'BUY'
    });

    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState(null);

    /* ── fetch helpers ── */
    const fetchTypes = async () => {
        try { const r = await apiFetch(ENDPOINTS.p2p.paymentTypes); setTypes(r); } catch (e) { console.error(e); }
    };
    const fetchAccounts = async () => {
        try { const r = await apiFetch(ENDPOINTS.p2p.paymentAccounts); setAccounts(r); } catch (e) { console.error(e); }
    };
    const fetchOffers = async () => {
        try { const r = await apiFetch(ENDPOINTS.p2p.offers); setOffers(r); } catch (e) { console.error(e); }
    };
    const fetchOrders = async () => {
        try { const r = await apiFetch(ENDPOINTS.p2p.orders); setOrders(r); } catch (e) { console.error(e); }
    };
    const fetchSellOrders = async () => {
        try {
            const r = await apiFetch(ENDPOINTS.p2p.sellOrders);
            setSellOrders(r);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchDisputes = async () => {
        try { const r = await apiFetch(ENDPOINTS.p2p.disputes); setDisputes(r); } catch (e) { console.error(e); }
    };

    const fetchAll = async (silent = false) => {
        if (!silent) setLoading(true);
        await Promise.all([
            fetchTypes(),
            fetchAccounts(),
            fetchOffers(),
            fetchOrders(),
            fetchSellOrders(),
            fetchDisputes()
        ]);
        if (!silent) setLoading(false);
    };

    useEffect(() => {
        fetchAll();
        const interval = setInterval(() => fetchAll(true), 10000);
        return () => clearInterval(interval);
    }, []);

    /* ── toast helper ── */
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /* ── create handlers ── */
    const handleCreateType = async () => {
        if (!typeForm.name || !typeForm.code) return;
        setSaving(true);
        try {
            await apiFetch(ENDPOINTS.p2p.paymentTypes, { method: 'POST', body: typeForm });
            setTypeForm({ name: '', code: '' });
            setShowModal(false);
            showToast('Payment type created!');
            fetchTypes();
        } catch (e) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleCreateAccount = async () => {
        if (!accountForm.payment_type_id) return;
        setSaving(true);
        try {
            /**
             * The body is camelCase and `.strict()` — a stray `payment_type_id`
             * is a 400, not a silently ignored field. Only `qr_image` keeps its
             * snake_case name, because that is the multer field, not a body key.
             */
            const fields = {
                paymentTypeId: accountForm.payment_type_id,
                accountName: accountForm.account_name,
                accountNumber: accountForm.account_number,
                ifscCode: accountForm.ifsc_code,
                upiId: accountForm.upi_id,
                extraDetails: accountForm.extra_details,
            };

            const formData = new FormData();
            Object.entries(fields).forEach(([k, v]) => { if (v) formData.append(k, v); });
            if (qrFile) formData.append('qr_image', qrFile);

            await apiFetch(ENDPOINTS.p2p.paymentAccounts, { method: 'POST', body: formData });

            setAccountForm({
                payment_type_id: '', account_name: '', account_number: '',
                ifsc_code: '', upi_id: '', extra_details: ''
            });
            setQrFile(null);
            setQrPreview(null);
            setShowModal(false);
            showToast('Payment account created!');
            fetchAccounts();
        } catch (e) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleCreateOffer = async () => {
        if (!offerForm.username || !offerForm.price) return;
        setSaving(true);
        try {
            /**
             * Amounts go as strings. They are money, and the validator parses
             * them as exact decimals — `parseFloat` on the way out is the step
             * that turns 0.1 + 0.2 into a price nobody typed.
             */
            await apiFetch(ENDPOINTS.p2p.offers, {
                method: 'POST',
                body: {
                    coin: offerForm.coin,
                    fiat: offerForm.fiat,
                    username: offerForm.username,
                    segment: offerForm.segment,
                    price: String(offerForm.price),
                    availableAmount: String(offerForm.available_amount),
                    ...(offerForm.min_limit ? { minLimit: String(offerForm.min_limit) } : {}),
                    ...(offerForm.max_limit ? { maxLimit: String(offerForm.max_limit) } : {}),
                    paymentAccountIds: offerForm.payment_account_ids.map(Number),
                    paymentTime: parseInt(offerForm.payment_time, 10),
                    isFeatured: offerForm.is_featured,
                    isVerified: offerForm.is_verified,
                    isKycVerified: offerForm.is_kyc_verified,
                },
            });
            setOfferForm({
                username: '', coin: 'USDT', fiat: 'INR', price: '',
                min_limit: '', max_limit: '', available_amount: '',
                payment_account_ids: [], payment_time: 30,
                is_featured: false, is_verified: true, is_kyc_verified: true,
                segment: 'BUY'
            });
            setShowModal(false);
            showToast('Offer created!');
            fetchOffers();
        } catch (e) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const handleRelease = async (orderId) => {
        if (!window.confirm('Release funds for this order?')) return;
        try {
            await apiFetch(buildPath(ENDPOINTS.p2p.releaseOrder, { orderId }), { method: 'POST' });
            showToast('Funds released successfully!');
            fetchOrders();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleCancel = async (orderId) => {
        if (!window.confirm('Cancel this order? Liquidity will be restored.')) return;
        try {
            await apiFetch(buildPath(ENDPOINTS.p2p.cancelOrder, { orderId }), { method: 'POST' });
            showToast('Order cancelled, liquidity restored');

            fetchOrders();
        } catch (e) { showToast(e.message, 'error'); }
    };

    /**
     * `DELETE /admin/p2p/order/:orderId` HAS NO REPLACEMENT, ON PURPOSE.
     *
     * It ran a bare DELETE with no status check and no authentication.
     * Removing a RELEASED order destroys the only record that crypto was paid
     * out, while the wallet ledger row survives with nothing to reconcile
     * against. Cancelling is the operation an operator actually wants: it
     * refunds and leaves the history intact.
     */
    const handleStatusChange = async () => {
        if (!statusModal || !newStatus) return;
        setSaving(true);
        try {
            await apiFetch(buildPath(ENDPOINTS.p2p.orderStatus, { orderId: statusModal.id }), {
                method: 'PATCH', body: { status: newStatus },
            });
            showToast(`Status updated to ${newStatus}`);
            setStatusModal(null);
            setNewStatus('');
            fetchOrders();
        } catch (e) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };


    /* ── selected payment type for account form ── */
    const handleQrChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setQrFile(file);
            setQrPreview(URL.createObjectURL(file));
        }
    };


    // sell side 
    const handleSellCancel = async (id) => {

        if (!window.confirm('Cancel this sell order?')) return;

        try {

            await apiFetch(buildPath(ENDPOINTS.p2p.cancelSellOrder, { orderId: id }), {
                method: 'POST'
            });

            showToast('Sell order cancelled');
            fetchSellOrders();

        } catch (e) {
            showToast(e.message, 'error');
        }
    };


    const handleSellRelease = async () => {

        if (!sellProofFile) {
            showToast('Upload payment proof', 'error');
            return;
        }

        try {

            const formData = new FormData();
            formData.append('admin_payment_proof', sellProofFile);
            // `note`, not `admin_note` — the body is `.strict()`.
            if (sellAdminNote) formData.append('note', sellAdminNote);

            /**
             * Through `apiFetch`, so a failure THROWS. The bare `fetch` here
             * never checked `res.ok`, so a refused release — an already-settled
             * order, a permission failure — still showed "Sell order released"
             * and cleared the form.
             */
            await apiFetch(
                buildPath(ENDPOINTS.p2p.releaseSellOrder, { orderId: sellReleaseModal.id }),
                { method: 'POST', body: formData }
            );

            showToast('Sell order released');
            setSellReleaseModal(null);
            setSellProofFile(null);
            setSellAdminNote('');
            fetchSellOrders();

        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleDisputeStatusUpdate = async () => {
        if (!disputeModal || !disputeNewStatus) return;
        setSaving(true);
        try {
            await apiFetch(buildPath(ENDPOINTS.p2p.disputeStatus, { disputeId: disputeModal.id }), {
                method: 'PATCH',
                body: {
                    status: disputeNewStatus,
                    ...(disputeAdminNote ? { adminNote: disputeAdminNote } : {}),
                },
            });
            showToast(`Dispute status updated to ${disputeNewStatus}`);
            setDisputeModal(null);
            setDisputeNewStatus('');
            setDisputeAdminNote('');
            fetchDisputes();
        } catch (e) { showToast(e.message, 'error'); }
        finally { setSaving(false); }
    };

    const selectedType = types.find(t => String(t.id) === String(accountForm.payment_type_id));
    const isUPI = selectedType?.code?.toLowerCase() === 'upi';

    /* ── tab config ── */
    const tabs = [
        { key: 'types', label: 'Payment Types', icon: <CreditCard size={16} />, count: types.length },
        { key: 'accounts', label: 'Payment Accounts', icon: <Landmark size={16} />, count: accounts.length },
        { key: 'offers', label: 'Offers', icon: <ShoppingBag size={16} />, count: offers.length },
        { key: 'orders', label: 'Buy Orders', icon: <Package size={16} />, count: orders.length },
        { key: 'sellOrders', label: 'Sell Orders', icon: <ArrowUpRight size={16} />, count: sellOrders.length },
        { key: 'disputes', label: 'Disputes', icon: <MessageSquare size={16} />, count: disputes.filter(d => d.status === 'OPEN').length },
    ];

    /* ── stat cards ── */
    const statCards = [
        { label: 'Payment Types', value: types.length, gradient: 'from-[#646ECD] to-[#8B5CF6]', glow: 'shadow-[0_0_30px_rgba(100,110,205,0.3)]', icon: <CreditCard size={22} /> },
        { label: 'Payment Accounts', value: accounts.length, gradient: 'from-[#0EA5E9] to-[#06B6D4]', glow: 'shadow-[0_0_30px_rgba(14,165,233,0.3)]', icon: <Landmark size={22} /> },
        { label: 'Active Offers', value: offers.length, gradient: 'from-[#F59E0B] to-[#EF4444]', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]', icon: <ShoppingBag size={22} /> },
        { label: 'Total Orders', value: orders.length, gradient: 'from-[#10B981] to-[#059669]', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]', icon: <Package size={22} /> },
    ];

    /* ================================================================
       RENDER
       ================================================================ */
    return (
        <div className="p-4 md:p-6 lg:ml-[256px] min-h-screen text-white space-y-6">

            {/* ── Toast ── */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all animate-[slideIn_0.3s_ease] ${toast.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-emerald-500/90 text-white'
                    }`}>
                    {toast.msg}
                </div>
            )}

            {/* ── header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">P2P Trading Management</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage payment methods, accounts, offers & orders</p>
                </div>
                <button
                    onClick={fetchAll}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1E2640] hover:bg-[#2B3350] border border-[#2D334A] rounded-lg text-sm transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((c, i) => (
                    <div
                        key={i}
                        className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${c.gradient} ${c.glow} p-5 transition-transform hover:scale-[1.02]`}
                    >
                        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                        <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-white/70 text-xs uppercase tracking-wider font-medium">{c.label}</p>
                                <p className="text-3xl font-extrabold mt-2 tracking-tight">{c.value}</p>
                            </div>
                            <div className="bg-white/20 p-2.5 rounded-lg backdrop-blur-sm">{c.icon}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── tabs ── */}
            <div className="flex flex-wrap gap-1 bg-[#1A2033] rounded-lg p-1 border border-[#2D334A]">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSearch(''); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.key
                            ? 'bg-[#646ECD] text-white shadow-lg shadow-[#646ECD]/20'
                            : 'text-gray-400 hover:text-white hover:bg-[#2B3350]'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20' : 'bg-[#2D334A]'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* ═══════════════════ PAYMENT TYPES TAB ═══════════════════ */}
            {activeTab === 'types' && (
                <div className="bg-[#1A2033] rounded-xl border border-[#2D334A] overflow-hidden">
                    <div className="p-4 border-b border-[#2D334A] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Payment Types ({types.length})</h2>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search types…"
                                    className="bg-[#0F1525] border border-[#2D334A] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#646ECD] text-white placeholder-gray-500 w-48"
                                />
                            </div>
                            <button
                                onClick={() => setShowModal('type')}
                                className="flex items-center gap-2 px-4 py-2 bg-[#646ECD] hover:bg-[#5560B7] rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#646ECD]/20"
                            >
                                <Plus size={16} /> Add Type
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-xs uppercase tracking-wider bg-[#151B2D]">
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-gray-500">Loading…</td></tr>
                                ) : types.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-gray-500">No payment types found</td></tr>
                                ) : (
                                    types.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase())).map((t, idx) => (
                                        <tr key={t.id} className={`border-t border-[#2D334A] hover:bg-[#1E2640] transition ${idx % 2 === 0 ? 'bg-[#1A2033]' : 'bg-[#171D2E]'}`}>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-300">{t.id}</td>
                                            <td className="px-4 py-3 font-medium">{t.name}</td>
                                            <td className="px-4 py-3">
                                                <span className="bg-[#646ECD]/20 text-[#646ECD] text-xs font-semibold px-2 py-0.5 rounded">{t.code}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(t.created_at)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════════════ PAYMENT ACCOUNTS TAB ═══════════════════ */}
            {activeTab === 'accounts' && (
                <div className="bg-[#1A2033] rounded-xl border border-[#2D334A] overflow-hidden">
                    <div className="p-4 border-b border-[#2D334A] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Payment Accounts ({accounts.length})</h2>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search accounts…"
                                    className="bg-[#0F1525] border border-[#2D334A] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#646ECD] text-white placeholder-gray-500 w-48"
                                />
                            </div>
                            <button
                                onClick={() => setShowModal('account')}
                                className="flex items-center gap-2 px-4 py-2 bg-[#646ECD] hover:bg-[#5560B7] rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#646ECD]/20"
                            >
                                <Plus size={16} /> Add Account
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-xs uppercase tracking-wider bg-[#151B2D]">
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Account Name</th>
                                    <th className="px-4 py-3">Account Number</th>
                                    <th className="px-4 py-3">IFSC</th>
                                    <th className="px-4 py-3">UPI ID</th>
                                    <th className="px-4 py-3">Extra</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading…</td></tr>
                                ) : accounts.filter(a =>
                                    a.type_name?.toLowerCase().includes(search.toLowerCase()) ||
                                    a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
                                    a.upi_id?.toLowerCase().includes(search.toLowerCase())
                                ).length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">No payment accounts found</td></tr>
                                ) : (
                                    accounts.filter(a =>
                                        a.type_name?.toLowerCase().includes(search.toLowerCase()) ||
                                        a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
                                        a.upi_id?.toLowerCase().includes(search.toLowerCase())
                                    ).map((a, idx) => (
                                        <tr key={a.id} className={`border-t border-[#2D334A] hover:bg-[#1E2640] transition ${idx % 2 === 0 ? 'bg-[#1A2033]' : 'bg-[#171D2E]'}`}>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-300">{a.id}</td>
                                            <td className="px-4 py-3">
                                                <span className="bg-[#646ECD]/20 text-[#646ECD] text-xs font-semibold px-2 py-0.5 rounded">{a.type_name}</span>
                                            </td>
                                            <td className="px-4 py-3 font-medium">{a.account_name || '—'}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-300">{a.account_number || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-gray-400">{a.ifsc_code || '—'}</td>
                                            <td className="px-4 py-3 text-emerald-400 font-medium">{a.upi_id || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{a.extra_details || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════════════ OFFERS TAB ═══════════════════ */}
            {activeTab === 'offers' && (
                <div className="bg-[#1A2033] rounded-xl border border-[#2D334A] overflow-hidden">
                    <div className="p-4 border-b border-[#2D334A] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Offers ({offers.length})</h2>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search offers…"
                                    className="bg-[#0F1525] border border-[#2D334A] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#646ECD] text-white placeholder-gray-500 w-48"
                                />
                            </div>
                            <button
                                onClick={() => setShowModal('offer')}
                                className="flex items-center gap-2 px-4 py-2 bg-[#646ECD] hover:bg-[#5560B7] rounded-lg text-sm font-medium transition-all shadow-lg shadow-[#646ECD]/20"
                            >
                                <Plus size={16} /> Create Offer
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-xs uppercase tracking-wider bg-[#151B2D]">
                                    <th className="px-4 py-3">Merchant</th>
                                    <th className="px-4 py-3">Coin</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Available</th>
                                    <th className="px-4 py-3">Limits</th>
                                    <th className="px-4 py-3">Segment</th>
                                    <th className="px-4 py-3">Badges</th>
                                    <th className="px-4 py-3">Payments</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">Loading…</td></tr>
                                ) : offers.filter(o =>
                                    o.username?.toLowerCase().includes(search.toLowerCase()) ||
                                    o.coin?.toLowerCase().includes(search.toLowerCase())
                                ).length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">No offers found</td></tr>
                                ) : (
                                    offers.filter(o =>
                                        o.username?.toLowerCase().includes(search.toLowerCase()) ||
                                        o.coin?.toLowerCase().includes(search.toLowerCase())
                                    ).map((o, idx) => (
                                        <tr key={o.id} className={`border-t border-[#2D334A] hover:bg-[#1E2640] transition ${idx % 2 === 0 ? 'bg-[#1A2033]' : 'bg-[#171D2E]'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-[#646ECD] rounded-full flex items-center justify-center text-xs font-bold">{o.avatar_letter}</div>
                                                    <span className="font-medium">{o.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded">{o.coin}/{o.fiat}</span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-emerald-400">₹{fmtNum(o.price)}</td>
                                            <td className="px-4 py-3 text-gray-300">{fmtNum(o.available_amount)}</td>
                                            <td className="px-4 py-3 text-xs text-gray-400">
                                                ₹{Number(o.min_limit).toLocaleString()} — ₹{Number(o.max_limit).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${o.segment === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {o.segment}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    {o.is_featured && <Star size={14} className="text-yellow-400" />}
                                                    {o.is_verified && <BadgeCheck size={14} className="text-emerald-400" />}
                                                    {o.is_kyc_verified && <ShieldCheck size={14} className="text-blue-400" />}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-400">
                                                {o.payments ? o.payments.map(p => p.type).join(', ') : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════════════ ORDERS TAB ═══════════════════ */}
            {activeTab === 'orders' && (
                <div className="bg-[#1A2033] rounded-xl border border-[#2D334A] overflow-hidden">
                    <div className="p-4 border-b border-[#2D334A] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Orders ({orders.length})</h2>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search orders…"
                                className="bg-[#0F1525] border border-[#2D334A] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#646ECD] text-white placeholder-gray-500 w-60"
                            />
                        </div>
                    </div>

                    {/* ── Status Sub-tabs ── */}
                    <div className="flex flex-wrap gap-1 px-4 py-3 border-b border-[#2D334A] bg-[#151B2D]">
                        {['ALL', 'PENDING', 'PAID', 'RELEASED', 'CANCELLED', 'EXPIRED'].map(s => {
                            const cnt = s === 'ALL' ? orders.length : orders.filter(o => o.status === s).length;
                            const dotColor = s === 'PENDING' ? 'bg-yellow-400' : s === 'PAID' ? 'bg-blue-400' : s === 'RELEASED' ? 'bg-emerald-400' : s === 'CANCELLED' ? 'bg-red-400' : s === 'EXPIRED' ? 'bg-orange-400' : 'bg-gray-400';
                            return (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s
                                        ? 'bg-[#646ECD]/20 text-white border border-[#646ECD]/50'
                                        : 'text-gray-400 hover:text-white hover:bg-[#2B3350] border border-transparent'
                                        }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                    {s}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === s ? 'bg-[#646ECD]/30' : 'bg-[#2D334A]'}`}>{cnt}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-xs uppercase tracking-wider bg-[#151B2D]">
                                    <th className="px-4 py-3">Order No</th>
                                    <th className="px-4 py-3">Merchant</th>
                                    <th className="px-4 py-3">Coin</th>
                                    <th className="px-4 py-3">Crypto Amt</th>
                                    <th className="px-4 py-3">Fiat Amt</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Time Left</th>
                                    <th className="px-4 py-3">UTR</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-gray-500">Loading…</td></tr>
                                ) : (() => {
                                    const filtered = orders
                                        .filter(o => statusFilter === 'ALL' || o.status === statusFilter)
                                        .filter(o =>
                                            o.order_no?.toLowerCase().includes(search.toLowerCase()) ||
                                            o.merchant_name?.toLowerCase().includes(search.toLowerCase()) ||
                                            o.status?.toLowerCase().includes(search.toLowerCase())
                                        )
                                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                                    return filtered.length === 0 ? (
                                        <tr><td colSpan={10} className="text-center py-12 text-gray-500">No orders found</td></tr>
                                    ) : (
                                        filtered.map((o, idx) => (
                                            <tr key={o.id} className={`border-t border-[#2D334A] hover:bg-[#1E2640] transition ${idx % 2 === 0 ? 'bg-[#1A2033]' : 'bg-[#171D2E]'}`}>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-300">{o.order_no}</td>
                                                <td className="px-4 py-3 font-medium">{o.merchant_name || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-amber-500/20 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded">{o.coin}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{fmtNum(o.crypto_amount)}</td>
                                                <td className="px-4 py-3 font-semibold text-emerald-400">₹{fmtNum(o.fiat_amount)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                                        {o.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {(() => {
                                                        const t = fmtTimeRemaining(o);
                                                        if (!t) return <span className="text-xs text-gray-500">—</span>;
                                                        if (t.expired) return (
                                                            <span className="flex items-center gap-1 text-xs font-semibold text-orange-400">
                                                                <AlertTriangle size={12} /> Expired
                                                            </span>
                                                        );
                                                        return (
                                                            <span className="flex items-center gap-1 text-xs font-mono text-yellow-400">
                                                                <Timer size={12} /> {t.text}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{o.utr_number || '—'}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(o.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1 relative">
                                                        {/* View Proof */}
                                                        {o.payment_proof && (
                                                            <button
                                                                onClick={() => setProofModal(o)}
                                                                title="View Proof"
                                                                className="text-xs text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/30 p-1.5 rounded-lg transition"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                        )}
                                                        {/* Release */}
                                                        {o.status === 'PAID' && (
                                                            <button
                                                                onClick={() => handleRelease(o.id)}
                                                                title="Release Funds"
                                                                className="text-xs text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 p-1.5 rounded-lg transition"
                                                            >
                                                                <ArrowUpRight size={14} />
                                                            </button>
                                                        )}
                                                        {/* Cancel (No Payment) */}
                                                        {(o.status === 'PENDING' || o.status === 'PAID') && (
                                                            <button
                                                                onClick={() => handleCancel(o.id)}
                                                                title="No Payment Received"
                                                                className="text-xs text-yellow-400 hover:text-white bg-yellow-500/10 hover:bg-yellow-500/30 p-1.5 rounded-lg transition"
                                                            >
                                                                <Ban size={14} />
                                                            </button>
                                                        )}
                                                        {/* Change Status */}
                                                        <button
                                                            onClick={() => { setStatusModal(o); setNewStatus(o.status); }}
                                                            title="Change Status"
                                                            className="text-xs text-gray-400 hover:text-white bg-gray-500/10 hover:bg-gray-500/30 p-1.5 rounded-lg transition"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        {/* No Delete — see `handleStatusChange` for why the
                                                            endpoint has no replacement. Cancel refunds and
                                                            keeps the record. */}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    );
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* ═══════════════════ SELL ORDERS TAB ═══════════════════ */}
            {activeTab === 'sellOrders' && (
                <div className="bg-[#1A2033] rounded-xl border border-[#2D334A] overflow-hidden">

                    <div className="p-4 border-b border-[#2D334A]">
                        <h2 className="text-lg font-semibold">
                            Sell Orders ({sellOrders.length})
                        </h2>
                    </div>

                    {/* Status Filters */}
                    <div className="flex gap-2 p-3 border-b border-[#2D334A] bg-[#151B2D]">
                        {['ALL', 'PENDING', 'RELEASED', 'CANCELLED', 'EXPIRED'].map(s => {

                            const cnt = s === 'ALL'
                                ? sellOrders.length
                                : sellOrders.filter(o => o.status === s).length;

                            return (
                                <button
                                    key={s}
                                    onClick={() => setSellStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${sellStatusFilter === s
                                        ? 'bg-[#646ECD]/20 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-[#2B3350]'
                                        }`}
                                >
                                    {s} ({cnt})
                                </button>
                            );
                        })}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-xs uppercase bg-[#151B2D]">
                                    <th className="px-4 py-3">Order</th>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Merchant</th>
                                    <th className="px-4 py-3">Crypto</th>
                                    <th className="px-4 py-3">Fiat</th>
                                    <th className="px-4 py-3">Payment</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Time Left</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>

                            <tbody>

                                {sellOrders
                                    .filter(o => sellStatusFilter === 'ALL' || o.status === sellStatusFilter)
                                    .map(o => (

                                        <tr key={o.id} className="border-t border-[#2D334A] hover:bg-[#1E2640]">

                                            <td className="px-4 py-3 font-mono text-xs">
                                                {o.order_no}
                                            </td>

                                            <td className="px-4 py-3">
                                                {o.user_id}
                                            </td>

                                            <td className="px-4 py-3">
                                                {o.merchant_name || '—'}
                                            </td>

                                            <td className="px-4 py-3">
                                                {fmtNum(o.crypto_amount)} {o.coin}
                                            </td>

                                            <td className="px-4 py-3 text-emerald-400 font-semibold">
                                                ₹{fmtNum(o.fiat_amount)}
                                            </td>

                                            <td className="px-4 py-3 text-xs">
                                                {o.payment_type}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[o.status]}`}>
                                                    {o.status}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3">
                                                {(() => {
                                                    const t = fmtTimeRemaining(o);
                                                    if (!t) return <span className="text-xs text-gray-500">—</span>;
                                                    if (t.expired) return (
                                                        <span className="flex items-center gap-1 text-xs font-semibold text-orange-400">
                                                            <AlertTriangle size={12} /> Expired
                                                        </span>
                                                    );
                                                    return (
                                                        <span className="flex items-center gap-1 text-xs font-mono text-yellow-400">
                                                            <Timer size={12} /> {t.text}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-4 py-3 text-xs">
                                                {fmtDate(o.created_at)}
                                            </td>

                                            <td className="px-4 py-3 flex gap-1">

                                                {/* Account Details */}
                                                <button
                                                    onClick={() => setSellDetailModal(o)}
                                                    className="text-blue-400 hover:text-white bg-blue-500/10 p-1.5 rounded"
                                                >
                                                    <Eye size={14} />
                                                </button>

                                                {/* Release */}
                                                {o.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => setSellReleaseModal(o)}
                                                        className="text-emerald-400 hover:text-white bg-emerald-500/10 p-1.5 rounded"
                                                    >
                                                        <ArrowUpRight size={14} />
                                                    </button>
                                                )}

                                                {/* Cancel */}
                                                {o.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleSellCancel(o.id)}
                                                        className="text-red-400 hover:text-white bg-red-500/10 p-1.5 rounded"
                                                    >
                                                        <Ban size={14} />
                                                    </button>
                                                )}

                                            </td>

                                        </tr>

                                    ))}

                            </tbody>
                        </table>
                    </div>

                </div>
            )}


            {/* ═══════════════════ PROOF VIEWER MODAL ═══════════════════ */}
            {proofModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1A2033] border border-[#2D334A] rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
                        <button onClick={() => setProofModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X size={18} />
                        </button>
                        <h3 className="text-lg font-bold mb-1">Payment Proof</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Order: <span className="font-mono text-white">{proofModal.order_no}</span>
                            {proofModal.utr_number && <> · UTR: <span className="font-mono text-emerald-400">{proofModal.utr_number}</span></>}
                            {proofModal.paid_at && <> · Paid: <span className="text-gray-300">{fmtDate(proofModal.paid_at)}</span></>}
                        </p>
                        <div className="bg-[#0F1525] rounded-xl border border-[#2D334A] p-3 flex items-center justify-center min-h-[300px]">
                            <ProofImage
                                path={buildPath(ENDPOINTS.p2p.orderProof, { orderId: proofModal.id })}
                                alt="Payment Proof"
                                className="max-w-full max-h-[400px] object-contain rounded-lg"
                                onError={(e) => { e.target.src = ''; e.target.alt = 'Failed to load image'; }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ STATUS CHANGE MODAL ═══════════════════ */}
            {statusModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A2033] border border-[#2D334A] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button onClick={() => setStatusModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X size={18} />
                        </button>
                        <h3 className="text-lg font-bold mb-1">Change Order Status</h3>
                        <p className="text-gray-400 text-sm mb-5">
                            Order: <span className="font-mono text-white">{statusModal.order_no}</span>
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Current Status</label>
                                <div className="bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm">
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[statusModal.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                        {statusModal.status}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">New Status</label>
                                <select
                                    value={newStatus}
                                    onChange={e => setNewStatus(e.target.value)}
                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                >
                                    {/*
                                      * Only the transitions that move no money.
                                      * Setting an order to RELEASED here would mark it
                                      * paid WITHOUT crediting the wallet, and setting a
                                      * released order back to PENDING would let it be
                                      * released again — the status is what every guard
                                      * in the module reads. Release and cancel have
                                      * their own buttons, which do the money and the
                                      * status in one transaction.
                                      */}
                                    {['DISPUTED', 'EXPIRED'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-gray-500 mt-1.5">
                                    Use Release or Cancel to settle an order — those move the funds too.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setStatusModal(null)} className="flex-1 py-2.5 rounded-lg border border-[#2D334A] text-sm text-gray-300 hover:bg-[#2B3350] transition">Cancel</button>
                                <button
                                    onClick={handleStatusChange} disabled={saving || newStatus === statusModal.status}
                                    className="flex-1 py-2.5 rounded-lg bg-[#646ECD] hover:bg-[#5560B7] text-sm font-semibold transition disabled:opacity-50"
                                >
                                    {saving ? 'Updating…' : 'Update Status'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ MODALS ═══════════════════ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A2033] border border-[#2D334A] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <X size={18} />
                        </button>

                        {/* ── Add Payment Type Modal ── */}
                        {showModal === 'type' && (
                            <>
                                <h3 className="text-lg font-bold mb-1">Add Payment Type</h3>
                                <p className="text-gray-400 text-sm mb-5">Define a new payment method category (e.g. UPI, Bank, IMPS)</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Name</label>
                                        <input
                                            value={typeForm.name}
                                            onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                                            placeholder="e.g. UPI"
                                            className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Code</label>
                                        <input
                                            value={typeForm.code}
                                            onChange={e => setTypeForm({ ...typeForm, code: e.target.value.toLowerCase() })}
                                            placeholder="e.g. upi"
                                            className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-[#2D334A] text-sm text-gray-300 hover:bg-[#2B3350] transition">Cancel</button>
                                        <button
                                            onClick={handleCreateType} disabled={saving || !typeForm.name || !typeForm.code}
                                            className="flex-1 py-2.5 rounded-lg bg-[#646ECD] hover:bg-[#5560B7] text-sm font-semibold transition disabled:opacity-50"
                                        >
                                            {saving ? 'Creating…' : 'Create Type'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Add Payment Account Modal ── */}
                        {showModal === 'account' && (
                            <>
                                <h3 className="text-lg font-bold mb-1">Add Payment Account</h3>
                                <p className="text-gray-400 text-sm mb-5">Add admin payment details users will pay to</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Payment Type</label>
                                        <select
                                            value={accountForm.payment_type_id}
                                            onChange={e => setAccountForm({ ...accountForm, payment_type_id: e.target.value })}
                                            className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                        >
                                            <option value="">Select type…</option>
                                            {types.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Dynamic fields based on type */}
                                    {isUPI ? (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">UPI ID</label>
                                                <input
                                                    value={accountForm.upi_id}
                                                    onChange={e => setAccountForm({ ...accountForm, upi_id: e.target.value })}
                                                    placeholder="e.g. merchant@upi"
                                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">QR Code Image</label>
                                                {qrPreview ? (
                                                    <div className="relative inline-block">
                                                        <img src={qrPreview} alt="QR Preview" className="w-32 h-32 object-contain rounded-lg border border-[#2D334A] bg-white p-1" />
                                                        <button
                                                            type="button"
                                                            onClick={() => { setQrFile(null); setQrPreview(null); }}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-28 bg-[#0F1525] border-2 border-dashed border-[#2D334A] rounded-lg cursor-pointer hover:border-[#646ECD] transition">
                                                        <Upload size={20} className="text-gray-500 mb-1" />
                                                        <span className="text-xs text-gray-500">Click to upload QR image</span>
                                                        <input type="file" accept="image/*" onChange={handleQrChange} className="hidden" />
                                                    </label>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Account Holder Name</label>
                                                <input
                                                    value={accountForm.account_name}
                                                    onChange={e => setAccountForm({ ...accountForm, account_name: e.target.value })}
                                                    placeholder="e.g. Ravi Kumar"
                                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Account Number</label>
                                                <input
                                                    value={accountForm.account_number}
                                                    onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })}
                                                    placeholder="e.g. 123456789"
                                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">IFSC Code</label>
                                                <input
                                                    value={accountForm.ifsc_code}
                                                    onChange={e => setAccountForm({ ...accountForm, ifsc_code: e.target.value.toUpperCase() })}
                                                    placeholder="e.g. SBIN000123"
                                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Extra Details (Optional)</label>
                                        <input
                                            value={accountForm.extra_details}
                                            onChange={e => setAccountForm({ ...accountForm, extra_details: e.target.value })}
                                            placeholder="Any additional notes…"
                                            className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-[#2D334A] text-sm text-gray-300 hover:bg-[#2B3350] transition">Cancel</button>
                                        <button
                                            onClick={handleCreateAccount} disabled={saving || !accountForm.payment_type_id}
                                            className="flex-1 py-2.5 rounded-lg bg-[#646ECD] hover:bg-[#5560B7] text-sm font-semibold transition disabled:opacity-50"
                                        >
                                            {saving ? 'Creating…' : 'Create Account'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Create Offer Modal ── */}
                        {showModal === 'offer' && (
                            <>
                                <h3 className="text-lg font-bold mb-1">Create P2P Offer</h3>
                                <p className="text-gray-400 text-sm mb-5">Create a merchant listing visible to users</p>
                                <div className="space-y-4">
                                    {/* Row 1 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Merchant Name</label>
                                            <input
                                                value={offerForm.username}
                                                onChange={e => setOfferForm({ ...offerForm, username: e.target.value.toUpperCase() })}
                                                placeholder="e.g. CHOUDHARY"
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Segment</label>
                                            <select
                                                value={offerForm.segment}
                                                onChange={e => setOfferForm({ ...offerForm, segment: e.target.value })}
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            >
                                                <option value="BUY">BUY</option>
                                                <option value="SELL">SELL</option>
                                            </select>
                                        </div>
                                    </div>
                                    {/* Row 2 */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Coin</label>
                                            <select
                                                value={offerForm.coin}
                                                onChange={e => setOfferForm({ ...offerForm, coin: e.target.value })}
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            >
                                                <option value="USDT">USDT</option>
                                                <option value="BTC">BTC</option>
                                                <option value="ETH">ETH</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Fiat</label>
                                            <select
                                                value={offerForm.fiat}
                                                onChange={e => setOfferForm({ ...offerForm, fiat: e.target.value })}
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            >
                                                <option value="INR">INR</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Price (per unit)</label>
                                            <input
                                                type="number" step="0.01"
                                                value={offerForm.price}
                                                onChange={e => setOfferForm({ ...offerForm, price: e.target.value })}
                                                placeholder="e.g. 97.60"
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            />
                                        </div>
                                    </div>
                                    {/* Row 3 */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Min Limit</label>
                                            <input
                                                type="number"
                                                value={offerForm.min_limit}
                                                onChange={e => setOfferForm({ ...offerForm, min_limit: e.target.value })}
                                                placeholder="200000"
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Max Limit</label>
                                            <input
                                                type="number"
                                                value={offerForm.max_limit}
                                                onChange={e => setOfferForm({ ...offerForm, max_limit: e.target.value })}
                                                placeholder="2500000"
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Available Amt</label>
                                            <input
                                                type="number"
                                                value={offerForm.available_amount}
                                                onChange={e => setOfferForm({ ...offerForm, available_amount: e.target.value })}
                                                placeholder="50000"
                                                className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                            />
                                        </div>
                                    </div>
                                    {/* Row 4 — Payment Time */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Payment Time (minutes)</label>
                                        <input
                                            type="number"
                                            value={offerForm.payment_time}
                                            onChange={e => setOfferForm({ ...offerForm, payment_time: e.target.value })}
                                            className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#646ECD] text-white"
                                        />
                                    </div>
                                    {/* Row 5 — Payment Accounts multi-select */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Payment Accounts</label>
                                        <div className="flex flex-wrap gap-2 bg-[#0F1525] border border-[#2D334A] rounded-lg p-3 min-h-[40px]">
                                            {accounts.map(a => {
                                                const sel = offerForm.payment_account_ids.includes(a.id);
                                                return (
                                                    <button
                                                        key={a.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setOfferForm(prev => ({
                                                                ...prev,
                                                                payment_account_ids: sel
                                                                    ? prev.payment_account_ids.filter(id => id !== a.id)
                                                                    : [...prev.payment_account_ids, a.id]
                                                            }));
                                                        }}
                                                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${sel
                                                            ? 'bg-[#646ECD]/30 border-[#646ECD] text-white'
                                                            : 'border-[#2D334A] text-gray-400 hover:border-gray-500'
                                                            }`}
                                                    >
                                                        {sel && <Check size={10} className="inline mr-1" />}
                                                        {a.type_name} — {a.account_name || a.upi_id || `#${a.id}`}
                                                    </button>
                                                );
                                            })}
                                            {accounts.length === 0 && <p className="text-gray-500 text-xs">No accounts available. Create one first.</p>}
                                        </div>
                                    </div>
                                    {/* Row 6 — Badges */}
                                    <div className="flex gap-4">
                                        {[
                                            { key: 'is_featured', label: 'Featured', icon: <Star size={14} /> },
                                            { key: 'is_verified', label: 'Verified', icon: <BadgeCheck size={14} /> },
                                            { key: 'is_kyc_verified', label: 'KYC', icon: <ShieldCheck size={14} /> },
                                        ].map(b => (
                                            <label key={b.key} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={offerForm[b.key]}
                                                    onChange={e => setOfferForm({ ...offerForm, [b.key]: e.target.checked })}
                                                    className="hidden"
                                                />
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${offerForm[b.key]
                                                    ? 'bg-[#646ECD]/30 border-[#646ECD] text-white'
                                                    : 'border-[#2D334A] text-gray-400'
                                                    }`}>
                                                    {b.icon} {b.label}
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-[#2D334A] text-sm text-gray-300 hover:bg-[#2B3350] transition">Cancel</button>
                                        <button
                                            onClick={handleCreateOffer} disabled={saving || !offerForm.username || !offerForm.price}
                                            className="flex-1 py-2.5 rounded-lg bg-[#646ECD] hover:bg-[#5560B7] text-sm font-semibold transition disabled:opacity-50"
                                        >
                                            {saving ? 'Creating…' : 'Create Offer'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════ sellDetailModal MODAL ═══════════════════ */}
            {sellDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">

                    <div className="bg-[#1A2033] border border-[#2D334A] rounded-xl p-6 w-full max-w-md">

                        <h3 className="text-lg font-bold mb-4">
                            Payment Details
                        </h3>

                        {sellDetailModal.payment_type === 'UPI' ? (
                            <div className="space-y-3">

                                <p>UPI: {sellDetailModal.upi_id}</p>

                                {sellDetailModal.qr_image && (
                                    <ProofImage
                                        path={buildPath(ENDPOINTS.p2p.sellOrderQr, { orderId: sellDetailModal.id })}
                                        className="w-40"
                                    />
                                )}

                            </div>
                        ) : (
                            <div className="space-y-2">

                                <p>Name: {sellDetailModal.account_name}</p>
                                <p>Account: {sellDetailModal.account_number}</p>
                                <p>IFSC: {sellDetailModal.ifsc_code}</p>

                            </div>
                        )}

                        <button
                            onClick={() => setSellDetailModal(null)}
                            className="mt-4 px-4 py-2 bg-[#646ECD] rounded"
                        >
                            Close
                        </button>

                    </div>

                </div>
            )}
            {/* ═══════════════════ sellReleaseModal MODAL ═══════════════════ */}
            {/* ═══════════════════ DISPUTES TAB ═══════════════════ */}
            {activeTab === 'disputes' && (
                <div className="bg-[#1A2033] rounded-xl border border-[#2D334A] overflow-hidden">
                    <div className="p-4 border-b border-[#2D334A] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-semibold">Disputes ({disputes.length})</h2>
                        <div className="flex gap-2 flex-wrap">
                            {['ALL', 'OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setDisputeStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${disputeStatusFilter === s
                                        ? 'bg-[#646ECD] text-white'
                                        : 'bg-[#0F1525] text-gray-400 hover:text-white border border-[#2D334A]'
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 text-xs uppercase tracking-wider bg-[#151B2D]">
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Order No</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Reason</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {disputes
                                    .filter(d => disputeStatusFilter === 'ALL' || d.status === disputeStatusFilter)
                                    .map(d => (
                                        <tr key={d.id} className="border-t border-[#2D334A] hover:bg-[#1E2640] transition-colors">
                                            <td className="px-4 py-3 text-gray-400">#{d.id}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{d.order_no || `#${d.order_id}`}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.order_type === 'SELL' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {d.order_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs">
                                                    <div>{d.user_name || '—'}</div>
                                                    <div className="text-gray-500">{d.user_email || d.user_id || '—'}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs max-w-[150px] truncate">{d.reason?.replace(/_/g, ' ')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.status === 'OPEN' ? 'bg-yellow-500/20 text-yellow-400'
                                                    : d.status === 'IN_REVIEW' ? 'bg-blue-500/20 text-blue-400'
                                                        : d.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(d.created_at)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setDisputeModal(d);
                                                            setDisputeNewStatus(d.status);
                                                            setDisputeAdminNote(d.admin_note || '');
                                                        }}
                                                        className="p-1.5 rounded-lg bg-[#0F1525] hover:bg-[#2B3350] border border-[#2D334A] transition-all"
                                                        title="View / Update"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                {disputes.filter(d => disputeStatusFilter === 'ALL' || d.status === disputeStatusFilter).length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-gray-500">No disputes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Dispute Detail / Update Modal ── */}
            {disputeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDisputeModal(null)}>
                    <div className="bg-[#1A2033] border border-[#2D334A] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Dispute #{disputeModal.id}</h3>
                            <button onClick={() => setDisputeModal(null)} className="p-1 hover:bg-[#2B3350] rounded-lg"><X size={18} /></button>
                        </div>

                        <div className="space-y-3 text-sm mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Order No</span>
                                <span className="font-mono">{disputeModal.order_no || `#${disputeModal.order_id}`}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Type</span>
                                <span>{disputeModal.order_type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">User</span>
                                <span>{disputeModal.user_name || disputeModal.user_email || disputeModal.user_id || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Reason</span>
                                <span>{disputeModal.reason?.replace(/_/g, ' ')}</span>
                            </div>
                            {disputeModal.message && (
                                <div>
                                    <span className="text-gray-400 block mb-1">Message</span>
                                    <p className="bg-[#0F1525] rounded-lg p-3 text-gray-300 text-xs">{disputeModal.message}</p>
                                </div>
                            )}
                            {disputeModal.screenshot && (
                                <div>
                                    <span className="text-gray-400 block mb-1">Screenshot</span>
                                    <ProofImage
                                        path={buildPath(ENDPOINTS.p2p.disputeScreenshot, { disputeId: disputeModal.id })}
                                        alt="Dispute screenshot"
                                        className="rounded-lg max-h-48 object-contain border border-[#2D334A]"
                                    />
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-400">Submitted</span>
                                <span>{fmtDate(disputeModal.created_at)}</span>
                            </div>
                        </div>

                        <hr className="border-[#2D334A] my-4" />

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Update Status</label>
                                <select
                                    value={disputeNewStatus}
                                    onChange={e => setDisputeNewStatus(e.target.value)}
                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#646ECD]"
                                >
                                    {/* UNDER_REVIEW, not IN_REVIEW — the old value matched no enum member. */}
                                    {['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Admin Note</label>
                                <textarea
                                    value={disputeAdminNote}
                                    onChange={e => setDisputeAdminNote(e.target.value)}
                                    placeholder="Add a note about the resolution..."
                                    className="w-full bg-[#0F1525] border border-[#2D334A] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#646ECD]"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setDisputeModal(null)}
                                    className="px-4 py-2 border border-[#2D334A] rounded-lg text-sm hover:bg-[#2B3350] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDisputeStatusUpdate}
                                    disabled={saving}
                                    className="px-4 py-2 bg-[#646ECD] hover:bg-[#5560B7] rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving…' : 'Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {sellReleaseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">

                    <div className="bg-[#1A2033] border border-[#2D334A] rounded-xl p-6 w-full max-w-md">

                        <h3 className="text-lg font-bold mb-4">
                            Release Sell Order
                        </h3>

                        <input
                            type="file"
                            onChange={(e) => setSellProofFile(e.target.files[0])}
                            className="mb-3"
                        />

                        <textarea
                            placeholder="Admin note"
                            value={sellAdminNote}
                            onChange={(e) => setSellAdminNote(e.target.value)}
                            className="w-full bg-[#0F1525] border border-[#2D334A] rounded p-2 mb-3"
                        />

                        <div className="flex gap-2">

                            <button
                                onClick={() => setSellReleaseModal(null)}
                                className="px-4 py-2 border border-[#2D334A] rounded"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleSellRelease}
                                className="px-4 py-2 bg-emerald-600 rounded"
                            >
                                Release
                            </button>

                        </div>

                    </div>

                </div>
            )}
        </div>
    );
};

export default PeerTrade;
