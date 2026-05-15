#!/usr/bin/env node
/**
 * Upload test cases from CSV to Zephyr Scale via REST API.
 * Handles test script steps with descriptions, test data, and expected results.
 *
 * Usage: node zephyr_upload_with_steps.js <csv-file-path>
 *
 * The CSV file must contain columns:
 * - Column 1 (Name): Test case name (only on first row of test case)
 * - Column 2 (Status): Draft, Approved, Deprecated
 * - Column 3 (Precondition): Prerequisites for test case
 * - Column 4 (Objective): Test objective
 * - Column 6 (Priority): High, Medium, Low
 * - Columns 14-16: Step description, Test Data, Expected Result
 *
 * Step rows have empty Name column but contain step data in columns 14-16.
 */

const fs = require('fs');
const https = require('https');

// Load .env properly
const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx < 0) return;

    const key = line.substring(0, idx).trim();
    let value = line.substring(idx + 1).trim();
    value = value.replace(/^["']+|["']+$/g, '');
    envVars[key] = value;
});

const API_TOKEN = envVars.ZEPHYR_API_TOKEN;
const BASE_URL = envVars.ZEPHYR_BASE_URL || 'https://jira.eg.dk';
const PROJECT_ID = parseInt(envVars.PROJECT_ID || '14901');
const AJOURBOX_ID = parseInt(envVars.PARENT_ID || '26283');  // AjourBox folder ID
const OWNER = envVars.JIRA_USER_KEY || 'JIRAUSER33050';
const { execSync } = require('child_process');

if (!API_TOKEN) {
    console.error('ERROR: ZEPHYR_API_TOKEN missing from .env');
    process.exit(1);
}

const CSV_FILE = process.argv[2];
if (!CSV_FILE || !fs.existsSync(CSV_FILE)) {
    console.error(`ERROR: CSV file not found: ${CSV_FILE}`);
    process.exit(1);
}

function makeRequest(method, path, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: data ? JSON.parse(data) : null,
                        text: data
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: null,
                        text: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (payload) {
            req.write(JSON.stringify(payload));
        }
        req.end();
    });
}

function priorityId(p) {
    if (p.includes('Critical')) return 1407;
    if (p.includes('High')) return 1408;
    if (p.includes('Low')) return 1410;
    return 1409;
}

function statusId(s) {
    if (s.includes('Approved')) return 1400;
    if (s.includes('Deprecated')) return 1401;
    return 1399;
}

function flattenFolders(node, parentId = 0) {
    const results = [[node.id, node.name, parentId]];
    for (const child of node.children || []) {
        results.push(...flattenFolders(child, node.id));
    }
    return results;
}

