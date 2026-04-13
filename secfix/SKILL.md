---
name: secfix
description: Security vulnerability fix workflow — analyze a vulnerability from a JIRA ticket, identify affected NuGet/npm dependencies or code patterns in Xena, implement the fix, run tests, and create a PR with documentation
argument-hint: "<XNA-XXXXX or vulnerability description>"
allowed-tools: Bash(git *), Bash(dotnet *), Bash(nuget *), Read, Grep, Glob, Edit, Write, AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_add_comment, mcp__mcp-github-server__create_pull_request, mcp__mcp-github-server__update_pull_request
---

# Security Vulnerability Fix Workflow

**Command:** `/secfix $ARGUMENTS`

## Step 0: Parse Input

The user's argument is: `$ARGUMENTS`

- If it matches `XNA-\d+` or is a JIRA URL → extract the ticket key and fetch it in Step 1
- If it's a free-text description (e.g., "upgrade Newtonsoft.Json to fix CVE-2024-XXXXX") → use as the vulnerability context, skip JIRA fetch
- If empty → show usage help and STOP:

```
Usage: /secfix <XNA-XXXXX | vulnerability-description>

Examples:
  /secfix XNA-19000
  /secfix https://jira.eg.dk/browse/XNA-19000
  /secfix "Upgrade NHibernate to 5.5.3 to fix CVE-2024-XXXXX"

This workflow:
  1. Analyzes the vulnerability and affected dependencies
  2. Creates a fix branch (with your approval)
  3. Implements the upgrade/fix
  4. Runs tests
  5. Creates a PR
  6. Updates the JIRA ticket
```

## Step 1: Gather Vulnerability Context

### If JIRA ticket provided:
Use `mcp__mcp-jira-service__jira_get_issue` to fetch:
- Summary, description, acceptance criteria
- CVE identifiers mentioned
- Affected packages/libraries
- Priority and severity

### For all inputs:
Identify:
- **CVE ID** (if any)
- **Affected package/library name**
- **Current version** in use
- **Fixed version** (minimum safe version)
- **Vulnerability type** (RCE, XSS, SQL injection, deserialization, DoS, etc.)

If the CVE or affected package is unclear, ask the user with `AskUserQuestion`.

## Step 2: Audit the Codebase

### 2a. Find the dependency

Search for the affected package across the solution:

- **NuGet packages**: Search `*.csproj` files and `packages.config` files for the package name
  ```
  grep -r "PackageName" --include="*.csproj" --include="packages.config" src/
  ```
