---
name: create-testcases
description: Create comprehensive test cases from a Jira issue key with optional upload to Zephyr. Use this whenever the user provides a Jira issue key and wants to generate test cases. Analyzes issue description, comments, acceptance criteria, linked tickets, parent epic, subtasks, AND git commits from upstream repository to automatically generate and organize test cases covering happy path, edge cases, positive and negative scenarios. Git commit analysis reveals implementation details, bug fixes, and edge cases for more thorough test coverage. Test cases are output as structured text, exported to a per-ticket CSV file, then prompts user to confirm before uploading to Zephyr Scale. Use this skill whenever someone says "create test cases for [ticket]", "generate tests for [issue]", "make test cases from [key]", or provides a Jira issue key expecting test case generation.
compatibility: Requires Jira MCP tools, Bash for git commit analysis from upstream repository, curl and jq for Zephyr API communication
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, EnterPlanMode, ExitPlanMode, AskUserQuestion, Task, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_transitions, mcp__mcp-jira-service__jira_get_worklog, mcp__mcp-jira-service__jira_download_attachments, mcp__mcp-jira-service__jira_add_comment, mcp__mcp-zephyr-server__get_project, mcp__mcp-zephyr-server__get_folders
---

# Create Test Cases from Jira Issue

## Overview

This skill automates the creation of comprehensive test cases from a Jira issue by analyzing **both Jira AND git commits** from the upstream repository. Git commits reveal actual implementation details, bug fixes, and edge cases that must be tested. 

**Two-Phase Approach:**
1. **Phase 1 - Analysis:** Create a comprehensive `.md` analysis file combining all Jira context (description, comments, attachments, acceptance criteria, worklog) + deep git code analysis (commits, patterns, boundary values)
2. **Phase 2 - Test Generation:** Use the analysis file as a single source of truth to generate comprehensive test cases covering happy paths, edge cases, boundary conditions, and user scenarios

**Outputs:**
- ✅ **Analysis File** (`.claude/skills/create-testcases/{TICKET-ID}-analysis.md`) — Complete reference with all Jira + git context
- ✅ **Test Cases CSV** (`src/testdata/{TICKET-ID}-testcases.csv`) — 19-column format ready for QA/automation

## Workflow

### 1. Extract Issue Key from User Input

The user will provide a Jira issue key (e.g., `AJB-123`, `PROJ-456`). If the key is unclear or incomplete, ask for clarification.

### 2. Fetch Comprehensive Jira Issue Details

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

### 3. Build Functional Understanding

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

### 4. Analyze Git Commits for Implementation Details (MANDATORY - DEEP CODE ANALYSIS)

**IMPORTANT:** This step is REQUIRED for every test case generation. Git commits reveal what was actually implemented, not just what was intended in Jira. This requires REAL code analysis of actual diffs, not just reading commit messages.

**1. Fetch ALL Git Commits for Ticket:**
- Always run the `list_upstream_commits.sh` script to fetch commits from upstream repository
- Command: `bash ./.claude/skills/create-testcases/list_upstream_commits.sh {TICKET-ID}`
- Capture ALL commit hashes related to the ticket
- If no commits found, note it in output but continue with Jira analysis

**2. Fetch Actual Code Diffs (NOT Just Commit Messages):**
For EACH commit found, fetch the full diff to understand actual implementation:

```bash
# Clone upstream repo and extract diffs for ALL commits
cd /tmp && git clone --quiet --depth 200 --branch develop https://github.com/EG-A-S/ajoursystem-build-web repo_analysis
cd repo_analysis

# For each commit hash found:
git show {COMMIT-HASH} --stat          # See which files changed and insertion/deletion counts
git show {COMMIT-HASH} | head -1000    # See full code diffs

# Store analysis in file:
git show {COMMIT-HASH} > /tmp/{TICKET-ID}-commit-{HASH}.diff
```

**3. Deep Code Analysis - Extract Concrete Implementation Details:**

For EACH modified file, analyze the actual code changes:

**A. Files Changed:**
- Extract exact file paths from diff header: `diff --git a/path/to/file b/path/to/file`
- Identify component/operation/API files modified
- Check file path to understand layer (Components, Operations, API, Utils)
- Count insertions/deletions from `--stat` to understand change magnitude

**B. Code Pattern Analysis - Look for:**

