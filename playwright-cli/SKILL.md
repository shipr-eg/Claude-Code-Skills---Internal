---
name: playwright-cli
description: |
  Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.

  ALWAYS use for Zephyr-driven test generation: when the user wants to run, execute, or generate test cases from Zephyr Scale. Immediately run the list-zephyr-testcases.sh script to show available test cases, let the user pick a key, fetch that test case with get-zephyr-testcase.sh, execute each step interactively in a real headed browser, then generate a production-ready test script following the project's 3-layer architecture (Components → Operations → Tests).
---

# Browser Automation with playwright-cli

## Quick start

```bash
# open new browser
playwright-cli open
# navigate to a page
playwright-cli goto https://playwright.dev
# interact with the page using refs from the snapshot
playwright-cli click e15
playwright-cli type "page.click"
playwright-cli press Enter
# take a screenshot (rarely used, as snapshot is more common)
playwright-cli screenshot
# close the browser
playwright-cli close
```

## Commands

### Core

```bash
playwright-cli open
# open and navigate right away
playwright-cli open https://example.com/
playwright-cli goto https://playwright.dev
playwright-cli type "search query"
playwright-cli click e3
playwright-cli dblclick e7
playwright-cli fill e5 "user@example.com"
playwright-cli drag e2 e8
playwright-cli hover e4
playwright-cli select e9 "option-value"
playwright-cli upload ./document.pdf
playwright-cli check e12
playwright-cli uncheck e12
playwright-cli snapshot
playwright-cli snapshot --filename=after-click.yaml
playwright-cli eval "document.title"
playwright-cli eval "el => el.textContent" e5
playwright-cli dialog-accept
playwright-cli dialog-accept "confirmation text"
playwright-cli dialog-dismiss
playwright-cli resize 1920 1080
playwright-cli close
```

### Navigation

```bash
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload
```

### Keyboard

```bash
playwright-cli press Enter
playwright-cli press ArrowDown
playwright-cli keydown Shift
playwright-cli keyup Shift
```

### Mouse

```bash
playwright-cli mousemove 150 300
playwright-cli mousedown
playwright-cli mousedown right
playwright-cli mouseup
playwright-cli mouseup right
playwright-cli mousewheel 0 100
```

### Save as

```bash
playwright-cli screenshot
playwright-cli screenshot e5
playwright-cli screenshot --filename=page.png
playwright-cli pdf --filename=page.pdf
```

### Tabs

```bash
playwright-cli tab-list
playwright-cli tab-new
playwright-cli tab-new https://example.com/page
playwright-cli tab-close
playwright-cli tab-close 2
playwright-cli tab-select 0
```

### Storage

```bash
playwright-cli state-save
playwright-cli state-save auth.json
playwright-cli state-load auth.json

# Cookies
playwright-cli cookie-list
playwright-cli cookie-list --domain=example.com
playwright-cli cookie-get session_id
playwright-cli cookie-set session_id abc123
playwright-cli cookie-set session_id abc123 --domain=example.com --httpOnly --secure
playwright-cli cookie-delete session_id
playwright-cli cookie-clear

# LocalStorage
playwright-cli localstorage-list
playwright-cli localstorage-get theme
playwright-cli localstorage-set theme dark
playwright-cli localstorage-delete theme
playwright-cli localstorage-clear

# SessionStorage
playwright-cli sessionstorage-list
playwright-cli sessionstorage-get step
playwright-cli sessionstorage-set step 3
playwright-cli sessionstorage-delete step
playwright-cli sessionstorage-clear
```

### Network

```bash
playwright-cli route "**/*.jpg" --status=404
playwright-cli route "https://api.example.com/**" --body='{"mock": true}'
playwright-cli route-list
playwright-cli unroute "**/*.jpg"
playwright-cli unroute
```

### DevTools

```bash
playwright-cli console
playwright-cli console warning
playwright-cli network
playwright-cli run-code "async page => await page.context().grantPermissions(['geolocation'])"
playwright-cli tracing-start
playwright-cli tracing-stop
playwright-cli video-start
playwright-cli video-stop video.webm
```

## Open parameters
```bash
# Use specific browser when creating session
playwright-cli open --browser=chrome
playwright-cli open --browser=firefox
playwright-cli open --browser=webkit
playwright-cli open --browser=msedge
# Connect to browser via extension
playwright-cli open --extension

# Use persistent profile (by default profile is in-memory)
playwright-cli open --persistent
# Use persistent profile with custom directory
playwright-cli open --profile=/path/to/profile

# Start with config file
playwright-cli open --config=my-config.json

# Close the browser
playwright-cli close
# Delete user data for the default session
playwright-cli delete-data
```

