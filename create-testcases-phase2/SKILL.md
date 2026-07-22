---
name: create-testcases-phase2
description: >
  Create comprehensive test cases from a Jira issue key using Jira + the Ajour Knowledge Base + deep git commit
  analysis from the upstream repository, with optional upload to Zephyr Scale. Most thorough coverage; slower
  than Jira-only analysis due to git cloning.
compatibility: Requires Jira MCP tools, Bash for git commit analysis from upstream repository, Confluence MCP tools for knowledge base integration, curl/node for Zephyr API upload
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, EnterPlanMode, ExitPlanMode, AskUserQuestion, Task, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_transitions, mcp__mcp-jira-service__jira_get_worklog, mcp__mcp-jira-service__jira_download_attachments, mcp__mcp-jira-service__jira_add_comment, mcp__mcp-zephyr-server__get_project, mcp__mcp-zephyr-server__get_folders, mcp__mcp-zephyr-server__create_folder, mcp__mcp-confluence-service__confluence_search, mcp__mcp-confluence-service__confluence_get_page
---

# Create Test Cases — Phase 2 (Jira + Ajour Knowledge Base + Git Commit Analysis)

## Overview

Generates test cases from a Jira issue using **Jira context + the Ajour Knowledge Base + deep git commit analysis** from the upstream repository, grounded in the product's actual positioning, role model, and license model (see Step 3b). Git commits reveal actual implementation (bug fixes, edge cases) beyond Jira's stated intent. If you only need fast, Jira-only test cases without git cloning, use `create-testcases-phase1` instead.

**Output:** Analysis file at `.claude/skills/create-testcases-phase2/{TICKET-ID}-analysis.md` + `src/testdata/{TICKET-ID}-testcases.csv` (19-column format) + optional Zephyr Scale upload.

## Quick Start

```bash
/create-testcases-phase2 AJB-123
```

## Workflow

### 1. Extract issue key

Parse the Jira key (e.g. `AJB-123`) from user input. Ask for clarification if missing/unclear.

### 2. Fetch Jira context

Call `jira_get_issue` and gather:
- Summary, description, type, priority, status, labels, components
- Acceptance criteria (description/custom fields), Given/When/Then scenarios, comments (edge cases, hidden requirements)
- Linked issues — fetch each **recursively** via `jira_get_issue`:
  - `blocks` / `is blocked by` → note as blocking scenarios
  - Related bugs → analyze in context (not just keyword matching) to find where the bug fix should be verified within this feature's workflows
- Parent epic (folder context), subtasks, attachments (`jira_download_attachments`), worklog, transitions

If no acceptance criteria can be found anywhere (description, comments, linked issues), stop and tell the user: "No acceptance criteria found. Skipping test case creation."

### 3. Search the Ajour Knowledge Base

1. Load `memory/kb_cache.json` if it exists; otherwise build it from `.claude/skills/create-testcases-phase2/KB_MAPPING.md` (pages, categories, keywords) and save it there.
2. Match ticket summary/component keywords against the cached Keywords → Page mapping.
3. Fetch full content (`confluence_get_page`) for only the top 2-3 matches.
4. Use KB specs to align expected results, constraints, and boundary values — you'll cross-reference these against the actual code in Step 4.

### 3b. Reference Ajour domain docs (product, roles, licenses)

Read these three static reference docs once, in `.claude/skills/create-testcases-phase2/`:

- `Positioning EG Ajour_4.md` — product positioning: module purpose (AjourInspect+QA, AjourBox, AjourFM, AjourTender), primary users, value proposition. Use to sanity-check that scenarios match how the module is actually positioned/used.
- `user-roles.md` — role → typical-action matrix per module. Use to pick a plausible actor for Role/Permission-Based scenarios (e.g. a Building Owner only views in AjourBox and uploads nothing).
- `system-hierarchy-and-access.md` — the 8-role hierarchy (System Administrator, Project Administrator, Project Manager, Project Assistant, User, Observer, AjourBox User, AjourTender User — these map 1:1 to `generalOperations.getRoleID()` in `src/operations/generalOperations.ts`) and the A/B/C license model, which gates Inspect/QA registration-creation independently of role.

### 4. Deep git commit analysis

Git commits reveal actual implementation (bug fixes, edge cases) beyond Jira intent.