**Data Types & Validation:**
- What variable types are used? (const, let, useState, useRef, etc.)
- Any null checks, length validations, regex patterns?
- Type annotations (TypeScript interfaces, prop types)
- Default values, fallbacks, empty checks

**CSS/Styling Changes:**
- Width/height constraints (`width: 300px`, `maxWidth`, `minHeight`)
- Overflow handling (`overflow: hidden`, `text-overflow: ellipsis`)
- Responsive breakpoints (@media queries)
- Animations, transitions, positioning

**JavaScript Logic:**
- New functions added or modified
- Conditional logic (`if`, `switch`, ternary operators)
- Loops (`map`, `filter`, `reduce`, `for`)
- Array operations (`.length`, `.splice`, `.push`)
- String manipulations (`substring`, `slice`, `split`, `regex`)
- Event handlers (`onClick`, `onHover`, `onChange`)

**State Management:**
- New state variables (`useState`, `useRef`, `useContext`)
- useEffect hooks and dependencies
- State update logic and re-render triggers
- State transitions and lifecycle

**Library Integration:**
- New imports (`import X from 'library'`)
- Component usage (MUI components, React hooks, utilities)
- API calls, HTTP methods, parameters
- Third-party library versions and features

**Edge Case Handling:**
- Try/catch blocks, error handling
- Null coalescing (`?.`, `??`)
- Optional parameters, default values
- Boundary checks (length > 50, width < 300, etc.)
- Empty/null handling

**Performance Optimizations:**
- Memoization patterns (useMemo, useCallback, React.memo)
- Conditional rendering optimizations
- Event delegation vs direct listeners

**C. Specific Implementation Insights to Extract:**

**Width/Size Constraints:**
- If code has `width: 300px`, test at boundaries: 299, 300, 301
- If code has `maxWidth: menuWidth`, test at exact FormControl width
- If code has `overflow: hidden`, test that content clips correctly

**String Truncation:**
- If code uses CSS `text-overflow: ellipsis`, test that "..." appears (CSS, not JS)
- If code uses `substring()` or `slice()`, test truncation point
- Find exact character limit that triggers truncation (e.g., 50 chars)
- If code uses `scrollWidth > clientWidth`, test the exact boundary

**Conditionals/Boundaries:**
- If code has `if (length > 50)`, specifically test: 49, 50, 51 characters
- If code has `if (width < 400)`, test: 399, 400, 401 pixels
- If code has `array.length === 0`, test: empty array, 1 item, multiple items

**Array/Loop Logic:**
- If code maps over array (`.map()`), test: empty array, single item, multiple items
- If code filters items, test: all pass, some pass, none pass filters
- If code uses array indexing, test: out of bounds, edge indices

**Regex Patterns:**
- If code validates with regex, find the pattern and test boundary cases
- Test special characters, Unicode, empty strings

**Measurements & Comparisons:**
- If using `scrollWidth > clientWidth`, test at exact boundary where it flips
- If using `element.offsetWidth`, test width measurement accuracy
- If comparing timestamps, test boundary dates and timezones

**Hover/Events/Interactions:**
- If code adds tooltip on hover, test: hover appearance, hover timing, keyboard access
- If code triggers on click, test: double-click, right-click, keyboard activation
- If code uses onChange, test: rapid changes, empty value, special characters

**Responsive Behavior:**
- If code uses media queries or responsive logic, identify breakpoints
- Test at each breakpoint (mobile: 320px, tablet: 768px, desktop: 1024px)
- Test window resize behavior (if layout updates dynamically)

**NOTE:** All specific ticket code examples and patterns should be documented in the `{TICKET-ID}-commit-analysis.md` file, NOT here. This skill remains completely generic and ticket-agnostic.

**5. Map Code Changes to Test Scenarios (CRITICAL STEP):**

Use the analysis file to generate specific test scenarios:
- **Component Changes** → Test the affected UI elements, interactions, and edge cases from code patterns
- **Operation Changes** → Test workflows that use those operations and any bug fixes
- **API Changes** → Test API edge cases and response handling, including error scenarios
- **Bug Fixes** → Create regression tests to verify the fix works AND test related edge cases
- **Configuration Changes** → Test different configuration states and feature toggles
- **File Additions** → Test new files/components and how they integrate with existing code

