// While the shop's mail is not connected (the test suites run without mail keys, except test-emails), a pay-at-the-counter pickup
// request needs a phone (src/checkout.js, 2026-11-27): the shop calls or texts it when the order is ready. Suites that place such
// orders give each customer a phone made from their email, so one email always carries the same phone (one person for the order
// limits, src/guard.js) and different emails almost always carry different ones.
export const phoneFor = email => "519-555-" + String([...String(email || "").toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 10000).padStart(4, "0");
// An order body with its phone filled in when it is a counter pickup that has none (an explicit phone, even an empty one, is kept).
export const withPhone = b => b && typeof b === "object" && b.method === "pickup" && b.pay === "at_pickup" && b.phone === undefined ? { ...b, phone: phoneFor(b.email) } : b;
