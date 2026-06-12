---
name: create-jira
description: Create a structured Jira ticket in the YBL (EG Lønservice) project — collect inputs, enrich from codebase/Confluence, draft a wiki-markup description, and push via mcp-jira-service after explicit approval. Instance jira.eg.dk, project YBL.
argument-hint: "[description | subtask of YBL-XXXX description | <feature-folder-path>] [<path/to/design.png>]"
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_create_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search_fields, mcp__mcp-jira-service__jira_utility_deeplink, mcp__mcp-jira-service__jira_upload_attachment, mcp__mcp-confluence-service__confluence_search, mcp__mcp-confluence-service__confluence_get_page
---

# /create-jira — structured Jira ticket for YBL

Create a clean, professional Jira ticket in the **YBL** (EG Lønservice) project. Collect the
minimum inputs, enrich from the codebase and Confluence, draft a wiki-markup description, show it
for approval, then push it via the `mcp-jira-service` MCP.

**Tenant facts (this instance is Jira Server/DC, _not_ Cloud):**

- Instance: `jira.eg.dk` — browse URLs are `https://jira.eg.dk/browse/YBL-XXXX`.
- Project key: `YBL`.
- Descriptions use **Jira wiki markup** (`h3.` headings, `*bold*`, `#` ordered list, leading `*`
  for bullets) — **never** markdown.
- Custom-field IDs (verified for this tenant):
  - **Issue category** → `customfield_10213` (select)
  - **Epic Link** → `customfield_10101`
  - **Epic Name** → `customfield_10103` (required when creating an Epic)
  - **Security Level** → `"ALL EG"` (No GDPR sensitive data)
- Sub-task issue type is named **`Sub-task`** (hyphenated).
- The MCP auto-resolves human-readable select values for custom fields, e.g.
  `{"customfield_10213": "New features and functionality"}`.

---

## Step 0: Check Jira MCP availability

Use `ToolSearch` to verify `mcp__mcp-jira-service__jira_create_issue` is available. If the Jira
MCP tools are **not** available, display this and STOP:

```
⛔ Jira MCP server is not connected. Cannot create a ticket.
Make sure the mcp-jira-service MCP is running and try again.
```

Do this **before** collecting any inputs — fail fast.

---

## Step 1: Parse arguments

The user's argument is `$ARGUMENTS`. Detect one of three input modes:

1. **Sub-task mode** — `$ARGUMENTS` starts with `subtask of YBL-XXXX` → see Step 1b.
2. **Feature-folder mode** — `$ARGUMENTS` is (or starts with) a path that exists under the
   workspace (e.g. `src/app/features/report/payroll-report`) → see Step 1c.
3. **Free-text mode** — anything else is the raw description seed; skip asking for the description
   in Step 2. If `$ARGUMENTS` is empty, collect everything in Step 2.

### Attachment detection (all modes)

Scan `$ARGUMENTS` for local file paths ending in a common attachment extension
(`.png .jpg .jpeg .gif .pdf .docx .xlsx .pptx .fig .svg`). For each, verify it exists on disk
(`Read`/`Glob`); collect the existing ones as **attachment candidates** and strip those paths from
the description seed. Candidates are *not* uploaded yet — that decision happens at the Step 4 gate.
If no such paths are present, there are simply no candidates and no attachment step runs.

### Step 1b: Sub-task mode

1. Extract the parent key (e.g. `YBL-830`).
2. Fetch it via `mcp__mcp-jira-service__jira_get_issue` (`fields: "summary,issuetype,customfield_10213,customfield_10101"`).
3. Use the remaining text as the description seed.
4. Auto-set **Issue Type = `Sub-task`**, set `parent` to the parent key (Step 5), and **inherit
   the parent's Issue category** (`customfield_10213`) and Epic Link (`customfield_10101`) if present.
5. Skip asking for Issue Type and Issue category in Step 2.

### Step 1c: Feature-folder mode

Read the feature folder to understand it, using this procedure:

- Read every `.ts` and `.html` file in the folder (recursive). Skip `.spec.ts`, `__tests__`,
  snapshots, and generated files.
- Also read the feature's `*.service.ts` (usually one level up under `services/`), its
  `models/*.ts`, and the parent `*.routes.ts` if a route exists.
- Goal: understand **what the user can do** with the feature and **which APIs back it**. Do not
  read unrelated files. Use this as the description seed; still collect type/category in Step 2.

---

## Step 2: Collect required inputs (SINGLE prompt)

Collect everything still unknown in **one** `AskUserQuestion`. Skip any field already provided via
`$ARGUMENTS` or inherited in sub-task mode.

### Issue category (required — maps to `customfield_10213`)

Choose one:

- New features and functionality
- Legal requirement
- Customer funded development
- Maintenance and defects
- Technical debt
- Rework
- Internal company work

### Issue type (default **Task**)

Choose one: Story / Task / Bug / Sub-task / Epic / Spike. (Auto-set to `Sub-task` in sub-task mode.)

### Priority (optional)

Leave **unset** by default — Jira applies "Not prioritized". Only set a priority if the user
explicitly asks for one; do not invent priority names.

### Parent Epic (optional)