**Implementation:**
1. Extract TICKET-ID from user input (e.g., AJB-14080)
2. Run: `bash ./.claude/skills/create-testcases/list_upstream_commits.sh {TICKET-ID} --format oneline` (get all commit hashes)
3. For EACH commit hash:
   - Run: `git clone --depth 200 https://github.com/EG-A-S/ajoursystem-build-web /tmp/repo_analysis`
   - Run: `git show {COMMIT-HASH} --stat` (see files changed)
   - Run: `git show {COMMIT-HASH}` (see actual code diffs)
   - Extract code patterns from diff
4. Create analysis file at `.claude/skills/create-testcases/{TICKET-ID}-analysis.md`
5. For each code pattern found, generate 2-3 specific test scenarios:
   - Happy path (code works as intended)
   - Boundary test (test at exact code limits)
   - Edge case (off-by-one errors, special characters, empty values)
6. Document critical boundary values to test
7. Merge git analysis with Jira analysis to build comprehensive test scenario list

**Output Format:**
```
🔧 Implementation Insights from Git Commits:

📝 Commits Found: 2 commits
   - 73598cd2a: AJB-14080 Solved project selector dropdown too wide in React UI caused by long project names
   - 18877cbf3: AJB-14080 Fixed Project selector dropdown expands too wide in new React UI
   
📂 Files Modified Indicators:
   - Project selector component (dropdown behavior)
   - Project selection logic
   
🐛 Bug Fixes Identified:
   - Dropdown expanding too wide with long project names
   - UI layout breaking with edge case inputs
   
🔍 Test Scenarios Required from Git Analysis:
   - Test dropdown with short project names (< 20 chars)
   - Test dropdown with long project names (> 50 chars)
   - Test dropdown with maximum length project names
   - Test dropdown expansion doesn't break layout
   - Test dropdown positioning with various screen sizes
   - Regression: Verify fix works across browsers
```

### 5. Perform External Knowledge Lookup

Use the project's documentation and memory system to assess broader impact:

**1. Reference Local Documentation**
- Use `Glob` to find relevant `.md` files in the project (CLAUDE.md, memory files, architecture docs)
- Use `Read` to extract relevant patterns, conventions, and related features
- Look for related features mentioned in documentation

**2. Functional Impact Assessment**
- Which features/modules are directly affected by this change?
- What upstream dependencies must be updated?
- What downstream features depend on this change?

**3. Cross-Feature Impact Analysis**
Does this change affect:
- **Reports?** (Does data model/filtering change?)
- **APIs?** (Do endpoints need updates? New endpoints needed?)
- **UI Flows?** (Other screens affected? Navigation changes?)
- **Permissions?** (New roles/permissions needed?)
- **Data Sync/Integration?** (External system synchronization affected?)

**4. Regression Risk Areas**
- Identify existing features that might break due to this change
- Surface edge cases that could be introduced
- Note any special scenarios (user states, toggles, permissions) that need testing

**Output Format:**
```
🔄 External Knowledge Lookup

📍 Functional Impact:
   - Affected modules: [modules]
   - Dependencies: [upstream/downstream]

🔀 Cross-Feature Impact:
   - Reports: [impact if any]
   - APIs: [impact if any]
   - UI Flows: [impact if any]
   - Permissions: [impact if any]
   - Data Sync: [impact if any]

⚠️ Regression Risk Areas:
   - Feature [X] might be affected because [reason]
   - Edge case: [scenario] could break if [not tested]
   - Special scenarios: [toggles/states/permissions needed]
```

### 6. Create Comprehensive Analysis File (.md)

**Purpose:** Create a single source of truth combining ALL Jira context + git analysis for test case generation and future reference.

**File Location:** `.claude/skills/create-testcases/{TICKET-ID}-analysis.md`

**File Structure:** The .md file should contain (in this order):

1. **Jira Issue Details Section**
   - Issue Key, Title, Type, Status, Priority, Component, Assignee
   - Epic Link, Sprint, Fix Version, Linked Issues, Subtasks
   - Time Tracking (original estimate, spent, remaining, worklog entries)

2. **Functional Understanding Section** (from Step 3)
   - Brief Summary (1-3 lines)
   - Detailed Explanation (Problem, Current, Expected, Impact, Flow, Edge Cases)

3. **Extracted Acceptance Criteria Table**
   - Create a table mapping each acceptance criterion to test cases
   - Status column showing implementation status

