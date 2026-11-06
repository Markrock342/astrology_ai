# Customer email templates

Templates live in `src/server/email/templates.ts`. Verification and password-reset
copy receives the actual token lifetime from the auth service (24 hours / 30
minutes). Payment messages reference the existing payment ID; they do not create
an order, approve a payment, or grant additional questions. Transfer time, when
available, is displayed in Bangkok time; otherwise the review timestamp is used.

Weekly mail still runs Monday from 07:00 Bangkok via the internal scheduler. Its
period is the containing Bangkok Sunday–Saturday calendar week. Seven daily
calculations, without name, email, birth details or chat history, are sent to the
configured auxiliary AI for a short overview. The provider gets one 15-second
attempt, at most 1,400 output tokens. Token cost is recorded as
`WEEKLY_EMAIL_SUMMARY`; no usage wallet or customer question balance is touched.

Provider/config/JSON failures fall back to a labelled seven-day calculated
summary. There is no fabricated AI summary. HTML escapes model and user text.
Delivery requires opt-in, an active account and a verified email; opt-in is
checked again after generation. Signed unsubscribe links and one-click headers
remain intact. No email is sent without an unsubscribe signing secret.

Each run processes at most ten recipients and stops starting recipients after
220 seconds (cron route limit: 300 seconds). The Monday scheduler repeats every
15 minutes, continuing the queue; the existing atomic claim prevents concurrent
instances sending the same user's weekly message, and failed sends retry after
about one hour. Preview scripts must use synthetic data and must not call
`runWeeklyDaysEmails` against production to generate samples.
