# Agreements Platform Recovery Runbook

Recovered from the live `agreements.hawaiidata.ai` server on 2026-04-27.

## Original Deployment Shape

| Component | Value |
| --- | --- |
| OS | Ubuntu 25.10 |
| App path | `/opt/agreements` |
| Runtime | Node.js |
| Process manager | systemd service named `agreements` |
| App bind | `127.0.0.1:3000` |
| Reverse proxy | nginx on ports 80/443 |
| Database | PostgreSQL 17, database `agreements` |
| Cache/session support | Redis installed locally |
| Email provider | SendGrid |
| SMS verification | Twilio-compatible REST API |
| TLS | Let's Encrypt via certbot/nginx |

## Service Operations

```bash
systemctl status agreements
systemctl restart agreements
journalctl -u agreements -f
```

The recovered unit file is at `deploy/systemd/agreements.service`.

## Web Proxy

The recovered nginx site is at `deploy/nginx/agreements.conf`. It redirects HTTP to HTTPS and proxies HTTPS traffic to the local Node process at `127.0.0.1:3000`.

## Database

Use `db/schema.sql` to recreate the schema:

```bash
createdb agreements
psql agreements < db/schema.sql
```

The public repository contains schema only. It does not include production customer rows, quotes, signed contracts, access tokens, or audit records.

Core tables recovered from the live schema:

- `organizations`
- `users`
- `quotes`
- `line_items`
- `revision_requests`
- `quote_access_tokens`
- `contracts`
- `contract_versions`
- `contract_templates`
- `pricing_rules`
- `audit_log`
- `session`

## Scheduled Task

The original server ran the renewal notifier daily:

```cron
0 18 * * * /usr/bin/node /opt/agreements/scripts/notify-renewals.js >> /var/log/agreements-renewals.log 2>&1
```

A copy is included at `deploy/cron/root`.

## Log Rotation

The original server rotated `/var/log/agreements*.log` daily with 14 compressed rotations. A copy is included at `deploy/logrotate/agreements`.

## Required Environment Variables

Start from `.env.example` and create fresh values:

- `DATABASE_URL`
- `SESSION_SECRET`
- `PORT`
- `NODE_ENV`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM`

Use new secrets when bringing the service back. Do not reuse credentials that were ever pasted into tickets, chat, logs, or public repositories.

## Restoring Public Service

1. Provision Ubuntu with Node.js, PostgreSQL, nginx, and certbot.
2. Create the `agreements` database and an application DB user.
3. Load `db/schema.sql`.
4. Copy `.env.example` to `.env` and fill in fresh secrets.
5. Install dependencies with `npm ci`.
6. Install `deploy/systemd/agreements.service` and adjust paths/users as needed.
7. Install `deploy/nginx/agreements.conf` and issue a new certificate.
8. Enable the systemd service and nginx site.
9. Create an initial domain admin through a private seed script or direct SQL.

## Private Backup Guidance

For a true business-continuity backup before deleting the server, export the production database and generated contract files into encrypted storage outside this public repo. Treat those artifacts as sensitive because they can contain customer PII, acceptance evidence, access tokens, signatures, IP addresses, and agreement terms.
