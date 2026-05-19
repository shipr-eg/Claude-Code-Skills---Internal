#!/bin/bash
# Fetches and displays all details for a single Zephyr Scale test case.
# Reads ZEPHYR_API_TOKEN, ZEPHYR_BASE_URL from .env (or environment).
#
# Run:
#   ! bash .claude/skills/playwright-cli/get-zephyr-testcase.sh <TEST_CASE_KEY>
#   ! bash .claude/skills/playwright-cli/get-zephyr-testcase.sh AJB-T1234

set -euo pipefail

# ── Required argument ─────────────────────────────────────────────────────────
TEST_CASE_KEY="${1:-}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

if [[ -z "$TEST_CASE_KEY" ]]; then
    echo -e "${RED}✗ Usage: $0 <TEST_CASE_KEY>${NC}"
    echo -e "  Example: $0 AJB-T1234"
    exit 1
fi

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
[[ -z "${ZEPHYR_API_TOKEN:-}" ]] && missing+=("ZEPHYR_API_TOKEN")
[[ -z "${ZEPHYR_BASE_URL:-}" ]]  && missing+=("ZEPHYR_BASE_URL")

if [[ ${#missing[@]} -gt 0 ]]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for v in "${missing[@]}"; do
        echo -e "  ${RED}- $v${NC}"
    done
    echo ""
    echo "Set them in .env or export them before running this script."
    exit 1
fi

# ── Fetch test case ───────────────────────────────────────────────────────────
URL="${ZEPHYR_BASE_URL}/rest/atm/1.0/testcase/${TEST_CASE_KEY}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${ZEPHYR_API_TOKEN}" \
    -H "Accept: application/json" \
    "$URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "404" ]]; then
    echo -e "${RED}✗ Test case '${TEST_CASE_KEY}' not found.${NC}"
    exit 1
fi

if [[ "$HTTP_CODE" != "200" ]]; then
    echo -e "${RED}✗ API request failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | head -5
    exit 1
fi

# ── Display all info ──────────────────────────────────────────────────────────
echo "$BODY" | node -e "
const chunks = []; process.stdin.on('data', c => chunks.push(c)); process.stdin.on('end', () => {
    const tc = JSON.parse(chunks.join(''));

    const RED     = '\033[0;31m';
    const GREEN   = '\033[0;32m';
    const YELLOW  = '\033[1;33m';
    const CYAN    = '\033[0;36m';
    const MAGENTA = '\033[0;35m';
    const BOLD    = '\033[1m';
    const DIM     = '\033[2m';
    const NC      = '\033[0m';

    const SEP  = '────────────────────────────────────────────────────────────────────────';
    const SEP2 = '  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

    const field = (label, value) => {
        if (value == null || value === '') return;
        console.log('  ' + BOLD + label.padEnd(18) + NC + String(value));
    };

    console.log('');
    console.log(SEP);
    console.log(BOLD + CYAN + '  ' + (tc.key ?? '') + '  —  ' + (tc.name ?? '(no name)') + NC);
    console.log(SEP);

    // ── Core fields ──────────────────────────────────────────────────────────
    console.log('');
    console.log(BOLD + YELLOW + '  OVERVIEW' + NC);
    console.log(SEP2);
    field('Status',     tc.status);
    field('Priority',   tc.priority);
    field('Folder',     tc.folder);
    field('Component',  tc.component);
    field('Owner',      tc.owner);
    field('Labels',     Array.isArray(tc.labels) ? tc.labels.join(', ') : tc.labels);

    // ── Metadata ─────────────────────────────────────────────────────────────
    console.log('');
    console.log(BOLD + YELLOW + '  METADATA' + NC);
    console.log(SEP2);
    field('Created by',  tc.createdBy);
    field('Created on',  tc.createdOn);
    field('Updated by',  tc.updatedBy  ?? tc.lastModifiedBy);
    field('Updated on',  tc.updatedOn  ?? tc.lastModifiedOn);

    // ── Description ──────────────────────────────────────────────────────────
    if (tc.description) {
        console.log('');
        console.log(BOLD + YELLOW + '  DESCRIPTION' + NC);
        console.log(SEP2);
        const lines = tc.description.replace(/<[^>]+>/g, '').split('\n');
        lines.forEach(l => console.log('  ' + l.trim()));
    }

    // ── Precondition ─────────────────────────────────────────────────────────
    if (tc.precondition) {
        console.log('');
        console.log(BOLD + YELLOW + '  PRECONDITION' + NC);
        console.log(SEP2);
        const lines = tc.precondition.replace(/<[^>]+>/g, '').split('\n');
        lines.forEach(l => console.log('  ' + l.trim()));
    }

    // ── Test steps ───────────────────────────────────────────────────────────
    const steps = tc.testScript?.steps ?? tc.steps ?? [];
    if (steps.length > 0) {
        console.log('');
        console.log(BOLD + YELLOW + '  TEST STEPS  (' + steps.length + ')' + NC);
        console.log(SEP2);
        steps.forEach((step, i) => {
            const num = String(i + 1).padStart(3, ' ');
            const desc   = (step.description ?? step.action ?? '').replace(/<[^>]+>/g, '').trim();
            const data   = (step.testData ?? step.data ?? '').replace(/<[^>]+>/g, '').trim();
            const result = (step.expectedResult ?? step.result ?? '').replace(/<[^>]+>/g, '').trim();

            console.log('');
            console.log('  ' + BOLD + CYAN + 'Step ' + num + NC);
            if (desc)   console.log('  ' + BOLD + '  Action:   ' + NC + desc);
            if (data)   console.log('  ' + BOLD + '  Data:     ' + NC + data);
            if (result) console.log('  ' + BOLD + '  Expected: ' + NC + result);
        });
    }

    // ── Custom fields ─────────────────────────────────────────────────────────
    const custom = tc.customFields ?? {};
    const customKeys = Object.keys(custom).filter(k => custom[k] != null && custom[k] !== '');
    if (customKeys.length > 0) {
        console.log('');
        console.log(BOLD + YELLOW + '  CUSTOM FIELDS' + NC);
        console.log(SEP2);
        customKeys.forEach(k => {
            const val = Array.isArray(custom[k]) ? custom[k].join(', ') : String(custom[k]);
            field(k, val);
        });
    }

    // ── Links ─────────────────────────────────────────────────────────────────
    const links = tc.issueLinks ?? tc.links ?? [];
    if (links.length > 0) {
        console.log('');
        console.log(BOLD + YELLOW + '  LINKED ISSUES' + NC);
        console.log(SEP2);
        links.forEach(l => {
            const id   = l.issueKey ?? l.id ?? '';
            const type = l.type ?? l.relationship ?? '';
            console.log('  ' + BOLD + CYAN + id + NC + (type ? '  ' + DIM + '(' + type + ')' + NC : ''));
        });
    }

    console.log('');
    console.log(SEP);
    console.log(GREEN + BOLD + '  ✓ ' + (tc.key ?? '') + NC);
    console.log('');
});
"
