// The preview's open edit switch (owner, 2026-11-27: "Remove the admin key for right now, have it so the preview site itself
// allows it and before launch we will lock things up"). ONE Worker setting, PREVIEW_OPEN_EDIT, never written in wrangler.jsonc:
// it is set on the demo only at deploy time (wrangler deploy --var PREVIEW_OPEN_EDIT:items). Without it everything is as before.
//   "items": anyone can fill in an item's name, colours, shelf count and price (the item editor's own fields, through
//            /api/open-edit/<sku>, from the item's page). Orders, customers, staff, settings and every other back office
//            route still need the passcode or a staff PIN.
//   "all":   the whole back office opens without a passcode; every visitor is treated as the owner.
// Never on a launched shop: with LIVE=1 the setting is ignored, whatever it says. Every open change is logged with the actor
// "preview (open) <8 characters of a keyed hash of the visitor's network>", never the address itself.
// Before launch: redeploy without the --var (docs/BACKEND-NOTES.md, GO-LIVE checklist).
import { sourceOf, keyedHash } from "./guard.js";

export const openScope = env => env.LIVE !== "1" && (env.PREVIEW_OPEN_EDIT === "items" || env.PREVIEW_OPEN_EDIT === "all") ? env.PREVIEW_OPEN_EDIT : null;
export const openActor = async (env, request) => "preview (open) " + (await keyedHash(env, "open", sourceOf(request))).slice(0, 8);
export const PREVIEW_LINE = "Preview: anyone can edit items. This will be locked before launch.";
// what a page gets while the switch is on: the scope for the page's script, the banner's and the editor's styles and script,
// and the banner itself at the very top of the page (in the flow, so it never covers anything; it scrolls away with the page)
export const previewHead = scope => `<meta name="oss-open-edit" content="${scope}"><link rel="stylesheet" href="/open-edit.css">`;
export const PREVIEW_SCRIPT = `<script type="module" src="/open-edit.js"></script>`;
export const PREVIEW_BANNER = `<p class="pvbar" role="note" data-preview-banner>${PREVIEW_LINE}</p>`;
// the same additions on any HTML page answer (the storefront shell, the back office, the questionnaire); off, the answer as it was
export function withPreview(env, res, { script = false } = {}) {
  const scope = openScope(env); if (!scope) return res;
  return new HTMLRewriter()
    .on("head", { element(e) { e.append(previewHead(scope) + (script ? PREVIEW_SCRIPT : ""), { html: true }); } })
    .on("body", { element(e) { e.prepend(PREVIEW_BANNER, { html: true }); } })
    .transform(res);
}
