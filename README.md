# agreements.hawaiidata.ai

Public-safe archive for `agreements.hawaiidata.ai`, a CRM-style agreement workflow for company users to quote from SKUs, email customers, collect SMS-verified acceptance, track contract dates, and notify management before expiration.

> Live site status: deprecated April 2026.

This repository intentionally contains two independent apps:

- **Original production app:** Node.js / Express / EJS / PostgreSQL recovered from the live server before deletion.
- **Next.js rebuild:** Next.js 14 / TypeScript / Prisma implementation of the same product direction.

Neither app includes production secrets, database rows, signed agreements, customer PII, SSL private keys, or SSH material.

## Product Workflow

1. Create company users who can quote from a managed SKU catalog.
2. Email quotes to customers with unique review links.
3. Verify the customer by SMS 2FA before they agree to the quote.
4. Track accepted quotes from install/start date through expiration.
5. Notify management when agreements are near expiration.

## Running The Next.js Rebuild

The root `package.json` is for the Next.js rebuild.

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Open `http://localhost:3000` and register the first company.

Main files:

- `src/app/` - App Router pages and API routes
- `src/lib/` - auth, quote, SendGrid, Twilio, cron helpers
- `prisma/schema.prisma` - rebuild database schema
- `RESTORE.md` - restore/rebuild playbook

## Running The Original Express App

The recovered Express app remains at the repo root as archival source:

- `server.js`
- `routes/`
- `views/`
- `lib/`
- `middleware/`
- `public/`
- `db/schema.sql`
- `deploy/`
- `runbook.md`

Because the root `package.json` belongs to the Next.js rebuild, restore the Express dependency manifest from the `main` history if you want to run the recovered production app exactly as archived:

```bash
git show origin/main:package.json > package.express.json
```

Then use the dependencies documented there with the recovered schema:

```bash
cp .env.example .env
createdb agreements
psql agreements < db/schema.sql
node server.js
```

## Environment Variables

`.env.example` contains the union of both apps' configuration:

- Express: `SESSION_SECRET`, `PORT`, `BASE_URL`, Google OAuth, Microsoft OAuth, `TWILIO_FROM`
- Next.js: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `TWILIO_VERIFY_SERVICE_SID`
- Shared: `DATABASE_URL`, SendGrid, Twilio account credentials

Always create fresh credentials before restoring service.

## Public Repo Safety

Do not commit:

- `.env` files or API keys
- Production database dumps with rows
- `storage/` contract PDFs or generated customer artifacts
- SSL private keys or SSH material
- Customer names, email addresses, signatures, or accepted contract records

If customer records need to be preserved, store them in an encrypted private backup outside this public repository.

## Docs

- `RESTORE.md` - rebuild playbook
- `runbook.md` - original Express deployment notes
- `docs/legal-enforceability.md` - ESIGN/UETA analysis
- `docs/scope-domain-admin-line-items.md` - domain admin line-item scope
- `docs/product-workflow.md` - workflow map from the recovered app
