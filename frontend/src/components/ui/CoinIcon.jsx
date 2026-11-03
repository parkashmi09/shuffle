import { COIN_FALLBACK_ICON, currencyIcon, localCurrencyIcon, useCoins } from "../../lib/currencies";

/**
 * A currency's 16px mark. The ONE implementation.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 *
 * There were two `CoinIcon` components and they disagreed. The one in
 * `wallet/CurrencySelect.jsx` asked `currencyIcon` which folder a code lives
 * in; the one in `layout/header/BalancePopup.jsx` hardcoded
 * `/icons/crypto/<code>.svg` for everything.
 *
 * The header pill and the mobile balance strip both imported the second one,
 * so every FIAT balance in the header requested a crypto path that does not
 * exist — `INR` asked for `/icons/crypto/inr.svg` — 404'd, and fell through
 * its own error handler to the generic star. The player's currency mark was
 * simply never shown, on the most visible control on the page.
 *
 * Two components for one job is the actual defect; fixing the copy would have
 * left the next edit free to drift again. Both call sites now re-export this.
 *
 * `currencyIcon` returns the generic coin rather than a guess for a code we
 * ship no mark for, so the `onError` below is a second line of defence and not
 * the normal path it had become.
 */
export function CoinIcon({ code, size = 16 }) {
  const key = String(code || "").toUpperCase();
  useCoins(); // the admin-uploaded mark replaces the local one once the list answers
  return (
    <img
      alt={key}
      className="CryptoIcon_root CryptoIcon_image"
      height={size}
      src={currencyIcon(key)}
      width={size}
      onError={(e) => {
        // The API mark failed → the local one; that failing too → the generic coin, once.
        const img = e.currentTarget;
        const local = localCurrencyIcon(key);
        if (!img.dataset.local && img.getAttribute("src") !== local) {
          img.dataset.local = "1";
          img.src = local;
          return;
        }
        if (img.dataset.fallback) return;
        img.dataset.fallback = "1";
        img.src = COIN_FALLBACK_ICON;
      }}
    />
  );
}

export default CoinIcon;
