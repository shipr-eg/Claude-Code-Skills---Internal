---
name: create-testcases
description: >
  Create comprehensive test cases from a Jira issue key with optional upload to Zephyr.
  Supports two phases: phase1 (Jira-only, fast) and phase2 (Jira + git analysis, thorough).
  Phase 1 analyzes Jira description, comments, acceptance criteria, linked tickets (recursive), parent epic, subtasks, attachments, and worklog.
  Phase 2 adds deep git commit analysis from upstream repository to reveal implementation details and edge cases.
  Test cases are output as structured text, exported to per-ticket CSV file, then prompts user to confirm before uploading to Zephyr Scale.
compatibility: Requires Jira MCP tools, Bash for git commit analysis from upstream repository, curl and jq for Zephyr API communication, Confluence MCP tools for knowledge base integration
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, EnterPlanMode, ExitPlanMode, AskUserQuestion, Task, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_transitions, mcp__mcp-jira-service__jira_get_worklog, mcp__mcp-jira-service__jira_download_attachments, mcp__mcp-jira-service__jira_add_comment, mcp__mcp-zephyr-server__get_project, mcp__mcp-zephyr-server__get_folders, mcp__mcp-confluence-service__confluence_search, mcp__mcp-confluence-service__confluence_get_page
---

# Create Test Cases from Jira Issue

## Overview

This skill automates the creation of comprehensive test cases from a Jira issue by analyzing issue context, automatically referencing the Ajour Knowledge Base for specifications, and optionally analyzing git commits from the upstream repository.

**Key Features:**
- ✅ **Jira Analysis** — Extracts requirements, acceptance criteria, linked tickets, comments, and worklog
- ✅ **Knowledge Base Integration** — Automatically searches KB for relevant pages and specifications
- ✅ **Git Analysis (Phase 2)** — Deep code analysis to reveal implementation details and edge cases
- ✅ **Specification Alignment** — Test cases align with both KB documented procedures and actual implementation

**Phase 1** (`/create-testcases phase1 {TICKET-ID}`):
- **Jira + Knowledge Base analysis:** Fetches comprehensive context including description, acceptance criteria, comments, linked tickets (recursively), parent epic, subtasks, attachments, worklog, and transitions
- **Automatically searches Ajour Knowledge Base** for pages related to ticket component and feature area
- Aligns test cases with official specifications and documented procedures
- Generates comprehensive test cases purely from Jira + KB context
- Fast execution — no git cloning required
- Outputs: CSV at `src/testdata/{TICKET-ID}-testcases.csv` + optional Zephyr upload
- No analysis .md file created

**Phase 2** (`/create-testcases phase2 {TICKET-ID}` or `/create-testcases {TICKET-ID}` default):
- **Full analysis:** Jira + Knowledge Base + deep git commit analysis from upstream repository
- Git commits reveal actual implementation details, bug fixes, and edge cases that must be tested
- **Knowledge Base provides specifications** that are mapped to actual code implementation
- Validates test scenarios against KB documented workflows and constraints
- Outputs: Analysis .md file at `.claude/skills/create-testcases/{TICKET-ID}-analysis.md` + CSV file + optional Zephyr upload
- Most thorough coverage — use when you want implementation-driven test cases aligned with official specifications

**Outputs:**
- ✅ **Test Cases CSV** (`src/testdata/{TICKET-ID}-testcases.csv`) — 19-column format ready for QA/automation
- ✅ **Analysis File (Phase 2 only)** (`.claude/skills/create-testcases/{TICKET-ID}-analysis.md`) — Complete reference with all Jira + git context

---

## Quick Start

```bash
# Phase 1: Jira-only (fast)
/create-testcases phase1 AJB-123

# Phase 2: Full analysis with git (default, recommended)
/create-testcases AJB-123
# or explicitly:
/create-testcases phase2 AJB-123
```

---

## Phase Selection

If user input contains:
- **`phase1`** → Execute Phase 1 Workflow (Jira + Knowledge Base only)
- **`phase2` or no phase** → Execute Phase 2 Workflow (Jira + KB + Git commits)

Extract the Jira issue key after removing the phase argument.

---

## Common Workflow Steps (Phase 1 & 2)

### Step 1: Extract and Validate Issue Key

Parse user input to extract Jira issue key (e.g., `AJB-123`, `PROJ-456`).
- If key is missing or unclear, ask user for clarification
- If phase is missing, default to Phase 2 and inform user: "No phase specified. Running Phase 2 (full analysis). Use `phase1 {TICKET-ID}` for Jira-only."

### Step 2: Fetch Comprehensive Jira Issue Details

