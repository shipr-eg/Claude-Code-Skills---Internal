---
name: code-review
description: Perform comprehensive code review on commits related to a JIRA ticket. Pass the JIRA ticket number (e.g., XNA-18827) as an argument. Finds all commits on the current branch matching that ticket and analyzes code changes for Xena-specific patterns (NHibernate, multi-tenancy, Rebus services, Knockout.js frontend), security, test coverage, and production readiness. READ-ONLY — no code changes, no commits, no remote operations.
compatibility: requires git repository access, commit history, and code diffs
allowed-tools: Bash(git *), Read, Grep, Glob
---

# Code Review by JIRA Ticket

**Command:** `/code-review $ARGUMENTS`

## Step 0: Parse the Argument

The user's argument is: `$ARGUMENTS`

| Argument | Action |
|----------|--------|
| *(empty)* | Show usage help (see below) and STOP |
| `XNA-XXXXX` | Review all commits with that JIRA ticket on current branch |
| `XNA-XXXXX --author <username>` | Review commits with that ticket by specific author |
| `XNA-XXXXX --detail detailed` | Full detailed report (default) |
| `XNA-XXXXX --detail summary` | Summary format only (PR-ready) |
| `XNA-XXXXX --output standalone` | Standalone report only |
| `XNA-XXXXX --output pr` | PR-ready format only |

### Usage Examples

```bash
/code-review XNA-18827
/code-review XNA-18827 --author siddhant
/code-review XNA-18827 --author "Siddhant Singh"
/code-review XNA-18827 --detail summary
/code-review XNA-18827 --author siddhant --output pr
```

## Process (Read-Only Analysis)

1. **Parse arguments** — Extract JIRA ticket number and optional filters (--author, --detail, --output)
2. **Find commits** — Search current branch for commits containing the ticket number:
   - `git log development..HEAD --grep="XNA-XXXXX" --oneline` (with `--author` if specified)
   - If no commits found on this branch, try `git log --all --grep="XNA-XXXXX" --oneline` and inform the user
3. **Extract changes** — Get the full diff of all matching commits (`git show <hash>` for each)
4. **Read affected files** — For each changed file, read the full file to understand context (not just the diff). Also read related files (e.g., if a mapping file changed, read the corresponding entity and vice versa)
5. **Categorize changes** — Group files by layer:
   - **Domain** (`Xena.Domain/`) — entities, business rules, validation
   - **Contracts** (`Xena.Contracts/`) — DTOs
   - **Infrastructure.Mappings** (`Xena.Infrastructure.Mappings/`) — NHibernate mappings, filters
   - **Infrastructure.Database** (`Xena.Infrastructure.Database/`) — commands, queries, creators, deleters
   - **API** (`Xena.Web.Api/`) — controllers, handlers
   - **Frontend** (`Xena.Web/`) — Views (.cshtml), Scripts (.ts/.js), Styles (.scss)
   - **Services** (`Xena.Services.*`, `Xena.*Service`) — Rebus handlers, background processing
   - **ServiceMessages** (`Xena.ServiceMessages.*`) — message contracts
   - **Migrations** (`Xena.DBMigration/`) — database schema changes
   - **Tests** (`*.Tests`, `*.UnitTests`, `Xena.IntegrationTests`) — test files
6. **Analyze against criteria** — Apply Xena-specific review criteria (see below)
7. **Generate output** — Produce the report

## Review Criteria

### Xena Architecture Compliance

#### NHibernate / ORM
- Mappings use `ClassMapping<T>` conformist pattern (not XML `.hbm.xml`)
- New entities use reusable extensions: `AddEntityMapping()`, `AddFiscalMapping()`, `AddTransactionalMapping()`
- HighLow ID generation used (not identity or assigned)
- New entities with FiscalSetup scope have `FiscalSetupFilter` applied
- Soft-delete entities have `NotDeletedFilter` applied
- Mapping file named `[EntityName]Mapping.cs` in `Infrastructure.Mappings/Entities/`
- No direct SQL queries bypassing NHibernate (except in migrations or explicit raw SQL use cases)
- Lazy loading awareness — no N+1 query patterns in loops

#### Multi-Tenancy
- Any new query/command that touches fiscal-scoped data correctly applies `FiscalSetupFilter`
- Bearer, Department, Purpose filters applied where appropriate
- No cross-fiscal data leaks — verify that queries don't accidentally expose data from other tenants
- `IHasFiscalSetup` interface implemented on fiscal-scoped entities

#### Domain Layer
- Entities follow the hierarchy: `IEntity` base with `IsDeactivated` and `Version`
- Transactional data (`TransactionalData<T>`) is append-only — never updated after creation
- Validation uses `IRule<T>` / `RelayRule<T>` pattern
- Domain entities have internal constructors (not public) — created through factories/creators
- DTOs in `Xena.Contracts` match their domain counterparts

#### API Layer
- Controllers inherit from the correct base: `XenaFiscalApiController`, `XenaUserApiController`, or `XenaAnonymousApiController`
- CRUD operations use wrapper methods: `WrapSave<TEntity, TDto>()`, `WrapDelete<T>()`, `WrapGet<T>()`, `WrapCommand()`
- Elasticsearch queries wrapped with `WrapElasticQuery<T>()`
- Route attributes (`[RoutePrefix]`, `[Route]`) are correct and consistent
- `[ApiAuthorizationFiscal]` or appropriate auth attribute present

