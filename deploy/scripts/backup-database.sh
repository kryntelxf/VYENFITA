#!/bin/bash
# ============================================================
# VYENFITA Database Backup Script
# ============================================================
# Creates a compressed backup of the PostgreSQL database.
# 
# Usage:
#   ./backup-database.sh
# 
# Environment variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#   BACKUP_DIR   - Directory to store backups (default: /backups)
#   RETENTION_DAYS - Days to keep backups (default: 30)
# ============================================================

set -euo pipefail

# Configuration
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/vyenfita_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."
echo "[$(date)] Backup file: $BACKUP_FILE"

# Create backup
if pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] ✓ Backup completed: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ✗ Backup failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Clean up old backups
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "vyenfita_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[$(date)] Deleted ${DELETED} old backup(s)"

# Upload to S3 if configured
if [ -n "${S3_BUCKET:-}" ]; then
  echo "[$(date)] Uploading to S3..."
  if aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/$(basename $BACKUP_FILE)"; then
    echo "[$(date)] ✓ Uploaded to S3"
  else
    echo "[$(date)] ✗ S3 upload failed"
    exit 1
  fi
fi

echo "[$(date)] Backup process completed successfully"
