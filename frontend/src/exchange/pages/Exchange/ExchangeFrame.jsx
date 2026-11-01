import ExchangeRail from './ExchangeRail';
import '../../styles/shuffle-exchange.css';

/* stake: hash's ExchangeCurrencyNote (a non-INR header coin, converted) is not ported — the
   exchange is INR only here, and its pages show the INR wallet in the header (TopBar.jsx). */

/**
 * The exchange's page frame: the sports rail across the top, then the page.
 * stake: `rb-exch` scopes the exchange stylesheet; the page sits in stake's content column.
 */
export default function ExchangeFrame({ children }) {
  return (
    <div className="rb-exch RbExch_page px-4 pb-4 lg:px-12">
      <ExchangeRail />
      {children}
    </div>
  );
}

/**
 * My Bets / Statement: the exchange frame and a heading.
 * stake: one layout at every width (hash uses its MenuPageLayout from `lg` up; stake has none).
 * The rail already carries the three destinations and the tools, so the heading has no ExchangeTools.
 */
export function ExchangeAccountPage({ title, children }) {
  return (
    <ExchangeFrame>
      <h1 className="pb-3 pt-4 text-lg font-extrabold leading-8">{title}</h1>
      {children}
    </ExchangeFrame>
  );
}
