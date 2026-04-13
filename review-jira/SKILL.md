---
name: review-jira
description: Analyse a JIRA ticket and provide an implementation plan tailored to the Xena codebase (NHibernate, multi-tenancy, Rebus services, Knockout.js frontend)
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, EnterPlanMode, ExitPlanMode, AskUserQuestion, Task, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_transitions, mcp__mcp-jira-service__jira_get_worklog, mcp__mcp-jira-service__jira_download_attachments, mcp__mcp-jira-service__jira_add_comment
argument-hint: <jira-url>
---

# Review JIRA Ticket & Plan Implementation

You have been given a JIRA ticket to analyse and plan an implementation for.

## Input

JIRA ticket URL or key: $ARGUMENTS

## Step 1: Extract the Ticket Key

Parse the JIRA ticket key from the input. It may be provided as:
- A full URL like `https://jira.eg.dk/browse/XNA-18827` — extract `XNA-18827`
- Just the key like `XNA-18827`

If empty, ask the user with `AskUserQuestion`.

## Step 2: Fetch Ticket Details via MCP

Use the `mcp__mcp-jira-service__jira_get_issue` MCP tool to retrieve:
- Summary, description, acceptance criteria
- Issue type, priority, status
- Labels, components, fix version
- Linked issues (parent epic, blockers, related tickets)
- Comments (for additional context from the team)
- Attachments (download if they contain specs, mockups, or diagrams)

If the ticket references other JIRA tickets (in description, comments, or links), fetch those too for full context.

## Step 3: Codebase Exploration

Based on the ticket details, systematically explore the Xena codebase. Use the layer-by-layer approach below to identify all affected areas.

### 3a. Identify the domain area

From the ticket, determine which business domain is involved (e.g., orders, articles, invoicing, vouchers, partners, bookkeeping, subscriptions). Then search for relevant files:

- **Domain entities**: `Glob` for `src/Xena.Domain/*<keyword>*` — entities and business rules
- **DTOs/Contracts**: `Glob` for `src/Xena.Contracts/Domain/*<keyword>*` — serializable DTOs
- **NHibernate mappings**: `Glob` for `src/Xena.Infrastructure.Mappings/Entities/*<keyword>*Mapping.cs`
- **NHibernate filters**: Check `src/Xena.Infrastructure.Mappings/Filters/` if multi-tenancy filtering is relevant

### 3b. Identify the infrastructure

- **Database commands/queries**: `Grep` for the entity name in `src/Xena.Infrastructure.Database/` — find creators, updaters, deleters, queries
- **Migrations**: Check `src/Xena.DBMigration/MigrationSteps/` for the latest migration folder to understand the current schema and where to add new migrations

### 3c. Identify the API surface

- **Controllers**: `Grep` for route keywords or entity names in `src/Xena.Web.Api/Controllers/`
- **Handlers**: Search `src/Xena.Web.Api/` for message handlers if the feature involves async processing

### 3d. Identify the frontend

- **Views**: `Glob` for `src/Xena.Web/Views/**/*<keyword>*.cshtml` — Razor views
- **Scripts**: `Grep` for related function/module names in `src/Xena.Web/Scripts/` — TypeScript/JS
- **Styles**: If UI changes are involved, check `src/Xena.Web/Content/css/`

### 3e. Identify services

- **Service messages**: `Grep` in `src/Xena.ServiceMessages.*` for relevant message types
- **Service handlers**: Check the corresponding `src/Xena.Services.*` project

### 3f. Identify tests

- **Integration tests**: `Glob` for `src/Xena.IntegrationTests/**/*<keyword>*`
- **Unit tests**: `Glob` for `src/Xena.UnitTests/**/*<keyword>*` and `src/Xena.Domain.Tests/**/*<keyword>*`
- **Service-specific tests**: Check `src/Xena.Services.*.Tests/` or `src/Xena.Services.*.UnitTest/`
- **Verify snapshots**: If integration tests exist, check for corresponding `VerifyFiles/*.verified.json`

### 3g. Check resources

- **String resources**: `Grep` in `src/Xena.Resources/` for existing strings that can be reused (IMPORTANT: reuse before creating new ones)
- **Email resources**: Check `src/Xena.Resources.Email/` if email templates are involved

### 3h. Read related code

For each identified file, **read it** to understand:
- Existing patterns and conventions
- How similar features were implemented
- What tests already exist

Use the Explore subagent for deeper research if the ticket spans many areas.

## Step 4: Enter Plan Mode & Present the Plan

**You MUST enter plan mode** using the `EnterPlanMode` tool before presenting the implementation plan.

Structure the plan as:

### Ticket Summary
- Ticket: [KEY] — [Summary]
- Type: [Bug/Story/Task/etc.] | Priority: [priority] | Status: [status]
- Epic: [parent epic if any]

### Analysis
- What the ticket is asking for (in your own words)
- Key acceptance criteria extracted from the ticket
- How similar functionality is currently implemented (reference specific files)

### Affected Areas
Organized by layer:
- **Domain** — entities to create/modify, validation rules needed
- **Contracts** — DTOs to create/modify
- **Mappings** — NHibernate mappings to create/modify, filters to apply
- **Database** — commands, queries, creators to create/modify
- **Migrations** — schema changes needed (new tables, columns, indexes, FKs)
- **API** — controllers/routes to create/modify
- **Frontend** — views, viewmodels, styles to create/modify
- **Services** — service messages and handlers if async processing needed
- **Resources** — new/reused string resources
- **Tests** — tests to add/update, verify snapshots that will change

### Implementation Steps
- Numbered, ordered list of concrete steps
- Each step should reference specific files and describe the change precisely
- Follow dependency order: Domain → Contracts → Mappings → Infrastructure.Database → API → Frontend
- Include migration steps with the next sequential migration number
- Include test steps (new tests to write, existing tests to update)
- Flag any Verify snapshots that will need regeneration

### Risks & Considerations
- Multi-tenancy implications (FiscalSetup scoping)
- Potential side effects on existing calculations or denormalized data
- Whether Rebus service messages need updating
- Elasticsearch reindexing requirements
- Open questions that need clarification from the team
- Dependencies on other tickets

### Estimated Scope
- List of files to create/modify/delete
- Rough classification: small (1-5 files), medium (5-15 files), large (15+ files)

Then use `ExitPlanMode` to present the plan for user approval.

## Step 5: Implement (Only After User Approval)

**Do NOT begin implementation until the user explicitly approves the plan.**

Once approved, follow the plan step by step:
1. Implement changes in dependency order (Domain first, Frontend last)
2. After each significant step, summarize what was done
3. When creating NHibernate mappings, use the extension methods (`AddEntityMapping()`, `AddFiscalMapping()`, etc.)
4. When creating migrations, use the next sequential migration number
5. When adding frontend code, follow KO observable patterns
6. Before adding resource strings, search for reusable existing ones
7. Run relevant tests if applicable

After implementation:
- Summarize all changes made
- Ask the user if they want to:
  - Run tests
  - Use `/ship` to commit and create a PR
  - Use `/worklog` to log time
  - Update the JIRA ticket with a comment

## Rules
- NEVER skip plan mode. Always plan first, implement after approval.
- NEVER commit or push without explicit user approval.
- NEVER manually edit `*.verified.json` snapshot files — let the Verify framework regenerate them.
- NEVER add new resource strings without first searching for reusable existing ones.
- Use MCP JIRA tools — do not fall back to WebFetch.
- If the MCP JIRA server is disconnected, tell the user immediately.
- Base branch is `development` (not `master` or `main`).
