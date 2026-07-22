#!/usr/bin/env node
/**
 * Upload test cases from a generated CSV into Zephyr Scale via the Zephyr Scale
 * Server/DC REST API ("/rest/atm/1.0/...") — the same API family already used by
 * .claude/skills/playwright-cli/get-zephyr-testcase.sh and list-zephyr-testcases.sh.
 *
 * Usage: node zephyr_api_upload.js <csv-file-path>
 *
 * The CSV must be the 19-column format produced by the create-testcases skills.
 * Relevant columns (0-indexed):
 * - 1  Name          : Test case name (only on the first row of a test case)
 * - 2  Status        : Draft, Approved, Deprecated
 * - 3  Precondition
 * - 4  Objective
 * - 5  Folder        : "Ajour/{Module}/{TICKET-ID} {Summary}" — module must exist
 *                       in zephyr_folders.json, the ticket subfolder is created
 *                       under it if missing.
 * - 6  Priority      : High, Normal, Low (Jira's Medium is mapped to Normal)
 * - 7  Component
 * - 8  Labels        : comma-separated
 * - 9  Owner
 * - 11 Coverage (Issues): Jira issue keys, used as Zephyr issue links
 * - 14-16 Step description, Test Data, Expected Result (repeated on step rows,
 *          which leave column 1 empty)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// ===================================
// CONFIGURATION - values are read from .env, falling back to these defaults
// ===================================
const CONFIG = {
    ZEPHYR_API_TOKEN: process.env.ZEPHYR_API_TOKEN || '',
    ZEPHYR_BASE_URL: process.env.ZEPHYR_BASE_URL || 'https://jira.eg.dk',
    ZEPHYR_PROJECT_KEY: process.env.ZEPHYR_PROJECT_KEY || 'AJB',
    JIRA_USER_KEY: process.env.JIRA_USER_KEY || ''
};
// ===================================

function loadEnvFile() {
    const envPath = path.join(REPO_ROOT, '.env');
    if (!fs.existsSync(envPath)) return {};

    const envVars = {};
    fs.readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const idx = line.indexOf('=');
        if (idx < 0) return;

        const key = line.substring(0, idx).trim();
        let value = line.substring(idx + 1).trim();
        value = value.replace(/^["']+|["']+$/g, '');
        envVars[key] = value;
    });
    return envVars;
}

const envVars = loadEnvFile();
const API_TOKEN = envVars.ZEPHYR_API_TOKEN || CONFIG.ZEPHYR_API_TOKEN;
const BASE_URL = envVars.ZEPHYR_BASE_URL || CONFIG.ZEPHYR_BASE_URL;
const PROJECT_KEY = envVars.ZEPHYR_PROJECT_KEY || CONFIG.ZEPHYR_PROJECT_KEY;
const OWNER = envVars.JIRA_USER_KEY || CONFIG.JIRA_USER_KEY;

if (!API_TOKEN) {
    console.error('ERROR: ZEPHYR_API_TOKEN missing from .env');
    process.exit(1);
}

const CSV_FILE = process.argv[2];
if (!CSV_FILE || !fs.existsSync(CSV_FILE)) {
    console.error(`ERROR: CSV file not found: ${CSV_FILE}`);
    process.exit(1);
}

function loadModuleFolderMap() {
    const foldersPath = path.join(REPO_ROOT, 'zephyr_folders.json');
    if (!fs.existsSync(foldersPath)) {
        console.error(`ERROR: zephyr_folders.json not found at ${foldersPath}`);
        process.exit(1);
    }
    const tree = JSON.parse(fs.readFileSync(foldersPath, 'utf-8'));
    const subfolders = tree.Ajour && tree.Ajour.subfolders || {};
    const map = new Map();
    for (const [name, info] of Object.entries(subfolders)) {
        map.set(name.toLowerCase(), { name, id: info.id });
    }
    return map;
}

function makeRequest(method, urlPath, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null, text: data });
                } catch (e) {
                    resolve({ status: res.statusCode, data: null, text: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(JSON.stringify(payload));
        req.end();
    });
}

function normalizePriority(p) {
    const v = (p || '').trim();
    if (/critical/i.test(v)) return 'Critical';
    if (/high/i.test(v)) return 'High';
    if (/low/i.test(v)) return 'Low';
    // Jira "Medium" (and anything unrecognized/blank) -> Zephyr "Normal"
    return 'Normal';
}

function normalizeStatus(s) {
    const v = (s || '').trim();
    if (/approved/i.test(v)) return 'Approved';
    if (/deprecated/i.test(v)) return 'Deprecated';
    return 'Draft';
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
                current += '"';
                j++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function parseTestCasesFromCSV(csvFile) {
    const testCases = {};
    let currentName = '';

    const csvLines = fs.readFileSync(csvFile, 'utf-8').split(/\r?\n/);

    for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i];
        if (!line.trim()) continue;

        const cols = parseCSVLine(line);
        const name = (cols[1] || '').trim();
        const step = (cols[14] || '').trim();

        if (name) {
            currentName = name;
            testCases[name] = {
                name,
                status: (cols[2] || '').trim(),
                precondition: (cols[3] || '').trim(),
                objective: (cols[4] || '').trim(),
                folder: (cols[5] || '').trim(),
                priority: (cols[6] || '').trim(),
                component: (cols[7] || '').trim(),
                labels: (cols[8] || '').trim(),
                coverageIssues: (cols[11] || '').trim(),
                steps: []
            };

            const testdata = (cols[15] || '').trim();
            const expected = (cols[16] || '').trim();
            if (step) {
                testCases[name].steps.push({ description: step, testData: testdata, expectedResult: expected });
            }
        } else if (currentName && step) {
            const testdata = (cols[15] || '').trim();
            const expected = (cols[16] || '').trim();
            testCases[currentName].steps.push({ description: step, testData: testdata, expectedResult: expected });
        }
    }

    return Object.values(testCases);
}

// "Ajour/{Module}/{TICKET-ID} {Summary}" -> { module: "AjourBox", subfolder: "AJB-14059 Move Files" }
function parseFolderPath(folderPath) {
    const parts = folderPath.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    return { module: parts[1], subfolder: parts.slice(2).join('/') };
}

// Validates "{Module}" against zephyr_folders.json. The Zephyr Scale folder REST
// resource (/rest/atm/1.0/folder) returns HTTP 500 on this Jira instance for both
// listing and single-folder lookups, so folder assignment goes through the
// testcase endpoint's `folder` path field instead (confirmed working — see
// feedback_zephyr_upload_atm_api memory) rather than resolving/creating a folderId.
function validateModule(module, moduleMap) {
    const moduleEntry = moduleMap.get(module.toLowerCase());
    if (!moduleEntry) {
        const validModules = Array.from(moduleMap.values()).map(m => m.name).join(', ');
        throw new Error(
            `Unknown module '${module}' in Folder path. Valid modules (from zephyr_folders.json): ${validModules}. ` +
            `Ask the user which module this ticket belongs to, fix the Folder column in the CSV, and re-run the upload.`
        );
    }
    return moduleEntry;
}

async function createTestCase(tc, folderPath) {
    const steps = tc.steps.map(s => {
        const step = { description: s.description };
        if (s.testData) step.testData = s.testData;
        if (s.expectedResult) step.expectedResult = s.expectedResult;
        return step;
    });

    const payload = {
        projectKey: PROJECT_KEY,
        name: tc.name,
        folder: folderPath.startsWith('/') ? folderPath : `/${folderPath}`,
        priority: normalizePriority(tc.priority),
        status: normalizeStatus(tc.status),
        testScript: { type: 'STEP_BY_STEP', steps }
    };

    if (OWNER) payload.owner = OWNER;
    if (tc.precondition) payload.precondition = tc.precondition;
    if (tc.objective) payload.objective = tc.objective;
    if (tc.component) payload.component = tc.component;
    if (tc.labels) payload.labels = tc.labels.split(',').map(l => l.trim()).filter(Boolean);
    if (tc.coverageIssues) {
        const issueLinks = tc.coverageIssues.match(/[A-Z][A-Z0-9]+-\d+/g);
        if (issueLinks) payload.issueLinks = [...new Set(issueLinks)];
    }

    return makeRequest('POST', '/rest/atm/1.0/testcase', payload);
}

async function main() {
    const moduleMap = loadModuleFolderMap();
    const tcList = parseTestCasesFromCSV(CSV_FILE);

    if (tcList.length === 0) {
        console.error('ERROR: No test cases found in CSV.');
        process.exit(1);
    }

    console.log(`Found ${tcList.length} test cases with ${tcList.reduce((sum, tc) => sum + tc.steps.length, 0)} total steps\n`);

    // Validate one Folder path per distinct value in the CSV (module must be a known key).
    const groups = new Map();
    for (const tc of tcList) {
        if (!groups.has(tc.folder)) groups.set(tc.folder, []);
        groups.get(tc.folder).push(tc);
    }

    const validFolderPaths = new Set();
    const folderErrors = new Map();

    for (const folderPath of groups.keys()) {
        const parsed = parseFolderPath(folderPath);
        if (!parsed) {
            folderErrors.set(folderPath, `Invalid Folder path '${folderPath}' — expected "Ajour/{Module}/{TICKET-ID} {Summary}"`);
            continue;
        }
        try {
            validateModule(parsed.module, moduleMap);
            validFolderPaths.add(folderPath);
            console.log(`  ✓ Folder path valid: ${folderPath}`);
        } catch (err) {
            folderErrors.set(folderPath, err.message);
            console.error(`  ✗ ${err.message}`);
        }
    }
    console.log('');

    console.log('Creating test cases...\n');
    let success = 0, failed = 0;

    for (const [folderPath, tcs] of groups) {
        const folderValid = validFolderPaths.has(folderPath);
        for (const tc of tcs) {
            if (!folderValid) {
                console.log(`  [SKIP] ${tc.name} — ${folderErrors.get(folderPath)}`);
                failed++;
                continue;
            }
            try {
                const resp = await createTestCase(tc, folderPath);
                if (String(resp.status).match(/^2/)) {
                    console.log(`  [OK]   ${tc.name} (${tc.steps.length} steps)`);
                    success++;
                } else {
                    console.log(`  [FAIL] ${tc.name} (HTTP ${resp.status})`);
                    if (resp.text) console.error(`         ${resp.text.substring(0, 200)}`);
                    failed++;
                }
            } catch (err) {
                console.log(`  [ERROR] ${tc.name} - ${err.message}`);
                failed++;
            }
        }
    }

    console.log('\n=========================================');
    console.log(`  Total   : ${tcList.length}`);
    console.log(`  Created : ${success}`);
    if (failed > 0) console.log(`  Failed  : ${failed}`);
    console.log('=========================================');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
