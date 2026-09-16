import { useCallback, useState } from "react";
import { cx } from "../../lib/carousel";
import { useApi } from "../../lib/useResource";
import { CoinIcon } from "../wallet/CurrencySelect";
import TableSkeleton from "../ui/TableSkeleton";
import SupportChatPrompt from "../ui/SupportChatPrompt";
import SetGamblingLimitModal from "./SetGamblingLimitModal";
import { LIMIT_TYPES, initiateLimitRemoval, limitReset, responsibleLimits } from "../../lib/shuffleWise";

/**
 * Shuffle Wise → Gambling Limits — reference `ResponsibleGamblingLimits`.
 *
 * A loss limit and a wager limit, each over a day, a week or a month. The
 * reference allows one of each and no more, which is why Set Gambling Limit
 * goes disabled at two and why the dialog's type select drops a type that is
 * already set.
 *
 * The table only exists once there is something in it — with no limits the tab
 * is the description, the rule and the button, which is what the live page
 * shows on a fresh account.
 *
 * Removing is not immediate. The reference stamps the row twelve hours out and
 * leaves it in the table, greyed, with the date in amber where the Remove
 * button was. `lib/shuffleWise.js` keeps that shape.
 */

const usd = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The coin icon plus a tabular figure — reference `FormattedUsdAmountWithTooltip`. */
function Amount({ value, suffix, className }) {
  return (
    <div className={cx("FormattedUsdAmountWithTooltip_flex", className)}>
      <CoinIcon code="USD" />
      {suffix ? `${usd(value)} ${suffix}` : usd(value)}
    </div>
  );
}

/** `6:07 AM 13/9/2026` — the reference's `h:mm A DD/M/YYYY`. */
function expiresAt(value) {
  const at = new Date(value);
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${time} ${String(at.getDate()).padStart(2, "0")}/${at.getMonth() + 1}/${at.getFullYear()}`;
}

const HEADERS = ["Type", "Limit", "Reset Period", "Progress", "Action"];

export default function GamblingLimits() {
  const [nonce, setNonce] = useState(0);
  const [open, setOpen] = useState(false);
  const { data, loading } = useApi(`shuffle-wise:limits:${nonce}`, () => responsibleLimits());
  const limits = data || [];

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  const remove = (limitId) => {
    initiateLimitRemoval(limitId);
    refetch();
  };

  const showTable = loading || limits.length > 0;

  return (
    <div data-testid="shuffle-wise-tab-content-section" className="ShuffleWiseLayoutWithSupport_root">
      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">Gambling Limits</h2>

        {showTable && (
          <div className="Table_root ResponsibleGamblingLimits_tableRoot">
            <table className="Table_table">
              <thead className="ResponsibleGamblingLimits_tableHeader">
                <tr>
                  {HEADERS.map((header) => (
                    <td key={header}>
                      {header === "Reset Period" ? (
                        <div className="ResponsibleGamblingLimits_resetPeriod">
                          {header}
                          <img
                            src="/icons/exclamation.svg"
                            alt="exclamation"
                            className="ResponsibleGamblingLimits_img"
                            title="If the chosen reset date is invalid, the limit will reset on the last day of the month."
                          />
                        </div>
                      ) : (
                        header
                      )}
                    </td>
                  ))}
                </tr>
              </thead>
              {loading && <TableSkeleton cells={["r", "cr", "r", "cr", "r"]} rows={5} />}
              {!loading && (
                <tbody className="TableBody_tbody TableBody_even" data-testid="table-body">
                  {limits.map((row) => {
                    const expired = row.expiredAt ? "ResponsibleGamblingLimits_expired" : "";
                    const left = Math.max(0, Number(row.usdAmount) - Number(row.progressAmount || 0));
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={cx("ResponsibleGamblingLimits_flex", expired)}>{LIMIT_TYPES[row.type]}</div>
                        </td>
                        <td>
                          <Amount value={row.usdAmount} className={cx("ResponsibleGamblingLimits_flex", expired)} />
                        </td>
                        <td>
                          <div className={cx("ResponsibleGamblingLimits_flex", expired)}>
                            {limitReset(row.periodUnit, row.createdAt)}
                          </div>
                        </td>
                        <td>
                          <Amount value={left} suffix="left" className={cx("ResponsibleGamblingLimits_flex", expired)} />
                        </td>
                        <td>
                          <div className={cx("ResponsibleGamblingLimits_flex", "ResponsibleGamblingLimits_expiredDate", expired)}>
                            {row.expiredAt ? (
                              `Expires at ${expiresAt(row.expiredAt)}`
                            ) : (
                              <button type="button" className="ResponsibleGamblingLimits_removeBtn" onClick={() => remove(row.id)}>
                                Remove
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        )}

        <div className="ResponsibleGamblingLimits_root">
          <p>
            Gain control over your play or betting by using loss or wagering limits. These limits allow you to
            control the maximum loss or wagered amount over a daily, weekly or monthly period.
          </p>
          <p>
            Your limit will apply immediately and will reset when that time is reached. E.g. If you set a $100
            daily loss limit at 2pm today, the limit will reset at 2pm tomorrow.
          </p>
          <p>
            Any changes to remove your limits require a 12-hour cool off period.{" "}
            <a
              target="_blank"
              className="TextLink_root"
              rel="noreferrer"
              href="https://help.shuffle.com/en/articles/10071185-how-shuffle-s-gambling-limits-work"
            >
              Learn More
            </a>
          </p>
          <hr className="ResponsibleGamblingLimits_divider" />
          <button
            type="button"
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary ResponsibleGamblingLimits_button"
            disabled={limits.length >= 2}
            onClick={() => setOpen(true)}
          >
            <span className="ButtonVariants_buttonContent">Set Gambling Limit</span>
          </button>
        </div>
      </form>

      <SupportChatPrompt />

      {open && (
        <SetGamblingLimitModal
          taken={limits.map((row) => row.type)}
          onDone={refetch}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
