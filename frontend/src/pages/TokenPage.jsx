import { useSession } from "../lib/sessionContext";
import { displayBalance } from "../lib/adapters";
import TokenGraphs from "../components/token/TokenGraphs";
import TokenLottery from "../components/token/TokenLottery";
import ActivityBoard from "../components/casino/ActivityBoard";
import {
  LineDash,
  TokenExternalLinks,
  TokenHeader,
  TokenHero,
  TokenShflLinks,
  TokenStats,
  TokenTiles,
} from "../components/token/TokenSections";

/**
 * `/token` — the SHFL token dashboard.
 *
 * ── THE PAGE IS SHORTER WHEN NOBODY IS SIGNED IN ─────────────────────────
 *
 * Measured on the live page in both states. A visitor gets seven sections:
 *
 *     header · hero · rule · site stats · graphs · market links · promos
 *
 * A player gets three more — the two unlock tiles under the hero, the lottery
 * staking block, and the second rule that separates it:
 *
 *     header · hero · TILES · rule · LOTTERY · RULE · stats · graphs · … · promos
 *
 * That is the reference's own split and it is not arbitrary: the tiles report
 * a rate against *your* wagering and the lottery block stakes *your* balance,
 * so neither means anything to somebody without an account. An earlier pass
 * rendered all ten unconditionally, which offered a signed-out visitor a
 * staking form.
 *
 * The hero copy changes with the session too — see `HERO` in `tokenData.js`.
 *
 * **Nothing here is wired.** There is no token module in any of the four
 * services and SHFL has no exchange rate, so price, market cap, TVL, holders,
 * supply and the lottery pool are published figures held in `tokenData.js`
 * with the date they were read. `docs/MISSING-AND-UNWIRED.md` has the detail.
 */
export default function TokenPage() {
  const { balances, signedIn } = useSession();
  const shfl = balances?.SHFL;

  return (
    <section className="LayoutContainer_root token_root LayoutContainer_column LayoutContainer_mobile-top-lg LayoutContainer_tablet-top-lg">
      <TokenHeader />
      <TokenHero signedIn={signedIn} />

      {signedIn && <TokenTiles />}
      <LineDash />
      {signedIn && (
        <>
          <TokenLottery balance={shfl ? displayBalance(shfl, "SHFL") : "0.00"} />
          <LineDash />
        </>
      )}

      <TokenStats />
      <TokenGraphs />
      <LineDash />
      <TokenExternalLinks />
      <TokenShflLinks />
       <ActivityBoard initialTab="latest-bets" hideTabs={["race"]} />
    </section>
  );
}