## Snapshots

After each command, playwright-cli provides a snapshot of the current browser state.

```bash
> playwright-cli goto https://example.com
### Page
- Page URL: https://example.com/
- Page Title: Example Domain
### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

You can also take a snapshot on demand using `playwright-cli snapshot` command.

If `--filename` is not provided, a new snapshot file is created with a timestamp. Default to automatic file naming, use `--filename=` when artifact is a part of the workflow result.

## Browser Sessions

```bash
# create new browser session named "mysession" with persistent profile
playwright-cli -s=mysession open example.com --persistent
# same with manually specified profile directory (use when requested explicitly)
playwright-cli -s=mysession open example.com --profile=/path/to/profile
playwright-cli -s=mysession click e6
playwright-cli -s=mysession close  # stop a named browser
playwright-cli -s=mysession delete-data  # delete user data for persistent session

playwright-cli list
# Close all browsers
playwright-cli close-all
# Forcefully kill all browser processes
playwright-cli kill-all
```

## Local installation

In some cases user might want to install playwright-cli locally. If running globally available `playwright-cli` binary fails, use `npx playwright-cli` to run the commands. For example:

```bash
npx playwright-cli open https://example.com
npx playwright-cli click e1
```

## Test Generation from Zephyr Scale

When the user wants to run or generate test cases, use the Zephyr Scale API via the two shell scripts in this skill directory. No CSV files needed — test cases live in Zephyr Scale.

### Workflow Overview

- **If the user already provided a test case key** (e.g., `AJB-T753`) — skip straight to fetching it. Do NOT run the list script first.
- **If no key was provided** — ask whether to list all test cases or filter by folder, then run `list-zephyr-testcases.sh` accordingly, show the output, and ask the user to pick a key.

1. **[If no key given] Ask folder preference** — Ask the user: all test cases or a specific folder?
2. **[If no key given] List test cases** — Run `list-zephyr-testcases.sh` (with or without folder argument) and show available test cases
3. **[If no key given] User picks a key** — Wait for the user to select a test case key (e.g., `AJB-T1234`)
4. **Fetch test case** — Run `get-zephyr-testcase.sh <key>` and display the full test script
5. **Pre-execution planning** — Read ALL steps, identify prerequisites and correct order before opening browser
6. **Execute in browser** — Open playwright-cli in headed mode, screenshot-first for element identification
7. **Clarification on Demand** — Ask user ONLY when a step is ambiguous or an element cannot be found
8. **Code Generation** — Generate complete test file, operations, and components following the 3-layer architecture

### Step 1: Decide Whether to List or Fetch Directly

**If the user message contains a test case key** (matches pattern `AJB-T\d+`), skip listing entirely and jump to Step 2 immediately.

**If no key was provided**, first ask the user whether to fetch all test cases or filter by a specific folder:

```
Would you like to fetch test cases from a specific folder or all test cases?
  1. All test cases
  2. Specific folder (e.g. /ReactUI/, /ReactUI/RecycleBin, /API)
```

Wait for the user's answer, then run the appropriate command:

```bash
# Option 1 — All test cases (no folder argument)
bash .claude/skills/playwright-cli/list-zephyr-testcases.sh