```bash
bash ./.claude/skills/create-testcases-phase2/list_upstream_commits.sh {TICKET-ID}
```

For each commit found, fetch the full diff:
```bash
cd /tmp && git clone --quiet --depth 200 --branch develop https://github.com/EG-A-S/ajoursystem-build-web repo_analysis
cd repo_analysis
git show {COMMIT-HASH} --stat     # Files changed
git show {COMMIT-HASH}            # Full code diffs
```

Extract from the diffs: files modified (Component/Operation/API layers), code patterns (validation, CSS/JS constraints, state management, edge-case handling), specific boundary insights (size limits, truncation points, regex patterns, responsive breakpoints), and what bugs were fixed. Map each to a test angle: Component changes → UI interaction tests; Operation changes → workflow/bug-fix tests; API changes → edge-case/error-handling tests; bug fixes → regression tests; config changes → state tests.

If git clone fails or no commits are found, continue with Jira + KB analysis only and note: "Git commit analysis unavailable — falling back to Jira-only coverage."

### 5. Write the analysis file

Create `.claude/skills/create-testcases-phase2/{TICKET-ID}-analysis.md` (`Write` tool) containing: Jira details, functional understanding (1-3 line summary + problem/current/expected/impact), acceptance criteria, related/linked issues, comments & edge cases, git commit analysis (commits, files, bug fixes, code patterns, boundary values), and a requirements-to-scenario mapping. See an existing `*-analysis.md` in this folder for structure.

### 6. Build test scenarios