async function main() {
    try {
        // Helper function to parse CSV with proper quote handling
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
                    values.push(current.trim().replace(/^"/, '').replace(/"$/, ''));
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim().replace(/^"/, '').replace(/"$/,''));
            return values;
        }

        // Fetch folders
        console.log('Fetching folder list from Zephyr...');
        const folderResp = await makeRequest('GET', `/rest/tests/1.0/project/${PROJECT_ID}/foldertree/testcase`);
        if (folderResp.status !== 200) {
            console.error(`ERROR: Failed to fetch folders (HTTP ${folderResp.status})`);
            process.exit(1);
        }

        let allFolders = [];
        for (const root of folderResp.data.children || []) {
            allFolders.push(...flattenFolders(root, 0));
        }
        console.log(`  Loaded ${allFolders.length} folders from Zephyr`);

        // Extract folder name from CSV
        let csvFolder = '';
        const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
        const fileLines = fileContent.split('\n');
        for (let i = 1; i < fileLines.length; i++) {
            const cols = parseCSVLine(fileLines[i]);
            if (cols[1] && cols[1].trim()) {
                csvFolder = (cols[5] || '').trim();
                break;
            }
        }

        // Extract only the ticket folder name (last part, skip ReactUI/AjourBox)
        const ticketFolder = csvFolder.split('/').pop();
        console.log(`  Ticket folder: ${ticketFolder}`);

        // Look for ticket folder - search by name anywhere first (more flexible)
        let ticketFolderId = null;
        for (const [fId, fName, pId] of allFolders) {
            if (fName === ticketFolder) {
                ticketFolderId = fId;
                console.log(`  ✓ Found existing folder (id: ${ticketFolderId})`);
                break;
            }
        }

        // If folder doesn't exist, create it under AjourBox
        if (!ticketFolderId) {
            console.log(`  Creating subfolder under AjourBox...`);
            try {
                // Create folder using Zephyr MCP tool via subprocess
                const createCmd = `node -e "
                  const { execSync } = require('child_process');
                  try {
                    const result = execSync('npx zephyr-cli create-folder --project AJB --name \\'${ticketFolder}\\' --parent 26283 --type testcase', { encoding: 'utf-8' });
                    console.log('Folder created via CLI');
                  } catch(e) {
                    // Fallback: Try REST API or alternative method
                    console.log('Folder creation attempt completed');
                  }
                "`;

                // For now, just log that we'll try to create via REST API alternative
                console.log(`  ⚠ Note: Please ensure folder '${ticketFolder}' exists under AjourBox (26283)`);
                console.log(`  Creating folder via command: zephyr create-folder --project AJB --parent-id 26283 --name '${ticketFolder}'`);

                // Try to create using a simple HTTP approach
                const createPayload = {
                    name: ticketFolder,
                    parentFolderId: AJOURBOX_ID
                };

                // Try alternative API endpoints
                const endpoints = [
                    `/rest/tests/1.0/project/${PROJECT_ID}/folders/testcase`,
                    `/rest/tests/1.0/project/${PROJECT_ID}/folder/testcase`,
                    `/rest/api/2/projects/AJB/folders/testcase`
                ];

                let folderCreated = false;
                for (const endpoint of endpoints) {
                    try {
                        const createResp = await makeRequest('POST', endpoint, createPayload);
                        if (createResp.status === 201 || createResp.status === 200) {
                            if (createResp.data && createResp.data.id) {
                                ticketFolderId = createResp.data.id;
                                console.log(`  ✓ Folder created successfully (id: ${ticketFolderId})`);
                                folderCreated = true;
                                break;
                            }
                        }
                    } catch (e) {
                        // Try next endpoint
                    }
                }

                if (!folderCreated) {
                    console.error(`ERROR: Could not create folder '${ticketFolder}' under AjourBox`);
                    console.error(`Please create the folder manually via:
                      1. Zephyr UI: ReactUI > AjourBox > Create new folder '${ticketFolder}'
                      2. Or via command: npx claude code --command "create-folder --project AJB --name '${ticketFolder}' --parent 26283"`);
                    process.exit(1);
                }
            } catch (err) {
                console.error(`ERROR: Failed to create folder: ${err.message}`);
                process.exit(1);
            }
        }
        console.log('');
        console.log('Parsing test cases and steps...');
        console.log('');

        // Parse CSV for metadata and steps - proper quoted CSV parsing
        const testCases = {};
        let currentName = '';

        const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
        const csvLines = csvContent.split(/\r?\n/);

        for (let i = 1; i < csvLines.length; i++) {
            const line = csvLines[i];
            if (!line.trim()) continue;

            const cols = parseCSVLine(line);

            const name = (cols[1] || '').trim();
            const step = (cols[14] || '').trim();

            // New test case row
            if (name) {
                currentName = name;
                const status = (cols[2] || '').trim() || 'Draft';
                const precond = (cols[3] || '').trim();
                const objective = (cols[4] || '').trim();
                const priority = (cols[6] || '').trim() || 'Normal';

                testCases[name] = {
                    name,
                    status,
                    precondition: precond,
                    objective,
                    priority,
                    steps: []
                };

                // Include first step if on same row (columns 14-16)
                const testdata = (cols[15] || '').trim();
                const expected = (cols[16] || '').trim();
                if (step) {
                    testCases[name].steps.push({
                        description: step,
                        testData: testdata,
                        expectedResult: expected
                    });
                }
            } else if (currentName && step) {
                // Step row for current test case (Name is empty, but has step data)
                const testdata = (cols[15] || '').trim();
                const expected = (cols[16] || '').trim();
                testCases[currentName].steps.push({
                    description: step,
                    testData: testdata,
                    expectedResult: expected
                });
            }
        }

        const tcList = Object.values(testCases);
        console.log(`Found ${tcList.length} test cases with ${tcList.reduce((sum, tc) => sum + tc.steps.length, 0)} total steps\n`);

        console.log('Creating test cases with steps...');
        console.log('');

        let success = 0, failed = 0;

        for (const tc of tcList) {
            // Build steps, only including non-empty fields
            const steps = tc.steps.map(s => {
                const step = { description: s.description };
                if (s.testData) step.testData = s.testData;
                if (s.expectedResult) step.expectedResult = s.expectedResult;
                return step;
            });

            const payload = {
                projectId: PROJECT_ID,
                name: tc.name,
                folderId: ticketFolderId,
                priorityId: priorityId(tc.priority),
                statusId: statusId(tc.status),
                owner: OWNER,
                testScript: {
                    stepByStepScript: {
                        steps: steps
                    }
                }
            };

            if (tc.precondition) payload.precondition = tc.precondition;
            if (tc.objective) payload.objective = tc.objective;

            try {
                const resp = await makeRequest('POST', '/rest/tests/1.0/testcase', payload);
                if (String(resp.status).match(/^2/)) {
                    console.log(`  [OK]   ${tc.name} (${tc.steps.length} steps)`);
                    success++;
                } else {
                    console.log(`  [FAIL] ${tc.name} (HTTP ${resp.status})`);
                    if (resp.text) console.error(`         ${resp.text.substring(0, 100)}`);
                    failed++;
                }
            } catch (err) {
                console.log(`  [ERROR] ${tc.name} - ${err.message}`);
                failed++;
            }
        }

        console.log('=========================================');
        console.log(`  Total   : ${tcList.length}`);
        console.log(`  Created : ${success}`);
        if (failed > 0) console.log(`  Failed  : ${failed}`);
        console.log('=========================================');

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

main();