- **lib/ DLLs**: Check if the library is in the `lib/` folder (legacy direct references)
- **npm packages**: If frontend-related, check `package.json` (though Xena doesn't use npm — check `Scripts/` for vendored libraries)

### 2b. Map the blast radius

Identify all projects that reference the affected package (directly or transitively):
- List all `.csproj` files that include the package
- Check if the package is in `Xena.Common` or `Xena.Infrastructure.*` (which would affect many downstream projects)
- Note whether the vulnerability is in a library only used at build-time vs runtime

### 2c. Check for vulnerable code patterns

If the vulnerability is about a specific code pattern (e.g., unsafe deserialization, unvalidated input):
- Grep for the vulnerable API/method calls across the codebase
- List all locations that need fixing

Present findings to the user before proceeding.

## Step 3: Create Fix Branch — CONFIRMATION GATE

Present the plan:

```
Vulnerability: [CVE-ID or description]
Package: [name] [current-version] → [target-version]
Affected projects: [list]
Code pattern fixes needed: [list or "none"]

Proposed branch: secfix/XNA-XXXXX-package-name-upgrade
```

Ask with `AskUserQuestion`: "Create this branch and proceed with the fix?"
- **Yes** → create branch from `development` and continue
- **Edit** → let user adjust the plan
- **Cancel** → stop

```bash
git checkout development
git pull
git checkout -b secfix/XNA-XXXXX-package-name-upgrade
```

## Step 4: Implement the Fix

### For NuGet package upgrades:
1. Update the version in all affected `.csproj` files (for SDK-style projects)
2. For `packages.config` projects, update the version and corresponding `<Reference>` in the `.csproj`
3. If the package is in `lib/`, replace the DLL and update assembly references
4. Check for breaking API changes between the current and target version
5. Update any `app.config` / `web.config` binding redirects if needed

### For code pattern fixes:
1. Fix each identified vulnerable code location
2. Follow existing patterns in the codebase (e.g., use NHibernate parameterized queries, not string concatenation)
3. Add input validation at system boundaries where missing

### For vendored JS libraries (in Scripts/):
1. Replace the file with the updated version
2. Verify the API hasn't changed in a breaking way
3. Check `BundleConfig.cs` if file names changed

**After each change, explain what was modified and why.**

## Step 5: Build and Test

1. Attempt a build:
   ```bash
   cd src && dotnet build Xena.sln
   ```
   (Or inform user to build in Visual Studio if `msbuild` is required for .NET Framework projects)

2. If build errors occur:
   - Diagnose (usually binding redirect or API breaking changes)
   - Fix and explain each resolution
   - Re-build until clean

3. Run tests if possible:
   ```bash
   dotnet test src/Xena.IntegrationTests/Xena.IntegrationTests.csproj
   ```

4. Report build and test results to the user.

## Step 6: Commit and Push — CONFIRMATION GATE

Stage only the relevant files (NEVER `git add -A`). Show the proposed commit message:

```bash
git commit -m "$(cat <<'EOF'
XNA-XXXXX - fix(security): upgrade [package] to [version] for [CVE-ID]

[1-2 sentence explanation of the vulnerability and fix]

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

Ask user to confirm before committing.

After commit, push:
```bash
git push -u origin secfix/XNA-XXXXX-package-name-upgrade
```

## Step 7: Create PR

Use `ToolSearch` to load GitHub MCP tools, then create a PR:

- **owner:** `EG-A-S`
- **repo:** `Xena`
- **base:** `development`
- **head:** current branch
- **title:** `XNA-XXXXX - fix(security): upgrade [package] to [version]`

PR body structure:

```markdown
# [XNA-XXXXX](https://jira.eg.dk/browse/XNA-XXXXX)

## Security Fix
- **CVE:** [CVE-ID or N/A]
- **Package:** [name] [old-version] → [new-version]
- **Severity:** [Critical/High/Medium/Low]
- **Vulnerability:** [brief description]

## Changes
- **`file1.csproj`** — upgraded [package] version
- **`file2.cs`** — fixed [vulnerable pattern]

## Blast Radius
- [X] projects affected (list them)
- Breaking API changes: [none / description]

# Code Quality
- [ ] Tests are written for the features.
- [x] Reasonable logging has been added to the code.
- [x] I have compiled and tested my own code.
- [x] I have run unit tests manually.

# Deployment
- [ ] Moved Jira subtask [XNA-XXXXX](https://jira.eg.dk/browse/XNA-XXXXX) to "Ready For Review".

Generated with [Claude Code](https://claude.com/claude-code)
```

## Step 8: Update JIRA (Optional)

If a JIRA ticket was provided, ask the user if they want to add a comment:

```
Fix implemented and PR created: [PR URL]

Package upgraded: [name] [old] → [new]
CVE: [CVE-ID]
Affected projects: [list]
```

Use `mcp__mcp-jira-service__jira_add_comment` if approved.

## Rules

- NEVER create branches, commit, push, or create PRs without explicit user approval at each gate
- NEVER use `git add -A` or `git add .`
- NEVER force-push or skip pre-commit hooks
- NEVER downgrade a package unless explicitly requested
- ALWAYS show the blast radius before making changes
- ALWAYS check for binding redirect / assembly reference issues after NuGet upgrades
- If `msbuild` is needed (for .NET Framework 4.7.2 projects), inform the user — `dotnet build` won't work for those
- `gh` CLI is NOT available — use MCP GitHub tools for PR operations