If the user mentions an epic or the work clearly belongs under one, capture the epic key (e.g.
`YBL-735`) for `customfield_10101`. Otherwise leave empty. (In sub-task mode the parent link is
already handled via Step 1b.)

### Label (optional)

Leave **blank** by default. Set `labels` only if the user provides one.

### Description

Use the seed from Step 1 (free-text / folder / sub-task remainder), or ask for it here if none.

### Attachments (optional, opt-in)

- **Attachments are NEVER uploaded by default.** A detected file path is only a *candidate*; it is
  not sent to Jira unless the user explicitly opts in at the Step 4 gate.
- If candidates were detected in Step 1, carry them forward to be listed at the gate — do not assume
  they will be attached.
- If none were detected, do not prompt for any; the field stays empty and the attachment step
  (Step 5b) never runs.
- Any candidate path that no longer exists is dropped with a warning (non-fatal).

---

## Step 3: Enrich & draft

### Context enrichment

1. **Codebase** — if the description references a specific feature/area, search `src/` with
   `Grep`/`Glob` to learn which modules/services/endpoints are involved and current behaviour.
2. **Confluence** — when product behaviour is unclear, query
   `mcp__mcp-confluence-service__confluence_search` for EG Lønservice product/spec pages, then
   `confluence_get_page` to read the relevant one. **If Confluence is unreachable** (error/timeout),
   print `⚠️ Confluence is unreachable — proceeding with codebase and user input only.` and continue.
   Do not retry or ask the user to fix it.

### Summary

Generate it yourself: a short, action-oriented heading that reflects correct product behaviour.

### Description (Jira wiki markup — not markdown)

Pick the template for the issue type:

**Bug**
```
h3. Context
[Which area of EG Lønservice is affected, what the user was trying to do]

h3. Current Behavior
[What happens now — reference actual UI elements or API endpoints]

h3. Expected Behavior
[What should happen instead]

h3. Steps to Reproduce
# [Step 1]
# [Step 2]

h3. Technical Notes
[Relevant files/modules from codebase exploration, if any]
```

**Story / Task**
```
h3. Context
[Background and motivation]

h3. Requirements
* [Requirement 1]
* [Requirement 2]

h3. Acceptance Criteria
* [Criterion 1]
* [Criterion 2]

h3. Technical Notes
[Affected modules, relevant files, architectural considerations if known]
```

**Spike**
```
h3. Question / Goal
[What we need to learn or decide]

h3. Context
[Why this investigation is needed]

h3. Expected Output
[Deliverable — document, POC, decision, etc.]
```

**Epic**
```
h3. Vision
[High-level goal and why it matters]

h3. Scope
* [Work stream 1]
* [Work stream 2]

h3. Out of Scope
* [What is explicitly NOT included]

h3. Success Criteria
* [Measurable outcome 1]
* [Measurable outcome 2]
```

**Sub-task**
```
h3. Parent Context
[Parent key + brief summary of the parent's goal]

h3. Task
[Specific piece of work this sub-task covers]

h3. Acceptance Criteria
* [Criterion 1]
* [Criterion 2]
```

Rules for the description:

- Ensure clarity for Dev + QA. Refine the user's raw input — never submit it verbatim.
- Use Jira wiki markup only: `h3.` headings, `*bold*`, `#` ordered lists, leading `*` for bullets.
- Include relevant files/modules under **Technical Notes** when codebase exploration found them.
- Do not assume unknown business logic — only enhance clarity.

---

## Step 3b: Duplicate check

Before presenting the draft, search for open duplicates:

```
mcp__mcp-jira-service__jira_search
  jql: project = YBL AND summary ~ "<key words from the generated summary>" AND status not in (Done, Closed, Resolved) ORDER BY created DESC
  limit: 5
```

If 1–3 open matches come back, list them (`KEY — summary (status)`) and ask whether to continue.
If the user declines, STOP. If there are no results — or the search tool is unavailable — proceed.

---

## Step 4: Present draft — CONFIRMATION GATE

Show the full draft:

```
Summary:     [generated summary]
Type:        [issue type]
Category:    [issue category]
Priority:    [priority or "Not prioritized"]
Epic Link:   [YBL-XXXX or "none"]
Parent:      [YBL-XXXX or "N/A" — sub-task mode only]
Label:       [label or "none"]
Attachments: [design.png, spec.pdf]  (candidates — not yet attached)   ← line shown ONLY if candidates exist
```

Ask with `AskUserQuestion`: "Create this ticket?".

**When there are NO attachment candidates**, options are:

- **Create** — push to Jira
- **Edit** — user revises (ask what to change: Summary / Description / Priority / Type / Category /
  multiple), apply, then re-display the full draft and re-ask this same gate
- **Cancel** — abort without creating

**When there ARE attachment candidates**, the user controls attachment independently of creation:

- **Create + attach files** — create the ticket AND upload the listed candidate files (Step 5b)
- **Create without attaching** — create the ticket only; skip all uploads (default-safe)
- **Edit** — revise the draft, *including* adding/removing which files to attach, then re-display and
  re-ask this same gate
- **Cancel** — abort without creating

