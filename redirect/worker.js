// The old mockup address now sends everyone to the store, keeping the page they asked for.
// To bring the mockup back: run `npx wrangler deploy` from the folder above this one.
const STORE = "https://onestopshop-store.anas-dev.workers.dev";
export default {
  fetch(request) {
    const u = new URL(request.url);
    return new Response(null, { status: 302, headers: { Location: STORE + u.pathname + u.search, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  },
};