Use `jira_get_issue` to retrieve ALL of the following:

**Core Issue Fields:**
- Summary and full Description
- Issue Type (Task, Story, Bug, Epic, Subtask)
- Priority (High, Normal, Low)
- Status (To Do, In Progress, Done, etc.)
- Labels and Components

**Acceptance Criteria & Requirements:**
- Acceptance criteria (Usually in description or custom fields)
- Detailed scenarios and user flows in description
- Comments (often contain additional test scenarios, edge cases, hidden requirements)
- Linked Issues (Epic, blockers, related features) — **fetch each linked ticket recursively** to extract requirements
  - **Blocking Relationships** (if related to feature):
    - `blocks` — THIS issue blocks other features (test: verify feature unavailable until this resolves)
    - `is blocked by` — THIS issue is blocked by dependencies (test: verify dependency state impacts this feature)
  - **Related Bugs** (based on context analysis, not keyword matching):
    - Analyze linked Bug issues in the context of acceptance criteria and scenarios
    - Include bugs that directly relate to feature workflows, data handling, edge cases, or error conditions
    - Example: If acceptance criteria mentions "file upload validation", and a linked bug describes "incorrect validation error message", include bug fix verification in test cases
    - Verify that bug fixes are working correctly within the feature's test scenarios
- Parent Epic (if any, for folder organization)
- Subtasks (if any)

**Additional Context:**
- Attachments — download if useful via `jira_download_attachments`
- Worklog via `jira_get_worklog` (to understand effort/complexity)
- Issue transitions via `jira_get_transitions` (to understand state changes needed for testing)

**Implementation:**
1. Call `jira_get_issue` with the provided issue key
2. Extract summary, description, type, priority, status, labels, components
3. Parse description for embedded acceptance criteria (look for "Given/When/Then" patterns)
4. For each linked issue or mentioned ticket, call `jira_get_issue` recursively to get full details
5. Extract all comments for edge cases and hidden requirements
6. Download and review any attachments that might contain test data or specifications

### Step 3: Build Functional Understanding

After fetching all Jira details, create a comprehensive functional understanding of the ticket:

**Level 1: Brief Summary**
- Generate a 1–3 line plain English summary of what this ticket is about
- Should be understandable to someone unfamiliar with the feature

**Level 2: Detailed Explanation**
- **Problem Being Solved:** What user pain point or business need is this addressing?
- **Current Behavior vs Expected Behavior:** If this is a bug fix or enhancement, describe the gap
- **Business Impact:** Why does this matter? Affected users/workflows, revenue implications, compliance requirements?
- **User Flow Changes:** If applicable, describe how the user's workflow changes after this feature
- **Edge Cases Identified:** List any edge cases or special scenarios mentioned in the issue

**Output Format:**
```
🎯 Functional Understanding

📌 Brief Summary:
[1-3 line summary]

📋 Detailed Explanation:
Problem: [Problem statement]
Current: [Current behavior]
Expected: [Expected behavior]
Impact: [Business impact]
Flow: [User flow changes if any]
```

### Step 4: Reference Knowledge Base Pages and External Impact

**A. Reference Local Documentation:**
- Use `Glob` to find relevant `.md` files in the project (CLAUDE.md, memory files, architecture docs)
- Use `Read` to extract relevant patterns, conventions, and related features

**B. Functional Impact Assessment:**
- Which features/modules are directly affected?
- What upstream/downstream dependencies exist?

**C. Cross-Feature Impact:**
- Reports, APIs, UI Flows, Permissions, Data Sync/Integration affected?

**D. Regression Risk Areas:**
- Which existing features might break?
- What special scenarios (toggles, permissions, user states) need testing?

**Output format:**
```
🔄 External Knowledge Lookup

📍 Functional Impact: [modules, dependencies]
🔀 Cross-Feature Impact: [reports, APIs, UI, permissions, data sync]
⚠️ Regression Risk: [features that might break, edge cases]
```

**Step 4b: Reference Knowledge Base Pages

Use cached KB structure to find and reference relevant knowledge base pages for this ticket:

**Implementation (Optimized with Caching):**

1. **Load KB Cache (First Priority):**
   - Check if `memory/kb_cache.json` exists
   - If YES: Load cached KB data (fast, no MCP calls)
   - If NO: Initialize cache (see Knowledge Base Caching Strategy section)

2. **Search Using Cached KB Data:**
   - Extract ticket summary and component keywords
   - Match against cached Keywords → Page ID mapping
   - Return matching pages with relevance scores
   - Example: "Project" + "Box" → ID: 393488008 (Ajour - Box Code walkthrough)

