---
name: code-review
description: Perform comprehensive code review on commits related to a JIRA ticket. Pass the JIRA ticket number (e.g., AJB-2134) as an argument. Automatically finds all commits on the current branch matching that ticket, analyzes the code changes for best practices, security, robustness, test coverage, and production readiness. Reviews against both general .NET 8/React standards AND repository-specific patterns (event sourcing, DDD, domain-driven design aggregates). Outputs both a detailed standalone report for the developer and a PR-ready summary format with inline code annotations. ⚠️ **READ-ONLY ANALYSIS ONLY** — No code changes, no commits, no remote operations. Use this skill whenever you need to perform code review on specific commits by ticket number, or when you want to evaluate changes for architectural compliance, security, test coverage gaps, or best practice violations.
compatibility: requires git repository access, commit history, and code diffs
---

# Code Review by JIRA Ticket

**Command:** `/code-review $ARGUMENTS`

## Step 0: Parse the Argument

The user's argument is: `$ARGUMENTS`

| Argument | Action |
|----------|--------|
| *(empty)* | Show usage help (see below) and STOP |
| `AJB-XXXX` | Review all commits with that JIRA ticket on current branch |
| `AJB-XXXX --author <username>` | Review commits with that ticket by specific author |
| `AJB-XXXX --author "<Full Name>"` | Review commits by author with spaces in name |
| `AJB-XXXX --detail detailed` | Full detailed report (default) |
| `AJB-XXXX --detail summary` | Summary format only (PR-ready) |
| `AJB-XXXX --output standalone` | Standalone report only (no PR format) |
| `AJB-XXXX --output pr` | PR-ready format only (no detailed report) |
| `AJB-XXXX --author <user> --detail summary` | Combine filters (author + detail level) |

### Usage Examples

```bash
# Full review (default: all commits with ticket, both detailed + PR-ready)
/code-review AJB-2134

# Review commits by specific author
/code-review AJB-2134 --author johndoe@eg.dk
/code-review AJB-2134 --author johndoe766

# Review by author with full name (quoted)
/code-review AJB-2134 --author "John Doe"

# Summary only (quick PR feedback)
/code-review AJB-2134 --detail summary

# Review commits by author + summary format
/code-review AJB-2134 --author johndoe --detail summary

# Detailed report only
/code-review AJB-2134 --output standalone

# PR-ready format only (specific author)
/code-review AJB-2134 --author "Jane Smith" --output pr
```

## Process (Read-Only Analysis)

1. **Parse arguments** — Extract JIRA ticket number and optional filters (--author, --detail, --output)
2. **Find commits** — Search current branch git history for commits containing:
   - The JIRA ticket number in the commit message
   - (Optional) Matching the specified author if --author is provided
   - Command: `git log --grep="AJB-XXXX" --author="<username>"` (if author specified)
3. **Load codebase knowledge** — Read `.knowledge/CODEBASE.md` to identify the module map. From the changed files found in commits, determine which modules are affected. Do not ask the user — infer from file paths matched against the module map. For each affected module, load `.knowledge/<module-folder>/knowledge.md` and `.knowledge/<module-folder>/patterns.md`. If no `.knowledge/` folder exists at the project root, skip silently and continue.
4. **Extract changes** — Get the full diff of all matching commits (`git show`, `git diff`)
5. **Categorize changes** — Identify files by type (.NET backend, React/TypeScript frontend, configuration, tests, etc.)
6. **Analyze against standards** — Apply both general and repository-specific review criteria (local analysis only), cross-referencing patterns and anti-patterns loaded from `.knowledge/`
7. **Generate output** — Create both detailed report and PR-ready format (no code modifications)

**Author Filter Matching**:
- Matches against `git log --author` which checks both name and email
- `--author mohil@eg.dk` matches email address
- `--author "Mohammediliyas766"` matches Git author name
- `--author "John Doe"` matches full names (use quotes if name has spaces)
- Case-insensitive pattern matching

**Important**: All operations are read-only. No commits, pushes, or file modifications occur.

## Review Criteria