4. **Related Issues & Dependencies Section**
   - Epic details and context
   - Linked issues and blockers
   - Subtasks and dependencies

5. **Detailed Issue Description Section**
   - Full description text from Jira
   - How to recreate (for bugs)
   - Expected behavior
   - Any screenshots/attachments referenced

6. **Comments & Hidden Requirements Section**
   - Developer comments with context
   - QA testing notes and observations
   - Edge cases discovered during comments
   - Attachments with descriptions (videos, screenshots showing behavior)

7. **Git Commit Analysis Section** (from Step 4)
   - Commits analyzed (hashes and messages)
   - Code pattern analysis with expected patterns and code snippets
   - Critical boundary values extracted from code
   - Test scenarios derived from code changes
   - Files changed and insertion/deletion counts

8. **Mapping & Integration Sections**
   - Jira requirements → test cases mapping table
   - Test coverage matrix (which test covers which requirement)
   - Detailed execution notes with specific testing guidance
   - Test execution checklist

**Implementation:**
1. Use `Write` tool to create the .md file at `.claude/skills/create-testcases/{TICKET-ID}-analysis.md`
2. Populate all sections with extracted Jira context and git analysis
3. Use the structure demonstrated in AJB-14080-analysis.md as a template
4. This file becomes the reference for test case generation (next step)

**Example File:** See `.claude/skills/create-testcases/AJB-14080-analysis.md` for complete structure and content examples.

---

### 7. Generate Test Cases Using Analysis File

**Purpose:** Generate comprehensive test cases by referencing the analysis .md file created in Step 6.

**Implementation:**
1. Open and review the created `.md` file (`.claude/skills/create-testcases/{TICKET-ID}-analysis.md`)
2. Extract test scenarios from:
   - **Jira section:** Acceptance criteria, comments, edge cases
   - **Git section:** Code patterns, boundary values, implementation details
   - **Mapping section:** Requirements that need test coverage
3. Map each code pattern to 2-3 specific test scenarios
4. Map each Jira acceptance criterion to test cases
5. Generate test cases in order: Positive → Edge Cases → Boundary → Negative → Integration → Role-Based

**Use Analysis File For:**
- Acceptance criteria verification (which criteria each test covers)
- Boundary values (exact code limits to test: e.g., if code has `if (x > 50)`, test 49, 50, 51)
- Edge cases identified from comments and git analysis
- Code patterns requiring specific test scenarios
- Folder organization (from Jira component and epic)
- Priority levels (from Jira priority field)

### 8. Analyze Content for Test Case Scenarios (Reference Analysis File)

Using the analysis .md file created in Step 6, extract test case ideas from:
- **Extracted Acceptance Criteria** (from analysis file section 3)
- **Jira Description Scenarios** (from analysis file section 5)
- **Comments & Edge Cases** (from analysis file section 6)
- **Git Code Patterns** (from analysis file section 7)
- **Requirements Mapping** (from analysis file section 8)

**Generate Comprehensive Test Scenarios:**
- **Positive Scenarios** - Happy path, successful workflows, primary user flows
- **Negative Scenarios** - Error conditions, invalid inputs, edge cases
- **Edge Cases** - Boundary values, empty inputs, max limits, special characters
- **Boundary Conditions** - Min/max values, limits, transition points
- **Integration Scenarios** - How this feature interacts with other modules
- **Role/Permission-Based Scenarios** - Different user roles (admin, user, guest), permission levels
- **State-Based Scenarios** - User project permissions, user active/inactive states
- **Toggle/Feature Flag Scenarios** - Check for applicable toggles (check `src/testdata/*.csv` for toggles)

### 9. Handle Warnings and Errors

**Warnings:**
- If issue type is Epic: Show warning "This is an Epic - subtask test cases will be created under it"
- If issue type is Subtask: Show warning "This is a Subtask - test cases will be organized under parent"
- If no linked issues found: Show note "No linked issues found - focusing on main issue requirements"
- If analysis .md file creation fails: Show warning "Could not create analysis file - proceeding with test case generation"

**Errors:**
- If no acceptance criteria found: Show error "No acceptance criteria found in description or comments. Skipping test case creation." and stop
- If Jira fetch fails: Show error "Unable to fetch Jira issue. Please verify the issue key and try again."
- If git commit analysis fails: Continue with Jira analysis only, note "Git commit analysis unavailable - focusing on Jira requirements"

