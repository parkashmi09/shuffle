import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { isSignedIn, SESSION_EXPIRED_EVENT } from './utils/api';
import Layout from './components/Layout';
import Users from './components/Users';
import Settings from './components/Settings';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/Login';
import Wallet from './components/WalletUpdate';
import DepositPage from './components/DepositPage';
import WithdrawPage from './components/WithdrawPage';
import House from './components/House'
import History from './components/History';
import Game from './components/Games';
import GamesLog from './components/WinSetting';
import SEO from './components/SeoManager';
import Referal from './components/Refrel';
import Bonus from './components/Bonus';
import NotificationSettings from './components/NotificationSettings';
import WinSettings from './components/WinSetting';
import ClubMemberShip from './components/ClubMembership';
import Banner from './components/Banner';
import BankDetails from './components/BankDetails';
import { Buffer } from 'buffer';
import RedeemCode from './components/RedeemCode';
import ExchangeRate from './components/ExchangeRate';
import Notification from './components/notification';
import SwapHistory from './components/SwapHistory';
import Reports from './components/Reports';
import KYC from './components/UserKyc';
import AdminManagementLayout from './components/AdminManagement';
import DashboardTab from './components/admin-management/DashboardTab';

import SettingsTab from './components/admin-management/SettingsTab';
import TwoFactorSettings from './components/TwoFactorSettings';
import MyAccountTab from './components/admin-management/MyAccountTab';
import StaffPortalTab from './components/admin-management/StaffPortalTab';
import BetListTab from './components/admin-management/BetListTab';
import BetListLiveTab from './components/admin-management/BetListLiveTab';

import CasinoTab from './components/admin-management/CasinoTab';
import RiskManagementTab from './components/admin-management/RiskManagementTab';
import ImportTab from './components/admin-management/ImportTab';
import MessageTab from './components/admin-management/MessageTab';
import GameCenterTab from './components/admin-management/GameCenterTab';
import AgentListingTab from './components/admin-management/AgentListingTab';
import TransferTab from './components/admin-management/TransferTab';
import AccessManagementTab from './components/admin-management/AccessManagementTab';
import ActivityLogTab from './components/admin-management/ActivityLogTab';
import RequirePermission from './components/RequirePermission';
import GameWinLossToggle from './components/GameWinLossToggle';
import UserConfig from './components/UserConfig';
import SiteConfig from './components/SiteConfig';
import PercentageHierarchyPage from './components/PercentageHierarchyPage';
import GiftCardAdmin from './components/AdminGiftcards';
import TurnoverReport from './components/TurnoverReport';
import VaultPro from './components/vaultpro';
import PeerTrade from './components/PeerTrade';
import SpinWheel from './components/spinWheel';
import Races from './components/Races';
import BlogAdmin from './components/Blog';
import PromotionsAdmin from './components/Promotions';
import AccountStatement from './components/AccountStatement';
import AccountReport from './components/agent-statement/AccountReport';
import ProvidersPriority from './components/ProvidersPriority';
import VendorPriority from './components/VendorPriority';
import TypePriority from './components/TypePriority';
import TrendingGames from './components/TrendingGames';
import OnlyOnStake from './components/OnlyOnStake';
import MarketingLogin from './components/marketing/MarketingLogin';
import MarketingLayout from './components/marketing/MarketingLayout';
import MarketingDashboard from './components/marketing/MarketingDashboard';
import MarketingCustomers from './components/marketing/MarketingCustomers';
import MarketingUsersTab from './components/admin-management/MarketingUsersTab';
import NotFound from './components/NotFound';
/**
 * The sports operator screens.
 *
 * These were routed to a placeholder that said the sports service "does not
 * boot (missing legacy module)". That is no longer true — sports-service
 * starts with all seven modules and mounts `/api/v1/admin/sports/*`, which is
 * what every screen below calls. The placeholder outlived its reason and was
 * hiding nine working screens, so it is gone.
 *
 * `SportsDashboard` answers to two paths on purpose: it reads `location`
 * itself and opens on its "betlock" tab for `/sports-lock`, so pointing both
 * routes at it is what the component already expects, not a duplicate.
 */
import MarketHistory from './components/MarketWins';
import MarketInternalSettle from './components/MOsettle';
import FanInternalSettle from './components/FanmanualSettle';
import FancyResultReport from './components/FancyResult';
import FanWins from './components/FanwinsHistory';
import SportsBetting from './components/SportsBetting';
import SportsDashboard from './components/sportsbetStats';
import SportsConfigSection from './components/SportsConfig';


/**
 * The guard on every operator screen.
 *
 * Declared at module scope, not inside `App`. A component defined in a render
 * body is a NEW component type on every render, so React unmounts and remounts
 * the whole protected subtree each time — every panel refetches and every open
 * form is thrown away. It also has to re-read the token itself, which is what
 * made the check drift from the one in `utils/api`.
 *
 * `isSignedIn` validates the token's shape and expiry rather than testing that
 * the key is non-empty. Real authentication happens server-side on every
 * request; this only decides whether to render a console or the sign-in page.
 */
