---
name: devdocs
description: Analyse code changes on the current GitHub branch and JIRA ticket comments, then generate a brief Developer Overview document. Previews the document before saving it as {TICKET_KEY}_DeveloperDocumentation.md on the Desktop.
allowed-tools: Read, Grep, Glob, Bash, Write, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_worklog, mcp__mcp-confluence-service__confluence_search, mcp__mcp-confluence-service__confluence_get_page, mcp__mcp-confluence-service__confluence_get_page_children, mcp__mcp-confluence-service__confluence_create_page
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

Use `Bash` to find changes **scoped to the target ticket only**.

### 3a. Find commits for this specific ticket

```bash
git branch --show-current
git log development...HEAD --oneline --grep="{TICKET_KEY}"
```

If commits referencing `{TICKET_KEY}` are found, get the diff **only for those commits**:

```bash
# Get the list of commit SHAs for this ticket
git log development...HEAD --format="%H" --grep="{TICKET_KEY}"

# Diff only those commits (combine their changes)
git show <SHA1> <SHA2> ... --stat
git diff <earliest-SHA>^ <latest-SHA> --name-only
git diff <earliest-SHA>^ <latest-SHA> -- <file>
```

If only **one commit** matches, use:
```bash
git show <SHA> --stat
git show <SHA> -- <file>
```

### 3b. Fallback: no ticket-specific commits found

If `git log --grep="{TICKET_KEY}"` returns no results, fall back to the full branch diff but **cross-reference with the JIRA ticket** to identify which files are plausibly related to this ticket (based on the ticket description, components, and acceptance criteria). Only include files in the documentation that are related to this ticket. Clearly note at the top of the Code Changes Summary section:

> Note: No commits explicitly tagged `{TICKET_KEY}` were found on this branch. The files below were inferred from the full branch diff based on the ticket context.

### 3c. Read the diff for the identified files

```bash
git diff <ref1> <ref2> -- <file>
```

For each file in scope:
- Read the diff to understand what was added, modified, or removed
- Identify the architectural layer (Domain, Contracts, Mappings, Database, API, Frontend, Services, Tests, Migrations, Resources)

### 3e. Summarise changes by layer

Group the ticket-scoped files into layers:

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

## Step 7: Publish to Confluence

After saving the file, automatically publish the documentation to Confluence. The target parent page is the **Development Documentation** page at ID `558351389` in the XNA space.

### 7a. Check for existing ticket page

Use `mcp__mcp-confluence-service__confluence_search` to find an existing page with the ticket key as its title under the parent page:

```
title = "{TICKET_KEY}" AND parent = 558351389 AND space = "XNA"
```

### 7b. Create the ticket page (if it doesn't exist)

If no page is found, create it using `mcp__mcp-confluence-service__confluence_create_page` with:
- **title:** `{TICKET_KEY}`
- **space:** `XNA`
- **parent_id:** `558351389`
- **content** (Confluence storage format): The JIRA issue macro, which renders as an embedded card (Jira icon + ticket key):

```xml
<p><ac:structured-macro ac:name="jira" ac:schema-version="1"><ac:parameter ac:name="key">{TICKET_KEY}</ac:parameter></ac:structured-macro></p>
```

If the page already exists, use its existing page ID — do not recreate it.

### 7c. Create the Developer Overview child page

Using the ticket page ID from 7a or 7b as the parent, create a child page using `mcp__mcp-confluence-service__confluence_create_page` with:
- **title:** `{TICKET_KEY} — Developer Overview`
- **space:** `XNA`
- **parent_id:** `{ticket page ID from 7b}`
- **content:** The full developer overview document converted to Confluence storage format (XHTML), **with the first `# {TICKET_KEY} — Developer Overview` heading removed** — Confluence renders the page title as the heading automatically, so including it in the body causes it to appear twice.

#### Converting Markdown to Confluence storage format

Strip the opening `# ...` line (the document title) before converting. Then convert the rest:
- `# Heading` → `<h1>Heading</h1>`
- `## Heading` → `<h2>Heading</h2>`
- `### Heading` → `<h3>Heading</h3>`
- `**bold**` → `<strong>bold</strong>`
- `` `code` `` → `<code>code</code>`
- `` ```code block``` `` → `<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[...]]></ac:plain-text-body></ac:structured-macro>`
- `- bullet` → `<ul><li>bullet</li></ul>`
- `| table |` → `<table><tbody><tr><th>...</th></tr><tr><td>...</td></tr></tbody></table>`
- Horizontal rules (`---`) → `<hr/>`
- Plain paragraphs → `<p>...</p>`
- Escaped HTML special characters: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`

Wrap the entire body in a root `<div>` element or leave it as a sequence of block elements.

### 7d. Inform the user

After successful creation, tell the user:

> "Published to Confluence:
> - Ticket page: `https://confluence.eg.dk/spaces/XNA/pages/{ticket-page-id}/{TICKET_KEY}`
> - Developer Overview: `https://confluence.eg.dk/spaces/XNA/pages/{overview-page-id}/{TICKET_KEY}+%E2%80%94+Developer+Overview`"

If any Confluence step fails, report the error clearly but do not block — the file was already saved to Desktop.

---

## Rules

- NEVER save the file without explicit developer confirmation.
- NEVER fabricate code changes — derive everything from the actual `git diff`.
- NEVER include implementation steps or future work — this document describes what **was** done, not what **will** be done.
- If the branch has no commits ahead of `development`, inform the user and stop.
- If the MCP JIRA server is disconnected, tell the user immediately.
- Keep the document concise — a developer should be able to read it in under 3 minutes.