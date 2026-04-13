---
name: create-jira-ticket  
description: Create a structured JIRA ticket for XENA (XNA) project by collecting required inputs, refining description, generating summary, and pushing the ticket to JIRA  
allowed-tools: Read, Write, Edit, Grep, Glob, AskUserQuestion, EnterPlanMode, ExitPlanMode, WebFetch, ToolSearch, mcp__mcp-jira-service__jira_create_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_issue
argument-hint: "[description | subtask of XNA-XXXXX description]"
---

# Create JIRA Ticket – Structured Mode

You are responsible for creating a clean, professional JIRA ticket with proper structure and clarity.

---

## Step 0: Check JIRA MCP availability

Use `ToolSearch` to verify that `mcp__mcp-jira-service__jira_create_issue` is available.

If the JIRA MCP tools are **not available**, display this message and STOP:

```
⛔ JIRA MCP server is not connected. Cannot create a ticket.
Make sure the JIRA MCP server is running and try again.
```

Do this check **before** collecting any inputs to avoid wasted effort.

---

## Step 1: Parse Arguments

The user's argument is: `$ARGUMENTS`

- If `$ARGUMENTS` starts with `subtask of XNA-XXXXX` → this is a sub-task (see Step 1b)
- If `$ARGUMENTS` contains a description (free text) → use it as the initial description input, skip asking for it in Step 2
- If `$ARGUMENTS` is empty → collect everything in Step 2

### Step 1b: Sub-task mode

If the user passed `subtask of XNA-XXXXX <description>`:

1. Extract the parent ticket key (e.g., `XNA-18827`)
2. Fetch the parent ticket via `mcp__mcp-jira-service__jira_get_issue` to get its summary, type, and epic link
3. Use the remaining text as the description input
4. Auto-set Issue Type to **Sub-task** and inherit the parent's Issue Category
5. Skip asking for Issue Type and Issue Category in Step 2

## Step 2: Collect Required Inputs from User

Collect all inputs in a **SINGLE prompt** using `AskUserQuestion`. Only ask for fields not already provided via `$ARGUMENTS` or inherited from sub-task mode (Step 1b).

### Issue Category (choose one)
* New features and functionality  
* Legal requirement  
* Customer funded development  
* Maintenance and defects  
* Technical debt  
* Rework  
* Internal company work  

### Issue Type (choose one)
* Story  
* Task  
* Bug  
* Epic  
* Business Project  
* Spike  
* Sub-task *(auto-set in sub-task mode)*

