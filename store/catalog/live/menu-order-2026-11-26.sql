-- Menu order (owner, 2026-11-26): "shisha should be more to the left in the header, an important item like that should be
-- more to the front". The order follows what people come in for: hookahs, shisha, charcoal, heat, then the parts.
UPDATE categories SET sort = 0 WHERE id = 'hookahs';
UPDATE categories SET sort = 1 WHERE id = 'shisha';
UPDATE categories SET sort = 2 WHERE id = 'charcoal';
UPDATE categories SET sort = 3 WHERE id = 'heat';
UPDATE categories SET sort = 4 WHERE id = 'bowls';
UPDATE categories SET sort = 5 WHERE id = 'hoses';
UPDATE categories SET sort = 6 WHERE id = 'bases';
UPDATE categories SET sort = 7 WHERE id = 'parts';
UPDATE categories SET sort = 8 WHERE id = 'cologne';
UPDATE categories SET sort = 9 WHERE id = 'misc';
