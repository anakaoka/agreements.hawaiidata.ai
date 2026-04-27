# agreements.hawaiidata.ai

> **Status: DEPRECATED (April 2026).** The live service at
> `https://agreements.hawaiidata.ai/` is being shut down and the host
> `144.202.122.152` may be deleted. This repository is the public
> archive kept in case the service needs to be brought back later.

## What it was

A proposal / contract-tracking CRM. The product gave organizations and
their employees an easy way to email quotes to customers, let customers
accept those quotes electronically, and gave the back office a way to
track agreements through their lifecycle.

## What's in this repo

- `docs/legal-enforceability.md` — research notes on what an emailed
  agreement needs to satisfy ESIGN / UETA, so a future implementation
  has a starting point for legal compliance.
- `docs/scope-domain-admin-line-items.md` — last agreed scope change
  before deprecation: Domain Admin permissions for line-item editing,
  pricing overrides, audit logging, and revision workflow.
- `scripts/backup-server.sh` — script to run **on the server** to
  produce two tarballs: a *public-safe* code/config archive and a
  *private* data archive (DB dumps, customer files, secrets). Only the
  public archive should be committed here.
- `RESTORE.md` — checklist for standing the service back up from this
  archive.

## What is NOT in this repo

The following are deliberately excluded and must never be committed
here, because this is a public repository:

- `.env` files, API keys, DB credentials, session secrets
- SSH private keys, TLS private keys
- Database dumps containing customer data
- Signed agreement PDFs / customer-uploaded files
- Anything in `node_modules/`, build artifacts, logs

If you need to restore service, the *private* archive lives outside
GitHub (see `RESTORE.md`).

## Bringing it back

See `RESTORE.md`. High level:

1. Provision a new host (any small Linux VM).
2. Reinstall the runtime stack documented in this archive.
3. Restore application code from this repo.
4. Restore data from the *private* tarball (kept off-GitHub).
5. Reissue SendGrid + any other API keys (do not reuse old ones).
6. Re-point DNS for `agreements.hawaiidata.ai`.

## History

Built as an internal CRM for emailing and tracking quotes /
agreements. Wound down in April 2026 in favor of consolidating tooling
elsewhere. The legal-enforceability notes and the line-item scope
update were the last two design artifacts before deprecation; both are
preserved under `docs/`.