3. **Fetch Page Content (Only for Top Results):**
   - Use `confluence_get_page` ONLY for top 2-3 matching pages from cache
   - Retrieve page content (convert to markdown)
   - Extract useful information:
     - Feature specifications and requirements
     - User workflows and procedures
     - Configuration details
     - Related features or dependencies
     - Known limitations or constraints

4. **Search Strategy (Using Cache):**
   - Primary: Match ticket summary keywords to cached Keywords → Page mapping
   - Secondary: Match Jira component name to cached Component → Page mapping
   - Tertiary: Match feature area to cached Category → Page mapping
   - Filter results by relevance score from cache

**Output Format:**
```
📚 Knowledge Base References:
   
   ✓ Page: [Page Title]
     URL: https://confluence.eg.dk/spaces/AJB/pages/[PAGE-ID]/[Page-Title]
     Relevance: [Why this page is relevant to the ticket]
     Key Info: [Extracted useful info - 1-2 sentences]
   
   ✓ Page: [Related Page Title]
     URL: [Page URL]
     Relevance: [Why this page is relevant]
     Key Info: [Extracted useful info]
```

**Store References For Later Use:**
- Include found pages in the test case generation phase
- Reference knowledge base pages in generated test case steps (e.g., "Follow procedure from KB page X")
- Include knowledge base links in the CSV export (in Comments or Labels)

### Step 5: Extract Test Case Scenarios

Extract test case ideas from Jira context:
- Acceptance criteria (description/custom fields)
- Description scenarios and user flows
- Comments and edge cases
- Linked tickets (recursive)
- Subtasks

**Generate comprehensive test scenarios in order:**
1. **Positive Scenarios** (1-2): Happy path, main user flow
2. **Edge Cases** (2-3): Boundary values, empty inputs, max limits
3. **Boundary Conditions** (1-2): Min/max values, transition points
4. **Negative Scenarios** (1-2): Error conditions, invalid inputs
5. **Integration Scenarios** (1-2): Interactions with other modules
6. **Role/Permission-Based** (1-2): Different user roles or permission levels
7. **State-Based** (0-1): User states, toggles, project permissions
8. **Blocking Relationship Scenarios** (if related):
   - If issue `blocks` other features: Test that dependent features show "blocked" state or are unavailable until this resolves
   - If issue `is blocked by` dependencies: Test that this feature is unavailable/limited until blocking issue is resolved
   - Example: "Verify file upload is disabled until virus scan feature (AJB-XYZ) is enabled"
9. **Related Bug Verification Scenarios** (if related bugs exist):
   - Analyze linked Bug issues against acceptance criteria and feature workflows
   - Generate test cases that verify bug fixes work correctly within feature context
   - Include regression tests to prevent bug recurrence
   - Example: If bug describes "validation fails for special characters", and feature involves user input, create test: "Verify special characters are handled correctly in validation"
   - Example: If bug describes "error message displays incorrectly", verify the corrected message appears in proper scenarios

**Warnings for special cases:**
- Epic: "This is an Epic — subtask test cases will be created under it"
- Subtask: "This is a Subtask — test cases will be organized under parent"
- No criteria: Show error "No acceptance criteria found. Skipping test case creation."
- No Jira access: Show error "Unable to fetch Jira issue. Please verify the issue key and try again."

---

## Test Case Format (Used in Both Phases)

Generate a structured text list of test cases with clear, action-based steps suitable for automation. When applicable, reference knowledge base pages that document the expected behavior or procedure. Use this format:

```
Test Case #1: [Scenario Description]
Knowledge Base Reference: [KB page URL if applicable, e.g., "See KB: Project Creation Workflow"]
Linked/Blocking Issues: [If related: "Blocked by AJB-456", "Blocks AJB-789", "Verifies fix for AJB-555", etc.]
Precondition: [Initial setup state, e.g., "User has valid credentials"]
Step 1: Login with valid credentials
Step 2: Navigate to AjourBox
Step 3: Select project "[project name]"
Step 4: [Feature-specific action - as per KB page if applicable]
Step 5: Verify [expected outcome]
Expected Result: [Clear, verifiable outcome - reference KB specification if applicable]

Test Case #2: [Scenario Description]
Precondition: [Setup state]
Step 1: Login with valid credentials
Step 2: Navigate to AjourBox
Step 3: Select project "[project name]"
Step 4: [Feature-specific action]
...
Expected Result: [Clear outcome]
```

