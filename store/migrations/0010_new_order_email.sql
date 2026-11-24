-- The shop hears about every new order (launch runbook, 2026-11-24): a short new-order note to OWNER_EMAIL for each
-- order that is paid by card or placed to pay at the counter. The outbox gains that kind. SQLite cannot change a CHECK in
-- place, so the table is rebuilt with every row and id kept (the same way 0009 did it).
CREATE TABLE emails_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('order_placed','order_shipped','pickup_ready','low_stock','sign_in','back_in_stock','restock_reminder','new_order')),
  recipient TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','sent','failed')),
  detail TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO emails_new (id, order_id, kind, recipient, subject, html, body, status, detail, at)
  SELECT id, order_id, kind, recipient, subject, html, body, status, detail, at FROM emails;
DROP TABLE emails;
ALTER TABLE emails_new RENAME TO emails;
CREATE INDEX emails_order ON emails(order_id, at);
