// A full copy of the shop's records as one JSON document: products, stock history, orders, emails, the change log.
// Used by the "Download a backup" link in the back office and by the nightly job. Uploaded photos are not
// included (they are large); the product rows that point at them are.
const TABLES = ["categories", "boxes", "products", "stock_moves", "orders", "order_items", "emails", "audit_log", "refunds", "pay_events",
  "customers", "loyalty_ledger", "favourites", "stock_alerts", "account_settings", "marketing_consents"];   // accounts: points are owed to customers, so they are backed up too (sign-ins and codes are not)
export async function snapshot(db) {
  const res = await db.batch(TABLES.map(t => db.prepare(`SELECT * FROM ${t}`)));
  const tables = {}; TABLES.forEach((t, i) => { tables[t] = res[i].results; });
  return { store: "One Stop Shop", taken_at: new Date().toISOString(), counts: Object.fromEntries(TABLES.map(t => [t, tables[t].length])), tables };
}
// Nightly: one file per day in the BACKUPS bucket, the last 30 kept. Does nothing until the bucket is connected.
export async function nightly(env) {
  if (!env.BACKUPS) { console.log(JSON.stringify({ at: "backup", skipped: "no bucket connected" })); return; }
  try { await save(env); } catch (e) { console.error(JSON.stringify({ at: "backup", failed: String(e && e.message || e) })); throw e; }   // a failed night shows red in the Worker's logs
}
async function save(env) {
  const snap = await snapshot(env.DB), key = `backups/${snap.taken_at.slice(0, 10)}.json`;
  await env.BACKUPS.put(key, JSON.stringify(snap), { httpMetadata: { contentType: "application/json" } });
  const all = (await env.BACKUPS.list({ prefix: "backups/" })).objects.map(o => o.key).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 30))) await env.BACKUPS.delete(old);
  console.log(JSON.stringify({ at: "backup", saved: key, kept: Math.min(all.length, 30) }));
}