From the Jira + KB + git + domain-doc context, generate scenarios in this order:
1. Positive (happy path) — 1-2
2. Edge cases (boundary values, empty/max inputs) — 2-3
3. Boundary conditions — 1-2
4. Negative/error conditions — 1-2
5. Integration with other modules — 1-2
6. Role/permission-based — 1-2 (actor chosen from `user-roles.md`; use the 8-role hierarchy in `system-hierarchy-and-access.md` for access-boundary scenarios)
7. State/toggle-based — 0-1
8. License-based — 0-1, only if the ticket touches Inspect/QA registration creation (verify A/B/C license gates registration creation independently of role, per `system-hierarchy-and-access.md`)
9. Blocking relationships (if any `blocks`/`is blocked by` links exist) — verify blocked/unblocked states
10. Related bug-fix verification (if a linked bug or git bug-fix relates to this feature's workflow) — verify the fix and add a regression test

### 7. Write test cases

```
Test Case #1: [Scenario Description]
Knowledge Base Reference: [KB page title/URL, if applicable]
Linked/Blocking Issues: [e.g. "Blocked by AJB-456", "Verifies fix for AJB-555"]
Precondition: [initial state, e.g. "User has valid credentials"]
Step 1: Login with valid credentials
Step 2: Navigate to AjourBox
Step 3: Select project "[project name]"
Step 4: [feature-specific action]
Step 5: Verify [expected outcome]
Expected Result: [clear, verifiable outcome]
```

Rules: one Playwright-style action per step (Login, Navigate, Select, Click, Drag, Enter, Verify...), no Given/When/Then narrative, minimal preconditions.

### 8. Export CSV

File: `src/testdata/{TICKET-ID}-testcases.csv`, 19-column header:
```
Key,Name,Status,Precondition,Objective,Folder,Priority,Component,Labels,Owner,Estimated Time,Coverage (Issues),Coverage (Pages),Automation Status,Test Script (Step-by-Step) - Step,Test Script (Step-by-Step) - Test Data,Test Script (Step-by-Step) - Expected Result,Test Script (Plain Text),Test Script (BDD)
```
- One metadata row per test case (`Name`, `Status: Draft`, `Precondition`, `Objective`, `Folder`, `Priority`, `Component`, `Labels`, `Coverage (Issues)`, first step), then one row per remaining step with only the step columns filled.
- `Folder`: `Ajour/{Module}/{TICKET-ID} {Summary}`. `{Module}` must be one of the canonical keys in `zephyr_folders.json` (repo root): `RecycleBin`, `AjourBox`, `Dashboard`, `AjourTender`, `AjourInspect`, `AjourFM`, `Administration`. The upload script reads this file to resolve `{Module}` to its Zephyr folder ID — there is no hardcoded folder ID anywhere in the skill. **If the module isn't clear from the Jira component/context, ask the user via `AskUserQuestion` before writing the CSV** — do not guess.
- `Priority`: Zephyr only supports `High`/`Normal`/`Low` — Jira's `Medium` maps to `Normal`.
- `Labels`/`Coverage (Issues)`: include relationship tags (`blocks:KEY`, `blocked-by:KEY`, `verifies-fix:KEY`) when applicable.
- Escape commas/quotes; number steps sequentially.

**Example:**
```csv
Key,Name,Status,Precondition,Objective,Folder,Priority,Component,Labels,Owner,Estimated Time,Coverage (Issues),Coverage (Pages),Automation Status,Test Script (Step-by-Step) - Step,Test Script (Step-by-Step) - Test Data,Test Script (Step-by-Step) - Expected Result,Test Script (Plain Text),Test Script (BDD)
,"Happy Path - Move File",Draft,"User has valid credentials","Verify user can move file within same folder type",Ajour/AjourBox/AJB-14059 Move Files,Normal,Box,,,,AJB-14059,,,"Login with valid credentials","","Login succeeds, dashboard displayed"
,,,,,,,,,,,,,,"Navigate to AjourBox","","AjourBox module loads"
,,,,,,,,,,,,,,"Select project from list","","Project files are displayed"
,,,,,,,,,,,,,,"Drag file from Folder A1 to Folder A2","","File moves to destination"
,,,,,,,,,,,,,,"Verify file appears in Folder A2","","File is visible in Folder A2"
```

Use `Write` to create/overwrite the CSV file. After writing, verify every data row has exactly 19 comma-separated fields (e.g. parse the file with a quick inline check) before treating the CSV as done — a missing trailing comma on any row silently drops columns and breaks the Zephyr upload.

### 9. Optional Zephyr upload

Ask via `AskUserQuestion`: "Upload these test cases to Zephyr Scale now?" If yes:

1. **Create the target folder first** — most new tickets won't have an existing Zephyr folder yet, and the upload script cannot create one itself (see below). Use `mcp__mcp-zephyr-server__create_folder` with `project_key: "AJB"`, `name: "/" + <the CSV Folder column value>` (e.g. `/Ajour/AjourBox/AJB-14059 Move Files`), `folder_type: "TEST_CASE"`. If it errors because the folder already exists, ignore that and continue.
2. Run the upload script:
```bash
node ./.claude/skills/create-testcases-phase2/zephyr_api_upload.js src/testdata/{TICKET-ID}-testcases.csv
```
Requires `.env`: `ZEPHYR_API_TOKEN`, `ZEPHYR_BASE_URL`, `ZEPHYR_PROJECT_KEY`, `JIRA_USER_KEY`.

The script itself only validates `{Module}` against `zephyr_folders.json` and sends the folder as a path string on each test case — it does not call Zephyr's folder-creation REST endpoint (that endpoint returns HTTP 500 on this Jira instance). If step 1 is skipped, every test case fails with HTTP 400 `"...was not found for field folder..."` — create the folder via the MCP tool and re-run the script.

## Error Handling

| Scenario | Action |
|---|---|
| Issue key not found | "Issue {key} not found. Please verify the key and retry." |
| No acceptance criteria found | "No acceptance criteria found in description or comments. Skipping test case creation." |
| Jira API call fails | "Unable to fetch Jira issue. Please check your Jira connection and retry." |
| Linked tickets inaccessible | Continue with the main issue; note that some linked issues could not be accessed |
| Issue is an Epic or Subtask | Continue; organize test cases under the epic/parent accordingly |
| Empty description | Continue on acceptance criteria/comments only; note it in output |
| Git clone fails or no commits found | Continue with Jira + KB only; note git analysis was unavailable |
| CSV write fails | "Failed to write CSV file. Check directory permissions for src/testdata/" |
| Zephyr upload reports unknown module | The `Folder` column used a module not in `zephyr_folders.json` — ask the user which of the 7 modules to use, fix the CSV, and re-run the upload |

## Tips

- Analyze git commits **and** Jira together — git reveals what was actually implemented (bug fixes, edge cases), Jira reveals intent; combining both gives the most complete coverage.
- Check `src/testdata/dev_toggles.csv` / `feature_toggles.csv` for toggle-driven scenarios.
- Cross-reference `tests/` to avoid duplicating existing coverage.
- When a specific file changed, check what test fixtures/operations use it to find all affected workflows.
