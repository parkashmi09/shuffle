import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_BASE_URL_ROOT, buildPath, getStaffToken } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';
import { WALLET_CURRENCIES } from '../constants/walletCurrencies';

/** Every one of these needs a staff token; none of them had one in legacy. */
const authConfig = () => {
  const token = getStaffToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

/**
 * The affiliate admin surface. `GET|PUT /affiliateAdmin/settings` had no
 * middleware at all, so the PUT was an unauthenticated write to the platform's
 * payout rates — and those three values live on `siteconfig`, which is why they
 * are under `site-config` rather than here.
 */
const API_BASE_URL = `${API_BASE_URL_ROOT}${ENDPOINTS.affiliate.stats.replace(/\/stats$/, '')}`;

// ─── Interfaces ───
interface DashboardStats {
  totalTeams: number;
  totalReferrals: number;
  totalLocked: number;
  totalDistributed: number;
  totalRewardRecords: number;
  totalClaimed: number;
  totalUnclaimed: number;
  claimedCount: number;
  unclaimedCount: number;
}

interface AffiliateSettingsForm {
  affiliateBonus: string;
  commissionPercent: string;
  registerBonus: string;
  registerBonusCurrency: string;
  affiliateBonusCurrency: string;
}

interface TeamMember {
  id: number;
  name: string;
  email: string;
  avatar: string;
  level: number;
  balance: number | null;
  games_played: number;
}

interface Team {
  ownername: string;
  referalCode: string;
  createdAt: string;
  updatedAt: string;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  owner_avatar: string;
  owner_level: number;
  members: TeamMember[];
  memberCount?: number;
}

interface RewardRecord {
  ownername: string;
  membername: string;
  referalCode: string;
  amount: number;
  coin: string;
  type: string;
  locked: boolean;
  referalmount: number;
  createdAt: string;
  member_email: string;
  member_level: number;
}

interface TopAffiliate {
  ownername: string;
  referral_count: string;
  email: string;
  level: number;
  total_earned: string;
}

// ─── Tabs ───
type TabId = 'dashboard' | 'settings' | 'teams' | 'rewards';

const Referal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topAffiliates, setTopAffiliates] = useState<TopAffiliate[]>([]);

  // Settings
  const [settings, setSettings] = useState<AffiliateSettingsForm>({
    affiliateBonus: '0',
    commissionPercent: '0',
    registerBonus: '0',
    registerBonusCurrency: 'BJB',
    affiliateBonusCurrency: 'BJB',
  });

  // Teams
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamMembersByOwner, setTeamMembersByOwner] = useState<
    Record<string, { loading: boolean; fetched: boolean; members: TeamMember[] }>
  >({});

  // Rewards
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [rewardsPage, setRewardsPage] = useState(1);
  const [rewardsTotalPages, setRewardsTotalPages] = useState(1);

  const [unlockMember, setUnlockMember] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState('');

  // ─── Fetch Functions ───
  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [statsRes, topRes] = await Promise.all([
        axios.get(`${API_BASE_URL_ROOT}${ENDPOINTS.affiliate.stats}`, authConfig()),
        axios.get(`${API_BASE_URL_ROOT}${ENDPOINTS.affiliate.top}?limit=10`, authConfig())
      ]);
      if (statsRes.data.success) {
        const d = statsRes.data.data;
        setStats({
          totalTeams: d.teams ?? 0,
          totalReferrals: d.members ?? 0,
          totalDistributed: d.unlockedTotal ?? 0,
          totalClaimed: d.claimedTotal ?? 0,
          totalLocked: d.outstanding ?? 0,
          totalUnclaimed: d.outstanding ?? 0,
          totalRewardRecords: d.unlockedCount ?? 0,
          claimedCount: d.claimedCount ?? 0,
          unclaimedCount: Math.max(0, (d.unlockedCount ?? 0) - (d.claimedCount ?? 0)),
        });
      }
      if (topRes.data.success) {
        const rows = Array.isArray(topRes.data.data) ? topRes.data.data : [];
        setTopAffiliates(
          rows.map((r: { owner: string; rewards: number; total: string }) => ({
            ownername: r.owner,
            referral_count: String(r.rewards ?? 0),
            total_earned: r.total ?? '0',
            email: '',
            level: 1,
          }))
        );
      }
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setLoading(false); }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL_ROOT}${ENDPOINTS.siteConfig.affiliate}`, authConfig());
      if (res.data.success) {
        const d = res.data.data;
        setSettings({
          affiliateBonus: String(d.affiliateBonus ?? '0'),
          commissionPercent: String(d.commissionPercent ?? '0'),
          registerBonus: String(d.registerBonus ?? '0'),
          registerBonusCurrency: String(d.registerBonusCurrency ?? 'BJB'),
          affiliateBonusCurrency: String(d.affiliateBonusCurrency ?? 'BJB'),
        });
      }
    } catch (e) { console.error('Settings fetch error:', e); }
    finally { setLoading(false); }
  };

  const runTierUnlock = async () => {
    const memberName = unlockMember.trim();
    if (!memberName) return;
    try {
      setUnlockBusy(true);
      setUnlockMsg('');
      const res = await axios.post(
        `${API_BASE_URL_ROOT}${ENDPOINTS.affiliate.unlock}`,
        { memberName },
        authConfig()
      );
      if (res.data.success) {
        const d = res.data.data;
        setUnlockMsg(
          d.unlocked
            ? `Unlocked tier ${d.tier} — ${d.amount} for ${d.owner}`
            : d.reason || 'No new tier to unlock'
        );
      }
    } catch (e) {
      console.error('Unlock error:', e);
      setUnlockMsg('Unlock failed — check the username and that they are on a team');
    } finally {
      setUnlockBusy(false);
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL_ROOT}${ENDPOINTS.affiliate.teams}`, authConfig());
      if (res.data.success) {
        const rows = Array.isArray(res.data.data) ? res.data.data : [];
        setTeamMembersByOwner({});
        setExpandedTeam(null);
        setTeams(
          rows.map((r: { owner: string; members: number }) => ({
            ownername: r.owner,
            owner_name: r.owner,
            referalCode: '',
            members: [],
            memberCount: Number(r.members ?? 0),
            createdAt: '',
            updatedAt: '',
            owner_id: 0,
            owner_email: '',
            owner_avatar: '',
            owner_level: 1,
          }))
        );
      }
    } catch (e) { console.error('Teams fetch error:', e); }
    finally { setLoading(false); }
  };

  const fetchRewards = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL_ROOT}${ENDPOINTS.affiliate.rewards}?page=${page}&limit=30`, authConfig());
      if (res.data.success) {
        const rows = Array.isArray(res.data.data) ? res.data.data : [];
        setRewards(
          rows.map((r: {
            owner?: string;
            member?: string;
            amount?: string;
            currency?: string;
            tier?: string | null;
            claimed?: boolean;
            createdAt?: string;
          }) => ({
            ownername: r.owner ?? '',
            membername: r.member ?? '',
            referalCode: r.tier ?? '',
            amount: r.amount ?? 0,
            referalmount: r.tier ?? 0,
            type: 'unlock',
            locked: !r.claimed,
            createdAt: r.createdAt ?? new Date().toISOString(),
          }))
        );
        setRewardsTotalPages(res.data.pagination?.totalPages ?? 1);
        setRewardsPage(page);
      }
    } catch (e) { console.error('Rewards fetch error:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'settings') fetchSettings();
    if (activeTab === 'teams') fetchTeams();
    if (activeTab === 'rewards') fetchRewards(1);
  }, [activeTab]);

  // ─── Save Settings ───
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setSaveMsg('');
      const res = await axios.put(
        `${API_BASE_URL_ROOT}${ENDPOINTS.siteConfig.affiliate}`,
        {
          affiliateBonus: settings.affiliateBonus,
          commissionPercent: settings.commissionPercent,
          registerBonus: settings.registerBonus,
          registerBonusCurrency: settings.registerBonusCurrency,
          affiliateBonusCurrency: settings.affiliateBonusCurrency,
        },
        authConfig()
      );
      if (res.data.success) {
        const d = res.data.data;
        setSettings({
          affiliateBonus: String(d.affiliateBonus ?? settings.affiliateBonus),
          commissionPercent: String(d.commissionPercent ?? settings.commissionPercent),
          registerBonus: String(d.registerBonus ?? settings.registerBonus),
          registerBonusCurrency: String(d.registerBonusCurrency ?? settings.registerBonusCurrency),
          affiliateBonusCurrency: String(d.affiliateBonusCurrency ?? settings.affiliateBonusCurrency),
        });
        setSaveMsg('Settings saved successfully!');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } catch (e) {
      console.error('Save error:', e);
      setSaveMsg('Failed to save settings');
    } finally { setSaving(false); }
  };

  // ─── Helpers ───
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatAmount = (n: number | string) => parseFloat(String(n)).toFixed(2);

  const loadTeamMembers = async (owner: string) => {
    const key = owner.trim();
    if (!key) return;
    const cached = teamMembersByOwner[key];
    if (cached?.fetched && !cached.loading) return;

    setTeamMembersByOwner((prev) => ({
      ...prev,
      [key]: { loading: true, fetched: false, members: prev[key]?.members ?? [] },
    }));

    try {
      const path = buildPath(ENDPOINTS.affiliate.teamMembers, { owner: key });
      const res = await axios.get(`${API_BASE_URL_ROOT}${path}`, authConfig());
      const rows = res.data.success && Array.isArray(res.data.data) ? res.data.data : [];
      const members: TeamMember[] = rows.map(
        (r: { member?: string; referralCode?: string; joinedAt?: string }, index: number) => ({
          id: index,
          name: r.member ?? 'Unknown',
          email: '',
          avatar: '',
          level: 1,
          balance: null,
          games_played: 0,
        })
      );

      setTeamMembersByOwner((prev) => ({
        ...prev,
        [key]: { loading: false, fetched: true, members },
      }));

      const code = rows.find((r: { referralCode?: string }) => r.referralCode)?.referralCode;
      if (code) {
        setTeams((prev) =>
          prev.map((t) => (t.ownername === key && !t.referalCode ? { ...t, referalCode: code } : t))
        );
      }
    } catch (e) {
      console.error('Team members fetch error:', e);
      setTeamMembersByOwner((prev) => ({
        ...prev,
        [key]: { loading: false, fetched: true, members: [] },
      }));
    }
  };

  const toggleTeamExpanded = (owner: string) => {
    if (expandedTeam === owner) {
      setExpandedTeam(null);
      return;
    }
    setExpandedTeam(owner);
    void loadTeamMembers(owner);
  };

  const filteredTeams = teams.filter((t) => {
    const count = t.memberCount ?? t.members.length;
    return (
      count > 0 &&
      ((t.owner_name || t.ownername || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.referalCode || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const stringToColor = (s: string): string => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) { const hex = ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)); color += hex.slice(-2); }
    return color;
  };

  // ─── Tab Navigation ───
  const tabs: { id: TabId; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'settings', label: 'Settings' },
    { id: 'teams', label: 'Teams' },
    { id: 'rewards', label: 'Rewards Log' },
  ];

  const inputClass =
    'bg-[#0C0D1D] text-[#F9F9F9] placeholder:text-[#878AA2] border border-[#1E2D55] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#886CFF]/50 focus:border-[#886CFF]';
  const panelClass = 'bg-[#0E1831] rounded-xl border border-[#1E2D55]';
  const btnPrimary =
    'px-6 py-2.5 bg-[#886CFF] text-[#F9F9F9] rounded-lg font-semibold hover:bg-[#9B82FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="p-4 md:p-6 text-[#F9F9F9]">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <h1 className="text-2xl font-bold text-[#F9F9F9] mb-6">Affiliate Management</h1>

          {/* Tab Navigation */}
          <div className="border-b border-[#1E2D55] mb-6">
            <nav className="flex space-x-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-[#886CFF] text-[#886CFF]'
                    : 'border-transparent text-[#878AA2] hover:text-[#F9F9F9] hover:border-[#1E2D55]'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {loading && (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#886CFF]"></div>
            </div>
          )}

          {/* ═══ Dashboard Tab ═══ */}
          {activeTab === 'dashboard' && !loading && stats && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Teams" value={stats.totalTeams} color="indigo" />
                <StatCard label="Total Referrals" value={stats.totalReferrals} color="blue" />
                <StatCard label="Total Distributed" value={`$${formatAmount(stats.totalDistributed)}`} color="green" />
                <StatCard label="Total Claimed" value={`$${formatAmount(stats.totalClaimed)}`} color="emerald" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Locked" value={`$${formatAmount(stats.totalLocked)}`} color="yellow" />
                <StatCard label="Total Unclaimed" value={`$${formatAmount(stats.totalUnclaimed)}`} color="orange" />
                <StatCard label="Claimed Count" value={stats.claimedCount} color="teal" />
                <StatCard label="Unclaimed Count" value={stats.unclaimedCount} color="red" />
              </div>

              {/* Top Affiliates */}
              <div className={`${panelClass} p-6`}>
                <h2 className="text-lg font-semibold text-[#F9F9F9] mb-4">Top Affiliates</h2>
                {topAffiliates.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#1E2D55]">
                      <thead className="bg-[#0C0D1D]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Username</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Level</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Referrals</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-[#878AA2] uppercase">Total Earned</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#0E1831] divide-y divide-[#1E2D55]">
                        {topAffiliates.map((a, i) => (
                          <tr key={a.ownername} className="hover:bg-[#162140]">
                            <td className="px-4 py-3 text-sm text-[#878AA2]">{i + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium text-[#F9F9F9]">{a.ownername}</td>
                            <td className="px-4 py-3 text-sm text-[#878AA2]">{a.email || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs rounded bg-green-500/15 text-green-400">
                                Lv {a.level || 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-[#886CFF]">{a.referral_count}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-green-400">${formatAmount(a.total_earned)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[#878AA2] text-center py-8">No affiliates found</p>
                )}
              </div>
            </div>
          )}

          {/* ═══ Settings Tab ═══ */}
          {activeTab === 'settings' && !loading && (
            <div className="max-w-2xl">
              <div className={`${panelClass} p-6 space-y-6`}>
                <h2 className="text-lg font-semibold text-[#F9F9F9]">Affiliate Reward Settings</h2>
                <p className="text-sm text-[#878AA2]">Configure the rewards and commission rates for the affiliate program. Changes take effect immediately for new registrations.</p>

                <div className="space-y-4">
                  <SettingField
                    label="Joining Reward (Referral Bonus)"
                    description="Amount and currency credited to the referrer when someone signs up with their code — also used for wager tier unlocks and claimable affiliate earnings (new rewards only)."
                    value={parseFloat(settings.affiliateBonus) || 0}
                    onChange={(v) => setSettings({ ...settings, affiliateBonus: String(v) })}
                    currency={settings.affiliateBonusCurrency}
                    onCurrencyChange={(c) => setSettings({ ...settings, affiliateBonusCurrency: c })}
                  />

                  <SettingField
                    label="Commission Percentage"
                    description="Percentage of referred user's wager paid as commission to the referrer."
                    value={parseFloat(settings.commissionPercent) || 0}
                    onChange={(v) => setSettings({ ...settings, commissionPercent: String(v) })}
                    suffix="%"
                  />

                  <SettingField
                    label="Registration Bonus"
                    description="Welcome bonus credited to a new user's wallet when they register (if amount is greater than zero)."
                    value={parseFloat(settings.registerBonus) || 0}
                    onChange={(v) => setSettings({ ...settings, registerBonus: String(v) })}
                    currency={settings.registerBonusCurrency}
                    onCurrencyChange={(c) => setSettings({ ...settings, registerBonusCurrency: c })}
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-[#1E2D55]">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className={btnPrimary}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                  {saveMsg && (
                    <span className={`text-sm font-medium ${saveMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                      {saveMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Teams Tab ═══ */}
          {activeTab === 'teams' && !loading && (
            <div>
              <div className="mb-6 p-4 bg-[#0E1831] rounded-xl border border-[#1E2D55]">
                <h3 className="text-sm font-semibold text-[#F9F9F9] mb-2">Process wager tiers</h3>
                <p className="text-xs text-[#878AA2] mb-3">
                  Run the tier unlock for a referred player (uses their current <code>userwager</code> total).
                  Casino bets trigger this automatically; use this to retry or after manual wager fixes.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Referred player username"
                    className={`flex-1 min-w-[200px] px-3 py-2 text-sm ${inputClass}`}
                    value={unlockMember}
                    onChange={(e) => setUnlockMember(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={runTierUnlock}
                    disabled={unlockBusy || !unlockMember.trim()}
                    className="px-4 py-2 bg-[#886CFF] text-white rounded-lg text-sm font-medium hover:bg-[#9B82FF] disabled:opacity-50"
                  >
                    {unlockBusy ? 'Running…' : 'Unlock tier'}
                  </button>
                </div>
                {unlockMsg && <p className="text-sm text-[#878AA2] mt-2">{unlockMsg}</p>}
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by owner name or referral code..."
                  className={`w-full md:w-80 pl-4 pr-4 py-2 text-sm ${inputClass}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className={`${panelClass} overflow-hidden`}>
                {filteredTeams.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#1E2D55]">
                      <thead className="bg-[#0C0D1D]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Owner</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Referral Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Members</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Created</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-[#878AA2] uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#0E1831] divide-y divide-[#1E2D55]">
                        {filteredTeams.map((team) => (
                          <React.Fragment key={team.ownername}>
                            <tr
                              className="hover:bg-[#162140] cursor-pointer transition-colors"
                              onClick={() => toggleTeamExpanded(team.ownername)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div
                                    className="h-8 w-8 rounded-full flex items-center justify-center text-[#F9F9F9] font-bold text-sm"
                                    style={{ backgroundColor: stringToColor(team.owner_name || '') }}
                                  >
                                    {(team.owner_name || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="ml-3 text-sm font-medium text-[#F9F9F9]">{team.owner_name || 'Unknown'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-[#878AA2]">{team.owner_email || '-'}</td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#886CFF]/20 text-[#B8A8FF]">
                                  {team.referalCode || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-[#878AA2]">
                                {team.memberCount ?? team.members.length}
                              </td>
                              <td className="px-6 py-4 text-sm text-[#878AA2]">{formatDate(team.createdAt)}</td>
                              <td className="px-6 py-4 text-right">
                                <svg
                                  className={`h-5 w-5 text-[#886CFF] inline-block transition-transform ${expandedTeam === team.ownername ? 'rotate-180' : ''}`}
                                  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                                >
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </td>
                            </tr>
                            {expandedTeam === team.ownername && (
                              <tr>
                                <td colSpan={6} className="px-6 py-4 bg-[#0C0D1D]">
                                  <h4 className="text-sm font-medium text-[#878AA2] mb-3">
                                    Team Members ({team.memberCount ?? teamMembersByOwner[team.ownername]?.members.length ?? 0})
                                  </h4>
                                  {teamMembersByOwner[team.ownername]?.loading ? (
                                    <p className="text-sm text-[#878AA2] py-4">Loading members…</p>
                                  ) : null}
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(teamMembersByOwner[team.ownername]?.members ?? []).map((m) => (
                                      <div key={`${team.ownername}-${m.name}`} className="bg-[#162140] p-3 rounded-lg border border-[#1E2D55] flex items-center gap-3">
                                        <div
                                          className="h-9 w-9 rounded-full flex items-center justify-center text-[#F9F9F9] font-bold text-sm flex-shrink-0"
                                          style={{ backgroundColor: stringToColor(m.name || '') }}
                                        >
                                          {(m.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-[#F9F9F9] truncate">{m.name || 'Unknown'}</div>
                                          <div className="text-xs text-[#878AA2] truncate">{m.email || 'Referred player'}</div>
                                          <span className="px-2 py-0.5 text-xs bg-green-500/15 text-green-400 rounded">Lv {m.level || 1}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {!teamMembersByOwner[team.ownername]?.loading &&
                                  teamMembersByOwner[team.ownername]?.fetched &&
                                  (teamMembersByOwner[team.ownername]?.members.length ?? 0) === 0 ? (
                                    <p className="text-sm text-[#878AA2] py-2">No members returned for this team.</p>
                                  ) : null}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-8 text-center text-[#878AA2]">No teams found</p>
                )}
              </div>
            </div>
          )}

          {/* ═══ Rewards Tab ═══ */}
          {activeTab === 'rewards' && !loading && (
            <div className={`${panelClass} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#1E2D55]">
                  <thead className="bg-[#0C0D1D]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Referrer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Member</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#878AA2] uppercase">Original</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#878AA2] uppercase">Remaining</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#0E1831] divide-y divide-[#1E2D55]">
                    {rewards.length > 0 ? rewards.map((r, i) => (
                      <tr key={i} className="hover:bg-[#162140]">
                        <td className="px-4 py-3 text-sm font-medium text-[#F9F9F9]">{r.ownername}</td>
                        <td className="px-4 py-3 text-sm text-[#878AA2]">{r.membername}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs rounded bg-[#886CFF]/20 text-[#B8A8FF]">{r.referalCode}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#878AA2] capitalize">{r.type}</td>
                        <td className="px-4 py-3 text-sm text-right text-[#878AA2]">${formatAmount(r.referalmount || 0)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-[#F9F9F9]">${formatAmount(r.amount || 0)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${r.locked ? 'bg-yellow-500/15 text-yellow-400' : 'bg-green-500/15 text-green-400'
                            }`}>
                            {r.locked ? 'Locked' : 'Unlocked'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#878AA2]">{formatDate(r.createdAt)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-[#878AA2]">No reward records found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {rewardsTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E2D55]">
                  <span className="text-sm text-[#878AA2]">Page {rewardsPage} of {rewardsTotalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchRewards(rewardsPage - 1)}
                      disabled={rewardsPage <= 1}
                      className="px-3 py-1 text-sm border border-[#1E2D55] text-[#F9F9F9] rounded-md hover:bg-[#162140] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchRewards(rewardsPage + 1)}
                      disabled={rewardsPage >= rewardsTotalPages}
                      className="px-3 py-1 text-sm border border-[#1E2D55] text-[#F9F9F9] rounded-md hover:bg-[#162140] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

// ─── Sub-components ───

const StatCard: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => {
  const colorMap: Record<string, string> = {
    indigo: 'bg-[#886CFF]/12 text-[#B8A8FF] border-[#886CFF]/30',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    green: 'bg-green-500/10 text-green-300 border-green-500/25',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    yellow: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/25',
    orange: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
    teal: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
    red: 'bg-red-500/10 text-red-300 border-red-500/25',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.indigo}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
};

const SettingField: React.FC<{
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  currency?: string;
  onCurrencyChange?: (currency: string) => void;
}> = ({ label, description, value, onChange, suffix, currency, onCurrencyChange }) => (
  <div className="p-4 bg-[#0C0D1D] rounded-lg border border-[#1E2D55]">
    <label className="block text-sm font-semibold text-[#F9F9F9] mb-1">{label}</label>
    <p className="text-xs text-[#878AA2] mb-3">{description}</p>
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-40 px-3 py-2 bg-[#0E1831] text-[#F9F9F9] border border-[#1E2D55] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#886CFF]/50 text-sm"
      />
      {onCurrencyChange && currency ? (
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="min-w-[120px] px-3 py-2 bg-[#0E1831] text-[#F9F9F9] border border-[#1E2D55] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#886CFF]/50 text-sm"
        >
          {WALLET_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : suffix ? (
        <span className="text-sm font-medium text-[#878AA2]">{suffix}</span>
      ) : null}
    </div>
  </div>
);

export default Referal;
