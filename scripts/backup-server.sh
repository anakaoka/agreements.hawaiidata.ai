#!/usr/bin/env bash
#
# Run this ON the agreements.hawaiidata.ai server (as root) to produce
# two archives before the host is deleted:
#
#   1. agreements-public-<DATE>.tar.gz
#        Code + config templates only. Safe to commit to a PUBLIC repo
#        AFTER you eyeball it. Excludes secrets and customer data.
#
#   2. agreements-private-<DATE>.tar.gz
#        Secrets, DB dumps, customer files. KEEP OFF GITHUB.
#        Store in encrypted offline storage (1Password, encrypted USB,
#        private S3 bucket with SSE, etc.).
#
# Usage (on the server):
#   curl -fsSL https://raw.githubusercontent.com/anakaoka/agreements.hawaiidata.ai/claude/deprecate-agreements-site-3gwpS/scripts/backup-server.sh -o backup-server.sh
#   chmod +x backup-server.sh
#   sudo ./backup-server.sh
#
# Then scp both tarballs to your laptop:
#   scp root@144.202.122.152:/root/agreements-*.tar.gz .
#
# Review the public tarball, then unpack into this repo and commit only
# the code/config-template portion.

set -euo pipefail

DATE="$(date -u +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-/root}"
PUB_TAR="${OUT_DIR}/agreements-public-${DATE}.tar.gz"
PRV_TAR="${OUT_DIR}/agreements-private-${DATE}.tar.gz"
RECON="${OUT_DIR}/agreements-recon-${DATE}.txt"

# Candidate locations to look for app code / config. Adjust if anything
# lives elsewhere.
APP_CANDIDATES=(
  /var/www
  /srv
  /opt
  /home
  /root
)

CONFIG_CANDIDATES=(
  /etc/nginx
  /etc/apache2
  /etc/caddy
  /etc/systemd/system
  /etc/letsencrypt/renewal   # config only, NOT live keys
  /etc/cron.d
  /etc/cron.daily
  /etc/cron.hourly
  /etc/logrotate.d
)

# Files/dirs that must NEVER end up in the public tarball.
PUBLIC_EXCLUDES=(
  --exclude='.env'
  --exclude='.env.*'
  --exclude='*.env'
  --exclude='secrets/'
  --exclude='secrets.*'
  --exclude='*.pem'
  --exclude='*.key'
  --exclude='id_rsa*'
  --exclude='id_ed25519*'
  --exclude='id_ecdsa*'
  --exclude='id_dsa*'
  --exclude='authorized_keys'
  --exclude='known_hosts'
  --exclude='.ssh/'
  --exclude='*.sqlite'
  --exclude='*.sqlite3'
  --exclude='*.db'
  --exclude='*.sql'
  --exclude='*.dump'
  --exclude='*.bak'
  --exclude='dumps/'
  --exclude='backups/'
  --exclude='uploads/'
  --exclude='customer-files/'
  --exclude='attachments/'
  --exclude='node_modules/'
  --exclude='.next/'
  --exclude='dist/'
  --exclude='build/'
  --exclude='vendor/'
  --exclude='__pycache__/'
  --exclude='*.pyc'
  --exclude='*.log'
  --exclude='logs/'
  --exclude='.cache/'
  --exclude='tmp/'
  --exclude='.git/objects/pack/'
)

echo "==> Recon: capturing host inventory to ${RECON}"
{
  echo "# Recon for agreements.hawaiidata.ai"
  echo "# Generated: $(date -u)"
  echo
  echo "## OS"
  uname -a || true
  cat /etc/os-release 2>/dev/null || true
  echo
  echo "## Disk usage"
  df -h || true
  echo
  echo "## Listening ports"
  ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || true
  echo
  echo "## Systemd services (enabled)"
  systemctl list-unit-files --state=enabled 2>/dev/null || true
  echo
  echo "## Running processes (top)"
  ps auxf | head -100 || true
  echo
  echo "## Nginx/Apache/Caddy presence"
  for f in /etc/nginx/nginx.conf /etc/apache2/apache2.conf /etc/caddy/Caddyfile; do
    [ -f "$f" ] && echo "FOUND: $f"
  done
  echo
  echo "## Likely app locations (top-level dirs)"
  for d in "${APP_CANDIDATES[@]}"; do
    [ -d "$d" ] && find "$d" -maxdepth 2 -type d 2>/dev/null
  done
  echo
  echo "## Installed runtimes"
  for cmd in node npm pnpm yarn python3 pip3 ruby gem php psql mysql redis-cli; do
    if command -v "$cmd" >/dev/null 2>&1; then
      printf '%-10s %s\n' "$cmd" "$($cmd --version 2>&1 | head -1)"
    fi
  done
  echo
  echo "## Crontabs"
  for u in $(cut -f1 -d: /etc/passwd); do
    out=$(crontab -u "$u" -l 2>/dev/null || true)
    [ -n "$out" ] && echo "--- $u ---" && echo "$out"
  done
  echo
  echo "## Databases on host"
  if command -v psql >/dev/null 2>&1; then
    sudo -u postgres psql -lqt 2>/dev/null | cut -d\| -f1 | sed '/^$/d' || true
  fi
  if command -v mysql >/dev/null 2>&1; then
    mysql -e 'SHOW DATABASES;' 2>/dev/null || true
  fi
} > "${RECON}" 2>&1
echo "    wrote ${RECON}"

