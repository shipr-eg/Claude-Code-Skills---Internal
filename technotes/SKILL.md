---
name: technotes
description: Generate technical release documentation as a Confluence child page
argument-hint: "<confluence-parent-page-url>"
allowed-tools: Bash(git *), Read, Grep, Glob, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search
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
  /technotes https://confluence.eg.dk/display/ZER/Release+Notes

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

## Step 1: Parse the Confluence URL

Extract from the provided URL:
- **Space key** (e.g., `ZER` from `/display/ZER/...` or `spaceKey=ZER`)
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
Run these commands via Bash:
```
git rev-parse --abbrev-ref HEAD
git log master..HEAD --oneline
git diff master...HEAD --stat
git diff master...HEAD --name-only
```

Extract:
- **Branch name** (often contains the JIRA key, e.g., `feature/ZER-1234-description`)
- **Commit list** with messages
- **Changed files** grouped by module/directory
- **Diff stats** (insertions, deletions)

### 3b. JIRA context (graceful degradation)
Extract the JIRA ticket key from the branch name (pattern: `ZER-\d+`).

If a key is found and JIRA MCP tools are available:
- Fetch the ticket via `mcp__mcp-jira-service__jira_get_issue`
- Extract: summary, description, acceptance criteria, status, priority, labels, linked issues, parent epic
- If there are linked issues, fetch them too (up to 5)

If no JIRA tools are available or the fetch fails:
- Print a warning: `JIRA MCP not available — proceeding with git-only context.`
- Continue with git data only.

### 3c. Test context
From the list of changed files, identify:
- Test files (matching patterns like `*Test.java`, `*Spec.java`, `*.test.js`, `*.spec.js`)
- Commit messages mentioning "test" (case-insensitive)

---

## Step 4: Discover the Page Template

This is the most important step. You must adapt to the existing format rather than imposing one.

### 4a. Read the parent page
Use the Confluence read/get page tool to fetch the parent page content (by ID or by space+title).

### 4b. Read existing child pages
Use the Confluence children tool to list child pages of the parent. Read the **2 most recent** child pages to learn:
- **Title format** (e.g., `v2.45 — ZER-1234 Description`, or `2025-01-15 Release Notes`, etc.)
- **Section headings** and their order
- **Content style** (tables vs bullets, use of macros, level of detail)
- **Confluence storage format patterns** (macros, panels, status labels)

### 4c. Read parent's siblings (optional, for cross-reference pattern)
Get the grandparent page's children (parent's siblings) to see if parent pages reference their children in a specific way (e.g., a table with links, a `{children}` macro, a bullet list). This informs Step 8.

### 4d. Template decision
- If child pages exist: synthesize the discovered format into a template to follow
- If no children exist: ask the user what format they prefer using `AskUserQuestion`, offering options like:
  - Standard sections (Overview, Technical Changes, Testing, Rollback, Related Tickets)
  - Minimal (Overview + Changes only)
  - Custom (let user describe)

---

## Step 5: Generate Content

Using the discovered template format, generate the page content with these sections (adapting names/order to match the template):

### Overview
- Source: JIRA ticket summary + description
- One or two paragraphs explaining what this release does and why

### Technical Changes
- Source: `git diff --stat`, `--name-only`, grouped by module
- List changed modules/packages with brief descriptions of what changed
- Highlight any database migrations, configuration changes, or API changes

### Testing Summary
- Source: test files in diff, commit messages mentioning tests
- List new/modified test files
- Note test coverage areas
- If no test changes: explicitly state this

### Rollback Plan
- Revert commit instructions: `git revert <commit-range>`
- Flag any irreversible changes (migrations, data changes)
- Risk assessment: low/medium/high with justification

### Related Tickets
- Source: JIRA linked issues, parent epic
- List all related JIRA tickets with their summaries
- Link to parent epic if applicable

Format the content in **Confluence storage format** (XHTML), matching the style discovered in Step 4.

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

Once approved, use the Confluence create page tool to:
- Create a new page as a **child** of the parent page
- Set the title to the format discovered in Step 4
- Set the content to the approved body
- Set the space key

After creation, report the new page URL to the user.

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
- If Confluence MCP is not available, stop immediately with a clear message
- If JIRA MCP is not available, warn but proceed with git-only data
- Use Confluence storage format (XHTML) for page content, not wiki markup
- Keep the generated content factual — only include information from git/JIRA, do not fabricate details
