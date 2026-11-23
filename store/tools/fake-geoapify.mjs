// A stand-in for the map service, for local tests only. The street name sets the answer: "D12500 Test St" is 12.5 km by road.
// "LZ9000W11000 Test St" is 9 km by road from Lauzon and 11 km from Wyandotte, and sits at the Lauzon end of town. GET /__routes counts route lookups.
// node store/tools/fake-geoapify.mjs   then run the store with --var GEOAPIFY_KEY:test --var GEOAPIFY_BASE:http://127.0.0.1:4499
import { createServer } from "node:http";
// Test points sit just north of the Wyandotte pin, so the straight line is always shorter than the pretend road.
const SHIFT = 0.3179407, WEST = -83.0263116, EAST = -82.9321728, pairs = new Map(); let routes = 0;
const place = (lat, over = {}) => ({ lat: lat + SHIFT, lon: WEST, country_code: "ca", state_code: "ON", city: "Windsor", result_type: "building", rank: { confidence_street_level: 1 }, ...over });
createServer((req, res) => {
  const u = new URL(req.url, "http://x"), send = (o, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/__routes") return send({ routes });
  if (u.pathname === "/v1/geocode/search") {
    if (u.searchParams.get("type") === "postcode") {
      const code = (u.searchParams.get("text") || "").slice(0, 7), km = { "N9A 1A1": 5, "N8N 1W9": 12.5, "N8M 1A8": 30, "N8X 1A1": 10, "N9H 1A1": 25, "N8H 1A1": 40 }[code];
      if (code === "N0R 1A0") { const lat = 42.3166188, lon = EAST; pairs.set(`${lat},${lon}`, { l: 18000, w: 27000 }); return send({ results: [{ ...place(0), lat, lon, postcode: code, result_type: "postcode" }] }); }
      return send({ results: km === undefined ? [] : [place(42 + km / 1000, { postcode: code, result_type: "postcode" })] });
    }
    const t = u.searchParams.get("text") || "", pc = (t.match(/[A-Z]\d[A-Z] \d[A-Z]\d/) || ["N9A 1A1"])[0];
    if (/^760 Wyandotte/.test(t)) return send({ results: [place(42, { postcode: "N9A 3J4", housenumber: "760" })] });
    if (/FARAWAY/.test(t)) return send({ results: [{ ...place(0, { postcode: pc, housenumber: "7" }), lat: 42.9, lon: -83 }] });
    const lz = t.match(/LZ(\d+)W(\d+)/);
    if (lz) { const l = +lz[1], w = +lz[2], lat = 42.3166188 + ((l + w) % 97) / 1e6, lon = EAST; pairs.set(`${lat},${lon}`, { l, w }); return send({ results: [{ ...place(0, { postcode: pc, housenumber: "7" }), lat, lon }] }); }
    if (/NOTFOUND/.test(t)) return send({ results: [] });
    if (/MAPDOWN/.test(t)) return send({ error: "down" }, 500);
    if (/DETROIT/.test(t)) return send({ results: [place(42.3, { state_code: "MI", postcode: pc })] });
    if (/WRONGPC/.test(t)) return send({ results: [place(42.1, { postcode: "M5V 2T6" })] });
    if (/VAGUE/.test(t)) return send({ results: [place(42.1, { postcode: pc, result_type: "city" })] });
    if (/FARHIT/.test(t)) return send({ results: [place(42.19, { housenumber: "12", result_type: "building" })] });
    if (/WRONGNUM/.test(t)) return send({ results: [place(42.005, { postcode: pc, housenumber: "12" })] });
    if (/ROADSAME/.test(t)) return send({ results: [place(42.005, { postcode: pc, result_type: "street", bbox: { lat1: 42.004 + SHIFT, lon1: WEST, lat2: 42.006 + SHIFT, lon2: WEST } })] });
    if (/ROADSPLIT/.test(t)) return send({ results: [place(42.01, { postcode: pc, result_type: "street", bbox: { lat1: 42.005 + SHIFT, lon1: WEST, lat2: 42.02 + SHIFT, lon2: WEST } })] });
    if (/NOBOX/.test(t)) return send({ results: [place(42.005, { postcode: pc, result_type: "street" })] });
    const m = t.match(/D(\d+)(?:_(\d+))? /); if (!m) return send({ results: [] });
    return send({ results: [place(42 + (+m[1] + (m[2] ? +m[2] / 100 : 0)) / 1e6, { postcode: pc, housenumber: "7" })] });
  }
  if (u.pathname === "/v1/routing") {
    routes++;
    const [from, to] = (u.searchParams.get("waypoints") || "").split("|"), lauzon = Math.abs(+from.split(",")[1] - EAST) < 0.001, pair = pairs.get(to);
    if (pair) return send({ results: [{ distance: lauzon ? pair.l : pair.w }] });
    const metres = Math.round((+to.split(",")[0] - SHIFT - 42) * 1e8) / 100;   // ordinary test points: Lauzon is always 5 km longer
    return send({ results: [{ distance: lauzon ? metres + 5000 : metres }] });
  }
  send({ error: "nope" }, 404);
}).listen(4499, "127.0.0.1");
