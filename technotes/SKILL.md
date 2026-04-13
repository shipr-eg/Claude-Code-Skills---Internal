---
name: technotes
description: Generate technical release documentation as a Confluence child page
argument-hint: "<confluence-parent-page-url>"
allowed-tools: Bash(git *), Read, Grep, Glob, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-confluence-service__confluence_get_labels, mcp__mcp-confluence-service__confluence_add_label
---

# Generate Technical Release Notes on Confluence

You generate a technical release notes page as a child of a given Confluence parent page. You discover the page format from existing sibling pages rather than imposing a fixed template.

## Input

Confluence parent page URL: $ARGUMENTS

---

## Step 0: Validate Input

If `$ARGUMENTS` is empty, blank, or missing:
- Print the following usage help and **stop**:

```
Usage: /technotes <confluence-parent-page-url>

Example:
  /technotes https://confluence.eg.dk/display/XNA/Release+Notes

This command generates a technical release notes page as a child
of the given Confluence parent page. It gathers context from the
current branch, JIRA, and git history, discovers the page template
from existing child pages, and creates the new page with your approval.

Requirements:
  - A Confluence MCP server must be connected
  - A JIRA MCP server is recommended (for richer context)
  - You should be on the feature/bugfix branch you want to document
```

Do not proceed further.

---

## Step 0b: Branch safety check

Run `git branch --show-current`. **Refuse to proceed** if the current branch is any of:
`main`, `master`, `development`, `develop`, `release/*`

```
⛔ You are on a protected branch (<branch-name>).
/technotes requires a feature/bugfix branch with commits to document.
```

---

## Step 1: Parse the Confluence URL

Extract from the provided URL:
- **Space key** (e.g., `XNA` from `/display/XNA/...` or `spaceKey=XNA`)
- **Page ID** (from `/pages/<id>/...` or `pageId=<id>` query param)
- **Title hint** (URL-decoded last path segment, e.g., `Release+Notes` → `Release Notes`)

If the URL format is unrecognized, ask the user to provide the space key and page ID manually.

---

## Step 2: Discover Confluence Tools

Use `ToolSearch` with query `"confluence"` to find available Confluence MCP tools.

**If no Confluence tools are found**, print:

```
No Confluence MCP server is connected.

To use /technotes, please add a Confluence MCP server to your
Claude Code configuration and restart the session.
```

Then **stop**. Do not proceed further.

**If tools are found**, note the tool names for:
- Reading/getting a page (content by ID)
- Getting child pages (children of a page)
- Creating a page
- Updating a page

Proceed to Step 3.

---

## Step 3: Gather Context

Collect information from three sources in parallel where possible:

### 3a. Git context

First, ensure the base branch reference is available. Run:

```
git fetch origin development
```

If this fails (e.g., `development` doesn't exist on the remote), try `main` as a fallback. If neither exists, ask the user:

```
AskUserQuestion: "Cannot find a base branch (development or main). What branch should I diff against?"
```

Then run these commands via Bash (using the resolved base branch):

```
git rev-parse --abbrev-ref HEAD
git log <base>..HEAD --oneline
git diff <base>...HEAD --stat
git diff <base>...HEAD --name-only
```

Extract:
- **Branch name** (often contains the JIRA key, e.g., `feature/XNA-12345-description`)
- **Commit list** with messages
- **Changed files** grouped by module/directory
- **Diff stats** (insertions, deletions)

### Empty branch guard

If `git log <base>..HEAD` returns **no commits**, display this message and STOP:

```
⛔ No commits found on this branch since <base>.
There is nothing to document. Commit your changes first, then run /technotes.
```

### 3b. JIRA context (graceful degradation)
Extract the JIRA ticket key from the branch name (pattern: `XNA-\d+`).

If a key is found and JIRA MCP tools are available:
- Fetch the ticket via `mcp__mcp-jira-service__jira_get_issue`
- Extract: summary, description, acceptance criteria, status, priority, labels, linked issues, parent epic
- If there are linked issues, fetch them too (up to 5)

If no JIRA tools are available or the fetch fails:
- Print a warning: `JIRA MCP not available — proceeding with git-only context.`
- Continue with git data only.

### 3c. Test context
From the list of changed files, identify:
- Test files (matching patterns like `*Tests.cs`, `*Test.cs`, `*.Tests/*.cs` — look for files in projects ending with `.Tests`, `.UnitTests`, `.IntegrationTests`)
- Commit messages mentioning "test" (case-insensitive)

---

## Step 4: Discover the Page Template

This is the most important step. You must adapt to the existing format rather than imposing one.

### 4a. Read the parent page
Use the Confluence read/get page tool to fetch the parent page content (by ID or by space+title).

### 4b. Read existing child pages
Use the Confluence children tool to list child pages of the parent. Read the **2 most recent** child pages to learn:
- **Title format** (e.g., `v2.45 — XNA-12345 Description`, or `2025-01-15 Release Notes`, etc.)
- **Section headings** and their order
- **Content style** (tables vs bullets, use of macros, level of detail)
- **Confluence storage format patterns** (macros, panels, status labels)

### 4c. Read parent's siblings (optional, for cross-reference pattern)
Get the grandparent page's children (parent's siblings) to see if parent pages reference their children in a specific way (e.g., a table with links, a `{children}` macro, a bullet list). This informs Step 8.