### Priority (choose one)
* Blocker  
* Critical  
* Major *(default — use if user doesn't specify)*  
* Minor  
* Trivial  

### Parent Epic (optional)
If the user mentions an epic or the work clearly belongs under one, ask:

```
"Should this be linked to an epic? (Enter epic key like XNA-10000, or skip)"
```

If the user provides an epic key, store it for Step 5. If they skip, leave it empty.

> **Note:** In sub-task mode the parent link is already set via Step 1b. This field is for linking a Story/Task/Bug to a parent epic.

### Description
User provides raw description (or already provided via `$ARGUMENTS`).

---

## Step 3: Process & Enhance Content

### Context Enrichment

Before writing the ticket, gather context to make it precise:

1. **Codebase context**: If the description references specific Xena features/areas, search the codebase to understand:
   - Which modules/files are involved (`Grep`/`Glob` in `src/`)
   - Existing related functionality (domain entities, API endpoints, views)
   - Current behavior that may need changing
   
2. **Xenapedia** (when product behavior is unclear):
   Refer to: https://xena.biz/en/support/xenapedia/category-getting-started/
   
   Use it to:
   - Understand product behavior  
   - Clarify workflows  
   - Identify hidden dependencies  

   **If Xenapedia is unreachable** (network error, timeout, 4xx/5xx):
   - Print a warning: `⚠️ Xenapedia is unreachable — proceeding with codebase and user input only.`
   - Continue without it. Do NOT ask the user to fix it or retry.

Apply this knowledge while:
- Creating **Summary**
- Writing **Description**
- Building **Steps to Reproduce** (if applicable)

---

### Summary
- Generate automatically  
- Should act like a clear heading  
- Short, meaningful, and action-oriented  
- Must reflect correct product behavior (use Xenapedia if needed)

---

### Description

Polish and refine user input. Structure depends on issue type:

**For Bugs:**
```
h3. Context
[Which area of Xena is affected, what the user was trying to do]

h3. Current Behavior
[What happens now — be specific, reference actual UI elements or API endpoints]

h3. Expected Behavior
[What should happen instead]

h3. Steps to Reproduce
# [Step 1]
# [Step 2]
# [Step 3]

h3. Technical Notes
[If codebase exploration revealed relevant files/modules, mention them here]
```

**For Stories/Tasks:**
```
h3. Context
[Background and motivation for this change]

h3. Requirements
* [Requirement 1]
* [Requirement 2]

h3. Acceptance Criteria
* [Criterion 1]
* [Criterion 2]

h3. Technical Notes
[Affected modules, relevant files, architectural considerations if known]
```

**For Spikes:**
```
h3. Question / Goal
[What we need to learn or decide]

h3. Context
[Background and why this investigation is needed]

h3. Expected Output
[What deliverable the spike should produce — document, POC, decision, etc.]
```

**For Epics:**
```
h3. Vision
[High-level goal this epic achieves and why it matters]

h3. Scope
* [Major deliverable / work stream 1]
* [Major deliverable / work stream 2]
* [Major deliverable / work stream 3]

h3. Out of Scope
* [What is explicitly NOT included in this epic]

h3. Success Criteria
* [Measurable outcome 1]
* [Measurable outcome 2]

h3. Technical Considerations
[Architectural impact, cross-team dependencies, migration concerns if known]
```

**For Business Projects:**
```
h3. Business Objective
[What business outcome this project targets]

h3. Stakeholders
* [Team / person 1 — role]
* [Team / person 2 — role]

h3. Scope & Deliverables
* [Deliverable 1]
* [Deliverable 2]

h3. Dependencies
* [External dependency or blocker, if any]

h3. Timeline Constraints
[Any deadlines, release windows, or external commitments]
```

**For Sub-tasks:**
```
h3. Parent Context
[Link to parent ticket and brief summary of the parent's goal]

h3. Task
[Specific piece of work this sub-task covers]

h3. Acceptance Criteria
* [Criterion 1]
* [Criterion 2]
```

Rules for description:
- Ensure clarity for Dev + QA  
- Incorporate Xenapedia insights where useful
- Use JIRA wiki markup (not markdown) for formatting: `h3.` for headings, `*` for bold, `#` for ordered lists, `*` (at line start) for bullet lists
- If codebase exploration found relevant files, include them in Technical Notes

---

## Step 3b: Check for Duplicate Tickets

Before presenting the draft, search JIRA for potential duplicates to avoid creating redundant tickets.

Use `mcp__mcp-jira-service__jira_search` with a JQL query targeting the same area:

```
project = XNA AND summary ~ "<key words from generated summary>" AND status NOT IN (Done, Closed) ORDER BY created DESC
```

If similar open tickets are found (1-3 results), show them to the user:

```
⚠️  Potential duplicates found:
  - XNA-18901 — "Similar summary text" (Status: In Progress)
  - XNA-18850 — "Another similar one" (Status: Open)

Continue creating a new ticket? [y/n]
```

If the user says no, STOP. If yes (or if the search returns no results, or the search tool is unavailable), proceed.

---

## Step 4: Present Draft for Approval — CONFIRMATION GATE

Show the user the full draft:

```
Summary:   [generated summary]
Type:      [issue type]
Category:  [issue category]
Priority:  [priority]
Epic Link: [XNA-XXXXX or "none"]
Parent:    [XNA-XXXXX or "N/A" — only for sub-tasks]

Description:
  [full enhanced description in JIRA wiki markup]
```

Ask with `AskUserQuestion`: "Create this ticket?" with options:
- **Create** — push to JIRA
- **Edit** — let the user revise (see Edit flow below)
- **Cancel** — abort without creating

### Edit flow

If the user chooses **Edit**:

1. Ask with `AskUserQuestion`: "What would you like to change?" with options:
   - **Summary** — "Enter your revised summary:"
   - **Description** — "Enter your feedback (I'll rewrite the description):"
   - **Priority** — show priority options again
   - **Type/Category** — show type and category options again
   - **Multiple fields** — ask for all changes at once
2. Apply the changes and display the full updated draft again (same format as above).
3. Ask "Create this ticket?" again — same Create/Edit/Cancel options.
4. Repeat until the user chooses Create or Cancel.

---

## Step 5: Apply Default / Fixed Fields & Create

Use `mcp__mcp-jira-service__jira_create_issue` with:

- **Project**: XNA  
- **Summary**: (generated)  
- **Description**: (enhanced, in JIRA wiki markup)  
- **Issue Type**: (user selected)  
- **Issue Category**: (user selected)  
- **Priority**: (user selected, default Major)
- **Labels**: AI  
- **Security Level**: ALL EG  
- **Epic Link**: (if provided in Step 2)
- **Parent**: (if sub-task mode, from Step 1b)

Leave empty/default:
- Sprint, Affects Version, Environment, Components
- Assignee: Automatic  
- Reporter: Current user  

> **Epic-specific fields:** If the issue type is Epic, also set the **Epic Name** field to the summary text (JIRA requires this for epics).

---

## Step 6: Report Result

### On success

Display a structured receipt:

```
✅ Ticket created
   Key:      XNA-XXXXX
   URL:      https://jira.eg.dk/browse/XNA-XXXXX
   Summary:  [summary]
   Type:     [issue type]
   Priority: [priority]
   Category: [issue category]
   Epic:     [XNA-XXXXX or "none"]
   Parent:   [XNA-XXXXX or "N/A"]

Add screenshots or attachments directly in JIRA if needed.
```

### On failure

Display the error clearly and **preserve the approved draft** so the user doesn't lose work:

```
❌ Failed to create ticket: <error message>

Your approved draft is preserved:
   Summary:     [summary]
   Description: [first 100 chars...]
```

Then diagnose the error. Common issues:
- **Missing required fields** → check the API error, identify which field is missing, add it, and retry **once**
- **Invalid issue type** → list valid types and ask user to pick again
- **Invalid field value** (e.g., bad epic key) → show the field and ask user to correct it
- **MCP disconnected** → tell user immediately, do not retry

Only auto-retry **once** for missing-field errors. For all other errors, stop and show the details.

---

## Rules

- ALWAYS check JIRA MCP availability before collecting inputs — fail fast
- ALWAYS refine description professionally — never submit raw user input  
- ALWAYS generate summary yourself  
- ALWAYS include steps to reproduce for bugs  
- ALWAYS use JIRA wiki markup (not markdown) in the description field  
- ALWAYS search codebase for context when the ticket references specific Xena features  
- ALWAYS refer Xenapedia when product behavior is unclear — if unreachable, warn and continue  
- ALWAYS use the correct description template for the issue type (Bug, Story/Task, Spike, Epic, Business Project, Sub-task)
- ALWAYS search for duplicate tickets before creating — avoid redundant work
- DO NOT fill unnecessary fields  
- DO NOT assume unknown business logic — only enhance clarity  
- ALWAYS create ticket via MCP tool
- On failure, preserve the approved draft content so the user doesn't lose work

## Permissions & Flow

- You have FULL PERMISSION to fetch Xenapedia pages — never ask the user before accessing them, just do it  
- You have FULL PERMISSION to search the Xena codebase for context — do it proactively  
- You have FULL PERMISSION to search JIRA for duplicates — do it proactively before presenting the draft
- Do NOT ask for excessive confirmations or permissions — keep the flow smooth  
- Collect the minimum required inputs in a SINGLE prompt (or skip if provided via `$ARGUMENTS`)  
- Then immediately build a complete draft and present it to the user  
- Once the user confirms the draft, push it to JIRA — no extra confirmation needed  
- Goal: minimum friction, maximum quality — ask once, draft once, confirm once, create  