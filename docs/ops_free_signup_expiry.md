# Free signup expiry

In Admin → Packages, edit Free → วันหมดอายุ Free สำหรับผู้สมัครใหม่. Choose DAYS and 30 for a 30-day signup allowance, or NONE for no expiry. DATE gives all future signups the same deadline. Legacy DEFAULT remains indefinite and does not inherit paid-pack defaults.

Email registration and first Google sign-in share provisioning. The subscription and included wallet deadline use the Free package rule and the exact user creation timestamp. Returning Google sign-in never renews the deadline or grants more questions. Changes apply only to accounts created after the package is saved; existing accounts keep their stored dates and balances. Use the individual expiry editor for existing members.

At the deadline the remaining included Free questions expire; the account is not suspended. Purchased questions keep their own expiry. Ending a paid/promotion period preserves the original Free deadline, even if the package default has since changed. Explicitly assigning Free to an existing user is not a new signup and does not start a new trial.

No schema migration or member backfill is required. Setting DAYS/30 changes only the Free package configuration and writes a package audit entry. Reverting to NONE affects future signups only; it does not remove deadlines already assigned to members.

Validation: `npm run ci`, isolated PostgreSQL `npm run test:integration:admin-users`, and `npm run test:e2e:free-expiry`. The latter saves the package through the actual admin UI, registers through the real API, verifies a 30-day deadline and unchanged existing member records, and emits screenshots. Both DATABASE_URL and DIRECT_URL must point to the isolated local test database. CI always builds a fresh production bundle; local build reuse requires a matching source fingerprint.
