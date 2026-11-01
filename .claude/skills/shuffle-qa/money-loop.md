# Money loop (manual INR deposit → bets → rollover → withdrawal)

Local only: backend :4600 (DB `shuffle`), admin :3140, player :5174. Manual rails are bookkeeping credits — no
provider, no real money. Creds from the env files in-process, never printed. Local `TXN_PASSWORD_MODE=login`: the
transaction password is the staff login password. The API half runs in one command:
`node .claude/skills/shuffle-env/scripts/player-api.mjs` (it needs at least one INR row in admin Transactions → Bank details).

## Wiring (backend routes; `site` = in `frontend/src/lib/endpoints.js`)

| Step | Route | Notes |
|---|---|---|
| Deposit methods | `GET /user/bank-details/INR` (site) | admin Transactions → Bank details rows; each has `minAmount`/`maxAmount` (also enforced on submit: 422 `FIAT_DEPOSIT_AMOUNT_OUT_OF_RANGE`) |
| Lodge deposit | `POST /user/deposits/fiat` multipart `amount, currency, transactionId, screenshot` (+ the method's `upiId`/`bankName`…) (site) | fiat: screenshot required (`SCREENSHOT_REQUIRED`). Owner `deposit_mode` manual/both, admin manual switch |
| Deposit history | `GET /user/deposits/fiat`, `GET /user/history/deposits` (site) | |
| Approve / reject | `PUT /admin/user/deposits/fiat/:id/approve {transactionPassword}` / `…/reject {comment}` | admin Transactions → Deposit → Manual |
| Requirements | `GET /user/withdrawals/requirements?currency=INR` (not called by the site yet) | owner `withdrawal_requirements` (kyc / wager / both / none); deposit rollover in USD; `bonusForfeitRequired` |
| Payout accounts | `GET/POST /user/bank-accounts` (not called by the site yet) | `{method:'upi',accountHolderName,upiId}` / `{method:'bank',…,accountNumber,ifscCode}` |
| Withdraw | `POST /user/withdrawals/fiat {amount,currency,bankAccountId[,forfeitBonus]}` (site) | 403 `FIAT_WITHDRAW_KYC_REQUIRED`, 403 `WITHDRAW_WAGER_REQUIRED`, 409 `BONUS_FORFEIT_REQUIRED`. Cancel while queued: `POST /user/withdrawals/fiat/:id/cancel` (refund) |
| Decide | `POST /admin/user/withdrawals/fiat/status {withdrawalId,status,transactionPassword}` | Approved / Paid / Rejected (refunds) |
| Rollover adjust | admin Users → Turnover Report → Edit TargetX (`PUT /admin/turnover-report/:id {multiplier>=0}`, 0 = no rollover) | target = approved deposits (USD) × TargetX |
| Bets | casino: JSGames iframe (`POST /casino/js-games/v2/launch`), history `GET /casino/bet-history` (site); sports: the site calls `GET /sports/bets` | the exchange's player route is `GET /sports/user/cricket/sports-bets/user`; sports wager sweep counts SETTLED bets every 60 s |

## Steps

1. Admin creates a test UPI (min 100 / max 50,000) if none (Transactions → Bank details).
2. Fresh player: wallet → Deposit → INR → 1000 → UPI → UTR + screenshot → Submit → row pending.
3. Approve without password → 403 `TXN_PASSWORD_REQUIRED`; with → 200; wallet shows ₹1,000.
4. Second ₹500 deposit → admin Reject with a reason → player row rejected, balance unchanged.
5. Bet within the test budget (in-house ₹10; third-party ₹10/round, ₹20 per session), check the balance moves and the bet shows in history.
6. Withdraw: KYC missing → KYC gate (policy `kyc`); wager short → `WITHDRAW_WAGER_REQUIRED`; TargetX → 0 → ₹200 queued (−200)
   → admin Decide Paid. A second withdrawal → Rejected → refunded.
7. Admin: user statement, Turnover Report, deposit/withdraw lists agree with the wallet.
