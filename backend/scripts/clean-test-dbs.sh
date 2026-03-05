#!/bin/bash
#
# Remove leftover test databases that were preserved after test failures.
# Run from the repo root or backend/ directory.
#
# Usage:
#   docker compose exec backend bash scripts/clean-test-dbs.sh
#   # or from backend/:
#   docker compose exec backend bash scripts/clean-test-dbs.sh

set -euo pipefail

DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-practice_user}"

echo "Checking for leftover test databases..."

# Find all databases matching the test pattern
TEST_DBS=$(psql -h "$DB_HOST" -U "$DB_USER" -d postgres -t -A -c \
    "SELECT datname FROM pg_database WHERE datname LIKE 'practice_journal_test%';" 2>/dev/null)

if [ -z "$TEST_DBS" ]; then
    echo "No test databases found."
    exit 0
fi

echo "Found test databases:"
echo "$TEST_DBS" | while read -r db; do
    echo "  - $db"
done

echo ""
read -p "Drop all listed databases? [y/N] " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "$TEST_DBS" | while read -r db; do
        echo "Dropping $db..."
        psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE \"$db\";" 2>/dev/null
    done
    echo "Done."
else
    echo "Cancelled."
fi