**Blocking Relationship Integration in Test Cases:**
- If issue `blocks` dependent features: Add test scenario verifying dependent feature is unavailable/disabled until this resolves
- If issue `is blocked by` dependency: Add test scenario showing feature is unavailable/limited until blocking issue resolves
- Include blocking issue key in metadata (e.g., "Linked/Blocking Issues: Blocks AJB-789")
- Example blocking test: "Verify upload feature shows 'Waiting for virus scan completion (AJB-456)' message"

**Related Bug Integration in Test Cases:**
- If linked Bug issues relate to feature acceptance criteria or workflows: Generate test cases verifying bug fixes
- Analyze bug description against feature scenarios to identify test context (not just keyword matching)
- Include bug key in metadata (e.g., "Linked/Blocking Issues: Verifies fix for AJB-555")
- Example bug fix test: "Verify validation error message displays correctly for special characters (fixes AJB-555)"
- Create regression test to prevent bug recurrence in the feature workflow

**Knowledge Base Integration in Test Cases:**
- If a KB page documents the expected behavior: Reference it in preconditions or as a note
- If KB specifies a procedure: Use KB steps in your test case steps
- If KB specifies constraints/limits: Include them in expected results
- Include KB page URL as a comment or metadata for team reference

**Step Writing Rules:**
- **Always start from Login + Navigate** — every test case begins with Login → Navigate to AjourBox → Select project, then feature-specific steps
- **One action per step** — each step = one Playwright interaction (click, select, drag, verify)
- **Use action verbs**: Login, Navigate, Select, Click, Drag, Enter, Verify, Confirm, Validate
- **Expected result per step** — can be inline in step or in final "Expected Result" summary
- **No Given/When/Then narrative** — remove all narrative format, use direct action verbs only
- **Minimize preconditions** — only state what must be true before starting (e.g., "User has account")

---

## CSV Export (Both Phases)

After generating and formatting all test cases using the Test Case Format above, create a CSV file:

**File:** `src/testdata/{TICKET-ID}-testcases.csv`

**Format:** 19-column structure (compatible with testCases.csv)
```
Key,Name,Status,Precondition,Objective,Folder,Priority,Component,Labels,Owner,Estimated Time,Coverage (Issues),Coverage (Pages),Automation Status,Test Script (Step-by-Step) - Step,Test Script (Step-by-Step) - Test Data,Test Script (Step-by-Step) - Expected Result,Test Script (Plain Text),Test Script (BDD)
```

**CSV generation process:**

1. Create header row (shown above)
2. For each test case, create multi-row entries:
   - **Row 1 (Metadata):**
     - `Name`: Test case title
     - `Status`: `Draft`
     - `Precondition`: Initial state (e.g., "User is logged in")
     - `Objective`: What's being verified
     - `Folder`: `ReactUI/AjourBox/{TICKET-ID} {Ticket Summary}` (AjourBox) or `ReactUI/{Module}/{TICKET-ID} {Summary}` (other)
     - `Priority`: From Jira issue priority. **Note:** Zephyr Scale supports `High`, `Normal`, and `Low`. Jira's `Medium` priority is automatically mapped to `Normal` during upload.
     - `Component`: From Jira issue component
     - `Labels`: From Jira issue labels (comma-separated). **If relationships exist, add them:** `blocks:AJB-789`, `blocked-by:AJB-456`, `verifies-fix:AJB-555`
     - `Coverage (Issues)`: Jira ticket key (e.g., `AJB-123`). **If blocking/bug scenarios exist, include related issues:** `AJB-123; blocked-by AJB-456; verifies-fix AJB-555`
     - `Test Script (Step-by-Step) - Step`: First step
     - All other fields: Empty
   
   - **Rows 2+ (Step rows):**
     - Only `Test Script (Step-by-Step) - Step` column has content
     - All other columns: Empty

3. Properly escape commas and quotes in field values
4. Number steps sequentially (1, 2, 3, etc.)
5. **For relationship-related test cases:** Include issue keys (blocking, blocked-by, bug-fixes) in Labels or Coverage columns for traceability
   - Format: `blocks:KEY`, `blocked-by:KEY`, `verifies-fix:KEY` in Labels
   - Format: `KEY; blocks KEY; blocked-by KEY; verifies-fix KEY` in Coverage (Issues)

