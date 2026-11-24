# Accounts, sticky features and points (branch accounts-loyalty, 2026-11-24)

The owner asked for "a login system for customers, ... possible loyalty program and other sticky features."
People rebuy charcoal and foil often, so repeat buying is the heart of it. Guest checkout always stays.

## 1. Brief (atelier:brief)
1. **Subject.** The customer side of the online counter: sign in, your orders, buy again, saved items,
   back-in-stock alerts, a charcoal reminder, and points.
2. **Audience.** Windsor regulars who go through charcoal and foil every week or two, on a phone, often in the
   evening. They distrust sign-up walls, passwords and spam.
3. **The single job.** Put a regular's usual order back in the cart in one tap.
4. **Category default.** "Create an account" walls, password forms, points dashboards with tiers and badges,
   newsletter pop-ups, and age gates.
5. **The idea.** THE COUNTER REMEMBERS YOU. Your last order waits on a counter label, and one tap puts it back
   in the cart.
6. **Register.** A phone-first working page in the shop's own system: coal ground, jewel tiles, Lalezar and
   Readex Pro, ember only for the primary action. Quiet chrome. This is a working page, not a campaign.
7. **Constraints.**
   - Direction 2 tokens (store/public/tokens.css).
   - Guest checkout stays and is never pushed aside.
   - No age or ID wording anywhere a customer looks.
   - No tickers, and nothing teleports in or out.
   - CASL, PIPEDA and the Ontario rules on points (section 5).
   - Bounded to new modules plus small hooks, because three other branches change checkout and admin.
8. **Success tests.**
   - From the code email, a returning customer has their usual in the cart within three taps.
   - A guest never meets a sign-in wall.
   - The points label reads at arm's length: you can see how far you are from the reward without reading the
     numbers.
   - A fresh design review scores 4 or more.

## 2. Concepts (atelier:concept)
| | A. The tab | B. The punch card | C. The home shelf |
|---|---|---|---|
| Idea | Your orders run as the counter's tab | Every dollar punches a hole | Your stash shows what is running low |
| Device | Till roll (from fx-till) | Punch card on price-gun label stock | Shelf of jewel tiles with "running low" marks |
| Layout | Ledger of orders, running total | One card, a ledger below | Tile grid |
| Trades | Points have no home | Loses its centre while points are off (the default) | Guesses usage, often wrongly; feels watched |

**Chosen: THE USUAL LABEL.** It is B's card stock and A's ledger in one object. The last order is printed on
a counter label: white stock, the ember ONE STOP band, the items and total, and one ember Buy again button.
When the owner turns points on, the same label grows a row of punched holes. Points still on their way show
as dashed holes, and points that count are punched through to the coal.

It comes from the store's own device, the price-gun sticker, so it is native to the shop. It also produces
more without new decisions: the checkout points line, the points line on the order page, and a printable
card for the counter. C was refused because guessing what someone is running low on is often wrong and reads
as being watched.

**One decision each atelier skill changed**
- **brief.** The single job put "Your usual" at the top of the account. Details, sign-out and delete come last.
- **concept.** No points dashboard, tiers or badges. Points are punches on the same label.
- **taste.** The kit-grammar scan removed status pills. Order status is a word in the meta column.
- **ux-flows.** Every empty state is written out. Delete is the only confirm step, and its button says the
  verb ("Delete my account"). The favourite toggle saves at once with no confirm.
- **layout.** Orders are a hairline ledger, not a stack of cards. Spacing stays on the 4px ladder in tokens.css.
- **color.** No new colour. Ember stays on the primary action and the label band. Points on their way use a
  dashed outline, not a second hue.
- **typography.** Lalezar is used only for the label figures (points, total). Money and dates use tabular
  numerals. The page band uses the existing display size, so there is no mushy middle.
- **motion.** One move: the newest hole presses in (200ms, once per visit). Saving an item does not animate,
  by the frequency law. Under reduced motion the holes are simply drawn.
- **brand-systems.** Second-artifact test: the checkout points line is built from the label's rules (the same
  punch row, smaller), with no new decisions.
- **critique.** Renders at 390 WebKit and 1440 Chromium, then a fresh design-reviewer (section 7).

## 3. How sign-in works
- **Email only, no passwords.** "Email me a code" sends a 6-digit code and a one-tap link.
  - The code lives 10 minutes, works once, and dies after 5 wrong tries.
  - A new code retires the older ones.
  - Code and link are stored only as salted SHA-256 hashes. Once used or expired, the outbox copy of the email
    is wiped.