#### Service Communication
- New service messages extend `BaseMessage` with `FiscalSetupId`, `ResourceId`, `TimestampUtc`
- Handlers extend `BaseHandler<TMessage>` and set `_systemContext.CurrentFiscalSetupId`
- Message contracts are in the correct `Xena.ServiceMessages.*` project
- No synchronous heavy operations in API controllers that should be offloaded to services via Rebus

#### Database Migrations
- Migration class has correct sequential `[Migration(N)]` number (no gaps, no conflicts)
- `Up()` and `Down()` methods both implemented
- Foreign keys use `CreateDefaultForeignKey()` extension where applicable
- No data-destructive operations without explicit justification
- Views updated if the underlying table structure changed

#### Frontend (Knockout.js / TypeScript)
- ViewModels use `var self = this` pattern with proper KO observable creation
- Uses `Xena.observable()`, `Xena.observables()`, `Xena.observableCollection()` for model binding
- TypeScript uses `module Xena {}` namespace pattern (not ES6 imports)
- No direct DOM manipulation — use KO bindings (`data-bind`)
- SCSS changes compile correctly (check `compilerconfig.json` references)
- No hardcoded strings — use resource strings from `Xena.Resources`

### General Quality

#### Security (OWASP)
- No hardcoded credentials, connection strings, or API keys
- SQL injection prevention (parameterized queries, NHibernate criteria)
- XSS prevention in frontend code (no `innerHTML` with user input, proper KO text bindings)
- Authorization attributes on all controller actions
- No `[AllowAnonymous]` without clear justification

#### Error Handling
- Proper exception handling — no swallowed exceptions
- Logging added for significant operations (especially in services)
- User-facing errors are meaningful (not stack traces)

#### Test Coverage
- New functionality has corresponding tests in the appropriate test project
- Integration tests use `TransactionalTestBase` for automatic rollback
- Verify snapshots (`*.verified.json`) not manually edited — regenerated via framework
- Test fixtures use `TestsWithTestWebSecurityContextFixture` or `TestsWithApiSecurityContextFixture`
- Mocking uses Moq, assertions use FluentAssertions

### Resource String Reuse
- Before adding new resource strings, check if existing strings in `Xena.Resources` can be reused
- Resource keys follow existing naming conventions

## Output Format

### Part 1: Detailed Standalone Report

```
# Code Review: XNA-XXXXX

## Summary
- Total commits: X
- Files changed: X
- Files added: X
- Test coverage: [Improved/Maintained/Decreased/None]
- Risk level: [Low / Medium / High]
- Layers affected: [Domain, API, Frontend, Services, Migrations, etc.]

## Overview of Changes
Brief description of what this commit set accomplishes.

## Checklist Summary
- [pass/fail] Multi-tenancy (FiscalSetup filters, no cross-tenant leaks)
- [pass/fail] NHibernate mapping conventions
- [pass/fail] Domain patterns (entity hierarchy, validation rules)
- [pass/fail] API conventions (correct base controller, wrapper methods)
- [pass/fail] Service communication (Rebus messages, handler patterns)
- [pass/fail] Security review passed
- [pass/fail] Test coverage maintained or improved
- [pass/fail] Frontend patterns (KO observables, TypeScript namespaces)
- [pass/fail] Resource string reuse checked
- [pass/fail] Migration correctness (sequential numbering, Up/Down)

## Detailed Findings

### [Layer Name] Changes
For each changed file:
- **File**: path/to/file.cs
- **Changes**: 1-2 sentence summary
- **Findings**:
  - What's done well
  - Areas to improve or questions
  - Any issues found

### Test Changes
- Coverage assessment
- Missing tests
- Test quality

## Actionable Recommendations

### Critical
Issues that could cause bugs, security vulnerabilities, data leaks, or production problems.

### Important
Issues affecting code quality, architectural compliance, or maintainability.

### Nice to Have
Suggestions for consistency or future improvement.

## Conclusion
Summary assessment: Is this ready to merge? Any blockers?
```

### Part 2: PR-Ready Format

```
## Code Review: XNA-XXXXX

**Overall**: [Ready to merge / Request changes / Needs discussion]

**Critical Issues**: X
- [Issue with suggestion]

**Improvements**: X
- [Suggestion]

**Test Coverage**: [Assessment]

**Positive Notes**: [What was done well]

---

### Inline Annotations

File: path/to/file.cs (Line X-Y)
[Code snippet]
Suggestion: [What to change and why]
```

## SAFETY RULES — READ-ONLY ONLY

### Prohibited
- NO `git commit`, `git add`, `git push`, or any state-changing git commands
- NO file modifications — analysis and recommendations only
- NO remote operations

### Allowed
- `git log`, `git show`, `git diff` — read commit history and diffs
- Read files — access code for context
- Grep/Glob — find patterns and references

## Usage Help

When no argument is provided:

```
Code Review by JIRA Ticket

USAGE:
  /code-review XNA-XXXXX [OPTIONS]

DESCRIPTION:
  Reviews commits related to a JIRA ticket for Xena-specific patterns
  (NHibernate, multi-tenancy, Rebus, Knockout.js), security, test
  coverage, and architectural compliance.

ARGUMENTS:
  XNA-XXXXX                     JIRA ticket number (required)

OPTIONS:
  --author <username|email>     Filter commits by author
  --detail [detailed|summary]   Output detail level (default: detailed)
  --output [standalone|pr]      Output format (default: both)

EXAMPLES:
  /code-review XNA-18827
  /code-review XNA-18827 --author siddhant
  /code-review XNA-18827 --detail summary
  /code-review XNA-18827 --author "Siddhant Singh" --output pr
```
