// A stand-in for the map service, for local tests only. The street name sets the answer: "D12500 Test St" is 12.5 km by road.
// node store/tools/fake-geoapify.mjs   then run the store with --var GEOAPIFY_KEY:test --var GEOAPIFY_BASE:http://127.0.0.1:4499
import { createServer } from "node:http";
const place = (lat, over = {}) => ({ lat, lon: -83, country_code: "ca", state_code: "ON", city: "Windsor", result_type: "building", rank: { confidence_street_level: 1 }, ...over });
createServer((req, res) => {
  const u = new URL(req.url, "http://x"), send = (o, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/v1/geocode/search") {
    const t = u.searchParams.get("text") || "", pc = (t.match(/[A-Z]\d[A-Z] \d[A-Z]\d/) || ["N9A 1A1"])[0];
    if (/^760 Wyandotte/.test(t)) return send({ results: [place(42, { postcode: "N9A 3J4", housenumber: "760" })] });
    if (/NOTFOUND/.test(t)) return send({ results: [] });
    if (/MAPDOWN/.test(t)) return send({ error: "down" }, 500);
    if (/DETROIT/.test(t)) return send({ results: [place(42.3, { state_code: "MI", postcode: pc })] });
    if (/WRONGPC/.test(t)) return send({ results: [place(42.1, { postcode: "M5V 2T6" })] });
    if (/VAGUE/.test(t)) return send({ results: [place(42.1, { postcode: pc, result_type: "city" })] });
    if (/WRONGNUM/.test(t)) return send({ results: [place(42.005, { postcode: pc, housenumber: "12" })] });
    if (/ROADSAME/.test(t)) return send({ results: [place(42.005, { postcode: pc, result_type: "street", bbox: { lat1: 42.004, lon1: -83, lat2: 42.006, lon2: -83 } })] });
    if (/ROADSPLIT/.test(t)) return send({ results: [place(42.01, { postcode: pc, result_type: "street", bbox: { lat1: 42.005, lon1: -83, lat2: 42.02, lon2: -83 } })] });
    if (/NOBOX/.test(t)) return send({ results: [place(42.005, { postcode: pc, result_type: "street" })] });
    const m = t.match(/D(\d+)(?:_(\d+))? /); if (!m) return send({ results: [] });
    return send({ results: [place(42 + (+m[1] + (m[2] ? +m[2] / 100 : 0)) / 1e6, { postcode: pc, housenumber: "7" })] });
  }
  if (u.pathname === "/v1/routing") {
    const lat = +(u.searchParams.get("waypoints") || "").split("|")[1].split(",")[0];
    return send({ results: [{ distance: Math.round((lat - 42) * 1e8) / 100 }] });
  }
  send({ error: "nope" }, 404);
}).listen(4499, "127.0.0.1");