- **The link needs a tap, and names the account.** It opens the account page, which first asks the shop whose
  account the link opens (`/peek`, which does not use the link up). The page then shows "Sign in as
  name@example.com" and waits for a tap. Mail scanners that open links (for example Outlook Safe Links) cannot
  use it up, and nobody can send you a link to their own account and slip you into it unawares (login CSRF).
- **No account enumeration.** Asking for a code gets the same answer, with the same work behind it, whether or
  not the email has an account. Sign-up and sign-in are the same step.
- **Rate limits.**
  - 3 codes per inbox per 15 minutes.
  - 20 codes per network per hour.
  - 1,000 codes per hour for the whole shop, a ceiling on what the form can send.
  - 30 wrong codes per network per 15 minutes.
  - At most 5 tries per code.
  - 15 wrong codes per inbox per day, counted across every network. A right code clears the count. Worst case
    for one inbox is 15 guesses a day out of a million codes, about 0.5% a year. NIST allows up to 100.
  - Known trade-off: someone who knows a customer's email can use up that inbox's daily allowance and keep them
    out for the day. They can still check out as a guest. Cloudflare Turnstile on the code form is the next
    step if that is ever abused.
- **Outbox copies.** Once the mail service accepts a sign-in email, the outbox copy is wiped. A copy still held
  (no mail service connected yet) is wiped when its code is used or expires, and again just before every
  nightly backup.
- **Sessions.**
  - A fresh 256-bit random token is issued at every sign-in, so session fixation is not possible. Only its
    SHA-256 is stored.
  - The cookie is `oss_c`: HttpOnly, Secure on https, SameSite=Lax, Path=/.
  - A session ends after 30 days. "Sign out" ends this device; "Sign out on every device" ends them all.
  - Every change needs JSON, the X-OSS-Account marker and a same-site Origin.
  - Account pages send `Referrer-Policy: no-referrer`.
- **Past guest orders.** Orders placed as a guest with the same email join the account at sign-in, because
  signing in proves the customer owns that email.
- **Delete my account.** Removes sign-ins, details, favourites, alerts, the reminder and points. Orders stay as
  guest orders, because sales records are kept for six years for tax.

**Deliberate departure from OWASP.** OWASP suggests 15 to 30 minute idle timeouts for low-risk apps. A shop
account that only reorders, holds no card data and cannot change the email address is kept for 30 days,
which is common retail practice. Deleting the account and signing out everywhere both need the signed-in
cookie.

## 4. Sticky features
- **Buy again.** One tap adds the items still on sale to the cart. It caps each item at the stock left, says
  which items have sold out, and goes to the cart.
- **Favourites.** Save on any product page. Signed-out visitors are taken to sign in, then back.
- **Back-in-stock alert.** On a sold-out product. Any back-office change that brings stock back, plus the
  nightly job, writes one email, then removes the alert.
- **Charcoal reminder.** Off unless the customer turns it on.
  - The customer picks every 2, 3, 4, 6 or 8 weeks (14 to 60 days), from the last charcoal order, the last
    reminder, or the day they agreed, whichever is latest.
  - It needs its own unticked consent box. The words on the box come from the server (REMIND_WORDS), so the
    words kept are exactly the words shown. Each yes is logged in `marketing_consents` with its time and
    interval (CASL s.10 and s.13). Turning it off, unsubscribing or deleting the account marks the log row
    withdrawn. The log row is never deleted, because it is the proof for emails already sent.
  - Every email names the shop with its address and phone and carries a working unsubscribe link (CASL s.6
    and s.11). The link works without signing in and acts at once.
  - Alerts are sent only because the customer asked for them. They carry the same identification and
    unsubscribe.

## 5. Points (off until the owner turns it on)
- **Defaults** (table `account_settings`, key `loyalty`, changed at `PUT /api/admin/loyalty`). The server
  refuses any setting that gives back more than 10 cents on a dollar of items, so a typo cannot become a
  giveaway.
  - On: off.
  - Earning: 1 point for every whole dollar of items, after any reward. Shipping and tax earn nothing.
  - Reward: 100 points for $5 off.
- **Cost to the shop.** At most 5 cents on every dollar of items, once the points are spent. Points nobody
  spends cost nothing.
