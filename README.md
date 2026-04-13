# Xena Custom Skills for Claude Code

This repository contains custom Claude Code skills tailored for the **Xena** project (EG A/S). These skills automate common development workflows — JIRA integration, code review, security fixes, shipping, documentation, and time tracking — all with deep knowledge of Xena's architecture (NHibernate, multi-tenancy, Rebus services, Knockout.js frontend).

---

## Available Skills

| Skill | Command | Description |
|-------|---------|-------------|
| [code-review](#code-review) | `/code-review XNA-XXXXX` | Comprehensive code review by JIRA ticket |
| [create-jira-ticket](#create-jira-ticket) | `/create-jira-ticket [description]` | Create structured JIRA tickets with templates per issue type |
| [review-jira](#review-jira) | `/review-jira XNA-XXXXX` | Analyse a JIRA ticket and plan implementation |
| [secfix](#secfix) | `/secfix XNA-XXXXX` | Security vulnerability fix workflow |
| [ship](#ship) | `/ship [commit\|push\|pr]` | Commit, push, and create PRs with conventional format |
| [technotes](#technotes) | `/technotes <confluence-url>` | Generate technical release notes on Confluence |
| [worklog](#worklog) | `/worklog [time]` | Create JIRA worklog entries from branch context |

---

## Skill Details

### code-review

**Read-only** analysis of all commits related to a JIRA ticket on the current branch. Reviews code against Xena-specific patterns and produces a detailed report.

**Usage:**
```bash
/code-review XNA-18827
/code-review XNA-18827 --author siddhant
/code-review XNA-18827 --detail summary
/code-review XNA-18827 --output pr
```

**Options:**
- `--author <username>` — filter commits by author
- `--detail [detailed|summary]` — output detail level (default: `detailed`)
- `--output [standalone|pr]` — report format (default: both)

**What it checks:**
- NHibernate / ORM conventions (conformist mappings, HighLow ID generation, filter application)
- Multi-tenancy compliance (FiscalSetup filters, no cross-tenant data leaks)
- Domain layer patterns (entity hierarchy, validation rules, internal constructors)
- API conventions (correct base controllers, wrapper methods, auth attributes)
- Service communication (Rebus message patterns, BaseHandler usage)
- Database migrations (sequential numbering, Up/Down methods)
- Frontend patterns (Knockout.js observables, TypeScript namespaces, resource string reuse)
- Security (OWASP top 10, hardcoded credentials, authorization)
- Test coverage assessment

**Output:** A two-part report — detailed standalone analysis and a PR-ready summary with inline annotations.

**Safety:** Strictly read-only. No commits, no file modifications, no remote operations.

---

### create-jira-ticket

Creates structured JIRA tickets with professional descriptions, automatic summary generation, codebase context enrichment, and Xenapedia integration. Supports all issue types with tailored templates.

**Usage:**
```bash
/create-jira-ticket Fix the checkbox alignment on the invoice page
/create-jira-ticket subtask of XNA-18827 Add unit tests for the new validation
/create-jira-ticket                      # Collects everything interactively
```

**Features:**
- **Issue type templates** — tailored description structure for each type: Bug (Context/Current/Expected/Steps), Story/Task (Context/Requirements/Acceptance Criteria), Spike (Question/Context/Expected Output), Epic (Vision/Scope/Out of Scope/Success Criteria), Business Project (Objective/Stakeholders/Deliverables), Sub-task (Parent Context/Task/Criteria)
- **Context enrichment** — proactively searches the Xena codebase for relevant files, modules, and existing functionality; fetches Xenapedia for product behavior clarification
- **Duplicate detection** — searches JIRA for similar open tickets before creating, to avoid redundant work
- **Sub-task mode** — `/create-jira-ticket subtask of XNA-XXXXX` fetches the parent ticket, inherits its category, and links automatically
- **Epic linking** — optionally links new tickets to a parent epic
- **Priority support** — collects priority (Blocker/Critical/Major/Minor/Trivial) with Major as default
- **Smart argument parsing** — description passed via arguments skips the description prompt; sub-task syntax is auto-detected
- **Edit flow** — structured revision loop for Summary, Description, Priority, Type, or multiple fields at once

**Fixed fields:** Project = XNA, Labels = AI, Security Level = ALL EG

**Confirmation gates:** Draft approval required before creation. Failed submissions preserve the approved draft.

**Integrations:** JIRA MCP (required), Xenapedia (optional, graceful degradation)

---

### review-jira

Fetches a JIRA ticket via MCP, explores the Xena codebase to identify all affected areas, and produces a structured implementation plan in **plan mode**. Implementation only begins after explicit user approval.

**Usage:**
```bash
/review-jira XNA-18827
/review-jira https://jira.eg.dk/browse/XNA-18827
```

**Workflow:**
1. Fetches ticket details from JIRA (summary, description, acceptance criteria, linked issues, attachments)
2. Explores the codebase layer-by-layer:
   - Domain entities, DTOs/Contracts, NHibernate mappings
   - Database commands/queries, migrations
   - API controllers, service handlers
   - Frontend views, scripts, styles
   - Tests (unit, integration, verify snapshots)
   - Resource strings
3. Enters plan mode and presents a structured implementation plan with:
   - Ticket summary and analysis
   - Affected areas organized by layer
   - Numbered implementation steps in dependency order (Domain -> Contracts -> Mappings -> Database -> API -> Frontend)
   - Risks, multi-tenancy implications, and open questions
   - Estimated scope (small/medium/large)
4. Implements the plan step-by-step after user approval

**Integrations:** JIRA MCP (required), Git

---

### secfix

End-to-end security vulnerability fix workflow. Analyzes a vulnerability, audits the codebase for affected dependencies and code patterns, implements the fix, runs tests, and creates a PR with full documentation.

**Usage:**
```bash
/secfix XNA-19000
/secfix https://jira.eg.dk/browse/XNA-19000
/secfix "Upgrade NHibernate to 5.5.3 to fix CVE-2024-XXXXX"
```

**Workflow:**
1. **Gather context** — fetch vulnerability details from JIRA or parse free-text input; identify CVE, affected package, current/fixed versions
2. **Audit codebase** — find the dependency across `.csproj`, `packages.config`, and `lib/` files; map the blast radius (all affected projects); grep for vulnerable code patterns
3. **Create fix branch** — with user approval, creates `secfix/XNA-XXXXX-package-name-upgrade` from `development`
4. **Implement fix** — upgrades NuGet packages, updates binding redirects, fixes vulnerable code patterns
5. **Build and test** — runs `dotnet build` and `dotnet test`, diagnoses and fixes any errors
6. **Commit and push** — stages only relevant files (never `git add -A`), uses conventional commit format
7. **Create PR** — via GitHub MCP with structured body including blast radius, security details, and code quality checklist
8. **Update JIRA** — optionally adds a comment with PR link and fix details

**Confirmation gates:** Branch creation, commit, push, and PR creation each require explicit user approval.

**Integrations:** JIRA MCP, GitHub MCP, Git, dotnet CLI

---

### ship

Commit, push, and/or create pull requests with conventional commit format and automatic JIRA ticket ID extraction from the branch name.

**Usage:**
```bash
/ship commit       # Stage + commit
/ship push         # Stage + commit + push
/ship pr           # Stage + commit + push + create PR
/ship pr --draft   # Same as pr, but creates a draft PR
```

**Features:**
- **Smart file staging** — analyzes which files belong to the feature work vs. unrelated changes; presents a categorized list for approval before staging
- **Branch safety** — refuses to operate on protected branches (`main`, `master`, `development`, `develop`, `release/*`)
- **JIRA ticket extraction** — automatically parses the ticket ID from the branch name (e.g., `bugfix/XNA-18827-checkbox-styling` -> `XNA-18827`)
- **Conventional commits** — formats messages as `XNA-XXXXX - type(scope): description` with proper type detection (`fix`, `feat`, `refactor`, etc.)
- **PR creation** — builds a structured PR body with changes summary, commit list, JIRA link, and code quality checklist (checkboxes only checked based on actual evidence in the diff)
- **Existing PR detection** — checks for open PRs before creating duplicates; offers to update instead
- **Rebase warnings** — alerts if the branch is behind `development` before pushing

**Confirmation gates:** Commit message and file staging require user approval. Never force-pushes or skips pre-commit hooks.

**Integrations:** GitHub MCP, Git

---

### technotes

Generates technical release notes as a Confluence child page. Discovers the page format from existing sibling pages rather than imposing a fixed template.

**Usage:**
```bash
/technotes https://confluence.eg.dk/display/XNA/Release+Notes
```

**Workflow:**
1. **Parse Confluence URL** — extracts space key, page ID, and title
2. **Discover tools** — verifies Confluence MCP availability
3. **Gather context** — collects data from three sources in parallel:
   - Git: branch name, commit list, changed files, diff stats
   - JIRA: ticket summary, description, acceptance criteria, linked issues (graceful degradation if unavailable)
   - Tests: identifies test files in the diff
4. **Discover page template** — reads the 2 most recent sibling pages to learn the existing format (title pattern, section headings, content style, Confluence macros)
5. **Generate content** — produces the page in Confluence storage format (XHTML) with sections for Overview, Technical Changes, Testing Summary, Rollback Plan, and Related Tickets
6. **User review** — presents the full page for approval with options to edit or cancel
7. **Create page** — publishes as a child of the specified parent page
8. **Update parent** — if the parent maintains a manual list of children, proposes a minimal addition (never modifies existing macros)

**Confirmation gates:** Page creation and parent page updates each require explicit user approval.

**Integrations:** Confluence MCP (required), JIRA MCP (optional), Git

---

### worklog

Creates concise JIRA worklog entries by summarizing work done on the current branch. Derives context from git commits and the JIRA ticket, with smart time estimation.

**Usage:**
```bash
/worklog 2h
/worklog 1h 30m
/worklog 4h yesterday
/worklog              # Will estimate time from commit timestamps
```

**Features:**
- **Automatic context gathering** — reads commits, diff stats, and the JIRA ticket to generate a 2-4 sentence summary
- **Time estimation** — calculates time span from commit timestamps when no time argument is given
- **Scope narrowing** — for branches with 15+ commits, offers to scope the worklog to today's commits, the last session, or a custom range
- **Duplicate detection** — checks for existing worklogs on the same ticket for today before submitting
- **Backdating support** — accepts date indicators like `yesterday` or `2026-04-11` to log time for previous days
- **Edit flow** — allows revising the comment and/or time before submission

**Valid time formats:** `30m`, `2h`, `1h 30m`, `1d`, `1d 4h` (standard JIRA time notation)

**Confirmation gates:** Worklog submission requires explicit user approval. Failed submissions preserve the approved entry for retry.

**Integrations:** JIRA MCP (required), Git

---

## Prerequisites

These skills require the following to be configured in your Claude Code environment:

| Requirement | Used By | Purpose |
|-------------|---------|---------|
| Git repository | All skills | Branch detection, commit history, diffs |
| JIRA MCP server | review-jira, secfix, worklog, technotes, code-review, create-jira-ticket | Ticket fetching, creation, worklog submission, comments |
| GitHub MCP server | ship, secfix | PR creation and management |
| Confluence MCP server | technotes | Page creation and template discovery |
| Xenapedia (web) | create-jira-ticket | Product behavior reference (optional, graceful degradation) |

## Installation

### Option 1: Copy individual skills

From your Xena project root, copy the skill folders you need:

```bash
# Copy a single skill
cp -r /path/to/Claude-Code-Skills---Internal/ship ./.claude/skills/

# Or on Windows
xcopy /E /I "C:\path\to\Claude-Code-Skills---Internal\ship" ".\.claude\skills\ship"
```

### Option 2: Copy all skills

```bash
# Copy all skills at once
cp -r /path/to/Claude-Code-Skills---Internal/* /path/to/your-project/.claude/skills/

# On Windows
xcopy /E /I "C:\path\to\Claude-Code-Skills---Internal\*" "C:\path\to\your-project\.claude\skills\"
```

### Directory structure after installation

```
your-project/
└── .claude/
    └── skills/
        ├── code-review/
        │   └── SKILL.md
        ├── create-jira-ticket/
        │   └── SKILL.md
        ├── review-jira/
        │   └── SKILL.md
        ├── secfix/
        │   └── SKILL.md
        ├── ship/
        │   └── SKILL.md
        ├── technotes/
        │   └── SKILL.md
        └── worklog/
            └── SKILL.md
```

After copying, restart Claude Code or reload the configuration. The skills will be available within that project context.

## Usage

Once installed, invoke any skill using the `/skill-name` command in Claude Code:

```
/code-review XNA-18827
/create-jira-ticket Fix the checkbox alignment on the invoice page
/review-jira XNA-18827
/secfix XNA-19000
/ship pr
/technotes https://confluence.eg.dk/display/XNA/Release+Notes
/worklog 2h
```

Refer to the individual skill sections above for full usage details and options.

## Common Workflows

### Start a new feature
1. `/create-jira-ticket` — create a well-structured ticket (or use an existing one)
2. `/review-jira XNA-XXXXX` — analyse the ticket and get an implementation plan
3. Implement the approved plan
4. `/ship pr` — commit, push, and create a PR
5. `/worklog 4h` — log your time

### Fix a security vulnerability
1. `/secfix XNA-XXXXX` — full guided workflow from analysis to PR

### Review before merging
1. `/code-review XNA-XXXXX` — get a detailed review of all changes for a ticket

### Document a release
1. `/technotes https://confluence.eg.dk/display/XNA/Release+Notes` — generate and publish release notes

## Safety and Conventions

All skills follow these principles:

- **Confirmation gates** — destructive or external actions (commits, pushes, PR creation, JIRA updates, Confluence edits) always require explicit user approval
- **Protected branches** — skills refuse to operate directly on `main`, `master`, `development`, `develop`, or `release/*`
- **No blind staging** — `git add -A` and `git add .` are never used; files are reviewed and staged individually
- **No force-push** — force-push and hook-skipping (`--no-verify`) are never performed
- **Conventional commits** — all commits follow the format `XNA-XXXXX - type(scope): description`
- **Base branch** — PRs target `development` (not `master` or `main`)
- **Repository** — PRs are created against `EG-A-S/Xena`
