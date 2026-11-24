-- On view before the shop's price is set (owner, 2026-11-24: "put them up with a price TBD").
-- listed = 1 shows the item in the shop with "Price TBD". It is never buyable that way: the storefront and checkout
-- sell only rows with active = 1 and a shop price above zero (the 0005 triggers keep a catalogue item off until its
-- price is set). listed is a shop column: a catalogue import writes it once, when the row is created.
ALTER TABLE products ADD COLUMN listed INTEGER NOT NULL DEFAULT 0 CHECK (listed IN (0, 1));
-- The storefront reads "active OR listed", by section and sort order.
CREATE INDEX products_listed ON products(listed, category_id, sort);