**Example CSV rows:**
```csv
Key,Name,Status,Precondition,Objective,Folder,Priority,Component,Labels,Owner,Estimated Time,Coverage (Issues),Coverage (Pages),Automation Status,Test Script (Step-by-Step) - Step,Test Script (Step-by-Step) - Test Data,Test Script (Step-by-Step) - Expected Result,Test Script (Plain Text),Test Script (BDD)
,"Happy Path - Move File",Draft,"User has valid credentials","Verify user can move file within same folder type",ReactUI/AjourBox/AJB-14059 Move Files,Medium,Box,,,,AJB-14059,,,"Login with valid credentials","","Login succeeds, dashboard displayed"
,,,,,,,,,,,,,,"Navigate to AjourBox","","AjourBox module loads"
,,,,,,,,,,,,,,"Select project from list","","Project files are displayed"
,,,,,,,,,,,,,,"Drag file from Folder A1 to Folder A2","","File moves to destination"
,,,,,,,,,,,,,,"Verify file appears in Folder A2","","File is visible in Folder A2"
```

Use `Write` tool to create/overwrite the CSV file.

**After CSV creation:**
- Use `AskUserQuestion` to prompt: "Would you like to upload these test cases to Zephyr Scale now?"
- Options: "Yes, upload now" or "No, skip upload"
- If YES: Proceed to Zephyr upload step

---

## Phase 1 Workflow

Execute Steps 1-5 from Common Workflow above, then:

### Phase 1 Step 6: Export CSV and Confirm Upload

Follow CSV Export process above, then execute Zephyr upload script if user selects YES:

```bash
node ./.claude/skills/create-testcases/zephyr_api_upload.js src/testdata/{TICKET-ID}-testcases.csv
```

---

## Phase 2 Workflow: Full Analysis (Jira + Git)

Execute Steps 1-5 from Common Workflow above, then:

**IMPORTANT:** Git commits reveal actual implementation (bug fixes, edge cases) beyond Jira intent.

**1. Fetch git commits:**
```bash
bash ./.claude/skills/create-testcases/list_upstream_commits.sh {TICKET-ID}
```

**2. For EACH commit, fetch full diffs:**
```bash
cd /tmp && git clone --quiet --depth 200 --branch develop https://github.com/EG-A-S/ajoursystem-build-web repo_analysis
cd repo_analysis
git show {COMMIT-HASH} --stat     # Files changed
git show {COMMIT-HASH}            # Full code diffs
```

**3. Extract implementation details from code:**
- **Files modified:** Component/Operation/API layers, insertion/deletion counts
- **Code patterns:** Data types, validation, CSS constraints, JavaScript logic, state management, library integration, edge case handling, performance optimizations
- **Specific insights:** Width/size boundaries, string truncation points, conditional boundaries, array/loop logic, regex patterns, responsive breakpoints, event handling
- **Bug fixes:** What bugs were fixed, what edge cases discovered

**4. Create analysis file:**
Create `.claude/skills/create-testcases/{TICKET-ID}-analysis.md` with:
- Jira details
- Functional understanding
- Acceptance criteria table
- Related issues
- Issue description
- Comments & edge cases
- Git commit analysis (commits, files, bug fixes, code patterns, boundary values, test scenarios)
- Requirements mapping

**5. Map code patterns to test scenarios:**
- Component changes → Test UI elements and interactions
- Operation changes → Test workflows and bug fixes
- API changes → Test edge cases and error handling
- Bug fixes → Create regression tests
- Configuration changes → Test different states
- File additions → Test integration

### Phase 2 Step 7: Create Analysis File

**File location:** `.claude/skills/create-testcases/{TICKET-ID}-analysis.md`

**Contains:** Jira details, functional understanding, acceptance criteria, related issues, description, comments, git analysis (commits, files, code patterns, boundary values, scenarios), requirements mapping.

Use `Write` tool to create the file. See `AJB-14080-analysis.md` for structure.

### Phase 2 Step 8: Generate & Export Test Cases

Follow Test Case Format above. Open analysis file and extract scenarios from:
- Jira acceptance criteria, comments, edge cases
- Git code patterns, boundary values, implementation details

Follow CSV Export process, then ask user to confirm Zephyr upload:

```bash
node ./.claude/skills/create-testcases/zephyr_api_upload.js src/testdata/{TICKET-ID}-testcases.csv
```

`.env` must have: ZEPHYR_API_TOKEN, ZEPHYR_BASE_URL, ZEPHYR_PROJECT_KEY, JIRA_USER_KEY

---

## Knowledge Base Integration Guide