# Option 2 — Specific folder (pass the folder name the user provided)
bash .claude/skills/playwright-cli/list-zephyr-testcases.sh "/ReactUI/"
bash .claude/skills/playwright-cli/list-zephyr-testcases.sh "/ReactUI/RecycleBin"
```

Display the full output and ask:

```
Which test case would you like to run? (enter the key, e.g. AJB-T1234)
```

Wait for the user's selection before proceeding.

### Step 2: Fetch the Selected Test Case

Run the get script with the key (either provided directly by the user or selected from the list) and display the full output:

```bash
bash .claude/skills/playwright-cli/get-zephyr-testcase.sh AJB-T1234
```

The script displays all test case details including:
- **Overview** — status, priority, folder, component, labels
- **Description** — what the test verifies
- **Precondition** — any setup needed before the test starts
- **Test Steps** — numbered list of Action / Test Data / Expected Result for each step

Show the complete output to the user so they can confirm the right test case was fetched before execution begins.

### Step 3: Map Folder to Test Directory

Use the `folder` field from Zephyr to determine where to save the generated test file:

| Zephyr folder | Test directory |
|---|---|
| `/ReactUI/AjourBox` | `tests/ajourBox/` |
| `/ReactUI/RecycleBin` | `tests/recycleBin/` |
| `/ReactUI/Admin` | `tests/admin/` |
| `/ReactUI` (no subdirectory) | `tests/inspectQA/` |
| `/API` | `tests/api/` |

Use `tests/ajourBox/` as the default if the folder does not map clearly.

### Step 4: Pre-execution Planning — Read ALL Steps First

**Before opening the browser**, read every Zephyr step and identify:

1. **Prerequisites / order dependencies** — some tabs/actions require a project to be selected first. If any step says "select project", it must happen before clicking module tabs. Executing tabs before selecting a project triggers an alert dialog and wastes time.
2. **Correct execution order** — reorder steps mentally if the Zephyr order would trigger an error (e.g., select project → then click tab, not the other way around).
3. **Known module quirks** — see [references/module-patterns.md](references/module-patterns.md) for per-module element patterns and step-to-operation mappings.

### Step 5: Get Credentials and Open Browser

Use the hardcoded test credentials and open browser in headed mode:

```bash
# Hardcoded test credentials
BASELOGIN="superman@testdc.dk"
BASEPASS="12345678"

# Open browser in headed mode (so user can see it running) - ALWAYS use --headed
playwright-cli open --headed https://develop.ajoursystem.tech

# Take screenshot FIRST to visually identify the UI, then snapshot for refs
playwright-cli screenshot --filename=login-page.png
playwright-cli snapshot --filename=login-page.yaml
```

**Element identification strategy — screenshot before snapshot:**
1. `playwright-cli screenshot` → look at the image to visually locate the element
2. `playwright-cli snapshot` → find the matching ref (e1, e2, …) for the visually identified element
3. Click/fill by ref

Never spend time on JS `eval` calls to discover elements. If the right element isn't obvious from the snapshot YAML, take a screenshot first — the visual makes identification immediate.

### Step 6: Execute Test Steps Interactively

Execute each Zephyr test step using playwright-cli commands in sequence:

```bash
# Example: Fill email and password, click login
playwright-cli fill e1 "superman@testdc.dk"
playwright-cli fill e2 "12345678"
playwright-cli click e3

# After each step, take a snapshot to verify it worked
playwright-cli snapshot --filename=after-login.yaml
```

**Automatic Execution Rules:**
- Parse each step from Zephyr and map it to a playwright-cli command
- Execute step automatically if it's clear (e.g., "Click Project Selector" → `playwright-cli click e5`)
- Take snapshot after each step to confirm the action worked
- **Ask user for clarification ONLY if:**
  - The step is vague or ambiguous (e.g., "do something" without detail)
  - An element cannot be found in the snapshot
  - The expected state doesn't match after executing a step
  - A step references UI that isn't visible or has changed

**Retry limit — stop and ask after 2–3 attempts:**
After **2 failed attempts** on the same action (element not found, wrong state, unexpected error), do NOT keep retrying. Instead, stop and ask the user:
> "I've tried X times to [describe what you attempted] but [describe what went wrong]. How would you like me to proceed?"
Options to offer:
- Skip this step and continue
- Try a different approach (describe an alternative)
- Investigate the page manually (share a screenshot)
- Abort test generation for now

Never silently loop or keep trying variations beyond 2–3 attempts without checking in.

### Step 7: Capture Snapshots After Key Steps

Always take a snapshot after significant steps so you can see what happened:

```bash
playwright-cli snapshot --filename=step-02-after-action.yaml
```

These snapshots show clickable elements with refs and help identify what to interact with next.

### Step 8: After Successful Execution, Map Steps to Operations

Once all test steps have been executed successfully in the browser, map each step to existing operations in the codebase. This mapping guides code generation:

| Zephyr Step | Operation Method | Module |
|---|---|---|
| "Navigate to ajourbox" | Automatic via `navigation` fixture | - |
| "Select project" | `boxOperations.selectProject(projectName)` | BoxOperations |
| "Create a folder under files on project" | `dataConnection.createProjectFolder(name, projectId, parentId)` (API) | DataConnection |
| "Create a folder via UI" | `boxOperations.createFolderOnfilesOnProject(projectName, folderName)` | BoxOperations |
| "Right click on created folder and click rename folder option" | `boxOperations.renameFolder(oldName, newName)` | BoxOperations |
| "Delete the folder created" | `dataConnection.deleteProjectFolder(folderId, projectId)` (API) | DataConnection |
| "Upload files to folder" | `boxOperations.uploadFilesToFolder(filePaths)` | BoxOperations |
| "Delete files from folder" | `boxOperations.deleteFilesFromFolder(fileNames)` | BoxOperations |
| "Search for file" | `boxOperations.searchForFile(searchTerm)` | BoxOperations |
| "Verify file is visible" | `expect(boxOperations.filesOnProjectComponent.fileInListByName(name)).toBeVisible()` | Components |
| "Click on folder" | `boxOperations.clickOnFolder(folderName)` | BoxOperations |

**Key principle**:
- Use **API operations** (`dataConnection.*`) for setup and teardown (faster, more reliable)
- Use **UI operations** (`boxOperations.*`) for the actual test steps
- Only add new operations if the step doesn't match any existing method

See `src/operations/boxOperations.ts`, `src/operations/generalOperations.ts`, `src/operations/dataConnection.ts` for the complete list of available operations.

### Step 9: Generate the Test File

Create a new test file following the existing pattern. File location: `tests/<module>/<test-name-kebab-case>.test.ts`

**Template (for AjourBox tests):**

The test title must follow the format `"<Zephyr key> - <Test Name from Zephyr>"` — e.g., `"AJB-T1234 - Rename folder"`.

```typescript
import { test, expect } from "./testFixtures";

