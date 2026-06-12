---
name: update-jira
description: Review an existing YBL (EG Lønservice) ticket and update its description based on feedback. Fetch and show the current ticket, draft a refined wiki-markup description, and push it via mcp-jira-service after explicit approval. Instance jira.eg.dk, project YBL. Description field only — never creates tickets or edits other fields.
argument-hint: "YBL-XXXX [what to change | <feature-folder-path>]"
allowed-tools: Read, Glob, Grep, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_update_issue, mcp__mcp-jira-service__jira_utility_deeplink, mcp__mcp-confluence-service__confluence_search, mcp__mcp-confluence-service__confluence_get_page
---

# /update-jira — review & update a YBL ticket's description

Review an existing **YBL** (EG Lønservice) ticket, then refine its **description** based on
feedback and codebase context. Show the current ticket, draft an improved wiki-markup description,
present it for approval, and push it via the `mcp-jira-service` MCP. This skill **only** edits the
description field — it never creates tickets and never touches summary, status, or any other field.

**Tenant facts (this instance is Jira Server/DC, _not_ Cloud):**

- Instance: `jira.eg.dk` — browse URLs are `https://jira.eg.dk/browse/YBL-XXXX`.
- Project key: `YBL`.
- Descriptions use **Jira wiki markup** (`h3.` headings, `*bold*`, `#` ordered list, leading `*`
  for bullets) — **never** markdown.

---

## Step 0: Check Jira MCP availability

Use `ToolSearch` to verify `mcp__mcp-jira-service__jira_update_issue` is available. If the Jira MCP
tools are **not** available, display this and STOP:

```
⛔ Jira MCP server is not connected. Cannot update a ticket.
Make sure the mcp-jira-service MCP is running and try again.
```

Do this **before** anything else — fail fast.

---

## Step 1: Parse arguments

The user's argument is `$ARGUMENTS`.

1. **Ticket key** (required) — extract the first `YBL-XXXX` token. If none is present, ask the
   user for the ticket key (single `AskUserQuestion`) and stop until provided.
2. **Change instruction** — the remaining text is the feedback / what to change. It may be:
   - free-text feedback (e.g. "add acceptance criteria for the export button"),
   - a **feature-folder path** under the workspace (e.g.
     `src/app/features/report/payroll-report`) — read it for context in Step 3, or
   - empty — then collect the feedback in Step 3.

---

## Step 2: Fetch & review (read-only)

Fetch the ticket via `mcp__mcp-jira-service__jira_get_issue` with
`fields: "summary,issuetype,status,description"`.

Display it for review so the user sees the current state **before** any change:

```
Reviewing: YBL-XXXX
Summary:   [summary]
Type:      [issue type]
Status:    [status]

Current description:
  [current description verbatim — or "(empty)" if none]
```

Always show the current description before drafting a replacement. If the fetch fails (bad key,
not found), surface the error and STOP.

---

## Step 3: Gather the change & context

- If `$ARGUMENTS` carried feedback, use it. Otherwise ask in **one** `AskUserQuestion` what should
  change (e.g. rewrite fully / add acceptance criteria / clarify steps to reproduce / fix
  technical notes).
- **Feature-folder seed** — if the change instruction is a folder path, read it for context:
  - Read every `.ts` and `.html` file in the folder (recursive). Skip `.spec.ts`, `__tests__`,
    snapshots, and generated files.
  - Also read the feature's `*.service.ts` (usually one level up under `services/`), its
    `models/*.ts`, and the parent `*.routes.ts` if a route exists.
  - Goal: understand **what the user can do** with the feature and **which APIs back it**. Do not
    read unrelated files.
- **Codebase** — if the feedback references a specific feature/area, search `src/` with
  `Grep`/`Glob` to confirm modules/services/endpoints and current behaviour.
- **Confluence** — when product behaviour is unclear, query
  `mcp__mcp-confluence-service__confluence_search`, then `confluence_get_page` to read the relevant
  page. **If Confluence is unreachable** (error/timeout), print
  `⚠️ Confluence is unreachable — proceeding with codebase and user input only.` and continue. Do
  not retry or ask the user to fix it.

---

## Step 4: Draft the updated description (Jira wiki markup — not markdown)

Pick the template matching the ticket's **existing issue type**. Refine the existing description
per the feedback — support both a full rewrite and targeted section edits, and **preserve good
existing content the feedback didn't ask to change**.

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

- Ensure clarity for Dev + QA. Refine the input — never push raw user text verbatim.
- Use Jira wiki markup only: `h3.` headings, `*bold*`, `#` ordered lists, leading `*` for bullets.
- Include relevant files/modules under **Technical Notes** when codebase exploration found them.
- Do not assume unknown business logic — only enhance clarity.

---

## Step 5: Present draft — CONFIRMATION GATE

Show the current and new description so the user can compare:

```
Updating: YBL-XXXX  ([issue type])

Current description:
  [current — truncate to ~30 lines if long]

New description:
  [full wiki-markup draft]
```

Ask with `AskUserQuestion`: "Update this ticket's description?" with options:

- **Update** — push to Jira.
- **Edit** — user revises (ask what to change), apply, re-display the draft, and re-ask this same
  gate.
- **Cancel** — abort without changing anything.

NEVER push without explicit approval through this gate.

---

## Step 6: Push (description only)

Call `mcp__mcp-jira-service__jira_update_issue` with:

```
mcp__mcp-jira-service__jira_update_issue
  issue_key: YBL-XXXX
  fields:
    description: <the wiki-markup draft>
```

**Hard rule:** update the **description field only**. Never include `summary`, `assignee`,
`status`, `parent`, category, labels, or any other field. If the existing summary looks wrong,
surface it as a follow-up *suggestion* after the update — do not auto-edit it.

---

## Step 7: Report result

### On success

Resolve the URL via `mcp__mcp-jira-service__jira_utility_deeplink` with the `issue_key` (fallback:
`https://jira.eg.dk/browse/<KEY>`). Display:

```
✏️ Ticket description updated
   Key:      YBL-XXXX
   URL:      https://jira.eg.dk/browse/YBL-XXXX
   Summary:  [summary]
   Type:     [issue type]
```

### On failure

Surface the error verbatim and **preserve the approved draft** so the user doesn't lose work:

```
❌ Failed to update ticket: <error message>

Your approved draft is preserved (paste it manually if needed):
   [full wiki-markup draft]
```

- **MCP disconnected** → tell the user immediately, do not retry.
- Other errors → surface details, do not retry blindly.

---

## Rules

- ALWAYS check Jira MCP availability first — fail fast.
- ALWAYS fetch and show the current description before drafting a replacement.
- ALWAYS use Jira **wiki markup** (not markdown) in the description.
- ALWAYS update only after explicit approval at the confirmation gate.
- Update the **description field only** — never touch summary, status, or any other field.
- ALWAYS search the codebase / read the feature folder for context when the feedback references a
  specific feature.
- ALWAYS check Confluence when product behaviour is unclear — if unreachable, warn and continue.

## Permissions & flow

- You have permission to read the ticket, search the codebase, Confluence, and the feature folder
  proactively — do it without asking.
- Keep friction low: review → gather feedback → draft → confirm once → push. No redundant
  confirmations beyond the Step 5 gate.

## Out of scope

- Creating tickets (use `/create-jira`).
- Editing summary, assignee, status, parent, or any non-description field.
- Transitions / status changes, comments, worklogs (see `worklog`), Confluence pages.
