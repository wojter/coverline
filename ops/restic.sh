#!/usr/bin/env bash
set -euo pipefail

# Copies the backup directory to the restic repository and keeps the last 30 snapshots.
# Needs RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE in the environment (e.g. /etc/coverline/restic.env).
DATA_DIR="${COVERLINE_DATA_DIR:-/opt/coverline/data}"

restic backup "$DATA_DIR/backup"
restic forget --keep-last 30 --prune