### 10. Generate and Format Test Cases as Brief, Automation-Friendly Steps

**Output Format:**

Generate a structured text list of test cases with clear, action-based steps suitable for automation. Use this format:

```
Test Case #1: [Scenario Description]
Precondition: [Initial setup state, e.g., "User has valid credentials"]
Step 1: Login with valid credentials
Step 2: Navigate to AjourBox
Step 3: Select project "[project name]"
Step 4: Go to Files on Project
Step 5: [Feature-specific action]
Step 6: [Feature-specific action]
Step 7: Verify [expected outcome]
Expected Result: [Clear, verifiable outcome]

Test Case #2: [Scenario Description]
Precondition: [Setup state]
Step 1: Login with valid credentials
Step 2: Navigate to AjourBox
Step 3: Select project "[project name]"
Step 4: [Feature-specific action]
...
Expected Result: [Clear outcome]
```

**Step Writing Rules:**
- **Always start from Login + Navigate** — every test case begins with Login → Navigate to AjourBox → Select project, then feature-specific steps
- **One action per step** — each step = one Playwright interaction (click, select, drag, verify)
- **Use action verbs**: Login, Navigate, Select, Click, Drag, Enter, Verify, Confirm, Validate
- **Expected result per step** — can be inline in step or in final "Expected Result" summary
- **No Given/When/Then narrative** — remove all narrative format, use direct action verbs only
- **Minimize preconditions** — only state what must be true before starting (e.g., "User has account")

**Implementation:**
1. Extract all acceptance criteria from the issue and linked issues
2. Analyze comments and parent epic for additional test scenarios
3. Generate test cases in the order: Positive → Edge Cases → Boundary → Negative → Integration → Role-Based
4. Number each test case sequentially (1, 2, 3, etc.)
5. For each test case, start with Step 1: Login → Step 2: Navigate → Step 3: Select project
6. Add feature-specific steps after navigation
7. Include clear expected result at the end
8. Format steps to be directly actionable (map to Playwright operations)

### 11. Export Test Cases to CSV File

After generating and formatting all test cases as text (Step 10), create a separate CSV file for this ticket:

**CSV File Details:**
- **Filename:** `src/testdata/<TICKET-ID>-testcases.csv` (e.g., `src/testdata/AJB-123-testcases.csv`)
- **Format:** Match the exact 19-column structure of `testCases.csv`
- **Columns:** `Key,Name,Status,Precondition,Objective,Folder,Priority,Component,Labels,Owner,Estimated Time,Coverage (Issues),Coverage (Pages),Automation Status,Test Script (Step-by-Step) - Step,Test Script (Step-by-Step) - Test Data,Test Script (Step-by-Step) - Expected Result,Test Script (Plain Text),Test Script (BDD)`

**CSV Generation Process:**

1. **Create header row:**
   ```csv
   Key,Name,Status,Precondition,Objective,Folder,Priority,Component,Labels,Owner,Estimated Time,Coverage (Issues),Coverage (Pages),Automation Status,Test Script (Step-by-Step) - Step,Test Script (Step-by-Step) - Test Data,Test Script (Step-by-Step) - Expected Result,Test Script (Plain Text),Test Script (BDD)
   ```

2. **For each test case, create multi-row entries:**
   - **Row 1 (Metadata Row):**
     - `Key`: Leave empty (following existing pattern)
     - `Name`: Test case scenario title
     - `Status`: `Draft`
     - `Precondition`: Given state from test case (e.g., "User is logged in")
     - `Objective`: Test case objective (what is being verified)
     - `Folder`: Use the pattern `ReactUI/AjourBox/<TICKET-ID> <Ticket Summary>` (e.g., `ReactUI/AjourBox/AJB-123 My Feature Name`). Default to `ReactUI/<module>/<TICKET-ID> <Ticket Summary>` for non-AjourBox tickets.
     - `Priority`: From Jira issue priority (Critical, High, Medium, Low)
     - `Component`: From Jira issue component
     - `Labels`: From Jira issue labels (comma-separated if multiple)
     - `Owner`: Leave empty (will be assigned later)
     - `Estimated Time`: Leave empty
     - `Coverage (Issues)`: Jira ticket key (e.g., `AJB-123`)
     - Rest: Leave empty
     - `Test Script (Step-by-Step) - Step`: First step of the test case
   
   - **Rows 2+ (Step Rows):**
     - All columns except `Test Script (Step-by-Step) - Step` should be empty
     - `Test Script (Step-by-Step) - Step`: Each subsequent step on its own row

