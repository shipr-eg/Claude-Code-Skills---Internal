#!/bin/bash

# Script to list git commits from upstream repository
# Usage: ./list_upstream_commits.sh [TICKET-ID] [options]
# Examples:
#   ./list_upstream_commits.sh                          # List all commits
#   ./list_upstream_commits.sh AJB-14080                # List commits for ticket
#   ./list_upstream_commits.sh AJB-14080 --limit 100   # Limit results
# Options:
#   --repo URL          Repository URL (default: https://github.com/EG-A-S/ajoursystem-build-web)
#   --branch BRANCH     Branch to list (default: develop)
#   --limit N           Number of commits to show (default: 50)
#   --output FILE       Save output to file (default: stdout)
#   --format FORMAT     Output format: oneline|full|short (default: oneline)

REPO="https://github.com/EG-A-S/ajoursystem-build-web"
BRANCH="develop"
LIMIT=50
OUTPUT=""
FORMAT="oneline"
TICKET_ID=""
TEMP_DIR="/tmp/upstream_repo_list_$$"

# Check if first argument is a ticket ID (contains dash and alphanumeric)
if [[ $# -gt 0 && "$1" =~ ^[A-Z]+-[0-9]+$ ]]; then
  TICKET_ID="$1"
  shift
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Function to cleanup
cleanup() {
  if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

# Clone repository
echo "[*] Fetching commits from $REPO ($BRANCH)..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

if ! git clone --quiet --depth 500 --branch "$BRANCH" "$REPO" repo 2>/dev/null; then
  echo "[!] Failed to clone repository"
  exit 1
fi

cd repo || exit 1

# Build git log command with optional ticket filter
if [ -n "$TICKET_ID" ]; then
  echo "[*] Filtering commits for ticket: $TICKET_ID"
  GIT_CMD="git log --grep=$TICKET_ID --all -n $LIMIT"
else
  GIT_CMD="git log -n $LIMIT"
fi

# List commits
if [ -n "$OUTPUT" ]; then
  case $FORMAT in
    oneline)
      $GIT_CMD --oneline > "$OUTPUT"
      ;;
    full)
      $GIT_CMD > "$OUTPUT"
      ;;
    short)
      $GIT_CMD --pretty=format:"%h | %ad | %an | %s" --date=short > "$OUTPUT"
      ;;
    *)
      echo "Unknown format: $FORMAT"
      exit 1
      ;;
  esac
  echo "[+] Output saved to: $OUTPUT"
  cat "$OUTPUT"
else
  case $FORMAT in
    oneline)
      $GIT_CMD --oneline
      ;;
    full)
      $GIT_CMD
      ;;
    short)
      $GIT_CMD --pretty=format:"%h | %ad | %an | %s" --date=short
      ;;
    *)
      echo "Unknown format: $FORMAT"
      exit 1
      ;;
  esac
fi

exit 0