### General Best Practices
- **Code quality**: SOLID principles, DRY (don't repeat yourself), KISS (keep it simple)
- **.NET 8 patterns**: Modern async/await, nullable reference types, records, minimal APIs where appropriate
- **React/TypeScript**: Hooks best practices, proper typing, component composition, performance (memoization, useCallback)
- **Security**: OWASP top 10 vulnerabilities (SQL injection, XSS, authentication, authorization, secrets in code)
- **Error handling**: Proper exception handling, user-friendly error messages, logging

### Repository-Specific Patterns (Event Sourcing + DDD)
- **Event Sourcing**: Events are immutable, aggregates rebuild state from events, event versioning
- **Domain-Driven Design**: Aggregate pattern (inherit from Aggregate base), command handling, event emission
- **Bounded Contexts**: Proper use of Adapter pattern, no direct aggregate references across domains
- **Commands**: Commands include ContextMetadata for audit trail, proper aggregate ID references
- **Projections**: Test idempotency, verify events properly transform to read models
- **Testing**: BDD style with AutoFixture, proper Given-When-Then structure

### Module-Specific Patterns (from `.knowledge/`)
- For each affected module, apply the canonical patterns from `patterns.md` as a review checklist
- Flag any code that matches anti-patterns listed in the module's `patterns.md`
- Flag any violation of business rules or domain constraints documented in `knowledge.md`
- Flag any deviation from public contracts defined in `knowledge.md` as [CONTRACT VIOLATION]
- Flag any contradiction between the committed code and `.knowledge/` documentation as [CONFLICT] — note it in Risks & Considerations

### Security Review
- No hardcoded credentials or secrets
- Proper authentication/authorization (Authenticated attribute, AllowAnonymous only where needed)
- SQL injection prevention (using Dapper parameterized queries correctly)
- XSS prevention in React/TypeScript
- CORS configuration if applicable
- API key handling (internal APIs use proper validation)

### Test Coverage
- Tests added for new functionality or modified behavior
- Test coverage increased (or maintained if only refactoring)
- BDD/NUnit patterns followed (Given-When-Then structure)
- Edge cases and error scenarios covered
- Mocks vs. integration tests used appropriately

## Output Format

### Part 1: Detailed Standalone Report

Use this structure:

```
# Code Review: [TICKET-NUMBER]

## Summary
- Total commits: X
- Files changed: X
- Files added: X
- Test coverage: [Improved/Maintained/Decreased]
- Risk level: [🟢 Low / 🟡 Medium / 🔴 High]
- Modules affected: [list of module names inferred from changed file paths]

## Overview of Changes
Brief description of what this commit set accomplishes.

## 📋 Checklist Summary
- ✅ or ❌ Follows event sourcing patterns
- ✅ or ❌ Proper DDD aggregate structure
- ✅ or ❌ Follows module-specific patterns (from .knowledge/)
- ✅ or ❌ No business rule violations (from .knowledge/)
- ✅ or ❌ Public contracts respected (from .knowledge/)
- ✅ or ❌ Security review passed
- ✅ or ❌ Test coverage maintained or improved
- ✅ or ❌ Error handling adequate
- ✅ or ❌ Follows .NET 8 / React best practices

## 🔍 Detailed Findings

### Backend (.NET) Changes
For each .NET file changed:
- **File**: path/to/file.cs
- **Type**: [Aggregate/Command/Event/Service/Controller/etc.]
- **Changes**: 1-2 sentence summary
- **Findings**:
  - ✅ What's done well
  - ⚠️ Areas to improve or questions
  - 🔴 Any issues found

### Frontend (React/TypeScript) Changes
For each React file changed:
- **File**: path/to/Component.tsx
- **Component**: [ComponentName]
- **Changes**: 1-2 sentence summary
- **Findings**:
  - ✅ What's done well
  - ⚠️ Areas to improve
  - 🔴 Any issues found

### Test Changes
- **Coverage**: Did tests increase proportional to code changes?
- **Test Quality**: BDD structure, edge cases, mocking strategy
- **Missing Tests**: Areas that should have test coverage but don't

### Configuration / Other Changes
- Migrations, settings, dependencies, etc.

## 🎯 Actionable Recommendations

List specific, actionable improvements prioritized by severity:

### 🔴 Critical
Issues that could cause bugs, security vulnerabilities, or production problems.

### 🟡 Important
Issues that affect code quality, maintainability, or test coverage.
Include [CONTRACT VIOLATION] and [CONFLICT] flags here if applicable.

### 🟢 Nice to Have
Suggestions for future improvement or consistency.

## Conclusion
Summary assessment: Is this ready to merge? Any blockers?
```

### Part 2: PR-Ready Format

Provide a condensed version suitable for posting as PR feedback:

```
## Code Review Summary: [TICKET]

**Overall Assessment**: [Ready to merge / Request changes / Needs discussion]

**Critical Issues Found**: X
- [Specific issue with suggestion]

**Improvements Recommended**: X
- [Area and suggestion]

**Test Coverage**: [Assessment]

**Positive Notes**: [What was done well]

---

### Inline Code Annotations

For each significant finding, provide the exact code location and suggestion:

\`\`\`
File: path/to/file.cs (Line X-Y)
[Code snippet]
💭 Suggestion: [What to change and why]
\`\`\`
```

## Implementation Notes

- **Diff extraction**: Use `git diff COMMIT~1..COMMIT` or `git show COMMIT` for full context
- **Multiple commits**: If multiple commits match the ticket, analyze all together as a cohesive changeset
- **File types**: Determine file type from extension (.cs, .tsx, .sql, .json, etc.)
- **Context matters**: Read nearby code and existing patterns in the repository to understand the context
- **Be constructive**: Frame suggestions as learning opportunities, not criticism
- **Reference patterns**: When recommending changes, reference existing code in the repo as examples where possible — prefer examples from `.knowledge/<module>/patterns.md` over generic suggestions

## ⚠️ SAFETY RULES - READ-ONLY OPERATIONS ONLY

**This skill performs ANALYSIS ONLY. No modifications or state changes are permitted.**

### Prohibited Operations
- 🚫 **NO git commits** — Never run `git commit`, `git add`, `git push`, or any state-changing git commands
- 🚫 **NO file modifications** — Never edit, create, delete, or modify any files
- 🚫 **NO code changes** — Analysis and recommendations only; never execute changes
- 🚫 **NO remote operations** — Never push to GitHub, remote branches, or external systems
- 🚫 **NO environment changes** — Never modify environment variables, configurations, or settings

### Allowed Operations (Read-Only)
- ✅ `git log` — Search for commits by ticket number
- ✅ `git show` — Display commit diffs and full context
- ✅ `git diff` — Compare commits or branches
- ✅ Read local files — Access code for analysis
- ✅ Read `.knowledge/` files — Load module knowledge for context-aware review
- ✅ Search files with grep/ripgrep — Find patterns and references
- ✅ Parse and analyze code — Detect issues, patterns, security concerns
- ✅ Generate reports — Output analysis and recommendations

### Local Repository Only
- ✅ **Local git operations**: Use local repository history (`git log`, `git show`, `git diff`)
- 🚫 **No remote access**: Never fetch from GitHub or interact with remote repositories
- 🚫 **No network calls**: Never make HTTP requests to GitHub API or other remote systems
- 🚫 **No branch switching**: Never modify the current branch with `git checkout` or `git switch`

### Scope
This skill is a **read-only analysis tool**. It generates insights and recommendations but never modifies code, configuration, or repository state. All output is informational only — actual implementation of recommendations requires manual action by the developer.

## Usage Help

When user provides no argument or invalid format, show this:

```
Code Review by JIRA Ticket

USAGE:
  /code-review AJB-XXXX [OPTIONS]

DESCRIPTION:
  Reviews commits related to a JIRA ticket for best practices, security,
  test coverage, and architectural compliance. Analyzes against both
  general standards (.NET 8, React) and repository patterns (DDD,
  event sourcing), plus module-specific patterns from .knowledge/.

ARGUMENTS:
  AJB-XXXX                     JIRA ticket number (required)

OPTIONS:
  --author <username|email>    Filter commits by author
                               Examples: --author "John Doe"
                                         --author johndoe@example.com
                                         --author Mohammediliyas766
                               (case-insensitive pattern matching)

  --detail [detailed|summary]   Output detail level
                                detailed = full findings (default)
                                summary  = condensed PR feedback

  --output [standalone|pr]      Output format
                                standalone = detailed report only
                                pr         = PR-ready format only
                                (default: both)

EXAMPLES:
  # Review all commits for ticket
  /code-review AJB-2134

  # Review commits by specific author
  /code-review AJB-2134 --author "John Doe"
  /code-review AJB-2134 --author johndoe@example.com

  # Combine options
  /code-review AJB-2134 --detail summary
  /code-review AJB-2134 --author johndoe --output pr
  /code-review AJB-2134 --author "Jane Smith" --detail detailed
```