const ProtectedRoutes = () => (isSignedIn() ? <Outlet /> : <Navigate to="/login" replace />);

function App() {
  window.Buffer = Buffer;
  const [, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };

    // `storage` fires for OTHER tabs; SESSION_EXPIRED_EVENT is how this tab
    // hears that its own session ended mid-request.
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleStorageChange);

    // Initial check in case the value is set before the listener is attached
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleStorageChange);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/*  ───────── public page ───────── */}
        <Route path="/login" element={<LoginPage />} />

        {/*  ───────── marketing panel ─────────
            Separate login + shell from the admin app. Guarded by
            MarketingLayout, which redirects to /marketing/login when the
            marketing session is missing. Sits outside ProtectedRoutes because
            it uses its own session keys, not `token`. */}
        <Route path="/marketing/login" element={<MarketingLogin />} />
        <Route path="/marketing" element={<MarketingLayout />}>
          <Route index element={<MarketingDashboard />} />
          <Route path="direct-users" element={<MarketingCustomers channel="direct" />} />
          <Route path="agent-users" element={<MarketingCustomers channel="agent" />} />
        </Route>

        {/*  ───────── protected part ────── */}
        <Route element={<ProtectedRoutes />}>
          <Route path="/" element={<Layout />}>

            {/* ↓↓↓  HOME = /admin-management  ↓↓↓ */}
            <Route index element={<Navigate to="/admin-management" replace />} />

            {/*  ───── separate top-level dashboard if you still need it ─────  */}
            <Route path="admin-dashboard" element={<AdminDashboard />} />

            {/*  ───── client-management group ─────  */}
            <Route path="admin-management" element={<AdminManagementLayout />}>
              <Route index element={<DashboardTab />} />
              <Route path="dashboard" element={<DashboardTab />} />

              <Route path="setting" element={<SettingsTab />} />
              {/* Second-factor enrolment for the signed-in operator. The
                  backend refuses a session to level 3 and above without it,
                  so this route is the way through that rule. */}
              <Route path="security" element={<TwoFactorSettings />} />
              <Route path="myaccount" element={<MyAccountTab />} />
              <Route path="staff-portal" element={<StaffPortalTab />} />
              <Route path="betlist" element={<BetListTab />} />
              <Route path="betlistlive" element={<BetListLiveTab />} />
              <Route path="casino" element={<CasinoTab />} />
              <Route path="riskmanagement" element={<RiskManagementTab />} />
              <Route path="import" element={<ImportTab />} />
              <Route path="message" element={<MessageTab />} />
              <Route path="gamecenter" element={<GameCenterTab />} />
              <Route path="agents" element={<AgentListingTab />} />
              <Route path="transfer" element={<TransferTab />} />
              <Route path="access" element={<AccessManagementTab />} />
              <Route path="marketing-users" element={<MarketingUsersTab />} />
            </Route>

            {/*  ───── Activity Log (top-level sidebar page) ───── */}
            <Route path="activity-log" element={<ActivityLogTab />} />

            {/*  ───── everything else (each route gated via RequirePermission) ───── */}
            <Route path="withdraw" element={<RequirePermission authority="canApproveWithdraw"><WithdrawPage /></RequirePermission>} />
            <Route path="users" element={<RequirePermission><Users /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission><Settings /></RequirePermission>} />
            <Route path="deposit" element={<RequirePermission authority="canApproveDeposit"><DepositPage /></RequirePermission>} />
            <Route path="account-statement" element={<RequirePermission><AccountStatement /></RequirePermission>} />
            {/* Per-account "hisab" — opened in its own tab from the agent listing.
                `subject` is 'staff' (agent + downline) or 'user' (one player).
                Gated on Client Management, since that is where it is launched
                from; the API re-checks the hierarchy on every request anyway. */}
            <Route
              path="account-report/:subject/:id"
              element={<RequirePermission page="/admin-management"><AccountReport /></RequirePermission>}
            />
            <Route path="games" element={<RequirePermission><Game /></RequirePermission>} />
            <Route path="win-settings" element={<RequirePermission><WinSettings /></RequirePermission>} />
            <Route path="house" element={<RequirePermission><House /></RequirePermission>} />
            <Route path="wallet" element={<RequirePermission><Wallet /></RequirePermission>} />
            <Route path="history" element={<RequirePermission><History /></RequirePermission>} />
            <Route path="seo-manager" element={<RequirePermission><SEO /></RequirePermission>} />
            <Route path="affiliate" element={<RequirePermission><Referal /></RequirePermission>} />
            <Route path="marketwins" element={<RequirePermission><MarketHistory /></RequirePermission>} />
            <Route path="MOsettle" element={<RequirePermission authority="canSettleSports"><MarketInternalSettle /></RequirePermission>} />
            <Route path="Fansettle" element={<RequirePermission authority="canSettleFancy"><FanInternalSettle /></RequirePermission>} />
            <Route path="fancyreport" element={<RequirePermission><FancyResultReport /></RequirePermission>} />
            <Route path="fanwins" element={<RequirePermission><FanWins /></RequirePermission>} />
            <Route path="bonus" element={<RequirePermission authority="canIssueBonus"><Bonus /></RequirePermission>} />
            <Route path="club" element={<RequirePermission><ClubMemberShip /></RequirePermission>} />
            <Route path="banner" element={<RequirePermission><Banner /></RequirePermission>} />
            <Route path="bankdetails" element={<RequirePermission><BankDetails /></RequirePermission>} />
            <Route path="redeemcode" element={<RequirePermission authority="canCreateRedeemCode"><RedeemCode /></RequirePermission>} />
            <Route path="sportsbeting" element={<RequirePermission><SportsBetting /></RequirePermission>} />
            <Route path="sports-betting" element={<Navigate to="/sportsbeting" replace />} />
            <Route path="exchangerate" element={<RequirePermission><ExchangeRate /></RequirePermission>} />
            <Route path="notification" element={<RequirePermission authority="canSendNotification"><Notification /></RequirePermission>} />
            <Route path="swaphistory" element={<RequirePermission><SwapHistory /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission authority="canViewReports"><Reports /></RequirePermission>} />
            <Route path="kyc" element={<RequirePermission authority="canManageKYC"><KYC /></RequirePermission>} />
            <Route path="siteconfig" element={<RequirePermission authority="canEditSiteConfig"><SiteConfig /></RequirePermission>} />
            <Route path="providers-priority" element={<RequirePermission authority="canEditPriorities"><ProvidersPriority /></RequirePermission>} />
            <Route path="vendor-priority" element={<RequirePermission authority="canEditPriorities"><VendorPriority /></RequirePermission>} />
            <Route path="type-priority" element={<RequirePermission authority="canEditPriorities"><TypePriority /></RequirePermission>} />
            {/* The home page's own row. Same authority as the other curation
                screens — they all rewrite what the lobby puts in front of
                players, and the trending row is the most visible of them. */}
            <Route path="trending-games" element={<RequirePermission authority="canEditPriorities"><TrendingGames /></RequirePermission>} />
            {/* The lobby's exclusives shelf. Same authority for the same
                reason — it rewrites a row players are shown. */}
            <Route path="only-on-stake" element={<RequirePermission authority="canEditPriorities"><OnlyOnStake /></RequirePermission>} />
            <Route path="userconfig" element={<RequirePermission><UserConfig /></RequirePermission>} />
            <Route path="winloss" element={<RequirePermission><GameWinLossToggle /></RequirePermission>} />
            <Route path="notification-settings" element={<RequirePermission><NotificationSettings /></RequirePermission>} />
            <Route path="percentage-hierarchy" element={<RequirePermission><PercentageHierarchyPage /></RequirePermission>} />
            <Route path="giftcard-admin" element={<RequirePermission authority="canIssueGiftCard"><GiftCardAdmin /></RequirePermission>} />
            <Route path="turnover-report" element={<RequirePermission authority="canViewReports"><TurnoverReport /></RequirePermission>} />
            <Route path="vaultpro" element={<RequirePermission><VaultPro /></RequirePermission>} />
            <Route path="peer-trade" element={<RequirePermission><PeerTrade /></RequirePermission>} />
            <Route path="sports-dashboard" element={<RequirePermission><SportsDashboard /></RequirePermission>} />
            <Route path="sports-lock" element={<RequirePermission><SportsDashboard /></RequirePermission>} />
            <Route path="sports-config" element={<RequirePermission authority="canEditSiteConfig"><SportsConfigSection /></RequirePermission>} />
            <Route path="only-on-shuffle" element={<Navigate to="/only-on-stake" replace />} />
            <Route path="spinwheel" element={<RequirePermission><SpinWheel /></RequirePermission>} />
            {/* The wagering race. Reads need `reports:read` and every write
                `config:write`, both enforced server-side — the guard here is
                the panel's own page-visibility check, not the authority. */}
            <Route path="races" element={<RequirePermission><Races /></RequirePermission>} />
            <Route path="blog" element={<RequirePermission><BlogAdmin /></RequirePermission>} />
            <Route path="promotions" element={<RequirePermission><PromotionsAdmin /></RequirePermission>} />
          </Route>
        </Route>

        {/*  ───────── catch-all ─────────
            Must stay last. Without it an unmatched URL rendered nothing at
            all, which reads as a blank page rather than a missing route. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
