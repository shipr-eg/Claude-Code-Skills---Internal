---
name: devdocs
description: Analyse code changes on the current GitHub branch and JIRA ticket comments, then generate a brief Developer Overview document. Previews the document before saving it as {TICKET_KEY}_DeveloperDocumentation.md on the Desktop.
allowed-tools: Read, Grep, Glob, Bash, Write, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_worklog
argument-hint: <jira-ticket-key-or-url>
---

# Developer Documentation Generator

Generate a concise Developer Overview document by combining JIRA ticket context with actual code changes on the current branch.

## Input

JIRA ticket URL or key: $ARGUMENTS

---

## Step 1: Extract the Ticket Key

Parse the JIRA ticket key from the input. It may be provided as:
- A full URL like `https://jira.eg.dk/browse/XNA-18827` → extract `XNA-18827`
- Just the key like `XNA-18827`

If empty, ask the user with `AskUserQuestion`.

---

## Step 2: Fetch JIRA Ticket Details

Use `mcp__mcp-jira-service__jira_get_issue` to retrieve:
- **Summary** and **description**
- **Acceptance criteria** (from description or a dedicated field)
- **Issue type**, **priority**, **status**
- **Labels**, **components**, **fix version**
- **Comments** — read all comments carefully; note any key decisions, scope changes, or clarifications the team discussed
- **Linked issues** — fetch parent epic and any blocking/related tickets for additional context

---

## Step 3: Analyse Code Changes on the Current Branch

Use `Bash` to compare the current branch against the base branch (`development`).

### 3a. Identify the current branch and diff

```bash
git branch --show-current
git diff development...HEAD --stat
git diff development...HEAD --name-only
```

### 3b. Read the full diff for changed files

```bash
git diff development...HEAD -- <file>
```

For each changed file:
- Read the diff to understand what was added, modified, or removed
- Identify the architectural layer (Domain, Contracts, Mappings, Database, API, Frontend, Services, Tests, Migrations, Resources)

### 3c. Summarise changes by layer

Group the changed files into layers:

| Layer | Files Changed | Brief Description |
|---|---|---|
| Domain | ... | ... |
| Contracts | ... | ... |
| Mappings | ... | ... |
| Database | ... | ... |
| Migrations | ... | ... |
| API | ... | ... |
| Frontend | ... | ... |
| Services | ... | ... |
| Resources | ... | ... |
| Tests | ... | ... |

---

## Step 4: Compose the Developer Overview Document

Build a Markdown document using the structure below. Keep it **concise and factual** — this is a quick-reference document for developers, not a full spec.

```markdown
# {TICKET_KEY} — Developer Overview

## Ticket
- **Key:** {TICKET_KEY}
- **Summary:** {ticket summary}
- **Type:** {issue type} | **Priority:** {priority} | **Status:** {status}
- **Epic:** {parent epic key + summary, if any}

---

## What This Ticket Does

{2–4 sentence plain-English explanation of what the feature/fix does and why, derived from the ticket description and acceptance criteria.}

---

## Acceptance Criteria

{Bullet list of acceptance criteria extracted from the ticket.}

---

## Key Discussions & Decisions (from JIRA Comments)

{Summarise any notable team discussions, scope decisions, clarifications, or implementation notes found in the JIRA comments. If no meaningful comments exist, write "No significant comments."}

---

## Code Changes Summary

### Branch: `{branch-name}`
### Base: `development`
### Files changed: {total count}

#### Domain
{List files and one-line description of what changed. If none, omit section.}

#### Contracts / DTOs
{List files and one-line description of what changed. If none, omit section.}

#### NHibernate Mappings
{List files and one-line description of what changed. If none, omit section.}

#### Database (Queries / Commands)
{List files and one-line description of what changed. If none, omit section.}

#### Migrations
{List migration files, describe schema changes (tables, columns, indexes). If none, omit section.}

#### API (Controllers / Handlers)
{List files and one-line description of what changed. If none, omit section.}

#### Frontend (Views / Scripts / Styles)
{List files and one-line description of what changed. If none, omit section.}

#### Services (Rebus Messages / Handlers)
{List files and one-line description of what changed. If none, omit section.}

#### Resources
{List any new or reused resource strings. If none, omit section.}

#### Tests
{List test files added or modified. Mention if Verify snapshots were regenerated. If none, omit section.}

---

## Technical Notes

{Any important implementation details worth highlighting: multi-tenancy scoping, performance considerations, breaking changes, dependencies on other tickets, or known limitations. Keep to bullet points.}

---

*Generated: {today's date} | Branch: `{branch-name}`*
```

---

## Step 5: Preview the Document

**Print the full document content to the conversation** so the developer can review it.

Then ask the developer:

> "Does this look correct? Type **yes** to save it to your Desktop, or provide any corrections and I will update the document before saving."

Wait for the user's response using `AskUserQuestion`.

- If the user requests changes, update the document content and show the revised preview again, repeating until they confirm.
- If the user confirms (**yes** / **save** / **looks good** / similar), proceed to Step 6.

---

## Step 6: Save to Desktop

Once the developer confirms, save the file using the `Write` tool:

- **File path:** `~/Desktop/{TICKET_KEY}_DeveloperDocumentation.md`
- **Content:** The confirmed Markdown document from Step 5

Inform the user:

> "Saved to Desktop as `{TICKET_KEY}_DeveloperDocumentation.md`."

---

## Rules

- NEVER save the file without explicit developer confirmation.
- NEVER fabricate code changes — derive everything from the actual `git diff`.
- NEVER include implementation steps or future work — this document describes what **was** done, not what **will** be done.
- If the branch has no commits ahead of `development`, inform the user and stop.
- If the MCP JIRA server is disconnected, tell the user immediately.
- Keep the document concise — a developer should be able to read it in under 3 minutes.
