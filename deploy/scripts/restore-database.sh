#!/bin/bash
# ============================================================
# VYENFITA Database Restore Script
# ============================================================
# Restores a PostgreSQL database from a backup file.
# 
# Usage:
#   ./restore-database.sh /path/to/backup.sql.gz
# 
# Environment variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#   CONFIRM      - Set to "yes" to skip confirmation
# ============================================================

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
CONFIRM="${CONFIRM:-no}"
BACKUP_FILE="${1:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 /path/to/backup.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "=========================================="
echo "DATABASE RESTORE"
echo "=========================================="
echo "Backup file: $BACKUP_FILE"
echo "Target: $DATABASE_URL"
echo "=========================================="
echo ""

if [ "$CONFIRM" != "yes" ]; then
  read -p "This will OVERWRITE the target database. Are you sure? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

echo "[$(date)] Starting restore..."

# Decompress and restore
if gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"; then
  echo "[$(date)] ✓ Restore completed successfully"
else
  echo "[$(date)] ✗ Restore failed"
  exit 1
fi
