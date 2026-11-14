# Launching and running a custom-built small online store: security, operations, migration, SEO, accessibility law, support

All sources read 2026-11-14 unless stated. Prices are USD unless marked CAD. "Snippet-level" means the fact came from a search result summary and the page itself was not opened; treat as weaker evidence. COULD NOT VERIFY items say what would confirm them.

## 1. Search and sharing with a hash-routed single page app

### Takeaway
Google says plainly not to use "#/" fragments to load different content, so the current hash routes will not be indexed as separate pages; the least-effort fix that keeps the vanilla build is History API paths plus a Worker that injects per-product title, meta, canonical, Open Graph and JSON-LD into index.html with HTMLRewriter. Separately, Google Merchant Center lists hookahs, pipes and rolling papers by name as not allowed, and Google's product rich result guidelines exclude tobacco and vaping content, so free listings and product rich results are probably closed to much of this catalogue.

### Cited Findings

Indexing of hash routes
- Google: "Don't use fragments to change the content of a page, as Google Search generally doesn't support URL fragments." Recommends the History API instead. - [Google Search Central, URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- Google JavaScript SEO basics: "don't use fragments to load different page content"; "use the History API to implement routing between different views of your web app." - [Google Search Central, JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- Googlebot "queues all pages with a 200 HTTP status code for rendering"; non-200 pages may skip rendering. - [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- Soft 404 in client-routed apps: Google says to either JavaScript-redirect to a URL that returns a real 404, or add a noindex robots meta tag with JavaScript. - [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- Canonical: Google does not recommend setting it with JavaScript ("While we don't recommend using JavaScript for this, it is possible") and says JS must not change a canonical to something other than what the original HTML specified. - [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- JSON-LD may be injected by JavaScript, but for merchant listings Google warns "dynamically-generated markup can make Shopping crawls less frequent and less reliable." - [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics); [Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- Bing: COULD NOT VERIFY. The Bing Webmaster Guidelines page returned no body text to the fetcher (JavaScript-rendered). Secondary, dated sources say Bing recommends pushState URLs that return 200. - [Bing Webmaster Guidelines (unreadable by fetch)](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a); [Search Engine Land on the guideline rewrite](https://searchengineland.com/bing-updates-its-webmaster-guidelines-336915)

Cloudflare Workers mechanics (no framework, no build step)
- `"not_found_handling": "single-page-application"`: when a request matches no file in the assets directory, Workers serves `/index.html` with `200 OK`. - [Workers static assets, SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- With a compatibility date of 2025-04-01 or later (flag `assets_navigation_prefers_asset_serving`), browser navigation requests (`Sec-Fetch-Mode: navigate`) skip the Worker and get the asset; an API route opened directly in a browser returns HTML. - [same page](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- `"run_worker_first": ["/api/*", "!/api/docs/*"]` gives explicit path control and "disables the automatic Sec-Fetch-Mode: navigate detection"; needs Wrangler 4.20.0 or later. - [same page](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- "Requests are only billable if a Worker script is invoked." Static asset requests are free and unlimited on both plans. - [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/); [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- HTMLRewriter is a streaming HTML parser that runs on any Response (including `env.ASSETS.fetch`); `setInnerContent` and `setAttribute` content is HTML-escaped unless `{ html: true }` is passed. - [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)

Options compared

| Option | What changes | Indexable | Shareable (OG per product) | Effort | Notes |
|---|---|---|---|---|---|
| Keep "#/" routes | Nothing | No (Google does not support fragments) | No (fragment never reaches the server) | 0 | Not viable for search |
| History API + SPA fallback only | Router uses real paths; `not_found_handling` set | Only after Google renders JS; unknown URLs return 200 (soft 404 risk) | No, every URL serves the same head | Low | Needs the soft-404 workaround Google describes |
| History API + Worker runs first on product and category paths, HTMLRewriter injects head tags and JSON-LD from D1 | Add `run_worker_first` for those paths; Worker returns real 404 for unknown slugs | Yes, tags are in the first HTML | Yes | Low to medium | Each such page view is a billable Worker invocation plus a D1 read |
| Prerender HTML per product at publish time into assets or R2 | Admin "publish" writes static HTML | Yes | Yes | Medium | Is a build step in practice; stale pages if stock or price changes without republish |

Structured data
- Merchant listing required: Product `name`, `image`, `offers` (must be `Offer`, not `AggregateOffer`); Offer `price` greater than zero and `priceCurrency` (ISO 4217). - [Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- Recommended on Offer: `availability`, `itemCondition`, `priceValidUntil`, `url`, `hasMerchantReturnPolicy`, `shippingDetails`. On Product: `brand.name`, `description`, `sku`, `mpn`, `gtin*`, `hasAdultConsideration`. - [same](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- `shippingDetails` needs `deliveryTime`, `shippingDestination` (`DefinedRegion` with `addressCountry`), and `shippingRate` with `value` or `maxValue` and `currency` matching the offer; `0` for free shipping. `hasMerchantReturnPolicy` needs `applicableCountry` and `returnPolicyCategory`. - [same](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- Images must be crawlable and indexable; Google recommends multiple high-resolution images (at least 50K pixels) in 16x9, 4x3 and 1x1. - [same](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- Product snippet required: `name` plus one of `review`, `aggregateRating`, `offers`. - [Product snippet structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- Product rich result content guideline: "We don't allow content that promotes widely prohibited or regulated goods, services, or information ... This includes content related to firearms and weapons, recreational drugs, tobacco and vaping products, and gambling-related products." - [Product snippet structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- General rule: "Don't mark up content that is not visible to readers of the page." - [Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

Merchant Center policy on smoking accessories (quoted)
- "Ads or listings for tobacco or any products containing tobacco are not allowed." - [Merchant Center, Dangerous products](https://support.google.com/merchants/answer/6150004?hl=en)
- "Ads or listings for products that form a component part of a tobacco product" are not allowed, nor products that directly facilitate tobacco use. Examples given: "rolling papers, pipes, tobacco filters, hookahs". Smoking simulators also barred: "herbal cigarettes, electronic cigarettes, e-cigarettes, e-juice". - [same](https://support.google.com/merchants/answer/6150004?hl=en)
- "Ads or listings for products or services marketed as facilitating recreational drug use are not allowed." - [same](https://support.google.com/merchants/answer/6150004?hl=en)
- Enforcement: violations "will not lead to immediate account suspension without prior warning"; a warning comes at least 7 days before suspension; products can be disapproved. - [same](https://support.google.com/merchants/answer/6150004?hl=en)
- The Shopping policy centre says its policies cover "Shopping ads and listings" and that Google may disapprove listings and suspend accounts for "repeat or egregious violations". - [Merchant Center policy overview](https://support.google.com/merchants/answer/9261529?hl=en)
- A November 2023 Google policy update treats e-juice as a dangerous product for Shopping ads and free listings (snippet-level). - [Policy update: e-juice](https://support.google.com/merchants/answer/14160748)

Google Business Profile
- Website link is edited under Edit profile; enter the full URL with protocol; do not block Googlebot; "We review your changes before we update them live on your profile." Name must match real-world signage. - [Google Business Profile help, edit your profile](https://support.google.com/business/answer/3039617?hl=en)

### Inferences
- Recommended path: move to History API paths (for example `/shop/hookahs`, `/product/<slug>`), set `not_found_handling` to SPA, add `run_worker_first` for product and category paths, and have the Worker inject title, description, `<link rel="canonical">`, Open Graph tags and JSON-LD via HTMLRewriter, returning a real 404 for unknown slugs. This satisfies Google's "canonical in original HTML" and "markup in initial HTML" preferences with no framework and no build step.
- Old "#/..." links: fragments are not sent to the server, so a server 301 is impossible. A few lines of client JS at boot must map `#/x` to `/x` with `history.replaceState`. (Standard HTTP behaviour; not separately sourced.)
- Sitemap and Open Graph images: generate `/sitemap.xml` from D1 in the Worker and point `og:image` at an R2 or transformed image URL. No Google source was fetched for sitemap format or OG image dimensions; see Gaps.
- Because hookahs, pipes and rolling papers are named in the Merchant Center ban, plan on zero Merchant Center free listings for those categories. Categories that are not smoking related (if any) could still be submitted, but a mixed account risks warnings. Organic search results (plain blue links) are not governed by Merchant Center policy.
- Product JSON-LD is still worth shipping for Bing and for accuracy, but do not count on Google product rich results for tobacco-adjacent items given the quoted guideline.
- Local search (Business Profile plus a crawlable site with matching name, address, phone) is likely the highest-value search channel given the Shopping restrictions. This is opinion.

### Gaps
- Bing's current stance on fragments and JS rendering: COULD NOT VERIFY. Confirm by reading the Bing Webmaster Guidelines in a real browser.
- Whether the Merchant Center free listings policy page states identical tobacco rules: the dedicated "Free listings policies" page was not located. The Dangerous products page says "Ads or listings", which reads as covering both. Confirm in Merchant Center help under Free listings.
- Whether glass water pipes sold as "tobacco accessories" are treated under the tobacco rule or the recreational drug rule: the page does not mention bongs.
- Sitemap protocol limits, Open Graph image size guidance, and Google Business Profile category rules for tobacco or smoke shops were not fetched.
- Google page dates: the fetcher could not read last-updated dates on the Search Central pages.

## 2. Migrating from GoDaddy Websites + Marketing

### Takeaway
DNS can move to Cloudflare with email intact if every MX and TXT record is copied and checked before the nameserver switch and DNSSEC is turned off first; the builder has no export, and a godaddysites.com address cannot be relied on for 301 redirects, so rankings on that address are the part most at risk.

### Cited Findings
- Cloudflare scans and imports existing DNS records, but "Since the quick scan is not guaranteed to find all existing DNS records, you need to review your records." For email: "contact your email service provider to confirm your DNS records are correct." - [Cloudflare DNS full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- "If your domain has DNSSEC active, you must turn it off at your registrar before replacing nameservers." "Changing nameservers while DNSSEC is active can cause your domain to become unreachable." - [same](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- "Wait up to 24 hours while your registrar updates your nameservers." Missing records cause `DNS_PROBE_FINISHED_NXDOMAIN`. Mail records are shown as "DNS Only" (not proxied) in Cloudflare's example. - [same](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- GoDaddy Website Builder has no export tool; content must be saved manually (snippet-level, third-party guides). - [WPBeginner, moving off GoDaddy Website Builder](https://www.wpbeginner.com/?p=30680); [Website Planet](https://websiteplanet.com/blog/how-migrate-godaddy-site-wix)
- Connecting a domain to Websites + Marketing "can take a few minutes but can take up to 72 hours"; a custom domain needs a paid plan (snippet-level). - [GoDaddy help, connect my site to a domain](https://www.godaddy.com/help/connect-my-websites-marketing-site-to-a-domain-24748)
- Google site move: "It's important to map your old site's URLs to the URLs for the new site." "We recommend server side permanent redirects from the old URLs to the new URLs." Avoid chains. "Keep the redirects for as long as possible, generally at least 1 year." - [Google, site move with URL changes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- Change of Address tool: "You only need this tool when moving from one domain or subdomain to another." Submit the new sitemap. "A small to medium-sized website can take a few weeks for most pages to move." Expect "temporary fluctuation in site ranking during the move." Update internal, external and profile links. - [same](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- Lost domain login: GoDaddy's Account Recovery has a "Domain Access" option that moves listed domains into an account the requester controls; it needs government ID and an email different from the one on the domain (snippet-level). - [GoDaddy help, regain access to my domain or account](https://www.godaddy.com/help/regain-access-to-my-domain-or-my-godaddy-account-4043)

Migration checklist (built from the above)

| Step | Action | Source basis |
|---|---|---|
| 1 | Find out who the registrant is and who holds the login. If the client is registrant but lacks the login, start GoDaddy Account Recovery (Domain Access) now; it is the long pole | GoDaddy help 4043 |
| 2 | Export first: every page's text, all product names, prices, photos (original files), policies, contact form destination, any customer or subscriber list, order history, connected email settings | No export tool exists |
| 3 | Crawl and list every old URL (both godaddysites.com and custom domain), with titles | Google site move |
| 4 | Verify the old site(s) in Search Console before touching anything, so history and Change of Address are available | Google site move |
| 5 | Add zone to Cloudflare, review imported records line by line against GoDaddy DNS, especially MX, SPF, DKIM, DMARC, autodiscover; keep mail records DNS only | Cloudflare full setup |
| 6 | Turn DNSSEC off at GoDaddy, then switch nameservers; allow up to 24 hours | Cloudflare full setup |
| 7 | 301 every old path to its new path in the Worker; keep at least 1 year | Google site move |
| 8 | Submit new sitemap; update Business Profile website link and other profile links | Google site move; GBP help |

### Inferences
- Typical downtime: none for the web if the Cloudflare zone already holds correct records before the nameserver change; the exposure is email if a record is missed. Cloudflare's "up to 24 hours" is the propagation window, during which both old and new answers may be served.
- If the shop is only on a godaddysites.com address, there is no way known from these sources to 301 it. Practical fallback: leave the old site up briefly with a prominent link to the new domain, change the Business Profile link, then unpublish. Any ranking held by the godaddysites.com URL should be treated as lost and rebuilt. Opinion.
- If the custom domain was already the public address, the domain itself does not change, so this is a same-domain URL change: no Change of Address needed, 301s from old paths are enough.
- Email hosted through GoDaddy (Microsoft 365 or Workspace Email) keeps working after a nameserver move only if its records are recreated in Cloudflare; the email product itself is not tied to GoDaddy nameservers. Confirm with GoDaddy before the switch (Cloudflare says to check with the email provider).
- Simplest low-risk alternative when the login is contested: leave nameservers at GoDaddy and only change the web records to point at Cloudflare. This needs Cloudflare partial (CNAME) setup, which is a paid Business-plan feature as far as memory serves; COULD NOT VERIFY here.

### Gaps
- GoDaddy's own nameserver-change help page returned HTTP 403 to the fetcher, so GoDaddy's stated propagation time and warnings are unquoted. Confirm at godaddy.com/help/edit-my-domain-nameservers-664 in a browser.
- Whether Websites + Marketing supports page-level 301s or any redirect from a godaddysites.com address: zero results from two searches. Confirm with GoDaddy support.
- Whether cancelling Websites + Marketing affects a bundled email plan or the domain registration: not found.
- .ca domains: CIRA registrant rules for recovering a domain registered by a third party were not researched.

## 3. Security for a small store plus owner admin on Cloudflare

### Takeaway
The two things most likely to hurt this shape of app are an admin API that trusts the front end (broken access control, OWASP's number one) and product text rendered with innerHTML; Cloudflare Access is a strong front door but the Worker must still validate the Access JWT itself on every admin request.

### Cited Findings

OWASP Top 10:2025 order: A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging and Alerting Failures, A10 Mishandling of Exceptional Conditions. - [OWASP Top 10:2025](https://top10.owasp.org/2025)

Cloudflare Access and the admin
- "You should validate the token with your public key to ensure that the request came from Access". - [Cloudflare, validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- "We recommend validating the Cf-Access-Jwt-Assertion header instead of the CF_Authorization cookie". Public keys live at `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/certs`. "The aud claim in the token payload specifies which application the JWT is valid for." - [same](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- "By default, Access rotates the signing key every 6 weeks." "Previous keys remain valid for 7 days after rotation". "Validate tokens using the external endpoint rather than saving the public key as a hard-coded value." The Workers example uses the `jose` npm package. - [same](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- Version (preview) URLs on workers.dev are public when enabled and can be put behind Access; identity can be read from the validated JWT. - [Workers previews](https://developers.cloudflare.com/workers/configuration/previews/)
- Zero Trust free plan: $0 for teams under 50 users; pay-as-you-go $7 per user per month (snippet-level from Cloudflare's plans page). - [Cloudflare SASE and Zero Trust plans](https://www.cloudflare.com/plans/sase-zero-trust.md)

CSRF (only relevant where a cookie authenticates)
- "SameSite is useful as a defense-in-depth control but it does not replace a proper CSRF defense". - [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- "Sec-Fetch-Site is the most useful Fetch Metadata header for blocking CSRF-like cross-origin requests", with origin-header verification as mandatory fallback: "If the Origin header is present, verify that its value matches the target origin." - [same](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- Custom request headers are "particularly well suited for AJAX or API endpoints"; APIs should "disallow these simple content types" such as text/plain; `__Host-` cookie prefix recommended with SameSite. - [same](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

XSS in a vanilla JS app
- "The most fundamental safe way to populate the DOM with untrusted data is to use the safe assignment property textContent." "element.setAttribute is only safe for a limited number of attributes." "It is always a bad idea to use a user-controlled input in dangerous sources such as eval." - [OWASP DOM based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- HTMLRewriter escapes inserted content by default (`html: false`). - [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)

Uploads to R2
- "List allowed extensions. Only allow safe and critical extensions"; Content-Type "can be spoofed"; signature check "should not be used on its own"; "Change the filename to something generated by the application."; "Set a file size limit."; "Only allow authorized users to upload files."; store on a different server or outside the webroot; re-encode images, though "Rewriting does not guarantee that all malicious content is removed". - [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

Secrets
- "secret values are not visible within Wrangler or Cloudflare dashboard after you define them." "Do not use vars to store sensitive information". `wrangler secret put` "creates a new version of the Worker and deploys it immediately"; `wrangler versions secret put` creates a version without deploying. ".dev.vars and .env files should not be committed to git." - [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- Secrets are per environment: "secrets are non-inheritable and must be defined per environment." - [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- Stripe: rotate keys before go-live "in case they've been saved somewhere outside of your codebase during development." - [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)

Rate limiting, bots, WAF on the Free plan

| Control | Free plan allowance | Source |
|---|---|---|
| Rate limiting rules | 1 rule, counts by IP only, 10 s counting period, 10 s mitigation timeout | [WAF rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) |
| WAF custom rules | 5 rules, all actions except Log, no regex (Pro: 20 rules) | [WAF custom rules](https://developers.cloudflare.com/waf/custom-rules/) |
| Turnstile | Free; up to 20 widgets per account, 10 hostnames per widget, unlimited challenges | [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/) |

- Turnstile: "You must call the Siteverify API to complete your Turnstile implementation." Endpoint `https://challenges.cloudflare.com/turnstile/v0/siteverify`. "Each token is valid for 300 seconds". "Tokens are intended for single use." Validate hostname and action. - [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

Headers
- The `_headers` file (max 100 rules, 2,000 characters per line) applies only to static asset responses: "Custom headers defined in the _headers file are not applied to responses generated by your Worker code." Cloudflare's example sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy: script-src 'self'; frame-ancestors 'none';`. - [Workers static assets headers](https://developers.cloudflare.com/workers/static-assets/headers/)

What bites this app, as a checklist

| Risk (OWASP 2025) | What the app must do | Source basis |
|---|---|---|
| A01 Broken access control | Every `/api/admin/*` handler validates the Access JWT (signature, `aud`, expiry) server side; never rely on the admin UI being hidden; put admin API and admin pages under the same Access application | Cloudflare validating JWTs |
| A05 Injection | D1 queries through prepared statements with bound parameters only; no string-built SQL | See Gaps (D1 prepared statement doc not fetched) |
| A05 XSS | Product names and descriptions rendered with `textContent`; no `innerHTML` with database text; validate URLs before use in `href`/`src` | OWASP DOM XSS sheet |
| CSRF | If any cookie authenticates a write: check `Origin` and `Sec-Fetch-Site`, require JSON content type and a custom header, `__Host-` cookie with SameSite | OWASP CSRF sheet |
| Uploads | Admin only, allowlist jpg/png/webp, size cap, magic-byte check, server-generated key, serve from a separate hostname; exclude SVG | OWASP File Upload sheet (SVG exclusion is inference) |
| A02 Misconfiguration | CSP and security headers in both `_headers` and Worker responses; version URLs disabled or behind Access; secrets not in `vars` | Cloudflare headers, previews, secrets |
| A03 Supply chain | No build step means few dependencies; any script loaded from a CDN should be self-hosted or pinned with integrity; `jose` for JWT validation is the one likely dependency | OWASP Top 10 A03; inference |
| A09 Logging | Append-only audit table of admin changes (who, when, what, before and after), plus Workers Logs | OWASP Top 10 A09; inference |
| A10 Exceptional conditions | API returns generic errors, logs detail server side; Stripe says handle "all possibilities" | Stripe go-live checklist |
| Abuse | Turnstile on contact, checkout and any login; one rate limit rule on the most abusable API path | Turnstile, WAF docs |

### Inferences
- Access covers who can reach the admin hostname or path. It does not cover: a Worker route that is reachable by another hostname (workers.dev, version URLs), per-action authorisation, or audit. Disable or protect workers.dev and version URLs for the production Worker.
- With Access issuing the identity, the app may not need its own password or session system at all, which removes most A07 authentication risk. The audit log should record the email claim from the validated JWT.
- The Free plan's single rate limiting rule with a 10 second window is thin; anything finer (per-email attempt limits, per-order limits) has to be done in the Worker with D1 or the Workers rate limiting binding. The binding was not verified in this pass.
- If payments go through a hosted checkout (card data never touches the Worker), PCI scope stays minimal. Not sourced here; confirm against the payment provider's PCI guidance.

### Gaps
- D1 prepared statement documentation (`prepare().bind()`) was not fetched; the SQL injection row rests on general practice. Confirm at developers.cloudflare.com/d1/worker-api/prepared-statements/.
- OWASP Top 10:2025 release status (final versus candidate) and date were not stated on the page read.
- Cloudflare Access free-tier feature list and the 50-user limit are snippet-level; confirm on the Zero Trust plans page.
- Free plan bot features (Bot Fight Mode) and managed WAF ruleset availability were not verified.
- No source was fetched on SVG upload risk or on Subresource Integrity.

## 4. Backups, recovery, monitoring and alerting

### Takeaway
D1 Time Travel gives point-in-time restore for 7 days on Free and 30 days on Paid, but a restore overwrites the live database and the feature cannot clone, so a scheduled SQL export to R2 is the real backup; alerting on the Free plan is weak (no health checks, no error-rate alerts), so an external uptime check and an error tracker fill the gap.

### Cited Findings

D1 Time Travel
- Retention: Workers Paid "up to 30 days in the past"; Workers Free 7 days. - [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- Commands: `wrangler d1 time-travel info <DB>`, `wrangler d1 time-travel restore <DB> --timestamp=...` or `--bookmark=...`; remote databases only. - [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/); [Wrangler d1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
- "Restoring a database to a specific point-in-time is a destructive operation". It overwrites in place, cancels in-flight queries, and returns a bookmark that can undo the restore. Cloning or forking a database is not available yet. - [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- For retention beyond the window, Cloudflare points to exporting D1 to R2 with the REST API and Workflows. - [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/); [Export and save D1 database guide](https://developers.cloudflare.com/d1/examples/export-d1-into-r2/)

D1 export
- `npx wrangler d1 export <database_name> --remote --output=./database.sql`; flags `--table`, `--no-data`, `--no-schema`. - [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- "A running export will block other database requests." "Export is not supported for virtual tables". Large int64 values can lose precision. - [same](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

Costs

| Item | Free | Paid | Source |
|---|---|---|---|
| Workers | 100,000 requests/day, 10 ms CPU per invocation | $5/month minimum per account; 10 million requests and 30 million CPU ms included; $0.30 per extra million requests | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Static asset requests | Free, unlimited | Free, unlimited | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 | 5 million rows read/day, 100,000 rows written/day, 5 GB total, 10 databases | 25 billion rows read and 50 million rows written per month included; 5 GB included then $0.75 per GB-month | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| R2 Standard | 10 GB-month, 1 million Class A, 10 million Class B per month; egress free | $0.015 per GB-month; $4.50 per million Class A; $0.36 per million Class B | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Workers Logs (until 2026-11-30) | 200,000 events/day, 3-day retention | 20 million events/month included, then $0.60 per million, 7-day retention | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Observability (from 2026-12-01) | 0.5 GB ingestion/day, 7-day retention | 50 GB ingestion per cycle, 10 GB-month storage; extra $0.25 per GB ingested, $0.10 per GB-month | [Cloudflare Observability pricing](https://developers.cloudflare.com/observability/pricing/) |
| Workers Logpush | Not available | 10 million requests/month, then $0.05 per million | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Standalone Health Checks | Not available (0) | Zone plan Pro: 10 checks; Business: 50 | [Cloudflare Health Checks](https://developers.cloudflare.com/health-checks/) |
| Sentry | Developer: 5k errors, 1 user, 30-day lookback | Team: $29/month ($26 annual), 50k errors, unlimited users, up to 90-day lookback | [Sentry pricing](https://sentry.io/pricing/) |

R2 protection
- Bucket locks block deletion and overwriting of objects for a set period or indefinitely, apply to new and existing objects, and override lifecycle rules (snippet-level). - [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
- Lifecycle rules delete objects after a set number of days or abort stale multipart uploads; up to 1,000 rules per bucket (snippet-level). - [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles)

Notifications available on all plans: HTTP DDoS attack alert, Universal SSL alert, Cloudflare incident alerts, maintenance notifications, image transformation quota alert, Web Analytics weekly summary. Not on Free: Health Check status (Pro or higher), origin error rate alerts (Enterprise), usage-based billing alert (Pro or higher and pay-as-you-go accounts). - [Cloudflare notifications available](https://developers.cloudflare.com/notifications/notification-available/)

Version URLs have no logs: logs for them cannot be viewed through Workers Logs, `wrangler tail` or Logpush. - [Workers previews](https://developers.cloudflare.com/workers/configuration/previews/)

### Inferences
- Realistic recovery plan for one developer:

| Layer | Mechanism | Covers | Test |
|---|---|---|---|
| Minutes to days | D1 Time Travel restore to a timestamp | Bad migration, bad admin edit, accidental delete | Run against the staging database quarterly; note the undo bookmark |
| Days to months | Nightly `d1 export` SQL file to a separate R2 bucket with a bucket lock (for example 30 to 90 days) and a lifecycle rule to expire old dumps | Anything older than 7 or 30 days; account-level mistakes | Monthly: import the latest dump into a fresh D1 database and compare row counts |
| Photos | Product photos in R2 under server-generated keys that are never overwritten; bucket lock on the photo bucket | Accidental delete or overwrite | Spot-check by deleting a test object |
| Off-platform | Monthly copy of the SQL dump and photo bucket to storage outside the Cloudflare account | Account lockout or billing suspension | Open the copy |
| Code | Git remote is the source of truth; `wrangler rollback` for the Worker | Bad deploy | See section 5 |

- Because export blocks other database requests, schedule it for the quietest hour. With a small catalogue this should be brief, but no duration figure was found.
- R2 object versioning: COULD NOT VERIFY that it exists or does not; one search found bucket locks and lifecycle rules only. Design around immutable keys plus bucket locks, which does not depend on versioning.
- Paid Workers ($5/month) is worth it for this store on the Time Travel difference alone (30 days versus 7), and it also unlocks Logpush.
- Minimum monitoring on the Free zone plan: an external uptime ping against a `/health` route that reads D1, Sentry free tier (or Workers Logs queries) for exceptions, and the free Universal SSL and incident notifications. An external uptime service was not priced in this pass.

### Gaps
- The D1-to-R2 export guide body did not load; the required API token permission and Workflow details are unconfirmed. Confirm at the guide URL.
- No official statement found on R2 object versioning. Confirm via developers.cloudflare.com/r2/llms.txt.
- Sentry's Workers SDK setup and whether it needs a build step were not checked.
- Notification delivery methods (email, webhook) per plan were not stated on the page read.
- Cloudflare's stated D1 durability or SLA was not researched.

## 5. Environments and release safety without a build step

### Takeaway
Wrangler supports a separate staging Worker with its own D1 and secrets, uploading a version without deploying it, splitting traffic, and one-command rollback; none of that rolls back the database, so migrations must be backward compatible and applied before the code that needs them.

### Cited Findings
- Environments: `[env.staging]` and `[env.production]` in the Wrangler config; each becomes a separate Worker named `<top-level-name>-<environment-name>`; "bindings and environment variables are non-inheritable, and must be specified per environment"; deploy with `npx wrangler deploy --env staging`. Environment names become public through certificates. - [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- D1 migrations: `.sql` files in `migrations/`, applied in order and recorded in a `d1_migrations` table; `wrangler d1 migrations create|list|apply <DATABASE>` with `--local` or `--remote`; apply asks for confirmation, and in CI the prompt is skipped "but a backup is still captured"; if a migration errors, that migration is rolled back. No down migrations are described. - [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/); [Wrangler d1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
- `wrangler versions upload` creates "a new version of the Worker that is not automatically deployed"; `wrangler versions deploy` sets the traffic split. Needs Wrangler 3.40.0 or later. Only the last 100 uploaded versions can be used. - [Gradual deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)
- "By default, each request is independently routed to a version based on the configured percentages", so one visitor's page and asset requests can hit different versions; version affinity pins requests with the same key. - [same](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)
- Version URLs: `<version-prefix>-<worker-name>.<subdomain>.workers.dev`; stable alias with `wrangler versions upload --preview-alias staging`; "A Version URL uses that Worker version's existing configuration and resources instead of creating a separate environment."; public when enabled; cannot run on a custom domain; not generated for Workers with Durable Objects. - [Workers previews](https://developers.cloudflare.com/workers/configuration/previews/)
- Rollback: "A rollback creates a new deployment set to 100% of traffic for the selected version." "You can only roll back to the 100 most recently published versions." "Resources connected to your Worker will not be changed during a rollback." "Errors could occur if using code for a prior version if the structure of data has changed." - [Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
- `wrangler secret put` deploys immediately; `wrangler versions secret put` does not. - [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

### Inferences
- Version URLs of the production Worker use production bindings (the docs say "existing configuration and resources"). So a version URL is a look at new code against live data, not a safe sandbox. Use a real staging environment with its own D1 database and R2 bucket for anything that writes.
- Release routine that fits one developer with no build step:
  1. Apply migration to staging D1, deploy staging, run end-to-end tests against the staging URL.
  2. Apply migration to production D1 (additive only: new tables and columns, no drops or renames in the same release).
  3. `wrangler versions upload`, open the version URL, click through.
  4. `wrangler versions deploy` at 100 percent (a split is of little value at this traffic level and introduces asset version skew).
  5. If wrong: `wrangler rollback`. If data is wrong: Time Travel restore to the bookmark taken before step 2.
- Feature flags: no Cloudflare-specific flag product was researched. A `settings` table in D1 or a plain `vars` entry per environment is the smallest thing that works. Opinion.
- End-to-end tests: Playwright against the staging URL is the usual choice and needs no build step in the app itself; not sourced in this pass.

### Gaps
- No Cloudflare source was fetched on "Previews" for branches or pull requests (the previews page mentions it as a separate feature).
- The "Version skew and static assets" page was not read.
- Whether the automatic backup on `migrations apply` is a Time Travel bookmark was not stated.
- CI options (Workers Builds, GitHub Actions) and their costs were not researched.

## 6. Performance targets for mobile e-commerce

### Takeaway
The 2026 targets are unchanged: LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less, each at the 75th percentile of real visits on mobile; in a store the hero or product image is almost always the LCP element and the thing to fix first.

### Cited Findings
- "LCP should occur within 2.5 seconds of when the page first starts loading."; "pages should have a INP of 200 milliseconds or less."; "pages should maintain a CLS of 0.1. or less."; measure at the "75th percentile of page loads, segmented across mobile and desktop devices." Page last updated 2024-10-31. - [web.dev, Web Vitals](https://web.dev/articles/vitals)
- LCP: make the LCP resource discoverable in the HTML source, use `fetchpriority="high"`, do not lazy-load it; use a CDN to improve TTFB; aim for instant navigations (bfcache, speculation). - [web.dev, top Core Web Vitals recommendations](https://web.dev/articles/top-cwv)
- INP: yield to break up tasks over 50 ms; avoid unnecessary JavaScript; avoid large rendering updates and keep the DOM small. - [same](https://web.dev/articles/top-cwv)
- CLS: set explicit sizes or aspect ratios on images and reserve space for late content; stay bfcache eligible (no `unload` listeners, no `no-store`); animate `transform`, not layout properties. - [same](https://web.dev/articles/top-cwv)
- Cloudflare image transformations: 5,000 unique transformations per month free; Paid includes 5,000 then $0.50 per 1,000. Over the free limit, cached transformations keep serving and new ones return error 9422; no charge on Free. A free notification exists for the quota. - [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/); [Notifications available](https://developers.cloudflare.com/notifications/notification-available/)
- Early Hints is on all plans including Free; enabled under Speed > Settings > Content Optimization; needs `Link` headers with preload or preconnect; only for HTML-like URLs with 200, 301 or 302 responses, over HTTP/2 and HTTP/3. - [Cloudflare Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/)
- Workers static assets default to `Cache-Control: public, max-age=0, must-revalidate` with an ETag unless overridden in `_headers`. - [Workers static assets headers](https://developers.cloudflare.com/workers/static-assets/headers/)

### Inferences
- A client-rendered SPA hides the LCP image from the HTML source, which is exactly what web.dev warns against. Injecting the main product image as an `<img>` or a `<link rel="preload" as="image">` via HTMLRewriter fixes discoverability and also feeds Early Hints.
- Budget the 5,000 free unique transformations: each photo times each width times each format counts. With, say, 200 products, 4 photos, 3 widths, that is 2,400 (assumed numbers for illustration). Alternatively resize once at upload in the admin and store fixed variants in R2, which costs nothing per view.
- Fingerprinted asset filenames need a build step; without one, keep the default revalidate behaviour or version the path by hand (`/v12/app.js`) and set a long `max-age` in `_headers`.
- A decorative smoke animation is an INP and CLS risk if it runs on the main thread or animates layout properties; keep it to `transform` and `opacity`, pause it off-screen, and honour reduced motion (see section 7).

### Gaps
- "Needs improvement" and "poor" boundaries (commonly 4 s, 500 ms, 0.25) were only in images on the web.dev page and are unquoted here.
- No font-loading guidance was on the page read; web.dev's font best practices were not fetched.
- Cloudflare cache rules for Worker-generated HTML were not researched.

## 7. Accessibility law for an Ontario business website

### Takeaway
AODA's website rule (WCAG 2.0 AA) binds public sector bodies and businesses with 50 or more employees, so a small single-location shop is very likely outside it, and the federal Accessible Canada Act covers federally regulated sectors, not provincial retail; building to WCAG 2.2 AA anyway is cheap at this stage and is the sensible bar.

### Cited Findings
- "As of January 1, 2021, the AODA requires you to make all public websites accessible if you are either:" a designated public sector organization or "a business or non-profit organization with 50 or more employees". The organisation that controls the site, directly or by contract, is responsible. - [Ontario, How to make websites accessible](https://www.ontario.ca/page/how-make-websites-accessible)
- Standard: "the WCAG 2.0 Level AA success criteria, except for" 1.2.4 (live captions) and 1.2.5 (pre-recorded audio descriptions). Applies to "websites and web content published on a website after January 1, 2012." Intranets are excluded. The page says it is not legal advice. - [same](https://www.ontario.ca/page/how-make-websites-accessible)
- Accessible Canada Act applies to "organizations under federal responsibility": the Government of Canada, and "parts of the private sector that the Government of Canada regulates" such as banks, the federal transportation network, and broadcasting and telecommunications. Provincial retail is not named. - [Canada.ca, Accessible Canada Act summary](https://www.canada.ca/en/employment-social-development/programs/accessible-canada/act-summary.html)
- WCAG 2.2 new criteria at A and AA: 2.4.11 Focus Not Obscured (Minimum) AA; 2.5.7 Dragging Movements AA; 2.5.8 Target Size (Minimum) AA; 3.2.6 Consistent Help A; 3.3.7 Redundant Entry A; 3.3.8 Accessible Authentication (Minimum) AA. - [W3C WAI, What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- 2.5.8: "The size of the target for pointer inputs is at least 24 by 24 CSS pixels, except where:" Spacing (a 24 px circle centred on each undersized target does not intersect another target), Equivalent, Inline, User agent control, Essential. - [same](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- Turnstile states WCAG 2.2 AAA compliance on all plans. - [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)

Practical WCAG 2.2 AA items for the store (criteria numbers from W3C; application is inference)

| Area | Check |
|---|---|
| Focus | Visible focus on every control; sticky header, cart drawer and cookie banner never fully cover the focused element (2.4.11); focus moves into and back out of drawers and dialogs |
| SPA routing | On route change, move focus to the new page heading and update `document.title`, since no page load announces it |
| Target size | Quantity steppers, variant swatches, close buttons, pagination at least 24 by 24 CSS px or spaced per the exception (2.5.8) |
| Dragging | Any carousel or slider works with buttons, not swipe only (2.5.7) |
| Contrast | Text 4.5:1, large text and UI components 3:1 (WCAG 2.x AA; not re-fetched) |
| Motion | Smoke animation stops or simplifies under `prefers-reduced-motion`; anything moving over 5 seconds can be paused (WCAG 2.2.2; not re-fetched) |
| Forms | Labels, error text tied to the field, errors described in words; checkout does not ask for the same address twice (3.3.7) |
| Authentication | Admin sign-in allows paste and password managers (3.3.8) |
| Help | Contact link in the same place on every page (3.2.6) |

### Inferences
- A shop with under 50 employees has no AODA website obligation on the wording read. The Ontario Human Rights Code duty to accommodate is widely described as applying regardless of size, but the OHRC page for this returned 404, so that point is unsourced here.
- Age gating for tobacco-adjacent products interacts with 3.3.8 only if it is a login step; a simple birth-date or yes/no confirmation is not a cognitive function test. Opinion.

### Gaps
- Ontario Human Rights Code applicability to small business websites: COULD NOT VERIFY (OHRC URL 404). Confirm on ohrc.on.ca.
- AODA penalties and the compliance-report requirement for 20+ employee organisations were not on the page read.
- Contrast and motion criteria were not re-fetched from the WCAG 2.2 text.
- Ontario and federal rules on online sale, age verification and promotion of tobacco accessories were out of scope here and not researched; this is a launch risk someone should check.

## 8. Privacy and legal pages

### Takeaway
A Canadian store needs a plain-language privacy policy that names an accountable person with contact details, says what is collected, why, and who it is shared with; selling to Quebec adds a published privacy officer, off-by-default tracking, and an incident register; and under PIPEDA the shop, not the studio hosting it, carries the breach duties because it controls the data.

### Cited Findings
- PIPEDA applies to "private-sector organizations across Canada that collect, use, or disclose personal information" in the course of commercial activity. Ten principles: Accountability, Identifying purposes, Consent, Limiting collection, Limiting use, disclosure, and retention, Accuracy, Safeguards, Openness, Individual access, Challenging compliance. - [OPC, PIPEDA in brief](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)
- Openness: information-handling practices must be clear, easy to understand and readily available, including the name or title and contact information of the person accountable (snippet-level). - [OPC, Openness principle](https://priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_openness/)
- Breaches: organisations must "report to the Privacy Commissioner of Canada breaches of security safeguards" that pose a real risk of significant harm, notify affected individuals "as soon as feasible", notify organisations that can reduce the harm, and "keep breach records of all breaches of security safeguards for two years" whether or not they meet the harm threshold. Knowing contravention is an offence that can lead to fines. - [OPC, What you need to know about mandatory reporting of breaches](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)
- Responsibility with a processor: it is reasonable to "interpret the principal organization as having control of the personal information" when a processor holds it; the principal should have sufficient contracts with the processor; a processor that uses the data for its own purposes may itself be in control. - [same](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)
- Quebec Law 25 (CAI summary, French, translated):
  - Whoever operates a business is responsible for personal information; the role can be delegated in writing; the title and contact details of the person in charge must be published on the website.
  - Notify the CAI and affected people of any confidentiality incident posing a risk of serious harm; keep an incident register.
  - Publish a privacy policy in plain language and notify of changes.
  - Since September 2023, consent must be requested for each purpose in clear terms.
  - Technologies that identify, locate or profile "ne pourront être activées par défaut" (cannot be on by default).
  - A privacy impact assessment is required before communicating personal information outside Quebec, and for projects to acquire, develop or overhaul an information system involving personal information.
  - Administrative penalties up to 2 percent of worldwide turnover or $10 million.
  - [CAI, Principaux changements Loi 25](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25)

Privacy policy contents checklist (from the above)

| Item | Basis |
|---|---|
| Who is accountable: title and contact details, published | PIPEDA openness; Law 25 |
| What is collected (name, address, email, phone, order contents, IP, age confirmation if used) and why | PIPEDA identifying purposes |
| Who it is shared with: payment processor, carriers, Cloudflare as host, email provider; that data may be stored outside Canada and Quebec | PIPEDA openness; Law 25 transfer assessment |
| Consent, and how to withdraw it; analytics that profile are off until chosen | Law 25 |
| Retention periods | PIPEDA limiting retention |
| How to request access or correction, and how to complain | PIPEDA individual access, challenging compliance |
| How changes to the policy are announced | Law 25 |

Hosting on the studio's account versus the client's

| Question | Studio's Cloudflare account | Client's Cloudflare account |
|---|---|---|
| Who controls the data in law | Client still controls it; studio is a processor and needs a written agreement | Client controls it; studio is a delegated user |
| Breach duties | Client reports and notifies; studio must tell the client fast and help | Same, with less dependence on the studio |
| Billing | Studio pays Cloudflare and passes it through | Client's card on file |
| If the studio disappears | Client has no access to its own store | Client keeps everything; revokes the studio's access |

- [OPC breach guidance for the control point](https://www.priv.gc.ca/en/privacy-topics/business-privacy/breaches-and-safeguards/privacy-breaches-at-your-business/gd_pb_201810/)

### Inferences
- Simplest Law 25 posture for analytics: use cookieless, non-profiling analytics (Cloudflare Web Analytics is the obvious candidate, not verified here) and no ad pixels, which avoids a consent banner. If any profiling tag is added later, it must be opt-in for Quebec visitors.
- The store's data sits on Cloudflare's global network, so a Quebec customer's data leaves Quebec; a short written privacy impact assessment and a data processing agreement with Cloudflare cover the transfer rule. D1 location hints or jurisdiction options were not researched.
- Other pages a Canadian store normally publishes: terms of sale, shipping, returns and refunds, contact. Shopify's launch checklist lists these as essential pages (see section 10).

### Gaps
- The OPC's detailed "what to put in a privacy policy" guide URL returned 404; the policy checklist above is assembled from the principles and the snippet-level openness page.
- Law 25 effective dates for each obligation were not all on the CAI page (only September 2023 for consent and transfers was stated).
- CASL (commercial email consent) was not researched; it applies to marketing email and order follow-ups.
- Ontario consumer protection rules for online sales (disclosure, cancellation rights) were not researched.
- Whether Law 25 applies to an Ontario business selling to Quebec residents is assumed by the brief and was not separately sourced.

## 9. Ownership and support model for a one-person studio

### Takeaway
Every account that would stop the store if the developer vanished (domain, Cloudflare, payments, carriers, Business Profile, Search Console) should be owned by the client with the developer added as a user; Canadian agency pages put e-commerce care plans roughly in the CAD 400 to 900 per month range, though these are vendor blog figures, not survey data.

### Cited Findings
- Legal commentary: "If the developer sets up the hosting account in their own name, you may not have control over your own website. The same goes for domain names, analytics accounts, email systems, payment gateway access and content management system logins." (snippet-level; Australian law firm) - [Sprintlaw, website development agreement](https://www.sprintlaw.com.au/articles/website-development-agreement)
- Common clause: ownership of final deliverables transfers only once all fees are paid in full; third-party and open-source components are licensed, not assigned, so "a mix of assignment and licence" is usual (snippet-level; UK and Australian law firm articles). - [Sprintlaw UK, web development contract key terms](https://www.sprintlaw.co.uk/articles/web-development-contract-in-the-uk-key-terms-to-include); [LegalVision, considerations for website developers](https://legalvision.com.au/considerations-website-developers)
- Hosting is often put in a separate agreement from the build (snippet-level). - [Klemchuk, website development agreement essentials](https://www.klemchuk.com/ideate/website-development-agreement-essentials)
- Client-side advice: make final payment only after full access to hosting admin and registrar control; a 7 to 14 day acceptance window is suggested (snippet-level; agency and freelancer blogs). - [William Alexander, website contracts what to look for](https://williamalexander.co/articles/website-contracts-what-to-look-for/); [eSEOspace, who owns the code](https://eseospace.com/blog/who-owns-the-code-website-contract-clauses/)
- Care plan prices in Canada (all snippet-level, vendor blogs, CAD):
  - Toronto agency tiers: 400/month (updates, backups); 900/month (3 hours of changes, monitoring, 48-hour response); 2,000/month (8 hours, 4-hour response, SEO report). - [Kolonell, care plan tiers Toronto 2026](https://kolonell.com/en/blog/website-care-plan-tiers-sla-toronto-agency-2026)
  - E-commerce cited at 400 to 800/month because of catalogue, payments and stricter response terms. - [Kolonell, maintenance retainer pricing Toronto 2026](https://kolonell.com/en/blog/website-maintenance-retainer-pricing-toronto-2026)
  - General ranges of 150 to 600+ (small agency) and 600 to 2,000+ (high-traffic or e-commerce) per month. - [Right Design, how much does a website care plan cost](https://rightdesign.ca/faq-items/how-much-does-a-website-care-plan-cost/) (attribution of this range to this page is uncertain; it came from a combined search summary)
  - Hosting is commonly billed separately from the base tier. - [Kolonell, maintenance cost per year Montreal 2026](https://kolonell.com/en/blog/website-maintenance-cost-per-year-what-you-get-montreal-2026)
- Typical inclusions listed across those pages: updates, backups, security, small content edits, basic performance work, monitoring, a block of change hours. - [Kolonell, maintenance plan tiers compared Toronto 2026](https://kolonell.com/en/blog/website-maintenance-plan-tiers-compared-toronto-2026)

### Inferences (opinion, labelled)

Where each account should live

| Account | Owner | Developer's role | Why |
|---|---|---|---|
| Domain registrar | Client | Delegate or DNS-only via Cloudflare | Section 2 shows how painful a lost login is |
| Cloudflare account (zone, Workers, D1, R2, Access) | Client | Member with admin role | Client keeps the store and the data if the relationship ends; aligns with PIPEDA control |
| Payment processor | Client (it is their merchant account and bank) | Developer or restricted key | Money and KYC are the client's |
| Carrier accounts | Client | API key stored as a Worker secret | Billing is the client's |
| Google Business Profile, Search Console | Client | Manager or delegated owner | Tied to the business identity |
| Code repository | Studio until paid, then transferred or mirrored to the client | Maintainer | Matches the "assign on final payment" clause |
| Error tracking, uptime monitor | Studio | Owner | These are the studio's tools for delivering support |

What a custom-store care plan covers that plugin-site plans do not: restore tests, dependency and Wrangler compatibility-date bumps, Cloudflare bill watching, Access user changes, Search Console checks, and a named response time. Plugin updates, the bulk of WordPress care plans, do not apply.

Bus-factor pack the client should hold: list of every account and who owns it; repository access; a one-page runbook (deploy, rollback, restore, rotate a secret); where secrets live (never the values in a document); the latest database dump location; the data processing and hosting terms.

Response-time wording seen in the sources is 48 hours on a mid tier and 4 hours on a top tier. A solo developer should promise a response time, not a fix time, and state business hours.

Contract terms to settle: IP assignment on final payment with a licence-back for reusable studio code; hosting and third-party fees passed through at cost in the client's own accounts; liability capped (commonly at fees paid; no detailed source found); the client is responsible for product legality and content; an exit clause with a handover checklist; a breach-notification duty on the studio as processor.

Owner training: one short session plus a written or recorded walkthrough of add product, edit price and stock, upload photos, mark an order shipped, and "what to do if something looks wrong" with the developer's contact.

### Gaps
- No Canadian legal source (for example a Canadian law firm or a Canadian design association contract) was found for IP, liability caps or hosting clauses; the cited firms are Australian and UK. Canadian copyright defaults for contractor-written code were not verified.
- No survey-grade data on Canadian care plan pricing; all figures are vendor blogs and several are from one publisher.
- No sourced benchmark for liability cap size or for response times specific to e-commerce outages.
- No source on training length or documentation standards for client handover.

## 10. Pre-launch and first-30-days checklists

### Takeaway
Stripe's and Shopify's own launch lists, web.dev's vitals guidance and Cloudflare's docs together cover a custom build well once the platform-specific items are swapped for their Workers equivalents; the items most often missed are a tested restore, real 404s, key rotation, and the old-URL redirect map.

### Cited Findings
- Stripe go-live items: set the API version; handle edge cases (incomplete, invalid, duplicate data) and have a non-developer test; review API error handling; review logging and keep sensitive data out of logs; do not rely on test objects; register production webhooks that handle delayed, duplicate and out-of-order events; subscribe to API announcements; rotate and secure API keys before going live. - [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- Shopify launch items relevant to a custom build: custom domain; tax and shipping rates; fulfilment process; essential pages (home, contact, about, FAQ, shipping and returns, legal policies); content audit for broken links, 404s and device issues; SEO basics with a sitemap and site speed; image optimisation with alt text; audit automated emails (order confirmation and others); test the checkout with real purchases covering shipping, discounts, payment methods and notifications; visible contact options; analytics and tracking. - [Shopify store launch checklist](https://www.shopify.com/blog/shopify-store-launch-checklist)
- Supporting rules cited in earlier sections: Google site move (redirects, sitemap), Cloudflare full setup (DNS review, DNSSEC), Time Travel and export, Access JWT validation, Turnstile Siteverify, Core Web Vitals thresholds.

Pre-launch checklist (adapted)

| # | Item | Source |
|---|---|---|
| 1 | Routes are real paths; each product and category URL returns its own title, description, canonical, OG tags and JSON-LD in the first HTML | Google JS SEO basics |
| 2 | Unknown URLs return a real 404, not index.html with 200 | Google JS SEO basics |
| 3 | `/sitemap.xml` and `robots.txt` live; Search Console verified for old and new sites | Google site move |
| 4 | Old URL map built; 301s in place; "#/" links rewritten client side | Google site move |
| 5 | DNS records reviewed against the old zone, email tested, DNSSEC handled | Cloudflare full setup |
| 6 | Admin behind Access and every admin API validates the Access JWT; workers.dev and version URLs disabled or protected | Cloudflare Access, previews |
| 7 | No `innerHTML` with database text; CSP and security headers on both asset and Worker responses | OWASP DOM XSS; Cloudflare headers |
| 8 | Upload validation in place; Turnstile verified server side; one rate limit rule set | OWASP uploads; Turnstile; WAF |
| 9 | Secrets set per environment; payment keys rotated; no keys in the repository | Workers secrets; Stripe |
| 10 | Live webhooks registered; handler is idempotent and order independent | Stripe |
| 11 | Real test orders: each shipping zone, tax by province, declined card, refund, confirmation email | Shopify; Stripe |
| 12 | Nightly D1 export running and one restore rehearsed end to end; Time Travel restore tried on staging | D1 Time Travel, export |
| 13 | Staging environment with its own D1 and R2; rollback command rehearsed | Wrangler environments; rollbacks |
| 14 | LCP 2.5 s, INP 200 ms, CLS 0.1 checked on a mid-range phone at 390 px; LCP image in HTML with `fetchpriority` | web.dev |
| 15 | WCAG 2.2 AA pass: focus, target size, contrast, reduced motion, form errors | W3C |
| 16 | Privacy policy with named contact, terms, shipping, returns, contact page published | OPC; CAI; Shopify |
| 17 | Error tracking and an uptime check wired to the developer's phone or email | Section 4 |
| 18 | Business Profile website link updated; name, address, phone match the site | GBP help |
| 19 | Owner trained; accounts in the client's name; runbook handed over | Section 9 |
| 20 | Merchant Center decision recorded (smoking accessories are not allowed) | Merchant Center policy |

First 30 days

| When | Item | Source |
|---|---|---|
| Day 1 to 2 | Watch errors and logs; place a real order; confirm email deliverability | Stripe (logging); Shopify |
| Week 1 | Search Console: coverage of new URLs, soft 404 reports, sitemap read; fix any 404s from the old URL list | Google site move |
| Week 1 | Confirm the nightly export file exists and opens; check Cloudflare usage against plan limits | D1 export; pricing pages |
| Week 2 | Review Access logs and the admin audit table; review rate limit and Turnstile analytics (7-day lookback on free Turnstile) | Turnstile plans |
| Week 2 to 4 | Expect "temporary fluctuation in site ranking"; most pages of a small site move within "a few weeks" | Google site move |
| Week 4 | Field Core Web Vitals check; restore drill; owner check-in on the admin; decide what goes on the care plan | web.dev; Section 4, 9 |
| Ongoing | Keep redirects at least 1 year; keep breach records 2 years | Google site move; OPC |

### Inferences
- "Commonly missed" list for this specific build, in order of likely damage: (1) admin API trusting the UI; (2) hash URLs left in place so nothing is indexed; (3) index.html served with 200 for every unknown URL; (4) no tested restore; (5) Version URLs or workers.dev exposing the admin or staging without Access; (6) `_headers` not applying to Worker-generated HTML, so product pages ship without CSP; (7) Merchant Center submission triggering policy warnings; (8) email breaking at the nameserver switch; (9) accounts left in the developer's name; (10) no privacy officer contact on the site for Quebec customers.
- Monthly running cost floor on Cloudflare for this store: $0 on Free, $5 on Workers Paid, with D1, R2, Turnstile, Access (under 50 users) and Early Hints inside free allowances at small-shop volumes. Payment processing and carrier fees were not researched.

### Gaps
- Payment provider, tax (GST/HST/PST/QST collection across provinces) and carrier-specific launch requirements were outside this brief and are not covered.
- No Cloudflare-published "production readiness" checklist was located; the Cloudflare rows are assembled from individual product docs.
- Rules on selling and shipping tobacco-adjacent products across provinces, and payment-processor restrictions on this product category, were not researched and could block launch.
