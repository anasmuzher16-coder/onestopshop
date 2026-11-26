-- Order emails are tried again for a day when the mail service refuses them (src/email.js retryEmails, 2026-11-26).
-- send_key: a random key per email, sent as the Idempotency-Key on every try, so no two emails (even across a restored
-- database) share one and no email is delivered twice. sent_from and reply_to are fixed when the email is written, so
-- every try is the same request. tries counts sends; next_try_at is when the next one is due (also the lease on a send
-- in progress), NULL once sent or given up.
ALTER TABLE emails ADD COLUMN send_key TEXT;
ALTER TABLE emails ADD COLUMN sent_from TEXT;
ALTER TABLE emails ADD COLUMN reply_to TEXT;
ALTER TABLE emails ADD COLUMN tries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN next_try_at TEXT;
CREATE INDEX emails_due ON emails(next_try_at) WHERE next_try_at IS NOT NULL;
