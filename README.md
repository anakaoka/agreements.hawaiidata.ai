# Agreements HawaiiData.ai

Recovered source for `agreements.hawaiidata.ai`, a Node/Express CRM-style agreement workflow for composing quotes, emailing customer review links, capturing electronic acceptance, and tracking accepted contracts.

This repository is intentionally public-safe. It does not include production `.env` values, database rows, signed contract files, SSH keys, SSL private keys, or generated agreement PDFs.

## What Is Included

- Express application source, EJS views, public CSS/images, and package lock.
- PostgreSQL schema-only dump from the live server at `db/schema.sql`.
- The earlier minimal schema recovered from the app tree at `db/schema-minimal-original.sql`.
- Deployment templates for systemd and nginx under `deploy/`.
- Operations and recovery notes under `runbook.md`.

## Stack

- Node.js / Express / EJS
- PostgreSQL 17
- Redis present on the original server, though the app primarily uses PostgreSQL-backed sessions
- nginx reverse proxy with Let's Encrypt certificates
- SendGrid for outbound agreement email
- Twilio-compatible SMS verification through Twilio's REST API
- Optional Google and Microsoft OAuth login

## Local Setup

```bash
npm install
cp .env.example .env
createdb agreements
psql agreements < db/schema.sql
npm start
```

The default app port is `3000`. Update `.env` with local database credentials and fresh API keys before sending email or enabling OAuth.

## Product Workflow

1. Create organizations and company users who can build quotes.
2. Define SKU/pricing rules by organization.
3. Build quotes from SKU line items and email a customer review link.
4. Require the customer to complete ESIGN consent, signer details, and SMS code verification before accepting.
5. Convert accepted quotes into tracked contracts with start/end dates.
6. Notify management as contracts approach renewal or expiration.

## Public Repo Safety

Do not commit:

- `.env` files or API keys
- Production database dumps with rows
- `storage/` contract PDFs or generated customer artifacts
- SSL private keys or SSH material
- Customer names, email addresses, signatures, or accepted contract records

If customer records need to be preserved before deleting the server, store an encrypted private backup outside this public repository.
