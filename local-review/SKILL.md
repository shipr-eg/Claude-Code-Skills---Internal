---
name: local-review
description: Perform comprehensive code review on your current local changes (staged, unstaged, or all uncommitted changes vs HEAD). No JIRA ticket needed. Analyzes working directory diffs against both general .NET 8/React standards AND repository-specific patterns (event sourcing, DDD, aggregates). Outputs a detailed standalone report and a PR-ready summary with inline code annotations. ⚠️ READ-ONLY ANALYSIS ONLY — No code changes, no commits, no remote operations. Use this skill whenever you want a pre-commit review of your local work-in-progress changes before staging or opening a PR.
compatibility: requires git repository with local changes (staged and/or unstaged)
---

# Local Change Code Review

**Command:** `/local-review [$ARGUMENTS]`

## Step 0: Parse the Argument

The user's argument is: `$ARGUMENTS`

| Argument | Action |
|----------|--------|
| *(empty)* | Review ALL local changes vs HEAD (staged + unstaged) — default |
| `--staged` | Review only staged changes (`git diff --cached`) |
| `--unstaged` | Review only unstaged (working directory) changes (`git diff`) |
| `--branch <base>` | Review all changes on current branch compared to `<base>` (e.g. `main`, `develop`) |
| `--detail detailed` | Full detailed report (default) |
| `--detail summary` | Summary format only (PR-ready) |
| `--output standalone` | Standalone report only (no PR format) |
| `--output pr` | PR-ready format only (no detailed report) |

### Usage Examples

```bash
# Review all local changes (staged + unstaged) vs HEAD
/local-review

# Review only staged changes
/local-review --staged

# Review only unstaged changes
/local-review --unstaged

# Review entire branch vs main
/local-review --branch main
/local-review --branch develop

# Summary only (quick pre-commit check)
/local-review --detail summary

# PR-ready format only
/local-review --output pr

# Full review of staged changes, detailed report
/local-review --staged --detail detailed
```

## Process (Read-Only Analysis)

1. **Parse arguments** — Extract scope flag (`--staged`, `--unstaged`, `--branch`) and optional `--detail` / `--output` filters
2. **Detect local changes** — Run the appropriate diff command based on scope:
   - `git diff HEAD` — all local changes vs HEAD (default, staged + unstaged)
   - `git diff --cached` — staged changes only
   - `git diff` — unstaged working directory changes only
   - `git diff <base>...HEAD` — branch changes vs base branch
   - Also run `git status` to get an overview of changed files
3. **Load codebase knowledge** — Read `.knowledge/CODEBASE.md` if it exists to identify the module map. From the changed files, determine which modules are affected. Do not ask the user — infer from file paths. For each affected module, load `.knowledge/<module-folder>/knowledge.md` and `.knowledge/<module-folder>/patterns.md`. Skip silently if no `.knowledge/` folder exists.
4. **Extract changes** — Get the full diff output with full context lines where possible (`git diff -U10 HEAD` or equivalent)
5. **Categorize changes** — Identify files by type (.NET backend, React/TypeScript frontend, SQL, tests, configuration, etc.)
6. **Analyze against standards** — Apply both general and repository-specific review criteria (local analysis only), cross-referencing patterns and anti-patterns from `.knowledge/`
7. **Generate output** — Create detailed report and/or PR-ready format (no code modifications)

**Important**: All operations are read-only. No commits, pushes, or file modifications occur.

---

## Review Criteria

### General Best Practices
- **Code quality**: SOLID principles, DRY, KISS
- **.NET 8 patterns**: Modern async/await, nullable reference types, records, minimal APIs where appropriate
- **React/TypeScript**: Hooks best practices, proper typing, component composition, memoization, `useCallback`
- **Security**: OWASP Top 10 (SQL injection, XSS, authentication, authorization, no secrets in code)
- **Error handling**: Proper exception handling, user-friendly messages, logging

### Repository-Specific Patterns (Event Sourcing + DDD)
- **Event Sourcing**: Events are immutable, aggregates rebuild state from events, event versioning strategy
- **DDD**: Aggregate pattern (inherit from `Aggregate` base), command handling, event emission via `Emit()`
- **Bounded Contexts**: Proper use of Adapter pattern, no direct aggregate references across domain boundaries
- **Commands**: Include `ContextMetadata` for audit trail, proper aggregate ID references
- **Projections**: Idempotency, correct event-to-read-model transformation
- **Testing**: BDD/NUnit style with AutoFixture, Given-When-Then structure

### Module-Specific Patterns (from `.knowledge/`)
- Apply canonical patterns from `patterns.md` for each affected module
- Flag deviations from `knowledge.md` business rules as [BUSINESS RULE VIOLATION]
- Flag public contract deviations as [CONTRACT VIOLATION]
- Flag contradictions between code and `.knowledge/` docs as [CONFLICT]

### Security Review
- No hardcoded credentials or secrets
- Proper `[Authenticated]` / `[AllowAnonymous]` usage
- SQL injection prevention via Dapper parameterized queries
- XSS prevention in React/TypeScript
- API key and sensitive config handling

### Test Coverage
- Tests added or updated proportional to new functionality
- BDD/NUnit patterns followed (Given-When-Then)
- Edge cases and error scenarios covered
- Appropriate balance of unit vs. integration tests