3. **Implementation Details:**
   - Use the `Write` tool to create/overwrite the CSV file
   - Properly escape commas and quotes in field values
   - Number steps sequentially (1, 2, 3, etc.)
   - Each step should be actionable and clear (from the generated test case format)

4. **Confirm CSV Creation:**
   - Report the file path created
   - Report the number of test cases added
   - Confirm that the CSV follows the 19-column format

5. **Ask User for Zephyr Upload Confirmation:**
   - After CSV is created, use `AskUserQuestion` to prompt:
     - **Question:** "Would you like to upload these test cases to Zephyr Scale now?"
     - **Options:** "Yes, upload now" or "No, skip upload"
   - If user selects **"Yes, upload now"**: Proceed to Step 14 (Automatic Zephyr Upload)
   - If user selects **"No, skip upload"**: Skip upload, provide manual upload instructions

**Example CSV Rows (Test case with automation-focused steps):**
```csv
,"Happy Path - Move File to Same Folder Type",Draft,"User has valid credentials","Verify user can move file within same folder type",ReactUI/AjourBox/AJB-14059 Move Files (drag and drop),Medium,Box,,,,AJB-14059,,,"Login with valid credentials","","Login succeeds, dashboard displayed"
,,,,,,,,,,,,,,"Navigate to AjourBox","","AjourBox module loads"
,,,,,,,,,,,,,,"Select project from list","","Project files are displayed"
,,,,,,,,,,,,,,"Go to Files on Project section","","File list is visible"
,,,,,,,,,,,,,,"Drag file from Folder A1 to Folder A2","","File moves to destination"
,,,,,,,,,,,,,,"Verify file appears in Folder A2","","File is visible in Folder A2 and removed from A1"
```

### 12. Structure Test Case Content

**Test Case Format:**
- **Number:** Sequential numbering (1, 2, 3, etc.)
- **Scenario Description:** Brief, action-oriented title
- **Precondition:** Minimal setup state (e.g., "User has credentials")
- **Steps:** Action-based steps starting from Login + Navigate + Select project
  - Step 1: Login with valid credentials
  - Step 2: Navigate to AjourBox
  - Step 3: Select project
  - Step 4+: Feature-specific actions (Navigate, Select, Click, Drag, Verify)
  - Each step = ONE Playwright action
- **Expected Result:** Clear, verifiable outcome of the test case

**Test Case Categories to Generate:**

| Category | Count | Examples |
|----------|-------|----------|
| Positive Scenarios | 1-2 | Main success workflow, primary user flow |
| Edge Cases | 2-3 | Boundary values, empty inputs, max limits |
| Boundary Conditions | 1-2 | Min/max values, transition points, field limits |
| Negative Scenarios | 1-2 | User tries to break the feature, malformed data |
| Integration Scenarios | 1-2 | Feature interaction with other modules, data flow |
| Role/Permission-Based | 1-2 | Admin vs User, different permission levels |
| State-Based | 0-1 | User active/inactive, project permission states, toggles |
| **Total per ticket** | **8-15** | Adjust based on complexity and risk |

### 13. Output and Confirmation

After generating and exporting all test cases to CSV (Step 11):

**Files Created:**
1. ✅ **Analysis File:** `.claude/skills/create-testcases/{TICKET-ID}-analysis.md`
   - Contains complete Jira context + git analysis
   - Serves as reference for test execution
   - Reusable documentation for QA/test teams

2. ✅ **CSV File:** `src/testdata/{TICKET-ID}-testcases.csv`
   - 19-column format compatible with test management
   - Ready for automation or manual test execution

**Output Format:**
Present the complete summary including functional understanding, impact analysis, test cases, analysis file, and CSV export confirmation:

```
✅ Test Cases Generated Successfully

📌 Issue Summary:
Issue Key: AJB-123
Issue Title: [Issue Summary]
Issue Type: Story
Priority: High
Status: To Do
Component: AjourBox

🎯 Functional Understanding:
[Brief Summary]
[Detailed Explanation]

🔄 External Knowledge Lookup:
[Functional Impact]
[Cross-Feature Impact]
[Regression Risk Areas]

📋 Test Case Summary:
   - Positive Scenarios: 2 cases
   - Edge Cases: 3 cases
   - Boundary Conditions: 2 cases
   - Negative Scenarios: 1 case
   - Integration Scenarios: 1 case
   - Role-Based Scenarios: 1 case
   - Total: 10 cases

[Full test case list below]

---

Test Case #1: Happy Path Successful Login
├── Category: Positive Scenario
├── Objective: Verify user can successfully login with valid credentials
├── Steps:
│   1. Given user is on login page
│   2. When user enters valid email and password
│   3. Then user is logged in and redirected to dashboard
└── Expected Result: User sees dashboard with authentication token stored

Test Case #2: Edge Case Empty Username Field
├── Category: Edge Case
├── Objective: Verify system handles empty username input
├── Steps:
│   1. Given user is on login page
│   2. When user leaves username empty and clicks login
│   3. Then error message appears
└── Expected Result: Form shows validation error, login blocked

[... additional test cases ...]

---

📄 CSV Export:
✅ CSV file created: src/testdata/AJB-123-testcases.csv
   - Format: 19-column testCases.csv compatible
   - Test Cases Exported: 10
   - Ready for use with playwright-cli skill
```

**Confirmation Message with Zephyr Upload:**
```
✅ Done! Generated 10 test cases and uploaded to Zephyr.
📊 Test Case Distribution:
   - Positive Scenarios: 2 cases
   - Edge Cases: 3 cases
   - Boundary Conditions: 2 cases
   - Negative Scenarios: 1 case
   - Integration Scenarios: 1 case
   - Role-Based Scenarios: 1 case

📄 CSV File: src/testdata/AJB-123-testcases.csv
   ✓ Compatible with playwright-cli skill
   ✓ Ready for QA team review

📤 Zephyr Upload: 10/10 test cases uploaded successfully
   ✓ Project: AJB
   ✓ Folder: ReactUI/AjourBox/AJB-123 My Feature Name
   ✓ Status: Draft
   🔗 View in Zephyr: https://jira.eg.dk/secure/Tests.jspa?project=AJB
```

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

## Example Test Case

**Issue:** AJB-123 - User Login with Email

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

---

### 14. Automatically Upload CSV to Zephyr Scale

**Purpose:** After test cases are generated and exported to CSV, automatically upload them to Zephyr Scale for team collaboration and test management.

**Implementation:**

Once the CSV file is created at `src/testdata/<TICKET-ID>-testcases.csv`, execute the Node.js upload script:

```bash
cd <project-root>
node ./.claude/skills/create-testcases/zephyr_api_upload.js src/testdata/<TICKET-ID>-testcases.csv
```

**Script Details:**

The script (`.claude/skills/create-testcases/zephyr_api_upload.js`) will:
1. Load configuration from `.env` file (ZEPHYR_API_TOKEN, ZEPHYR_BASE_URL, PROJECT_ID, PARENT_ID, JIRA_USER_KEY)
2. Parse the CSV with proper handling of quoted values and commas in step descriptions
3. Resolve or create folder structure in Zephyr based on CSV `Folder` column
4. Extract test case metadata and all test steps from CSV
5. Upload all test cases with complete step-by-step test scripts to Zephyr Scale API
6. Report success/failure count for each test case

**Key Features:**

- ✅ Handles CSV with hierarchical structure (test cases + multiple steps per case)
- ✅ Includes all test script steps with descriptions, test data, and expected results
- ✅ Proper CSV parsing with support for quoted values containing commas
- ✅ Windows and Unix line ending compatibility
- ✅ Creates test cases in correct Zephyr folder structure
- ✅ Detailed per-test-case status reporting

**Folder Organization in Zephyr:**

Test cases are organized in Zephyr using the folder structure from the CSV `Folder` column:
- Default folder pattern: `ReactUI/AjourBox/<TICKET-ID> <Ticket Summary>`
- Format: `/` separates nested folder levels
- Example: `ReactUI/AjourBox/AJB-14080 Dropdown Width Fix` creates:
  - Folder: `ReactUI` (root)
    - Subfolder: `AjourBox`
      - Test Cases folder: `AJB-14080 Dropdown Width Fix`

**Configuration Requirements:**