- **Earned only on paid orders.** A ledger row never changes. What it is worth is read from its order's status
  each time:
  - Points are on their way while the order is paid, packed or ready.
  - They count once it is shipped or collected.
  - They are gone if it is cancelled or refunded.
  - A reward's points come back if its order is cancelled or refunded.
  - So cancelling or refunding takes points back whichever screen or branch made the change. No hook into the
    back office is needed.
- **Farming is closed.** Points cannot be spent before their order is handed over. Two orders at once cannot
  spend the same points: the spend is a guarded insert inside the order's own transaction (D1 batch).
- **Tax.** The reward comes off the items before tax, because a retailer's own points are a price reduction.
  See ETA s.181(4) and CRA ruling 64981.
- **Points never expire.** There is no expiry code at all. Ontario's Consumer Protection Act bans points
  expiring because of time alone (s.47.1, Protecting Rewards Points Act, 2016). The regulation allows expiry
  for inactivity, and Bill 46 (2025) may move these rules into regulation. Never expiring meets both versions.

## 6. Sources (fetched 2026-11-24)
| Topic | Source | What it supports |
|---|---|---|
| OWASP Authentication | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html | Generic answers, the same timing, per-account throttling |
| OWASP Session Management | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | 64+ bits of entropy, a new ID at sign-in, HttpOnly + Secure + SameSite, server-side logout |
| OWASP Forgot Password | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html | The same message for existing and unknown accounts, random single-use tokens that expire, stored securely, per-account rate limit, no-referrer |
| NIST SP 800-63B-4 | https://pages.nist.gov/800-63-4/sp800-63b.html | 6+ digit codes, 10 minutes, single use, rate limiting. Email codes are low assurance, which is acceptable for reordering. |
| Link scanners | https://docs.descope.com/flows/use-cases/email-scanner | Scanners click links, so finishing needs a button |
| Cloudflare D1 | https://developers.cloudflare.com/d1/worker-api/d1-database/ | Batches are transactions, so all of a batch happens or none does. Prepared and bound statements. |
| D1 indexes | https://developers.cloudflare.com/d1/best-practices/use-indexes/ | Index emails, IDs and dates |
| Workers best practices | https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ | crypto.getRandomValues for secrets, never Math.random |
| PIPEDA principles | https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/ | Limited collection, access, retention |
| OPC retention | https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/gd_rd_201406/ | Destroy what is no longer needed |
| CASL s.6, s.10 | https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html | Consent, sender identification, unsubscribe |
| CASL s.11, s.13 | https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html | Unsubscribe within 10 business days, the sender proves consent |
| ISED CASL guidance | https://fightspam-combattrelepourriel.ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email | Name, mailing address and contact in each message |
| Ontario reward points | https://www.ontario.ca/page/reward-points | No expiry on time alone since 2018. Inactivity is the exception. |
| Bill 46 (2025) | https://www.ola.org/en/legislative-business/bills/parliament-44/session-1/bill-46 | s.47.1 is re-enacted and moves to regulation, on a date not yet named |
| ETA s.181 | https://laws-lois.justice.gc.ca/eng/acts/E-15/section-181.html | A coupon reduces the taxable price |
| Forced accounts | https://baymard.com/blog/make-guest-checkout-prominent | 24% abandon because of forced account creation, so guest checkout stays first |
| Replenishment | https://help.klaviyo.com/hc/en-us/articles/360003195232 | Remind before the supply runs out, and do not badger |
| Simple points | https://www.shopify.com/blog/loyalty-program | 1 point a dollar as the plain starting rule |

Not verified, and not relied on:
- The CRTC page on separate, unticked consent returned 403. The design follows that rule anyway.
- The e-Laws text of CPA s.47.1 and O. Reg. 388/17 could not be fetched. It is taken from the ontario.ca page.

## 7. Merge notes
- **Settings table.** This branch keeps its settings in `account_settings`. backoffice-ops creates its own
  `settings` table, so the two do not collide.
- **Refunds on the payments branch.** Points stop counting when `orders.status` is cancelled or refunded. The
  payments branch records refunds in `pay_status` instead. When the two merge, add
  `OR o.pay_status = 'refunded'` to the two "does not count" tests in `src/loyalty.js` (POINTS and BALANCE).
  That column does not exist on this branch, so it cannot be referenced here.
- **No settings screen yet.** Points have no back-office screen on this branch. The owner turns them on with
  the API. The screen belongs to backoffice-ops.

## 8. Reviews
See the branch report. The breaker's findings and the fixes for them are in the commit messages.
