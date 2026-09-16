import { cx } from "../../lib/carousel";
import WalletSelect from "../wallet/CurrencySelect";

/**
 * The notification rail — reference `CasinoAside` + `RightSidebar` +
 * `NotificationsSidebarHeader`, opened from the account menu's Notifications
 * row.
 *
 * ── HOW IT MOVES ─────────────────────────────────────────────────────────
 *
 * It is not an overlay. The reference keeps the `<aside>` in the layout at all
 * times as a flex sibling of the page column, parked off-canvas with
 * `margin-right: -22.5rem`; opening it sets that margin to zero and the
 * transition on `margin-right` (0.25s, `cubic-bezier(0.16, 1, 0.3, 1)`) slides
 * it in while the page column narrows to meet it. That is why the content
 * reflows instead of being covered, and why `magic-container` has to switch to
 * `right-side-opened-only` / `both-side-opened` at the same moment — every
 * rail-aware breakpoint on the site keys off that class.
 *
 * Rendering it always is what makes the close animate too: a panel mounted only
 * while open has nothing to transition out of.
 *
 * ── WHAT IT SHOWS ────────────────────────────────────────────────────────
 *
 * The empty state, always, for now. `modules/notifications` is scoped `staff`
 * and `internal` only (`backend/docs/API-ROUTES.md` §`notifications`) — there
 * is no player-facing list route to read, and the live panel shows the same
 * empty state on an account with nothing waiting. `notifications` is left in
 * `endpoints.js` pointing at the routes a player scope would expose; the moment
 * one exists, this reads it.
 */

const FILTERS = [
  { value: "ALL", label: "All notifications" },
  { value: "PROMOTIONAL", label: "From Shuffle" },
  { value: "TRANSACTIONAL", label: "Transactions" },
];

export default function NotificationPanel({ open, filter, onFilterChange, onClose }) {
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
                {/* Mark everything read. Disabled with nothing to mark, which is
                    how the live panel renders it on an empty account. */}
                <span className="Tooltip_trigger">
                  <button
                    type="button"
                    disabled
                    aria-label="Mark all as read"
                    className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_tertiary NotificationsSidebarHeader_iconButton"
                  >
                    <span className="ButtonVariants_buttonContent">
                      <img alt="notifications" src="/icons/check-circle.svg" />
                    </span>
                  </button>
                </span>
                <div
                  className={cx(
                    "FormControlWrapper_root Select_formWrapper NotificationsSidebarHeader_formWrapper",
                    filter !== "ALL" && "NotificationsSidebarHeader_filterActive"
                  )}
                >
                  {/* The reference's trigger here is not the `Select_button`
                      chrome — it is a tertiary icon button holding the filters
                      mark, so the select passes its own. */}
                  <WalletSelect
                    label="notification-filter"
                    variant="plain"
                    options={FILTERS}
                    value={filter}
                    onChange={onFilterChange}
                    buttonClass="ButtonVariants_root ButtonVariants_tertiary ButtonVariants_buttonHeightSmall"
                    trigger={
                      <span className="ButtonVariants_buttonContent Select_blockImg">
                        <img alt="notifications" src="/icons/filters.svg" />
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
            <div className="RightSidebarEmptyState_emptyStateContainer RightSidebarEmptyState_paddingBottom">
              <img alt="notification empty state icon" src="/icons/notification-gold.svg" />
              <div className="Flex_root Flex_column Flex_sm3 Flex_center">
                <h3 className="RightSidebarEmptyState_title">No notifications</h3>
                <p className="RightSidebarEmptyState_description">There are no notifications to display</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
