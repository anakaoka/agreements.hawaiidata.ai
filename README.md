# agreements.hawaiidata.ai

A multi-company SaaS for quoting, emailing, and tracking signed agreements.

> **Live site status:** Deprecated April 2026. This repo is both the public
> archive and the full application source — everything needed to run or
> rebuild the service is here.

## What it does

1. **Companies register** and get their own isolated workspace.
2. **Admins build a SKU catalog** — reusable products/services with prices.
3. **Editors create quotes** from SKUs, add line items, set validity dates.
4. **Quote is emailed** to the customer (SendGrid) with a unique one-time link.
5. **Customer verifies identity via SMS** (Twilio Verify) then clicks "I Agree".
6. **Full audit log** is saved: IP, timestamp, user-agent, SMS verification.
7. **Confirmation email** goes to the customer; quote status flips to ACCEPTED.
8. **Management is alerted** 30, 7, and 1 day before a quote expires (cron job).

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (JWT, email+password) |
| Email | SendGrid |
| SMS 2FA | Twilio Verify |
| Styling | Tailwind CSS |
| Scheduling | node-cron (via Next.js instrumentation) |

## Roles

| Role | Can do |
|---|---|
| `EDITOR` | Create quotes, add line items |
| `DOMAIN_ADMIN` | Everything above + override pricing, lock items, manage SKUs, approve quotes |
| `SUPER_ADMIN` | Platform-wide access (operators only) |

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/anakaoka/agreements.hawaiidata.ai.git
cd agreements.hawaiidata.ai
npm install

# 2. Copy and fill in env vars
cp .env.example .env
# Edit .env — you need: DATABASE_URL, NEXTAUTH_SECRET, SendGrid key, Twilio creds

# 3. Set up the database
npm run db:push        # apply schema to a new Postgres DB
# (or: npm run db:migrate for a migration-tracked setup)

# 4. Run dev server
npm run dev
# → http://localhost:3000

# 5. Register your first company at http://localhost:3000/register
```

## Production deployment (single VPS)

```bash
npm run build
npm run start          # runs on port 3000; put nginx in front
```

The cron job (expiry alerts) starts automatically via `src/instrumentation.ts`
when the Node.js runtime starts. No separate process needed.

See `RESTORE.md` for a full re-provisioning checklist.

## Environment variables

See `.env.example` for all required variables and where to get them:

- **DATABASE_URL** — PostgreSQL connection string
- **NEXTAUTH_SECRET** — random 32-byte string (`openssl rand -base64 32`)
- **NEXTAUTH_URL** — public URL of the app
- **SENDGRID_API_KEY** / **SENDGRID_FROM_EMAIL** — verified SendGrid sender
- **TWILIO_ACCOUNT_SID** / **TWILIO_AUTH_TOKEN** / **TWILIO_VERIFY_SERVICE_SID**

## Legal compliance

This system is designed to satisfy ESIGN / UETA requirements for electronic
agreements. See `docs/legal-enforceability.md` for the full analysis.

Key implementation points:
- Customer identity tied to a verified email + phone (2FA)
- Affirmative acceptance action ("I Agree" button after SMS verify)
- Electronic consent disclosure shown before acceptance
- Audit log: IP, timestamp, user-agent, agreement version, SMS verification status
- Confirmation email serves as the customer's electronic receipt

## Docs

- `docs/legal-enforceability.md` — ESIGN/UETA analysis
- `docs/scope-domain-admin-line-items.md` — last scope update before deprecation
- `scripts/backup-server.sh` — server backup script (for ops)
- `RESTORE.md` — rebuild playbook