Ensure `.env` file contains:
```env
ZEPHYR_API_TOKEN=<your-zephyr-api-token>
ZEPHYR_BASE_URL=https://jira.eg.dk
ZEPHYR_PROJECT_KEY=AJB
JIRA_USER_KEY=JIRAUSER33050
```

**Upload Status Indicators:**

After uploading, the script displays:
```
=========================================
  Total   : 10
  Created : 10
=========================================
```

If upload fails for any test case:
```
=========================================
  Total   : 10
  Created : 9
  Failed  : 1

Failures:
  - Test Case Name: HTTP 400 - Invalid folder ID
=========================================
```

**Success Confirmation:**

Upon successful upload:
```
✅ Uploaded {count} test cases to Zephyr Scale
   Folder: ReactUI/AjourBox/<TICKET-ID> <Ticket Summary>
   Project: AJB
   Status: Draft
```

**Output & Reporting:**

The complete output includes:
1. ✅ Test Cases Generated: {count} test cases with detailed descriptions
2. 📊 CSV Export: File saved to `src/testdata/<TICKET-ID>-testcases.csv`
3. 📤 Zephyr Upload: {count} test cases uploaded to Zephyr Scale
4. 🔗 Zephyr URL: Direct link to view test cases in Zephyr: 
   - `https://jira.eg.dk/secure/Tests.jspa?project=<PROJECT_ID>`

## Automatic Upload Process (Step 14)

**Triggered Only After User Confirmation:**

After CSV creation, if user selects **"Yes, upload now"** in the confirmation prompt (Step 11, part 5), the skill will:

1. **Validate Zephyr Configuration** - Ensure `.env` has valid ZEPHYR_API_TOKEN and ZEPHYR_BASE_URL
2. **Execute Upload Script** - Run `./.claude/skills/create-testcases/import-testcases-to-zephyr.sh` with the CSV file path
3. **Monitor Upload Status** - Display real-time upload progress and any errors
4. **Report Results** - Summary of successful uploads and any failures with detailed feedback

**If User Selects "No, skip upload":**
- CSV file is ready at `src/testdata/<TICKET-ID>-testcases.csv`
- Provide manual upload instructions:
  ```bash
  bash ./.claude/skills/create-testcases/import-testcases-to-zephyr.sh --csv-file src/testdata/<TICKET-ID>-testcases.csv
  ```

**Automation Requirements:**

For automatic upload to work:
- ✅ `.env` file must contain valid Zephyr API credentials
- ✅ `ZEPHYR_API_TOKEN` must have proper permissions to create test cases
- ✅ `ZEPHYR_PROJECT_KEY` must match the Jira project (default: AJB)
- ✅ Bash environment with `curl` and `jq` installed

**Failure Handling:**

If upload fails:
- Script reports specific error (API token invalid, folder not found, etc.)
- CSV file is preserved at `src/testdata/<TICKET-ID>-testcases.csv`
- User can manually retry with: `./scripts/import-testcases-to-zephyr.sh --csv-file src/testdata/<TICKET-ID>-testcases.csv`
- Or use alternative CLI commands: `--list-folders` to discover folder IDs, `--list-meta` to verify priorities/statuses

## Tips for Success

1. **Git + Jira Combined Analysis**: ALWAYS analyze both git commits AND Jira issue together. Git reveals what was actually implemented (bug fixes, edge cases); Jira reveals intended requirements. Together they provide complete test coverage.
2. **Map Git Insights to Test Cases**: For each bug fix or edge case mentioned in commits, generate specific test cases that verify the fix and test boundary conditions.
3. **Combine Results**: Use git insights + functional understanding + regression risk areas to prioritize test cases
4. **Leverage Toggles**: Check `src/testdata/dev_toggles.csv` and `feature_toggles.csv` for state-based scenarios
5. **Cross-Reference**: Look at existing tests in `tests/` to identify duplicate scenarios
6. **Validate CSV**: Ensure CSV can be read by opening in Excel or text editor to verify format
7. **Team Review**: Have QA lead review test cases before marking as "Approved"
8. **File Changes Analysis**: When git shows specific files changed, analyze the test fixtures and operations those files use to identify all affected workflows
9. **Zephyr Upload Status**: After skill completes, verify upload success by checking Zephyr UI or checking the summary report
10. **Retry Mechanism**: If Zephyr API is temporarily unavailable, retry the upload using the bash script directly with the generated CSV file
