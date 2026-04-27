# Product Workflow

This app is intended to support a lightweight agreement CRM workflow.

## Required Jobs

1. Company users can create quotes from a managed list of SKUs.
2. Quotes can be emailed to a customer through a unique review link.
3. Customers verify by SMS code, complete ESIGN consent, and accept the quote.
4. Accepted quotes become tracked contracts with install/start and expiration dates.
5. Management is notified before contracts expire.

## Current Implementation Map

| Job | Implementation |
| --- | --- |
| Company users | `users`, `organizations`, and `user_organizations` tables with `domain_admin`, `editor`, and `customer` roles. |
| SKU quoting | `pricing_rules` provide reusable SKU/pricing rows; `line_items` store selected quote items. |
| Email quote | `lib/email.js` sends review links through SendGrid and records audit entries. |
| SMS acceptance | `routes/public.js` sends a six-digit SMS verification code through `lib/sms.js` before final acceptance. |
| Contract tracking | Accepted quotes create `contracts` with start/end dates and signed metadata. |
| Expiration alerts | `scripts/notify-renewals.js` notifies domain admins at 6, 3, and 1 month before expiration. |

## Notes For Rebuild

- Seed each company/organization privately; do not put real customer/org seed data in the public repo.
- Add pricing rules as private operational data unless the SKU catalog is intended to be public.
- Use fresh SendGrid, SMS, database, OAuth, and session credentials.
- Preserve acceptance audit fields: timestamp, IP address, user agent, signer name, signer email, signer phone, ESIGN consent, agreement hash, and versioned terms.
