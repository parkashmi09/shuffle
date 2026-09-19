import { useCallback, useEffect, useMemo, useState } from "react";

import { cx } from "../../lib/carousel";
import { ApiError } from "../../lib/api";
import { notifications as notificationsApi } from "../../lib/endpoints";
import { useSession } from "../../lib/sessionContext";
import { useApi } from "../../lib/useResource";
import WalletSelect from "../wallet/CurrencySelect";

/**
 * The notification rail — opened from the account menu's Notifications row.
 * Reads `GET /user/notifications` and mark-read routes on user-service.
 */

const FILTERS = [
  { value: "ALL", label: "All notifications" },
  { value: "PROMOTIONAL", label: "From Shuffle" },
  { value: "TRANSACTIONAL", label: "Transactions" },
];

const PROMOTIONAL_TYPES = new Set(["promotion", "general", "bonus"]);
const TRANSACTIONAL_TYPES = new Set(["deposit", "withdrawal", "bet"]);

function matchesFilter(row, filter) {
  const type = String(row?.type ?? "general").toLowerCase();
  if (filter === "PROMOTIONAL") return PROMOTIONAL_TYPES.has(type);
  if (filter === "TRANSACTIONAL") return TRANSACTIONAL_TYPES.has(type);
  return true;
}

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function notifyUnreadChanged(unread) {
  window.dispatchEvent(new CustomEvent("shuffle:notifications-updated", { detail: { unread } }));
}

export default function NotificationPanel({ open, filter, onFilterChange, onClose }) {
  const { signedIn } = useSession();
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const enabled = Boolean(signedIn && open);

  const { data: inbox, loading, error } = useApi(
    enabled ? `notifications:inbox:${refreshKey}` : "notifications:inbox:off",
    () => notificationsApi.list({ limit: 50, offset: 0 }),
    { enabled }
  );

  const rows = useMemo(() => (Array.isArray(inbox?.data) ? inbox.data : []), [inbox]);

  const filtered = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [rows, filter]);

  const unreadTotal = useMemo(() => rows.filter((row) => !row.read).length, [rows]);

  const refreshInbox = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    notificationsApi
      .unreadCount()
      .then((res) => notifyUnreadChanged(Number(res?.unread ?? 0)))
      .catch(() => {});
  }, [signedIn, refreshKey]);

  useEffect(() => {
    if (signedIn && open) notifyUnreadChanged(unreadTotal);
  }, [signedIn, open, unreadTotal]);

  const markAllRead = async () => {
    if (actionPending || unreadTotal === 0) return;
    setActionError(null);
    setActionPending(true);
    try {
      await notificationsApi.markAllRead();
      refreshInbox();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : err?.message || "Could not mark notifications read.");
    } finally {
      setActionPending(false);
    }
  };

  const markOneRead = async (row) => {
    if (actionPending || row.read) return;
    setActionError(null);
    setActionPending(true);
    try {
      await notificationsApi.markRead(row.id);
      refreshInbox();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : err?.message || "Could not update notification.");
    } finally {
      setActionPending(false);
    }
  };

  const loadError = error instanceof ApiError ? error.message : error?.message;
  const showEmpty = !loading && !loadError && filtered.length === 0;

  return (
    <aside
      className={cx(
        "CasinoAside_rightSide CasinoAside_enableAnimation",
        open ? "CasinoAside_showRightSide" : "CasinoAside_disableMobileView"
      )}
      aria-hidden={!open}
    >
      <div className="AnimateMobileView_animateContainer">
        <section className="RightSidebar_rightSidebarContent">
          <div className="RightSidebarHeader_rightSidebarHeaderElement RightSidebarHeader_md2">
            <div className="Flex_root Flex_wide" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>Notifications</h3>
              <div className="Flex_root Flex_sm5 NotificationsSidebarHeader_buttonContainer">
                <span className="Tooltip_trigger">
                  <button
                    type="button"
                    disabled={!signedIn || loading || actionPending || unreadTotal === 0}
                    aria-label="Mark all as read"
                    onClick={markAllRead}
                    className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_tertiary NotificationsSidebarHeader_iconButton"
                  >
                    <span className="ButtonVariants_buttonContent">
                      <img alt="" src="/icons/check-circle.svg" />
                    </span>
                  </button>
                </span>
                <div
                  className={cx(
                    "FormControlWrapper_root Select_formWrapper NotificationsSidebarHeader_formWrapper",
                    filter !== "ALL" && "NotificationsSidebarHeader_filterActive"
                  )}
                >
                  <WalletSelect
                    label="notification-filter"
                    variant="plain"
                    options={FILTERS}
                    value={filter}
                    onChange={onFilterChange}
                    menuMinWidth={240}
                    portalClassName="NotificationsSidebar_filterPopup"
                    buttonClass="ButtonVariants_root ButtonVariants_tertiary ButtonVariants_buttonHeightSmall"
                    trigger={
                      <span className="ButtonVariants_buttonContent Select_blockImg">
                        <img alt="" src="/icons/filters.svg" />
                      </span>
                    }
                  />
                </div>
              </div>
            </div>
            <div className="Flex_root Flex_center ToolbarGroup_root ToolbarGroup_default ToolbarGroup_noVerticalPadding">
              <div>
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={onClose}
                  className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon"
                >
                  <span className="ButtonVariants_buttonContent ToolbarButton_buttonDefault">
                    <span className="ButtonIcon_root">
                      <img alt="close" src="/icons/times.svg" />
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="RightSidebar_rightSidebarScrollable">
            {loadError && (
              <p className="NotificationsSidebar_message NotificationsSidebar_messageError">{loadError}</p>
            )}
            {actionError && (
              <p className="NotificationsSidebar_message NotificationsSidebar_messageError">{actionError}</p>
            )}

            {loading && rows.length === 0 && (
              <p className="NotificationsSidebar_message">Loading notifications…</p>
            )}

            {showEmpty && (
              <div className="RightSidebarEmptyState_emptyStateContainer RightSidebarEmptyState_paddingBottom">
                <img alt="" src="/icons/notification-gold.svg" />
                <div className="Flex_root Flex_column Flex_sm3 Flex_center">
                  <h3 className="RightSidebarEmptyState_title">No notifications</h3>
                  <p className="RightSidebarEmptyState_description">
                    {filter === "ALL"
                      ? "There are no notifications to display"
                      : "Nothing in this filter yet"}
                  </p>
                </div>
              </div>
            )}

            {filtered.length > 0 && (
              <ul className="NotificationsSidebar_list" aria-label="Notifications">
                {filtered.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={cx(
                        "NotificationsSidebar_item",
                        !row.read && "NotificationsSidebar_itemUnread"
                      )}
                      disabled={actionPending}
                      onClick={() => markOneRead(row)}
                    >
                      <span className="NotificationsSidebar_itemMain">
                        <span className="NotificationsSidebar_title">{row.title || "Notification"}</span>
                        {row.body ? (
                          <span className="NotificationsSidebar_body">{row.body}</span>
                        ) : null}
                      </span>
                      <span className="NotificationsSidebar_meta">
                        <span className="NotificationsSidebar_time">{formatWhen(row.createdAt)}</span>
                        {!row.read ? <span className="NotificationsSidebar_dot" aria-hidden /> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
