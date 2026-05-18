#!/bin/bash
# Lists Zephyr Scale test cases grouped by folder.
# Reads ZEPHYR_API_TOKEN, ZEPHYR_BASE_URL, ZEPHYR_PROJECT_KEY from .env (or environment).
#
# Run:
#   ! bash .claude/skills/playwright-cli/list-zephyr-testcases.sh
#   ! bash .claude/skills/playwright-cli/list-zephyr-testcases.sh "/ReactUI/RecycleBin"
#   ! bash .claude/skills/playwright-cli/list-zephyr-testcases.sh "/ReactUI/"

set -euo pipefail

# ── Optional folder filter (first argument) ───────────────────────────────────
FOLDER_FILTER="${1:-}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Load .env if present ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE")
    set +a
fi

# ── Validate required vars ────────────────────────────────────────────────────
missing=()
[[ -z "${ZEPHYR_API_TOKEN:-}" ]]   && missing+=("ZEPHYR_API_TOKEN")
[[ -z "${ZEPHYR_BASE_URL:-}" ]]    && missing+=("ZEPHYR_BASE_URL")
[[ -z "${ZEPHYR_PROJECT_KEY:-}" ]] && missing+=("ZEPHYR_PROJECT_KEY")

if [[ ${#missing[@]} -gt 0 ]]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for v in "${missing[@]}"; do
        echo -e "  ${RED}- $v${NC}"
    done
    echo ""
    echo "Set them in .env or export them before running this script."
    exit 1
fi

# ── Temp file to accumulate all pages ────────────────────────────────────────
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT
echo "[]" > "$TMP_FILE"

# ── Pagination settings ───────────────────────────────────────────────────────
MAX_RESULTS=100
START_AT=0
TOTAL_FETCHED=0

echo ""
echo -e "${BOLD}${CYAN}Zephyr Scale — Test Cases by Folder${NC}"
echo -e "${CYAN}Project: ${ZEPHYR_PROJECT_KEY}${NC}"
echo -e "${CYAN}Base URL: ${ZEPHYR_BASE_URL}${NC}"
[[ -n "$FOLDER_FILTER" ]] && echo -e "${YELLOW}Folder filter: ${FOLDER_FILTER}${NC}"
echo -e "${CYAN}Fetching...${NC}"

# ── Fetch all pages ───────────────────────────────────────────────────────────
while true; do
    BASE_QUERY="projectKey = \"${ZEPHYR_PROJECT_KEY}\""
    [[ -n "$FOLDER_FILTER" ]] && BASE_QUERY="${BASE_QUERY} AND folder = \"${FOLDER_FILTER}\""
    ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${BASE_QUERY}'))" 2>/dev/null \
        || node -e "process.stdout.write(encodeURIComponent('${BASE_QUERY}'))")

    URL="${ZEPHYR_BASE_URL}/rest/atm/1.0/testcase/search?query=${ENCODED_QUERY}&maxResults=${MAX_RESULTS}&startAt=${START_AT}&fields=key,name,status,folder,labels"

    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer ${ZEPHYR_API_TOKEN}" \
        -H "Accept: application/json" \
        "$URL")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [[ "$HTTP_CODE" != "200" ]]; then
        echo -e "${RED}✗ API request failed (HTTP $HTTP_CODE)${NC}"
        echo "$BODY" | head -5
        exit 1
    fi

    RESULT_COUNT=$(echo "$BODY" | node -e "
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
    const data = JSON.parse(chunks.join(''));
    const items = Array.isArray(data) ? data : (data.results ?? data.values ?? []);
    console.log(items.length);
});
")

    if [[ "$RESULT_COUNT" -eq 0 ]]; then
        break
    fi

    # Append page items into the temp file
    echo "$BODY" | node -e "
const fs = require('fs');
const tmpFile = process.argv[1];
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
    const data = JSON.parse(chunks.join(''));
    const items = Array.isArray(data) ? data : (data.results ?? data.values ?? []);
    const existing = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    fs.writeFileSync(tmpFile, JSON.stringify([...existing, ...items]));
});
" "$TMP_FILE"

    TOTAL_FETCHED=$((TOTAL_FETCHED + RESULT_COUNT))
    START_AT=$((START_AT + MAX_RESULTS))

    if [[ "$RESULT_COUNT" -lt "$MAX_RESULTS" ]]; then
        break
    fi
done

echo "────────────────────────────────────────────────────────────────────────"

# ── Display grouped by folder ─────────────────────────────────────────────────
node -e "
const fs    = require('fs');
const items = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));

const YELLOW = '\033[1;33m';
const BOLD   = '\033[1m';
const NC     = '\033[0m';

const groups = {};
items.forEach(tc => {
    const folder = tc.folder || '(no folder)';
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(tc);
});

Object.keys(groups).sort().forEach(folder => {
    const tcs = groups[folder];
    console.log('');
    console.log(BOLD + YELLOW + '  ' + folder + '  (' + tcs.length + ')' + NC);
    console.log('  ' + '─'.repeat(Math.max(folder.length + 8, 44)));
    tcs.forEach((tc, i) => {
        const num    = String(i + 1).padStart(4, ' ');
        const key    = (tc.key ?? '').padEnd(12);
        const name   = tc.name ?? '(no name)';
        const status = tc.status ? '  [' + tc.status + ']' : '';
        console.log(\`\${num}.  \${key}  \${name}\${status}\`);
    });
});
" "$TMP_FILE"

echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo -e "${GREEN}✓ Total test cases: ${BOLD}${TOTAL_FETCHED}${NC}"
echo ""
