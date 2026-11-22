import { useState } from "react";
import { giftCards as giftApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { formatAmount } from "../../lib/adapters";
import { alertFromError, alertSuccess } from "../../lib/alerts";
import { useSession } from "../../lib/sessionContext";

/**
 * The redeem dialog's Gift Cards tab (owner `gift_cards`).
 *
 * `GET /user/gift-cards` lists the cards the player can see with their deposit and wager progress; a card is
 * taken with `POST .../activate` (starts its clock) and paid with `POST .../claim` once both conditions are met.
 * `GET .../claimed` is the history.
 */
export default function GiftCardsTab() {
  const { refreshBalances } = useSession();
  const { data, loading, error, reload } = useApi("gift-cards", () => giftApi.list());
  const { data: claimed, reload: reloadClaimed } = useApi("gift-cards:claimed", () => giftApi.claimed({ limit: 10 }));
  const [busy, setBusy] = useState(null);
  const cards = (Array.isArray(data) ? data : []).filter((c) => c.usergiftcards?.status !== "Claimed");
  const history = Array.isArray(claimed) ? claimed : [];

  const act = async (id, claim) => {
    setBusy(id);
    try {
      if (claim) {
        const r = await giftApi.claim(id);
        alertSuccess(`${formatAmount(r.amount)} ${r.currency} added to your balance.`);
        refreshBalances?.();
        reloadClaimed();
      } else {
        await giftApi.activate(id);
        alertSuccess("Gift card activated. Meet its conditions, then claim it.");
      }
      reload();
    } catch (e) {
      alertFromError(e, "That gift card could not be updated.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="RaceInfoModal_text">Loading…</p>;
  if (error && !data) return <p className="RaceInfoModal_text" role="alert">{error.message || "Could not load your gift cards."}</p>;

  return (
    <div className="RewardStack_root">
      {cards.length === 0 && <p className="RaceInfoModal_text">No gift cards available right now.</p>}
      {cards.map(({ giftcards: card, usergiftcards: mine, deposit, wager }) => {
        const activated = mine?.status === "Activated" && !mine.expired;
        const ready = activated && deposit?.status && wager?.status;
        return (
          <div key={card.id} className="MiniList_root">
            <div className="MiniList_row">
              <span className="MiniList_heading">{card.uniqueKey}</span>
              <span>{formatAmount(card.amount)}</span>
            </div>
            {card.description && <span className="MiniList_meta">{card.description}</span>}
            {card.depositStatus && (
              <div className="MiniList_row">
                <span>Deposit ${formatAmount(card.depositAmount)}</span>
                <span className="MiniList_meta">{deposit?.status ? "Done" : "Pending"}</span>
              </div>
            )}
            {card.wagerStatus && (
              <div className="MiniList_row">
                <span>Wager ${formatAmount(wager?.requiredWagerUSD)}</span>
                <span className="MiniList_meta">${formatAmount(wager?.totalUsdWager ?? 0)}</span>
              </div>
            )}
            {mine?.expired ? (
              <span className="MiniList_meta">Expired</span>
            ) : (
              <button
                type="button"
                disabled={busy != null || (activated && !ready)}
                onClick={() => act(card.id, activated)}
                className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
              >
                <span className="ButtonVariants_buttonContent">{busy === card.id ? "…" : activated ? "Claim" : "Activate"}</span>
              </button>
            )}
          </div>
        );
      })}
      {history.length > 0 && (
        <div className="MiniList_root">
          <p className="MiniList_heading">Claimed</p>
          {history.map((h) => (
            <div key={h.id} className="MiniList_row">
              <span>{h.card?.uniqueKey ?? "Gift card"}</span>
              <span className="MiniList_meta">{h.card ? `${formatAmount(h.card.amount)} ${h.card.currency}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