test("AJB-T1234 - Test Name from Zephyr", async ({ login, navigation, boxOperations, basicConfig, env, generalOperations, dataConnection, page }) => {
    // Fixture 'login' automatically handles authentication using baseloginname/baseloginpassword
    // User is already logged in before test starts
    
    // Test setup: Generate unique names
    const folderName = await generalOperations.generateFolderName();
    const projectId = await dataConnection.getProjectId(basicConfig[env].projectName);
    const rootFolderId = await boxOperations.getRootFolderParentId(projectId);

    // Step 1: Select project (if needed)
    await boxOperations.selectProject(basicConfig[env].projectName);

    // Step 2: Create folder via API (faster than UI)
    const folderResponse = await dataConnection.createProjectFolder(folderName, projectId, rootFolderId);
    const folderId = folderResponse.id;

    // Step 3: Reload to see changes in UI
    await generalOperations.pageReload();

    // Step 4: Perform UI action - rename folder
    await boxOperations.renameFolder(folderName, `${folderName}_renamed`);

    // Step 5: Verify the action
    await expect(boxOperations.filesOnProjectComponent.folderInTreeByName(`${folderName}_renamed`)).toBeVisible();
    await expect(boxOperations.filesOnProjectComponent.folderInTreeByName(folderName)).not.toBeVisible();

    // Cleanup: Delete folder via API
    await dataConnection.deleteProjectFolder(folderId, projectId);
});
```

**Authentication in fixtures:** The `login` fixture automatically logs in using `basicConfig[env].baseloginname` and `basicConfig[env].baseloginpassword` before any test starts. This replaces the previous cookie injection approach.

**Key patterns:**
1. **API setup** — Use `dataConnection` to create test data quickly
2. **Reload after API calls** — `await generalOperations.pageReload()` so UI reflects changes
3. **UI test steps** — Use `boxOperations.*` methods
4. **Assertions** — Use `expect()` with locators from `boxOperations.filesOnProjectComponent.*`
5. **API cleanup** — Delete test data via API at the end

### Step 10: Add Operations or Components (if needed)

**Only if** a Zephyr step doesn't map to existing operations:

- Add public method to `src/operations/boxOperations.ts` following the existing pattern (JSDoc + implementation)
- Add component locators to `src/components/boxComponents/*.ts` if new UI elements need mapping

**Do not** add operations for every step — reuse existing ones.

### Step 11: Run and Validate the Generated Test

```bash
# Run the newly generated test
npx playwright test tests/ajourBox/rename_folder.test.ts

# View the HTML report
npx playwright show-report
```

---

### Complete Example: "Rename folder" from Zephyr

**Zephyr test case (fetched via `get-zephyr-testcase.sh AJB-T1234`):**
```
Key:    AJB-T1234
Name:   Rename folder
Folder: /ReactUI/AjourBox
Precondition: User is logged in, project exists

Test Steps:
  Step 1  Action: Login with develop credentials
  Step 2  Action: Select project
  Step 3  Action: Create a folder under files on project
  Step 4  Action: Right click on created folder and click rename folder option
  Step 5  Action: Click ok
  Step 6  Action: Verify the rename is successful
  Step 7  Action: Delete the folder created
```

**Interactive Browser Execution Flow:**
1. Ask user: fetch all test cases or a specific folder? → run `list-zephyr-testcases.sh` with or without a folder argument accordingly
2. User picks a key (e.g., `AJB-T1234`) → run `get-zephyr-testcase.sh AJB-T1234` and display the full output
3. **Read ALL steps first** — identify prerequisites and correct execution order before opening browser
4. Open browser in headed mode → `playwright-cli open --headed https://develop.ajoursystem.tech`
5. For each step: take a **screenshot first** to visually locate the element, then snapshot for the ref
6. Execute each step automatically; take snapshots after key steps to verify execution
7. If any step is ambiguous or an element cannot be found, ask user for clarification
8. After successful execution, map steps to existing operations

**Generated test file** (`tests/ajourBox/rename_folder.test.ts`):

```typescript
import { test, expect } from "./testFixtures";

test("AJB-T1234 - Rename folder", async ({ login, navigation, boxOperations, basicConfig, env, generalOperations, dataConnection, page }) => {
    // Fixture 'login' automatically handles authentication with develop credentials
    // User is already logged in before the test starts
    
    const folderName = await generalOperations.generateFolderName();
    const projectId = await dataConnection.getProjectId(basicConfig[env].projectName);
    const rootFolderId = await boxOperations.getRootFolderParentId(projectId);
    const newFolderName = `${folderName}_renamed`;

    // 1. Select project
    await boxOperations.selectProject(basicConfig[env].projectName);

    // 2. Create a folder under files on project via API
    const folderResponse = await dataConnection.createProjectFolder(folderName, projectId, rootFolderId);
    const folderId = folderResponse.id;

    // 3. Reload the page to see the newly created folder in the UI
    await generalOperations.pageReload();

    // 4. Right click on created folder and click rename folder option
    await boxOperations.renameFolder(folderName, newFolderName);

    // 5. Verify the rename is successful
    await expect(boxOperations.filesOnProjectComponent.folderInTreeByName(newFolderName)).toBeVisible();
    await expect(boxOperations.filesOnProjectComponent.folderInTreeByName(folderName)).not.toBeVisible();

    // 6. Delete the folder created via API
    await dataConnection.deleteProjectFolder(folderId, projectId);
});
```

**Login approach:**
- The `login` fixture automatically authenticates using `basicConfig[env].baseloginname` and `basicConfig[env].baseloginpassword`
- No need for manual cookie injection or auth file manipulation
- User is fully authenticated before test execution begins

**Run it:**
```bash
npx playwright test rename_folder.test.ts
```

---

## Example: Form submission

```bash
playwright-cli open https://example.com/form
playwright-cli snapshot

playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "password123"
playwright-cli click e3
playwright-cli snapshot
playwright-cli close
```

## Example: Multi-tab workflow

```bash
playwright-cli open https://example.com
playwright-cli tab-new https://example.com/other
playwright-cli tab-list
playwright-cli tab-select 0
playwright-cli snapshot
playwright-cli close
```

## Example: Debugging with DevTools

```bash
playwright-cli open https://example.com
playwright-cli click e4
playwright-cli fill e7 "test"
playwright-cli console
playwright-cli network
playwright-cli close
```

```bash
playwright-cli open https://example.com
playwright-cli tracing-start
playwright-cli click e4
playwright-cli fill e7 "test"
playwright-cli tracing-stop
playwright-cli close
```

**Fallback rule:** If something fails, check the previous step once (re-take a screenshot/snapshot to verify state). If it still fails on the second attempt, stop and ask the user what to do next — do not retry more than 2–3 times total on any single action.

## Specific tasks

* **Request mocking** [references/request-mocking.md](references/request-mocking.md)
* **Running Playwright code** [references/running-code.md](references/running-code.md)
* **Browser session management** [references/session-management.md](references/session-management.md)
* **Storage state (cookies, localStorage)** [references/storage-state.md](references/storage-state.md)
* **Test generation** [references/test-generation.md](references/test-generation.md)
* **Tracing** [references/tracing.md](references/tracing.md)
* **Video recording** [references/video-recording.md](references/video-recording.md)
* **Module-specific UI patterns** [references/module-patterns.md](references/module-patterns.md)

