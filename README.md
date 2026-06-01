# Xena Custom Skills for Claude Code

This repository contains custom Claude Code skills tailored for the **Xena** project (EG A/S). These skills automate common development workflows — JIRA integration, code review, security fixes, shipping, documentation, and time tracking — all with deep knowledge of Xena's architecture (NHibernate, multi-tenancy, Rebus services, Knockout.js frontend).

---

## Available Skills

| Skill | Command | Description |
|-------|---------|-------------|
| [architecture-analysis](#architecture-analysis) | `/architecture-analysis [path]` | Full architectural analysis of a module with Mermaid diagrams and scorecard |
| [code-review](#code-review) | `/code-review XNA-XXXXX` | Comprehensive code review by JIRA ticket |
| [create-jira-ticket](#create-jira-ticket) | `/create-jira-ticket [description]` | Create structured JIRA tickets with templates per issue type |
| [path-finder-qa](#path-finder-qa) | `/path-finder-qa <view-or-feature>` | Locate a view, tab, pop-up or form in Xena via Xenapedia, Confluence, and codebase |
| [review-jira](#review-jira) | `/review-jira XNA-XXXXX` | Analyse a JIRA ticket and plan implementation |
| [review-jira-qa](#review-jira-qa) | `/review-jira-qa XNA-XXXXX` | QA analysis of a JIRA ticket with Git commit analysis, impact assessment, and test case generation |
| [secfix](#secfix) | `/secfix XNA-XXXXX` | Security vulnerability fix workflow |
| [ship](#ship) | `/ship [commit\|push\|pr]` | Commit, push, and create PRs with conventional format |
| [technotes](#technotes) | `/technotes <confluence-url>` | Generate technical release notes on Confluence |
| [worklog](#worklog) | `/worklog [time]` | Create JIRA worklog entries from branch context |

---

## Skill Details

### architecture-analysis

**Read-only** complete architectural analysis of a module or project directory. Produces production-grade documentation suitable for developers, architects, technical leads, product owners, and onboarding engineers.

**Usage:**
```bash
/architecture-analysis                                # Analyse the current workspace / opened module
/architecture-analysis src/Xena.BookkeepingService   # Analyse a specific module path
```

**Workflow:**
1. **Discovery** — walks the directory tree, reads root manifests (`*.csproj`, `*.sln`, `package.json`, `appsettings*.json`, `Dockerfile`, etc.), identifies language/framework/runtime, and inventories controllers, services, repositories, DTOs, entities, handlers, jobs, migrations, and tests
2. **Deep analysis** — traces constructor dependencies, DI registrations, call graphs, persistence mappings (NHibernate / EF / raw SQL / stored procs), messaging (Rebus / Kafka / RabbitMQ / Azure Service Bus / Hangfire / Quartz), and security (`[Authorize]`, multi-tenancy filters, secret handling). Uses the `Explore` subagent in parallel for large modules.
3. **Synthesis** — produces an 18-section report plus a Module Architecture Scorecard.

**What it produces:**
- Module overview, architecture pattern detection, and directory structure analysis
- Per-component breakdown (purpose, dependencies, callers, methods, business rules, risks)
- Request flow analysis and Mermaid **data flow**, **sequence**, and **end-to-end architecture** diagrams
- Dependency analysis (internal projects, external NuGet/npm, shared components, cross-module)
- Database interaction analysis with ER-style description
- Business logic, integration, configuration, error handling, and security analyses (OWASP Top 10)
- Developer walkthrough ("if a new dev joins tomorrow…")
- Technical debt & prioritized improvement recommendations
- Executive summary
- Module Architecture Scorecard (Maintainability / Scalability / Testability / Security / Performance / Complexity, 1–10) with production-readiness verdict

**Formatting:** Strict Markdown + Mermaid rules — `<br/>` (never `\n`) in node labels, quoted labels with special characters, blank lines around tables and fenced blocks — so output renders cleanly in VS Code preview, GitHub, and Confluence.

**Output:** Renders the full report in chat and saves it to `./architecture-analysis-<module-name>-<yyyyMMdd>.md` in the workspace.

**Safety:** Strictly read-only. No code modifications, no commits, no remote operations.

---

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

### path-finder-qa

Navigation lookup helper for QA. Given a view, tab, pop-up, window, or form name, searches **Xenapedia**, **Confluence**, and the codebase to return every navigation path where that UI element can be found in Xena. Always returns at least an approximate answer — never stops because a single source is unavailable.

**Usage:**
```bash
/path-finder-qa voucher registration tab
/path-finder-qa "Create Invoice" pop-up
/path-finder-qa partner card form
```

**Workflow:**
1. Normalizes the query — extracts the target label, element kind (tab / pop-up / form / etc.), domain hints, and common Xena synonyms (Voucher ↔ Bilag, Article ↔ Item, Partner ↔ Customer, …)
2. Searches Xenapedia first (the authoritative end-user navigation source) via `WebFetch` / `WebSearch`
3. Searches Confluence next via the Confluence MCP for internal specs, feature designs, and QA docs
4. Falls back to the codebase only if the above yield nothing — `Glob`/`Grep` for Razor views, TypeScript, resource strings, controllers, and menu configuration, then translates technical findings into a human-friendly path
5. Deduplicates and classifies every candidate path as ✅ **Exact**, 🟡 **Likely**, or 🟠 **Approximate**
6. Presents a short QA-friendly report — navigation paths first, then reference pages, preconditions, and a transparent notes-and-gaps section if any data source was unavailable

**What it produces:**
- Ranked list of navigation paths (✅ / 🟡 / 🟠) with a one-line source note per path
- Reference Xenapedia and Confluence page links actually consulted
- Preconditions (module enabled, role required, feature flag, etc.) when mentioned in sources
- ⚠️ Notes & Gaps section listing any source that was unreachable (only shown when relevant)
- One-line "next step for QA" so the QA knows what to do with the answer

**Graceful degradation:**
- Xenapedia unreachable → falls back to Confluence + codebase
- Confluence MCP unavailable → falls back to Xenapedia + codebase
- Codebase inaccessible → returns documented paths only, labels gaps clearly
- Never fabricates paths — inferred routes are always marked 🟠 **Approximate**

**Safety:** Strictly read-only. No file edits, no JIRA or Confluence writes, no commits.

**Integrations:** Xenapedia (web, optional), Confluence MCP (optional), local repo (optional)

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

### review-jira-qa

QA-focused analysis of a JIRA ticket. Reads the ticket, mines Git commits and code changes, assesses UI and functionality breakage risk, and generates prioritized test cases. Optionally pushes test cases directly to Zephyr Scale.

**Usage:**
```bash
/review-jira-qa XNA-18827
/review-jira-qa https://jira.eg.dk/browse/XNA-18827
```

**Workflow:**
1. Fetches full ticket details from JIRA including development panel (linked commits, PRs, branches)
2. Runs Git analysis from two sources — JIRA-linked commits and local git history (graceful fallback if either is unavailable)
3. Mines full commit message bodies for edge cases, known limitations, and fixup patterns
4. Reads changed code files; finds all dependent files via Grep/Glob
5. Runs a multi-tenancy safety check on every backend change (Xena-specific)
6. Checks existing test coverage to avoid duplicating automated tests
7. Assesses UI and functionality breakage risk per changed file type
8. Generates test scenarios and detailed test cases with P1/P2/P3 priority and severity ratings
9. Produces a structured output including Quick Smoke Test Checklist, Test Data Prerequisites, and risk-rated Risks & Gaps
10. Optionally pushes all test cases to Zephyr Scale with folder management

**What it produces:**
- Git commit analysis (source, pattern, message insights)
- Code change impact analysis (backend/frontend/database/config + dependent files)
- Multi-tenancy findings
- Quick smoke test checklist (5–7 highest-risk items first)
- Test data & environment prerequisites
- Full test scenarios and detailed test cases (step-by-step or BDD, your choice)
- Risks & Gaps rated 🔴 HIGH / 🟡 MEDIUM / 🟢 LOW
- ⚠️ Git & Repository Access Summary (only shown when data was missing)

**Graceful degradation:**
- Repo inaccessible → uses commit messages for context
- No git integration → proceeds with ticket-only analysis
- Both cases noted transparently in the output

**Integrations:** JIRA MCP (required), Git (optional), Zephyr Scale REST API (optional)

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
| JIRA MCP server | review-jira, review-jira-qa, secfix, worklog, technotes, code-review, create-jira-ticket | Ticket fetching, creation, worklog submission, comments |
| Workspace file access | architecture-analysis | Read source, config, and manifest files for module analysis |
| GitHub MCP server | ship, secfix | PR creation and management |
| Confluence MCP server | technotes, path-finder-qa | Page creation, template discovery, internal navigation lookup |
| Xenapedia (web) | create-jira-ticket, path-finder-qa | Product behavior reference and navigation paths (optional, graceful degradation) |

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
        ├── architecture-analysis/
        │   └── SKILL.md
        ├── code-review/
        │   └── SKILL.md
        ├── create-jira-ticket/
        │   └── SKILL.md
        ├── path-finder-qa/
        │   └── SKILL.md
        ├── review-jira/
        │   └── SKILL.md
        ├── review-jira-qa/
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
/architecture-analysis src/Xena.BookkeepingService
/code-review XNA-18827
/create-jira-ticket Fix the checkbox alignment on the invoice page
/path-finder-qa voucher registration tab
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

### Onboard onto a module
1. `/architecture-analysis src/Xena.<Module>` — generate a full architectural overview with diagrams and scorecard

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