### 4d. Discover labels from siblings

If Confluence label tools are available (`confluence_get_labels`), read the labels from the 2 most recent child pages. Collect all labels that appear on **both** siblings — these are likely standard labels applied to every release notes page (e.g., `release-notes`, `technical`, `xna`).

Store these common labels to apply to the new page in Step 7.

### 4e. Auto-detect version number from sibling titles

Scan the child page titles for a version pattern (e.g., `v2.45`, `v2.46`, `2025.03.1`). If a consistent pattern is found:

- Parse the latest version number
- Increment the minor/patch component (e.g., `v2.46` → `v2.47`)
- Suggest it in the page title

If no version pattern is found, or the pattern is ambiguous, ask the user:

```
AskUserQuestion: "What version or identifier should appear in the page title?"
```

### 4f. Template decision
- If child pages exist: synthesize the discovered format into a template to follow
- If no children exist: ask the user what format they prefer using `AskUserQuestion`, offering options like:
  - Standard sections (Overview, Technical Changes, Testing, Rollback, Related Tickets)
  - Minimal (Overview + Changes only)
  - Custom (let user describe)

---

## Step 5: Generate Content

**The template discovered in Step 4 is authoritative.** Use the section names, order, and style from the discovered template. The sections listed below are **fallback defaults** — only use them if no template was discovered (i.e., no existing child pages).

### 5a. Change detection heuristics

Before writing content, scan the changed files list for high-impact patterns:

| Pattern | Flag as |
|---------|---------|
| `**/Migrations/*.cs`, `*.sql`, `**/FluentMigrator*` | Database migration |
| `web.config`, `app.config`, `appsettings*.json`, `*.yml` in config dirs | Configuration change |
| `*Controller.cs`, `*ApiController.cs`, `**/Contracts/**`, `*.swagger.*` | API surface change |
| `**/EventHandlers/**`, `**/Sagas/**`, `*ServiceMessage*` | Service bus / messaging change |
| `**/NHibernate/**`, `*Map.cs`, `*Mapping.cs` | ORM mapping change |
| `package.json`, `*.csproj`, `packages.config` | Dependency change |

Collect these flags — they inform the Technical Changes and Rollback sections.

### 5b. Fallback section definitions

Use these only when Step 4 found no existing child pages to learn from:

**Overview**
- Source: JIRA ticket summary + description
- One or two paragraphs explaining what this release does and why

**Technical Changes**
- Source: `git diff --stat`, `--name-only`, grouped by module
- List changed modules/packages with brief descriptions of what changed
- Highlight any flagged changes from Step 5a (migrations, config, API, messaging)

**Testing Summary**
- Source: test files in diff, commit messages mentioning tests
- List new/modified test files
- Note test coverage areas
- If no test changes: explicitly state "No test changes in this release"

**Rollback Plan**
- Revert commit instructions: `git revert <commit-range>`
- Flag any irreversible changes from Step 5a (migrations are irreversible by default unless a down migration exists)
- Risk assessment: low/medium/high with justification based on the change flags

