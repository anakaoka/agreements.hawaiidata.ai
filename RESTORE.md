# Restoring agreements.hawaiidata.ai

This is the playbook for rebuilding the service from this archive after the
original host (`144.202.122.152`) is deleted.

## What you need

- **This repo** — application code + config templates.
- **The private tarball** (`agreements-private-<DATE>.tar.gz`) produced by
  `scripts/backup-server.sh` and kept *off GitHub* in encrypted offline
  storage. Contains: DB dumps, `.env` files, TLS material, customer uploads.
- **A new host** — any small Linux VM (the original was a single Vultr-class
  instance).
- **Fresh credentials** — do **not** reuse the SendGrid key or root password
  that were exposed at deprecation time; both should already be revoked.

## Pre-flight: review what you have

```sh
tar tzf agreements-public-*.tar.gz | less
cat agreements-recon-*.txt           # tells you the runtime stack
```

The recon report is the source of truth for OS, runtimes (Node / Python /
PHP / etc.), web server (nginx / Apache / Caddy), and database engine. The
old host had whatever the recon report says; match that.

## Step 1 — Provision the host

1. Spin up a Linux VM (Ubuntu LTS is a safe default if the recon doesn't say
   otherwise).
2. Add your SSH public key. Disable password auth in
   `/etc/ssh/sshd_config` (`PasswordAuthentication no`) and reload sshd.
3. Install the runtime stack listed in the recon report (Node + npm/pnpm,
   Python, Postgres/MySQL, etc.).

## Step 2 — Restore application code

```sh
git clone https://github.com/anakaoka/agreements.hawaiidata.ai.git
cd agreements.hawaiidata.ai
# unpack the public archive (if code wasn't committed file-by-file)
tar xzf /path/to/agreements-public-*.tar.gz
```

## Step 3 — Restore secrets and data (private tarball, OFF-GitHub)

```sh
tar xzf agreements-private-*.tar.gz -C /tmp/restore
# .env files
cp /tmp/restore/env/<path>/.env <app-dir>/.env
# DB
sudo -u postgres psql < /tmp/restore/db/postgres-all.sql
# uploads / customer files
rsync -a /tmp/restore/uploads/ <app-uploads-dir>/
shred -u /tmp/restore/**/*    # do not leave decrypted secrets on disk
```

## Step 4 — Reissue external credentials

The credentials exposed at deprecation time are compromised. Issue new ones:

- **SendGrid**: create a new API key with the minimum scope the app needs
  (Mail Send only is usually enough). Update `.env`.
- **Any other API key** referenced in `.env` should be rotated as a matter
  of course — this archive is years old by the time you read it.

## Step 5 — Web server + TLS

1. Restore the nginx/Apache/Caddy site config from the public tarball under
   `etc/`.
2. Issue a fresh Let's Encrypt cert (do not try to revive the old one):
   ```sh
   certbot --nginx -d agreements.hawaiidata.ai
   ```

## Step 6 — DNS

Point `agreements.hawaiidata.ai` at the new host's IP. TTL was previously
short; if it isn't, lower it 24h before the cutover so rollback is fast.

## Step 7 — Smoke test

- Sign in as an admin.
- Send a test quote to a known good email address.
- Click "I Agree" from that email.
- Verify the audit log captured: user, IP, timestamp, agreement version.
- Verify the confirmation email arrived with the PDF snapshot attached.

If any of those fail, see `docs/legal-enforceability.md` — those checkpoints
are what makes the agreement enforceable, not just functional.

## Step 8 — Lock down

- `ufw` / firewall: allow 22, 80, 443; deny everything else.
- `fail2ban` for sshd.
- Off-site backups (DB dump nightly, encrypted, somewhere that is not the
  same VM).

## If you only need the data, not the service

The private tarball alone is enough to answer "what did customer X agree to
on date Y" — just restore the DB dump into any Postgres/MySQL and query.
You don't need to bring the web app back to satisfy a records request.
