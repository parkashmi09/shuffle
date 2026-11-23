import { useState } from "react";
import { raffle as raffleApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { formatAmount } from "../../lib/adapters";
import { alertFromError, alertSuccess } from "../../lib/alerts";
import Modal from "../ui/Modal";
import Countdown from "../ui/Countdown";

/**
 * The weekly raffle — opened from the account menu (owner `raffles`).
 *
 * `GET /user/raffle/current` is the running draw; `GET /user/raffle/me` the caller's tickets (wager tickets
 * are topped up on that read); `POST /user/raffle/claim` the one free ticket per draw; the last drawn draw's
 * winners are `GET /user/raffle/draws/:number`. Prizes are paid by the draw itself, nothing to claim here.
 */
export default function RaffleModal({ onClose }) {
  const { data: draw, loading, error } = useApi("raffle:current", () => raffleApi.current());
  const { data: mine, reload: reloadMine } = useApi("raffle:me", () => raffleApi.mine());
  const last = draw?.latestDrawn;
  const { data: results } = useApi(`raffle:draw:${last}`, () => raffleApi.results(last), { enabled: Boolean(last) });
  const [busy, setBusy] = useState(false);
  const tickets = mine?.tickets ?? [];
  const open = draw?.enabled && draw.status !== "DRAWN";

  const claim = async () => {
    setBusy(true);
    try {
      const t = await raffleApi.claimFree();
      alertSuccess(`Free ticket #${t.ticket} added.`);
      reloadMine();
    } catch (e) {
      alertFromError(e, "Could not claim the free ticket.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="raffle-title">
      <div className="RaceInfoModal_root">
        <div className="RaceInfoModal_headerWrapper RewardModal_plainHeader">
          <img alt="" height="80" src="/icons/lottery-ticket.svg" width="80" />
          <h2 className="RaceInfoModal_header" id="raffle-title">
            {draw ? `$${formatAmount(draw.prizePoolUsd)} Weekly Raffle` : "Weekly Raffle"}
          </h2>
          {open && <Countdown target={draw.drawAt} />}
        </div>

        {loading && <p className="RaceInfoModal_text">Loading…</p>}
        {error && !draw && <p className="RaceInfoModal_text" role="alert">{error.message || "The raffle is not available right now."}</p>}

        {draw && (
          <>
            <p className="RaceInfoModal_text">
              {draw.enabled
                ? `Every $${formatAmount(draw.wagerPerTicketUsd)} wagered earns a ticket, plus one free ticket per draw. ${draw.winners} tickets win $${formatAmount(draw.prizeUsd)} each.`
                : "The raffle is not running right now."}
            </p>
            <div className="RaceInfoModal_raceForm">
              <div className="MiniList_root">
                <div className="MiniList_row">
                  <span>Your tickets</span>
                  <span>{tickets.length}</span>
                </div>
                {mine && (
                  <div className="MiniList_row">
                    <span>Next ticket in</span>
                    <span>${formatAmount(mine.nextTicketInUsd)} wagered</span>
                  </div>
                )}
                {tickets.length > 0 && (
                  <div className="MiniList_row">
                    <span className="MiniList_meta">{tickets.map((t) => `#${t.ticket}`).join("  ")}</span>
                  </div>
                )}
              </div>
              {open && mine && (
                <button
                  type="button"
                  className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary RaceInfoModal_cta"
                  disabled={busy || mine.freeClaimed}
                  onClick={claim}
                >
                  <span className="ButtonVariants_buttonContent">{mine.freeClaimed ? "Free Ticket Claimed" : busy ? "Claiming…" : "Claim Free Ticket"}</span>
                </button>
              )}
              {results?.winners?.length > 0 && (
                <div className="MiniList_root">
                  <p className="MiniList_heading">Draw #{results.number} winners</p>
                  {results.winners.map((w) => (
                    <div key={w.ticket} className="MiniList_row">
                      <span>#{w.ticket} · {w.player}</span>
                      <span className="MiniList_meta">${formatAmount(w.prizeUsd)}</span>
                    </div>
                  ))}
                  {results.myTickets?.length > 0 && (
                    <div className="MiniList_row">
                      <span className="MiniList_meta">You held {results.myTickets.length} ticket{results.myTickets.length === 1 ? "" : "s"} in this draw</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