**Related Tickets**
- Source: JIRA linked issues, parent epic
- List all related JIRA tickets with their summaries
- Link to parent epic if applicable

### 5c. Format

Format the content in **Confluence storage format** (XHTML), matching the style discovered in Step 4. If using the fallback sections, use standard Confluence headings (`<h2>`) and bullet lists.

---

## Step 6: User Review — CONFIRMATION GATE 1

Present the full generated page to the user:

1. Show the proposed **page title**
2. Show the **full page content** (rendered as a code block for readability)
3. Ask for approval using `AskUserQuestion`:
   - "Create this page?" with options:
     - **Create as-is**
     - **Edit first** (let user provide feedback, then regenerate)
     - **Cancel**

**Do NOT create the page until the user explicitly approves.**

If the user chooses "Edit first", incorporate their feedback and show the updated content again. Repeat until approved or cancelled.

---

## Step 7: Create the Child Page

### 7a. Check for duplicate page

Before creating, search existing children (from Step 4b) for a page whose title matches or closely matches the proposed title (e.g., same JIRA key, same version number).

If a potential duplicate is found:

```
⚠️  A page with a similar title already exists:
   "<existing title>" — <existing page URL>

What would you like to do?
```

Ask with `AskUserQuestion`:
- **Update existing page** — overwrite the existing page's content with the new content
- **Create anyway** — create a new page alongside the existing one
- **Cancel** — stop without creating

### 7b. Create (or update) the page

Once approved, use the Confluence create page tool to:
- Create a new page as a **child** of the parent page
- Set the title to the format discovered in Step 4 (with version from Step 4e)
- Set the content to the approved body
- Set the space key

If common labels were discovered in Step 4d, apply them to the new page using `confluence_add_label`.

### 7c. Handle creation failure

If the Confluence API call fails, **preserve the approved content** and display:

```
❌ Failed to create page: <error message>

Your approved content has been preserved. Options:
  - Retry by running /technotes again (your content will need to be regenerated)
  - Copy the content below and create the page manually in Confluence
```

Then output the full approved content in a code block so the user can copy it. Do NOT retry automatically.

### 7d. Success summary

On success, display:

```
✅ Page created
   Title:  <page title>
   URL:    <page URL>
   Parent: <parent page title>
   Labels: <applied labels, or "none">
   Sections: <list of section headings>
```

---

## Step 8: Update the Parent Page — CONFIRMATION GATE 2

Determine if the parent page needs updating (based on Step 4c analysis):

- If the parent uses a `{children}` macro: **no update needed**, tell the user.
- If the parent has a manual list (table or bullets) referencing child pages: propose a **minimal addition**.

### Update rules (CRITICAL):
- **NEVER** remove, replace, or modify any existing macros: `{children}`, `{toc}`, `{status}`, `{jira}`, or any `<ac:structured-macro>` elements
- **ONLY** add a new row/bullet/entry to the existing list
- **Preserve** all existing content exactly as-is
- The addition should match the format of existing entries

### Confirmation:
1. Show the user a **diff** of what will change (old vs new, minimal context)
2. Ask for approval using `AskUserQuestion`:
   - "Update parent page?" with options:
     - **Apply update**
     - **Skip** (leave parent unchanged)
     - **Edit first**

**Do NOT update the parent until the user explicitly approves.**

---

## Rules

- NEVER create or update Confluence pages without explicit user approval
- NEVER remove or modify existing Confluence macros — only add content
- NEVER skip the template discovery step — always adapt to existing format
- NEVER run on protected branches (`main`, `master`, `development`, `develop`, `release/*`)
- If Confluence MCP is not available, stop immediately with a clear message
- If JIRA MCP is not available, warn but proceed with git-only data
- If the base branch (`development`) is not available locally, fetch it first — do not fail silently
- Use Confluence storage format (XHTML) for page content, not wiki markup
- Keep the generated content factual — only include information from git/JIRA, do not fabricate details
- The discovered template from Step 4 is **authoritative** — Step 5 fallback sections are only used when no template exists
- On creation failure, always preserve and display the approved content so the user can copy it manually
