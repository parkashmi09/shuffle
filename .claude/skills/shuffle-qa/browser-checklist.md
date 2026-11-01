# Browser checklist (5174, 1440 and 390 wide)

Flip in the admin (or run `toggles.mjs` and pause), reload 5174 — the public reads are once per page load — then look.
Restore and reload again. `resize_page` 1440×900 and 390×844.

| Item | Look at (1440) | Look at (390) |
|---|---|---|
| admin flag `affiliate` | left nav Affiliate, user menu Affiliate, footer "Affiliate Program"; off → `/affiliate` shows the marketing page only | mobile nav sheet, user menu |
| admin Bonus → registration bonus | Register tab of the auth modal: bonus amount + currency | same modal, no overflow |
| owner policy `business_model` b2b | top bar Register button gone, auth modal has only Login | same |
| owner policy `deposit_mode` | wallet Deposit tab: manual / automatic routes per mode | wallet sheet |
| owner policy `withdrawal_mode` | wallet Withdraw tab routes | wallet sheet |
| Content · Banners | home hero carousel (placement `home`) | home hero |
| Content · Blogs | `/blog` tabs, `/blog/:slug` | stacked list |
| Promotions · Promotions | `/promotions` tiles, `/promotions/:slug` | stacked tiles |
| Content · Notifications | right-side notification panel, unread count | panel full width |

Not checkable in the browser (shuffle's frontend reads no value): casino / sports / originals / vipclub / bonus / home_* flags,
owner feature on/off, Branding, Site config → Content. Report them as "no surface", don't mark them FAIL in the browser pass.

Pass = the surface appears when on / set and is gone (or back to built-in copy) when off / cleared, with no console error,
no 4xx/5xx in the network panel, no layout overflow at 390.