---

## Output Format

### Part 1: Detailed Standalone Report

```
# Local Change Review

## Summary
- Scope: [All local changes / Staged only / Unstaged only / Branch vs <base>]
- Files changed: X
- Files added: X
- Files deleted: X
- Test coverage: [Improved / Maintained / Decreased / No tests changed]
- Risk level: [🟢 Low / 🟡 Medium / 🔴 High]
- Modules affected: [list of module names inferred from changed file paths]

## Overview of Changes
Brief description of what the local changeset accomplishes.

## 📋 Checklist Summary
- ✅ or ❌ Follows event sourcing patterns
- ✅ or ❌ Proper DDD aggregate structure
- ✅ or ❌ Follows module-specific patterns (from .knowledge/)
- ✅ or ❌ No business rule violations
- ✅ or ❌ Public contracts respected
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
For each React/TypeScript file changed:
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
- **Missing Tests**: Areas without coverage that should have it

### Configuration / Other Changes
- Migrations, settings, dependency changes, SQL, etc.

## 🎯 Actionable Recommendations

### 🔴 Critical
Issues that could cause bugs, security vulnerabilities, or production problems.

### 🟡 Important
Issues affecting code quality, maintainability, or test coverage.
Include [CONTRACT VIOLATION], [BUSINESS RULE VIOLATION], and [CONFLICT] flags here if applicable.

### 🟢 Nice to Have
Suggestions for future improvement or consistency.

## Conclusion
Summary assessment: Is this ready to commit/push? Any blockers?
```

### Part 2: PR-Ready Format

```
## Local Change Review Summary

**Overall Assessment**: [Ready to commit / Request self-review / Needs discussion]

**Critical Issues Found**: X
- [Specific issue with suggestion]

**Improvements Recommended**: X
- [Area and suggestion]

**Test Coverage**: [Assessment]

**Positive Notes**: [What was done well]

---

### Inline Code Annotations

For each significant finding, provide the exact location and suggestion:

\`\`\`
File: path/to/file.cs (Line X-Y)
[Code snippet from diff]
💭 Suggestion: [What to change and why]
\`\`\`
```

---

## Implementation Notes

- **Diff commands**: Use `git diff HEAD`, `git diff --cached`, `git diff`, or `git diff <base>...HEAD` as appropriate
- **Context lines**: Use `-U10` or `-U20` to get enough surrounding context for meaningful analysis
- **File type detection**: Determine from extension (.cs, .tsx, .ts, .sql, .json, .csproj, etc.)
- **No commits matched**: If there are no local changes in the selected scope, report "No local changes found" and suggest checking `git status`
- **Large diffs**: If diff is very large (100+ files), summarize by module/area rather than file-by-file
- **Be constructive**: Frame suggestions as learning opportunities, not criticism
- **Reference patterns**: When recommending changes, reference existing code or `.knowledge/` patterns as examples

---

## ⚠️ SAFETY RULES - READ-ONLY OPERATIONS ONLY

**This skill performs ANALYSIS ONLY. No modifications or state changes are permitted.**

### Prohibited Operations
- 🚫 **NO git commits** — Never run `git commit`, `git add`, `git push`, or any state-changing git commands
- 🚫 **NO file modifications** — Never edit, create, delete, or modify any files
- 🚫 **NO code changes** — Analysis and recommendations only; never execute changes
- 🚫 **NO remote operations** — Never push to GitHub, remote branches, or external systems
- 🚫 **NO staging changes** — Never run `git add` or `git rm`

### Allowed Operations (Read-Only)
- ✅ `git status` — List changed files
- ✅ `git diff` / `git diff --cached` / `git diff HEAD` — View local changes
- ✅ `git diff <base>...HEAD` — Compare branch to base
- ✅ Read local files — Access code for analysis
- ✅ Read `.knowledge/` files — Load module knowledge for context-aware review
- ✅ Search files with grep — Find patterns and references
- ✅ Parse and analyze code — Detect issues, patterns, security concerns
- ✅ Generate reports — Output analysis and recommendations

---

## Usage Help

When no argument is provided, show a brief help note before starting the default (all local changes) review:

```
Local Change Code Review

USAGE:
  /local-review [OPTIONS]

DESCRIPTION:
  Reviews your current local (uncommitted) changes for best practices,
  security, test coverage, and architectural compliance. Analyzes against
  both general standards (.NET 8, React) and repository patterns (DDD,
  event sourcing), plus module-specific patterns from .knowledge/.

OPTIONS:
  --staged                     Review only staged changes (git diff --cached)
  --unstaged                   Review only unstaged changes (git diff)
  --branch <base>              Review branch changes vs base (e.g. main, develop)

  --detail [detailed|summary]  Output detail level
                               detailed = full findings (default)
                               summary  = condensed PR-ready feedback

  --output [standalone|pr]     Output format
                               standalone = detailed report only
                               pr         = PR-ready format only
                               (default: both)

EXAMPLES:
  /local-review
  /local-review --staged
  /local-review --branch main
  /local-review --detail summary
  /local-review --staged --output pr
  /local-review --branch develop --detail detailed
```
