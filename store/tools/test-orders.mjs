// Order safety against the running local store: the server refuses a total the shopper did not see, and a retry
// after a lost answer can never make a second order. node store/tools/test-orders.mjs   (changes local sample data: reseed afterwards)
const B = (process.env.BASE || "http://127.0.0.1:4420").replace(/\/$/, "");
let n = 0, f = 0; const ok = (c, msg) => { n++; if (!c) { f++; console.log("FAIL", msg); } };
const post = async body => { const r = await fetch(B + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const stockOf = async sku => (await (await fetch(B + "/api/catalog")).json()).products.find(p => p.sku === sku)?.stock;
const who = { name: "Key Tester", email: "key@example.com" }, key = s => `test-${s}-${crypto.randomUUID()}`.slice(0, 60);
const pickup = (sku, qty, extra = {}) => ({ ...who, method: "pickup", lines: [{ sku, qty }], ...extra });

// the total
const s0 = await stockOf("OSS-8004");
const wrong = await post(pickup("OSS-8004", 1, { expected_total_cents: 1 }));
ok(wrong.status === 409 && wrong.data.repriced?.total_cents > 1, "a total the shopper did not see is refused: " + wrong.status);
ok((await stockOf("OSS-8004")) === s0, "a refused total takes no stock");
const right = await post(pickup("OSS-8004", 1, { expected_total_cents: wrong.data.repriced.total_cents }));
ok(right.status === 201 && right.data.order.total_cents === wrong.data.repriced.total_cents, "the server's own figure goes through: " + right.status);
ok((await post(pickup("OSS-8004", 1, { expected_total_cents: "x" }))).status === 409, "a total that is not a number is refused");

// the same order, sent twice
const k1 = key("a"), s1 = await stockOf("OSS-8004");
const a = await post(pickup("OSS-8004", 1, { order_key: k1 })), b = await post(pickup("OSS-8004", 1, { order_key: k1 }));
ok(a.status === 201 && /^W[A-Z0-9]{6}$/.test(a.data.order?.id), "first send places the order: " + a.status);
ok(b.status === 200 && b.data.replayed === true && b.data.order?.id === a.data.order?.id, "a retry gets the same order back: " + b.status);
ok(b.data.order?.total_cents === a.data.order?.total_cents && b.data.order?.items?.length === 1 && b.data.order?.tax_label === a.data.order?.tax_label, "the retry carries the same figures");
ok((await stockOf("OSS-8004")) === s1 - 1, "stock came down once, not twice");

// sent at the same moment
const k2 = key("b"), s2 = await stockOf("OSS-8004");
const race = await Promise.all([1, 2, 3].map(() => post(pickup("OSS-8004", 1, { order_key: k2 }))));
const ids = new Set(race.filter(r => r.data.order).map(r => r.data.order.id));
ok(ids.size === 1 && race.filter(r => r.status === 201).length === 1, "three copies at once make one order: " + race.map(r => r.status).join(","));
ok((await stockOf("OSS-8004")) === s2 - 1, "three copies take one from stock");

// the last one, then a retry: the retry must not say sold out
const last = await stockOf("OSS-7006"), k3 = key("c");
const got = await post(pickup("OSS-7006", last, { order_key: k3 })), again = await post(pickup("OSS-7006", last, { order_key: k3 }));
ok(got.status === 201 && again.status === 200 && again.data.order?.id === got.data.order?.id, `retry of the order that took the last ${last}: ${got.status},${again.status}`);

// a key is not a way to read or change something else
const other = await post({ ...who, email: "someone@example.com", method: "pickup", lines: [{ sku: "OSS-8004", qty: 1 }], order_key: k1 });
ok(other.status === 409 && !other.data.order, "a key with different order details is refused: " + other.status);
ok((await post(pickup("OSS-8004", 1, { order_key: "short" }))).status === 400, "a malformed key is refused");
ok((await post(pickup("OSS-8004", 1, { order_key: 12345 }))).status === 400, "a key that is not text is refused");
console.log(f ? `FAIL ${f} of ${n} checks` : `PASS ${n} checks`); process.exit(f ? 1 : 0);