# ---- Build PUBLIC tarball: code + config templates only -----------------

echo "==> Building public tarball: ${PUB_TAR}"
PUBLIC_PATHS=()
for d in "${APP_CANDIDATES[@]}" "${CONFIG_CANDIDATES[@]}"; do
  [ -e "$d" ] && PUBLIC_PATHS+=("$d")
done
PUBLIC_PATHS+=("${RECON}")

tar czf "${PUB_TAR}" \
  "${PUBLIC_EXCLUDES[@]}" \
  "${PUBLIC_PATHS[@]}" 2>/dev/null || true

echo "    size: $(du -h "${PUB_TAR}" | cut -f1)"

# ---- Build PRIVATE tarball: secrets, DB dumps, customer files -----------

echo "==> Building private tarball: ${PRV_TAR}"
PRV_TMP="$(mktemp -d)"
trap 'rm -rf "${PRV_TMP}"' EXIT

# Secrets: collect any .env-ish files we can find under app dirs
mkdir -p "${PRV_TMP}/env"
for d in "${APP_CANDIDATES[@]}"; do
  [ -d "$d" ] || continue
  find "$d" -maxdepth 6 \( -name '.env' -o -name '.env.*' -o -name '*.env' \) \
    -type f 2>/dev/null | while read -r f; do
      mkdir -p "${PRV_TMP}/env$(dirname "$f")"
      cp -a "$f" "${PRV_TMP}/env$(dirname "$f")/" || true
    done
done

# SSH + TLS material
mkdir -p "${PRV_TMP}/ssh" "${PRV_TMP}/tls"
[ -d /root/.ssh ] && cp -a /root/.ssh "${PRV_TMP}/ssh/root" || true
for h in /home/*; do
  [ -d "$h/.ssh" ] && cp -a "$h/.ssh" "${PRV_TMP}/ssh/$(basename "$h")" || true
done
[ -d /etc/letsencrypt ] && cp -a /etc/letsencrypt "${PRV_TMP}/tls/letsencrypt" || true

# DB dumps
mkdir -p "${PRV_TMP}/db"
if command -v pg_dumpall >/dev/null 2>&1; then
  echo "    dumping postgres..."
  sudo -u postgres pg_dumpall 2>/dev/null > "${PRV_TMP}/db/postgres-all.sql" || true
fi
if command -v mysqldump >/dev/null 2>&1 && [ -f /root/.my.cnf ]; then
  echo "    dumping mysql..."
  mysqldump --all-databases --single-transaction 2>/dev/null > "${PRV_TMP}/db/mysql-all.sql" || true
fi

# Customer-uploaded files (heuristic: common dirs)
mkdir -p "${PRV_TMP}/uploads"
for d in "${APP_CANDIDATES[@]}"; do
  [ -d "$d" ] || continue
  find "$d" -maxdepth 6 -type d \
    \( -name 'uploads' -o -name 'attachments' -o -name 'customer-files' -o -name 'storage' \) \
    2>/dev/null | while read -r u; do
      cp -a "$u" "${PRV_TMP}/uploads/$(echo "$u" | tr / _)" || true
    done
done

tar czf "${PRV_TAR}" -C "${PRV_TMP}" . 2>/dev/null || true
echo "    size: $(du -h "${PRV_TAR}" | cut -f1)"

cat <<EOF

==> Done.

Public archive  (REVIEW before committing to GitHub):
  ${PUB_TAR}

Private archive (KEEP OFF GITHUB - secrets / customer data):
  ${PRV_TAR}

Recon report:
  ${RECON}

Next steps from your laptop:
  scp root@144.202.122.152:${PUB_TAR} .
  scp root@144.202.122.152:${PRV_TAR} .
  scp root@144.202.122.152:${RECON} .

Then:
  - Spot-check the public tarball: tar tzf agreements-public-*.tar.gz | less
  - grep for leaks: zgrep -E 'SG\\.[A-Za-z0-9_-]{20,}|password|api[_-]?key|secret' agreements-public-*.tar.gz
  - If clean, unpack into the repo's app/ directory and commit.
  - Move the private tarball into encrypted offline storage and delete
    the local copy.
EOF