The `/create-testcases` skill automatically searches and references the Ajour Solution Knowledge Base (https://confluence.eg.dk/spaces/AJB/pages/393478390/Ajour+-+Solution+Knowledge+Base+KC) when generating test cases.

### Knowledge Base Caching Strategy

**Goal:** Minimize repeated Confluence MCP API calls by caching KB structure locally.

**First Run (Initialization):**
1. Skill checks if KB cache exists at `memory/kb_cache.json`
2. If NOT found:
   - Read KB_MAPPING.md from `.claude/skills/create-testcases/KB_MAPPING.md`
   - Parse the KB structure (pages, categories, keywords)
   - Generate and store cache at `memory/kb_cache.json`
   - Log: "✅ KB cache initialized (first run)"
3. Cache contains:
   - All 40 KB page IDs and titles
   - Keywords → Page ID mapping
   - Search priorities and relevance scores
   - Category organization

**Subsequent Runs:**
1. Skill checks for `memory/kb_cache.json`
2. If FOUND:
   - Load cached KB data (instant, no MCP calls)
   - Use cached data for all keyword searches
   - Log: "✅ Using cached KB structure (0 MCP calls)"
3. Benefits:
   - ⚡ Fast execution (no Confluence API latency)
   - 💾 Reduced API quota usage
   - 🔄 Works offline if KB_MAPPING.md is available
   - 📊 Scalable for team usage

**Cache Invalidation:**
- Cache is valid for the entire session/conversation
- If KB structure changes in Confluence, user can manually delete `memory/kb_cache.json` to force re-initialization
- OR skill can check KB_MAPPING.md modification date and auto-refresh if newer

### How Knowledge Base Integration Works

**Phase 1 (Jira-only):**
- Searches KB for pages matching ticket summary and component keywords
- Extracts feature specifications, workflows, and procedures
- References KB pages in functional understanding section
- Includes KB links in generated test cases for team reference

**Phase 2 (Jira + Git):**
- Performs deeper KB searches across multiple feature areas
- Maps KB specifications to actual git implementation changes
- Validates test scenarios against KB documented procedures
- Uses KB constraints and limits in boundary value testing
- Includes KB API documentation for API-related changes

### Using Knowledge Base in Test Cases

When a KB page is found relevant to a ticket:

1. **Specification Alignment:**
   - Verify test cases match KB documented behavior
   - Use KB specifications for expected results
   - Reference KB procedures in test steps

2. **Coverage Validation:**
   - Ensure test cases cover all KB-documented scenarios
   - Test features and constraints mentioned in KB
   - Validate against KB-specified user workflows

3. **Documentation:**
   - Include KB page URL in test case metadata
   - Reference KB page in preconditions if needed
   - Link test cases to KB pages for team collaboration

### Example: Knowledge Base Integration

**Ticket:** AJB-14080 - Project selector dropdown width issue

**KB Search Results:**
- Page: "Project Selection Workflow" (KB-2345)
  - Documents: How users select projects, dropdown behavior
  - Constraint: Dropdown width should not exceed available screen space
  - Related: Project naming conventions, long project name handling

**Integration in Test Cases:**
```
Test Case #1: Project Selection with Long Project Name
Knowledge Base Reference: See "Project Selection Workflow" (KB-2345) - Dropdown width constraints
Precondition: User has projects with names longer than 50 characters
Step 1: Login with valid credentials
Step 2: Navigate to AjourBox
Step 3: Click Project Selector dropdown
Step 4: Verify dropdown expands within available screen width (per KB specs)
Expected Result: Dropdown displays without horizontal scrollbar; long project names are visible
```

### Search Strategy for Knowledge Base

The skill searches KB using these strategies:

1. **Primary Search:**
   - Ticket summary keywords (e.g., "project creation", "file management")
   - Jira component name (e.g., "AjourBox", "Files")

2. **Secondary Search:**
   - Feature area from description (e.g., "permissions", "folder structure")
   - Related features from git commit analysis (e.g., API names, UI components)

3. **Tertiary Search:**
   - Parent epic title (if applicable)
   - Related issue names (from linked tickets)

### Knowledge Base Page Types

The skill recognizes and uses these KB page types:

- **Feature Specifications:** Detailed feature requirements and behavior
- **User Workflows:** Step-by-step procedures users follow
- **API Documentation:** API endpoints, parameters, responses
- **Configuration Guides:** System and feature configuration
- **Troubleshooting Guides:** Known issues and solutions
- **Architecture Pages:** System design and data flow
- **Permission Guidelines:** Role-based access specifications

### Best Practices

1. **Always Review KB Pages:** If KB pages are found, review them before finalizing test cases
2. **Validate Procedures:** Cross-reference test steps with KB documented procedures
3. **Check Constraints:** Ensure boundary value tests match KB constraints
4. **Update KB:** If test cases reveal gaps in KB, update KB documentation
5. **Link Test Cases:** Include KB page links in test management system for traceability

## Error Handling & Robustness

| Scenario | Action |
|----------|--------|
| Issue key not found | Show error: "Issue {key} not found. Please verify the key and retry." |
| No acceptance criteria found | Show error: "No acceptance criteria found in description or comments. Skipping test case creation." |
| Jira API call fails | Show error: "Unable to fetch Jira issue. Please check your Jira connection and retry." |
| CSV write fails | Show error: "Failed to write CSV file. Please check directory permissions for src/testdata/" |
| Linked tickets inaccessible | Continue with main issue analysis, note in output: "Some linked issues could not be accessed" |
| Issue type is Epic or Subtask | Show warning but continue: "This is an Epic/Subtask - test cases will be organized accordingly" |
| No linked issues found | Show info: "No linked issues found - focusing on main issue requirements only" |
| Empty description | Show warning: "Description is empty - relying on acceptance criteria and comments only" |

## Special Cases

### Subtasks
- If issue is a Subtask: Create folder under parent issue, not under epic
- Example: `Parent-Story > Subtask-123 > TC-Subtask-123-001`

### Bugs
- Generate test cases that reproduce the bug (negative cases)
- Include expected vs actual behavior
- Add "Regression" test cases to verify fix

### Epics
- Show warning but continue
- Generate test cases for the epic's acceptance criteria
- Create folder: `Epic-Key > TC-Epic-Key-001`

## Tips for Quality Test Cases

1. **Be Specific** - Each step should be actionable, not vague
2. **Use Clear Language** - Steps are for QA team, be unambiguous
3. **Cover Boundaries** - Include min/max values, special characters, nulls
4. **Mix Happy & Sad Paths** - Don't just test success scenarios
5. **Reference Requirements** - Link test cases to acceptance criteria
6. **Consider User Flows** - Think about how real users interact with the feature
7. **Include Blocking Scenarios** - If issue blocks or is blocked by dependencies, create test cases verifying blocked/unblocked states
8. **Analyze Related Bugs in Context** - For linked bugs, don't match by keyword alone:
   - Read bug description and understand what was broken
   - Analyze feature acceptance criteria to find related workflows
   - Identify where the bug would manifest in feature scenarios
   - Create test cases that verify the bug fix works correctly within feature context
   - Example: Bug describes "validation rejects special characters", Feature involves user input → Test that special characters are handled correctly
9. **Document Relationships** - Include all issue keys (blocking, blocked-by, bug-fixes) in test case metadata for traceability

## Example Test Cases

**Issue 1:** AJB-123 - User Login with Email

**Generated Test Case (Automation-Friendly Format):**
```
Test Case #1: Happy Path - Login with Valid Email and Password
Precondition: User has valid account credentials (email: test@example.com, password: SecurePass123!)
Step 1: Navigate to login page (go to /login)
Step 2: Enter email address in email field
Step 3: Enter password in password field (password characters are masked)
Step 4: Click Login button
Step 5: Verify dashboard is displayed with user name in header
Expected Result: User is successfully logged in, dashboard displays, auth token stored in secure cookie
```

This format maps directly to Playwright operations:
- `Navigate to login page` → `page.goto('/login')`
- `Enter email address in email field` → `page.fill('[email-selector]', 'test@example.com')`
- `Enter password in password field` → `page.fill('[password-selector]', 'SecurePass123!')`
- `Click Login button` → `page.click('[login-button-selector]')`
- `Verify dashboard displays` → `expect(page).toHaveURL('/dashboard')`

---

**Issue 2:** AJB-456 - File Upload Feature (Blocked by AJB-123 - Virus Scan Implementation)

**Generated Test Case (Blocking Scenario):**
```
Test Case #3: Verify Upload is Blocked Until Virus Scan Dependency Resolves
Linked/Blocking Issues: Is blocked by AJB-123 (Virus Scan Implementation)
Precondition: User is logged in; Virus scan feature (AJB-123) is NOT yet enabled
Step 1: Navigate to Files module
Step 2: Click "Upload File" button
Step 3: Attempt to select a file for upload
Step 4: Verify upload UI shows disabled/blocked state
Step 5: Verify message indicates dependency: "File upload unavailable - waiting for virus scan feature"
Expected Result: Upload button is disabled; user sees blocking message referencing AJB-123

Test Case #4: Verify Upload Works After Virus Scan Dependency Resolves
Linked/Blocking Issues: Is blocked by AJB-123 (Virus Scan Implementation)
Precondition: User is logged in; Virus scan feature (AJB-123) IS enabled
Step 1: Navigate to Files module
Step 2: Click "Upload File" button
Step 3: Select a safe test file
Step 4: Verify file upload proceeds normally
Step 5: Verify file appears in project after scan completes
Expected Result: Upload is available and functions as documented
```

---

**Issue 3:** AJB-789 - Filename Validation Enhancement (Verifies fix for AJB-555 - Special Characters Bug)

**Related Bug Context:** AJB-555 describes that validation incorrectly rejects filenames with hyphens and underscores, showing confusing error message "Invalid character detected". Feature AJB-789 implements proper validation that accepts hyphens/underscores and shows correct error messages for truly invalid characters.

**Generated Test Cases (Related Bug Verification):**
```
Test Case #5: Verify Filenames with Hyphens and Underscores are Accepted
Linked/Blocking Issues: Verifies fix for AJB-555 (Special Characters Validation Bug)
Precondition: User is logged in; File upload form is open; Feature AJB-789 is deployed
Step 1: Navigate to Files module
Step 2: Click "Upload File" button
Step 3: Select file named "project-report_v2.1.pdf"
Step 4: Verify filename field accepts the input without error
Step 5: Verify error message does NOT appear for hyphens/underscores
Expected Result: File with hyphens and underscores uploads successfully; no validation error (fixes AJB-555)

Test Case #6: Verify Correct Error Message for Actually Invalid Characters
Linked/Blocking Issues: Verifies fix for AJB-555 (Special Characters Validation Bug)
Precondition: User is logged in; File upload form is open; Feature AJB-789 is deployed
Step 1: Navigate to Files module
Step 2: Click "Upload File" button
Step 3: Select file named "report@#$.pdf" (contains truly invalid characters @#$)
Step 4: Verify validation fails with correct error message
Step 5: Verify message states: "Filename contains invalid characters: @ # $. Allowed: letters, numbers, hyphens, underscores"
Expected Result: Validation rejects file and shows accurate error message describing allowed characters (fixes AJB-555 bug fix)
```

## Next Steps & Integration

Once test cases are generated and CSV is created:

**For QA Team:**
1. Review generated test cases for clarity and completeness
2. Adjust test steps if needed for better clarity
3. Update CSV file with any corrections or additions
4. Import CSV into test management system or use with playwright-cli

**For Automation Team:**
1. CSV file is ready for use with `playwright-cli` skill
2. CSV follows 19-column format compatible with `testCases.csv`
3. Can directly reference test cases by Name in CSV for automated test generation
4. Playwright test scripts can be auto-generated from CSV test cases

**For Development Team:**
1. Review test cases for technical feasibility
2. Identify any additional edge cases or scenarios
3. Provide feedback on test coverage and risk areas
4. Use test cases to drive implementation and validation

**Integration Points:**
- CSV file location: `src/testdata/<TICKET-ID>-testcases.csv`
- Compatible with: `playwright-cli` skill for Playwright test generation
- Format: Standard 19-column CSV matching `testCases.csv` structure
- Status: Draft (can be updated to "Approved" once reviewed)

## Tips for Success

1. **Git + Jira Combined Analysis**: ALWAYS analyze both git commits AND Jira issue together. Git reveals what was actually implemented (bug fixes, edge cases); Jira reveals intended requirements. Together they provide complete test coverage.
2. **Map Git Insights to Test Cases**: For each bug fix or edge case mentioned in commits, generate specific test cases that verify the fix and test boundary conditions.
3. **Combine Results**: Use git insights + functional understanding + regression risk areas to prioritize test cases
4. **Analyze Linked Bugs in Context**: For each linked Bug issue:
   - Read the bug description to understand what was broken or incorrect
   - Analyze feature acceptance criteria and workflows to find where bug would manifest
   - Create test cases verifying the bug fix works correctly in feature context
   - Generate regression tests to prevent bug recurrence
   - Don't rely on keyword matching alone—use contextual understanding
5. **Leverage Toggles**: Check `src/testdata/dev_toggles.csv` and `feature_toggles.csv` for state-based scenarios
6. **Cross-Reference**: Look at existing tests in `tests/` to identify duplicate scenarios
7. **Validate CSV**: Ensure CSV can be read by opening in Excel or text editor to verify format
8. **Team Review**: Have QA lead review test cases before marking as "Approved"
9. **File Changes Analysis**: When git shows specific files changed, analyze the test fixtures and operations those files use to identify all affected workflows
10. **Zephyr Upload Status**: After skill completes, verify upload success by checking Zephyr UI or checking the summary report
11. **Retry Mechanism**: If Zephyr API is temporarily unavailable, retry the upload using the bash script directly with the generated CSV file