NEVER create a ticket without explicit approval through this gate. NEVER upload a file unless the
user explicitly chose **Create + attach files**.

---

## Step 5: Create

Call `mcp__mcp-jira-service__jira_create_issue` with:

- `project_key`: `"YBL"`
- `summary`: the generated summary
- `description`: the wiki-markup description
- `issue_type`: the selected type (use `"Sub-task"` for sub-tasks)
- `assignee`: omit (defaults to reporter/automatic) unless the user named one
- `additional_fields`:
  - `customfield_10213`: <issue category>            ← always
  - Security Level → `"ALL EG"`                       ← always (e.g. `{"security": {"name": "ALL EG"}}`)
  - `customfield_10101`: <epic key>                   ← only if an epic was given
  - `parent`: <YBL-XXXX>                              ← sub-task mode only
  - `customfield_10103`: <summary>                    ← only when issue type is Epic (Epic Name)
  - `labels`: [<label>]                               ← only if the user provided a label

Leave Sprint, Affects Version, Environment, and Components empty/default.

---

## Step 5b: Upload attachments (opt-in only)

Run this step **only** when ALL of the following are true:

1. The ticket was created successfully in Step 5 (you have its `issue_key`).
2. There is ≥1 attachment candidate.
3. The user chose **Create + attach files** at the Step 4 gate.

If the user chose **Create without attaching**, skip this step entirely — no file leaves the
machine. For each candidate file, do the 2-step upload:

1. **Shell upload** via `Bash` (use `curl.exe` on Windows):
   ```
   curl.exe -s -F "file=@<absolute-path>" https://jira-mcp-server.cto.aks.egdev.eu/jira/upload
   ```
   Parse `fileRef` from the returned JSON (`{"fileRef":"<uuid>"}`). Binary bytes never pass through
   the LLM.
2. **Attach** via `mcp__mcp-jira-service__jira_upload_attachment`:
   - `issue_key`: the key returned by Step 5
   - `file_ref`: the `fileRef` from step 1
   - `file_name`: the original filename (optional)

Track success/failure per file.

**Failure policy:** the ticket already exists, so an upload failure must **not** be reported as a
ticket-creation failure. Retry a failed upload **once**; if it still fails, record it and move on.
Surface per-file results in Step 6 and tell the user they can attach the failed ones manually in Jira.

---

## Step 6: Report result

### On success

Resolve the URL via `mcp__mcp-jira-service__jira_utility_deeplink` with the returned `issue_key`
(fallback: `https://jira.eg.dk/browse/<KEY>`). Display:

```
✅ Ticket created
   Key:         YBL-XXXX
   URL:         https://jira.eg.dk/browse/YBL-XXXX
   Summary:     [summary]
   Type:        [issue type]
   Category:    [issue category]
   Epic:        [YBL-XXXX or "none"]
   Parent:      [YBL-XXXX or "N/A"]
   Attachments: design.png ✅, spec.pdf ✅   (or "none")
```

- If the user chose **Create without attaching** (or there were no candidates), show
  `Attachments: none`.
- If some uploads failed, list them and add:
  `⚠️ Could not upload: <file> — attach manually in Jira.`

### On failure

Surface the error and **preserve the approved draft** so the user doesn't lose work:

```
❌ Failed to create ticket: <error message>

Your approved draft is preserved:
   Summary:     [summary]
   Description: [first 100 chars...]
```

Then diagnose:

- **Missing required field** → identify it from the error, add it, retry **once**.
- **Invalid issue type / field value** (e.g. bad epic key) → show the field and ask the user to correct it.
- **MCP disconnected** → tell the user immediately, do not retry.

Auto-retry **once** only for missing-required-field errors. For all other errors, stop and show details.

---

## Rules

- ALWAYS check Jira MCP availability before collecting inputs — fail fast.
- ALWAYS generate the summary yourself and refine the description professionally — never submit raw input.
- ALWAYS use Jira **wiki markup** (not markdown) in the description.
- ALWAYS include steps to reproduce for bugs.
- ALWAYS set Security Level `ALL EG` and Issue category on every ticket.
- ALWAYS search the codebase for context when the ticket references a specific feature.
- ALWAYS check Confluence when product behaviour is unclear — if unreachable, warn and continue.
- ALWAYS search for duplicates before presenting the draft.
- ALWAYS create the ticket only after explicit approval at the confirmation gate.
- DO NOT fill unnecessary fields; DO NOT assume unknown business logic.
- Label is optional — leave blank unless the user provides one.
- Attachments are strictly opt-in: NEVER upload a file unless the user chose **Create + attach
  files**. Upload happens **after** creation (2-step: shell upload → attach); an upload failure
  never fails the ticket — report it and continue.

## Permissions & flow

- You have permission to search the codebase, Confluence, and Jira proactively — do it without asking.
- Keep friction low: collect the minimum inputs in a SINGLE prompt (or skip when provided), draft
  once, confirm once, create. Do not ask for redundant confirmations beyond the Step 4 gate.

## Out of scope

- Editing existing tickets (use `update-jira` to update a ticket's description).
- Confluence page creation, transitions/status changes, worklogs (see `worklog`).
