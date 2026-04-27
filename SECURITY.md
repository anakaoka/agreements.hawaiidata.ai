# Security Notes

This project handles customer agreement workflows and can contain legally significant acceptance records in production.

Never publish production secrets or customer records. Public commits should be limited to source code, static public assets, deployment templates, and schema-only database definitions.

If a secret is committed by accident:

1. Revoke or rotate the secret immediately.
2. Remove the secret from git history before pushing further.
3. Audit access logs for use of the exposed credential.

Recommended production controls:

- Use fresh SendGrid, database, OAuth, and session secrets on restore.
- Keep PostgreSQL and Redis bound to localhost or a private network.
- Store generated PDFs and database backups in encrypted private storage.
- Preserve audit logs for acceptance events.
- Keep `.env`, `storage/`, and raw database dumps out of git.
