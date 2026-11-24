// Test fixtures for the suites that buy things. The shop's real catalogue has no item yet of some kinds a suite must buy
// (a ground-only cologne, a sold-out piece, a glass base, a cap that ships by carrier), and every made-up sample is switched
// off (owner, 2026-11-24: "Hide samples, show coming soon"; catalog/live/samples-off-2026-11-24.sql). So a suite turns the
// sample rows it buys back on, through the back office, the same way the shop switches any item on, in its own throwaway
// local database (the runner builds a fresh one for every suite). The shop's database never runs this.
//   import { samplesOn } from "./fixtures/samples-on.mjs"; await samplesOn(B, ["OSS-8004", "OSS-7001"]);
import { readFileSync } from "node:fs";
import { SAMPLE_SKUS } from "../../src/samples.js";
export async function samplesOn(B, skus) {
  const bad = skus.filter(s => !SAMPLE_SKUS.has(s)); if (bad.length) throw new Error("not a sample: " + bad.join(", "));   // fixtures never touch a real item
  const KEY = process.env.ADMIN_KEY || readFileSync(new URL("../../.dev.vars", import.meta.url), "utf8").match(/ADMIN_KEY=(.+)/)[1].trim();
  const base = String(B).replace(/\/+$/, "");
  const login = await fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1" }, body: JSON.stringify({ passcode: KEY }) });
  if (login.status !== 200) throw new Error("fixtures: back office sign-in failed " + login.status);
  const Cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  for (const sku of skus) {
    const r = await fetch(`${base}/api/admin/products/${sku}`, { method: "PUT", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie }, body: JSON.stringify({ active: true }) });
    if (r.status !== 200) throw new Error(`fixtures: could not switch ${sku} on: ${r.status}`);
  }
  await fetch(base + "/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json", "X-OSS-Admin": "1", Cookie }, body: "{}" });
}
