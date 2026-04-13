---
name: ship
description: Commit, push, and/or create PR with conventional commit format and JIRA ticket ID
argument-hint: "[commit|push|pr|pr --draft]"
allowed-tools: Bash(git *), Bash(mkdir *), Read, Grep, Glob, AskUserQuestion, ToolSearch, mcp__mcp-github-server__create_pull_request, mcp__mcp-github-server__update_pull_request, mcp__mcp-github-server__list_pull_requests
---

# Ship — Commit, Push & PR Workflow

**Command:** `/ship $ARGUMENTS`

## Step 0: Parse the subcommand

The user's argument is: `$ARGUMENTS`

| Argument | Action |
|----------|--------|
| *(empty)* | Show usage help (see below) and STOP |
| `commit` | Stage + commit |
| `push` | Stage + commit + push |
| `pr` | Stage + commit + push + create PR |
| `pr --draft` | Stage + commit + push + create **draft** PR |

If the argument is empty or unrecognised, display this help message and stop:

```
/ship commit    — Stage changed files and commit with conventional format
/ship push      — Stage, commit, and push to remote
/ship pr        — Stage, commit, push, and create a pull request
/ship pr --draft — Same as pr, but creates a draft pull request
```

## Step 0b: Branch safety check

Run `git branch --show-current` and **refuse to proceed** if the current branch is any of:
`main`, `master`, `development`, `develop`, `release/*`

Display this message and STOP:

```
⛔ You are on a protected branch (<branch-name>).
Ship requires a feature/bugfix branch. Create one first:
  git checkout -b type/XNA-XXXXX-description
```

## Step 1: Gather context

1. Run `git status` to see changed/untracked files.
2. Run `git diff` and `git diff --cached` to see unstaged and staged changes.
3. Run `git branch --show-current` to get the current branch name.
4. Run `git log --oneline -5` to see recent commit style.

If there are no changes to commit (working tree clean and nothing staged), tell the user and stop.

## Step 2: Extract JIRA ticket ID

Parse the ticket ID from the branch name. Branches follow the pattern `type/XNA-XXXXX-description`.

Example: `bugfix/XNA-18827-checkbox-styling` → `XNA-18827`

If no ticket ID can be extracted, ask the user for it.

## Step 3: Select and stage files

**Goal:** Only stage files that are genuinely part of the feature/fix work for this branch. Do NOT blindly stage everything in `git status`.

### 3a. Determine which files belong to this branch's work

1. Run `git diff development...HEAD --name-only` to see files already committed on this branch vs development. These establish the **scope** of the feature work.
2. Run `git status --porcelain` to see all uncommitted changes (modified, added, deleted, untracked).
3. For each uncommitted file, evaluate whether it belongs to this commit:

**INCLUDE** a file if:
- It was already modified in earlier commits on this branch (i.e., it appears in the `git diff development...HEAD --name-only` output) — this is continuation of the same feature work
- Its changes are clearly related to the JIRA ticket / feature purpose (review the diff content to judge)

**EXCLUDE** a file if:
- It is unrelated to the feature branch's purpose (e.g., temporary debug scripts, experimental changes to `package.json` like adding test scripts, scratch files)
- It only contains linter/formatter whitespace changes (unless the user explicitly asked for formatting changes)
- It is a secrets/credentials file: `.env`, `.env.*`, `*credentials*`, `*secret*`, `*.key`, `*.pem`
- It is a binary file larger than 1 MB
- It is an untracked file that looks temporary or personal (e.g., `notes.txt`, `TODO.md`, `test.js` in root)

### 3b. Present the file list for approval

**Before staging anything**, show the user a clear list:

```
Files to include:
  + path/to/file1.ext
  + path/to/file2.ext

Files to exclude (not part of feature work):
  - package.json (contains unrelated script changes)
  - path/to/scratch-file.js (untracked, not related to XNA-XXXXX)
```

Explain briefly WHY each excluded file is being skipped. Ask the user to confirm or adjust the list.

### 3c. Stage approved files

Stage only the approved files using `git add <file1> <file2> ...`. **NEVER use `git add -A` or `git add .`**.

## Step 4: Craft the commit message

Analyse the staged diff to determine:
- **type**: `fix`, `feat`, `refactor`, `style`, `docs`, `test`, `chore`, `build`, `ci`, `perf`
- **scope**: the module or area affected (e.g., `frontend`, `security`, `api`)
- **description**: concise imperative summary of the change

Format the commit using a HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
XNA-XXXXX - type(scope): description

Optional body explaining the "why" if the change is non-trivial.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Show the user the proposed commit message and ask for approval before committing.**

## Step 5: Push (if `push` or `pr`)

If the subcommand is `push` or `pr`:

### 5a. Check if the branch is behind the base

Run `git fetch origin development` then `git rev-list --count HEAD..origin/development` to see how many commits the branch is behind.

If the branch is **behind by 1+ commits**, warn the user before pushing:

```
⚠️  Your branch is <N> commit(s) behind origin/development.
You may want to rebase before pushing to avoid merge conflicts later:
  git pull --rebase origin development

Push anyway? [y/n]
```

Ask the user to confirm. Do NOT rebase automatically.

### 5b. Push

```bash
git push -u origin <branch-name>
```

If the push is rejected (non-fast-forward), inform the user and suggest `git pull --rebase` but do NOT run it automatically.

## Step 6: Create PR (if `pr` or `pr --draft`)

If the subcommand is `pr` (or `pr --draft`):

### 6a. Check tool availability

Use `ToolSearch` to load the GitHub MCP tools (`mcp__mcp-github-server__create_pull_request`, `mcp__mcp-github-server__update_pull_request`, `mcp__mcp-github-server__list_pull_requests`).

If the GitHub MCP tools are **not available**, display this message and STOP:

```
⛔ GitHub MCP server is not connected. Cannot create a PR.
Your changes have been committed and pushed to origin/<branch-name>.
Create the PR manually: https://github.com/EG-A-S/Xena/compare/development...<branch-name>
```

### 6b. Check for existing PR

Before creating a new PR, check if one already exists for this branch:

Use `mcp__mcp-github-server__list_pull_requests` with:
- **owner:** `EG-A-S`
- **repo:** `Xena`
- **head:** `EG-A-S:<branch-name>`
- **state:** `open`

If an open PR already exists:
- Inform the user: `"PR #<number> already exists for this branch: <url>"`
- Ask: `"Would you like to update the existing PR body, or skip PR creation?"`
- If update: proceed to Step 6e with `mcp__mcp-github-server__update_pull_request` using the existing PR number
- If skip: display the existing PR URL and STOP

### 6c. Gather PR context

- Run `git log development..HEAD --oneline` to see all commits being merged.
- Run `git diff development...HEAD --stat` to see files changed vs development.
- Run `git diff development...HEAD --name-only` to get the full list of changed files.

### 6d. Build the PR body

Construct this structure:

```markdown
# [XNA-XXXXX](https://jira.eg.dk/browse/XNA-XXXXX)

<1-3 sentences describing what was changed and why>

## Changes
- **`file1.ext`** — what changed
- **`file2.ext`** — what changed

## Commits
- `abc1234` — commit message 1
- `def5678` — commit message 2

# Code Quality
- [ ] Tests are written for the features.
- [ ] Reasonable logging has been added to the code.
- [ ] I have compiled and tested my own code.
- [ ] I have run unit tests manually.

# Deployment
- [ ] Moved Jira subtask [XNA-XXXXX](https://jira.eg.dk/browse/XNA-XXXXX) to "Ready For Review".

Generated with [Claude Code](https://claude.com/claude-code)
```

> **Commits section:** Include the output of `git log development..HEAD --oneline`. If there is only a single commit, omit the Commits section entirely — it adds no value.

> **Evaluating Code Quality checkboxes:** Do NOT blindly check all boxes. Inspect the staged diff and commit history for this branch to determine each one individually:
> - **Tests written** → `[x]` only if the diff includes new or updated test files (e.g., `*Test*.cs`, `*.spec.*`, `*.test.*`).
> - **Reasonable logging** → `[x]` only if the diff adds or updates logging statements (`Log.`, `_logger.`, `console.log`, etc.).
> - **Compiled and tested** → `[x]` only if a build command was run successfully during this session.
> - **Unit tests run** → `[x]` only if a test runner was executed successfully during this session.
>
> If none apply, leave all unchecked. If only some apply, check only those.

### 6e. Create (or update) the PR via MCP

1. Create the PR with `mcp__mcp-github-server__create_pull_request`:
   - **owner:** `EG-A-S`
   - **repo:** `Xena`
   - **base:** `development`
   - **head:** current branch name
   - **title:** `XNA-XXXXX - type(scope): description` (same as commit subject line)
   - **body:** `"Pending update"` (placeholder — the tool double-escapes newlines)
   - **draft:** `true` if the user passed `--draft`, otherwise `false`

2. **Immediately** update the PR body with `mcp__mcp-github-server__update_pull_request`:
   - Pass the real markdown body as a plain multi-line string (no `\n` escapes)
   - This is the workaround for the MCP newline double-escaping bug

### 6f. Offer to assign reviewers

After the PR is created, ask the user:

```
PR created: <url>
Would you like to add reviewers? (Enter GitHub usernames comma-separated, or press Enter to skip)
```

If the user provides reviewers, update the PR with `mcp__mcp-github-server__update_pull_request` to request reviews. If the user skips, proceed.

## Step 7: Success summary

After every subcommand completes, print a concise summary so the user knows exactly what happened:

**After `commit`:**
```
✅ Committed on <branch-name>
   <commit-hash-short> — XNA-XXXXX - type(scope): description
   <N> file(s) changed
```

**After `push`:**
```
✅ Pushed <branch-name> → origin/<branch-name>
   <commit-hash-short> — XNA-XXXXX - type(scope): description
   <N> file(s) changed
```

**After `pr`:**
```
✅ PR created: <url>
   Title: XNA-XXXXX - type(scope): description
   Base: development ← <branch-name>
   <N> file(s) changed, <M> commit(s)
```

## Rules

- NEVER commit or push without showing the user the proposed message and getting approval.
- NEVER use `git add -A` or `git add .`.
- NEVER force-push.
- NEVER skip pre-commit hooks (`--no-verify`).
- NEVER commit directly on protected branches (`main`, `master`, `development`, `develop`, `release/*`).
- If anything fails, report the error clearly and stop — do not retry destructively.
- `gh` CLI is NOT available. Always use MCP GitHub tools for PR operations.

## Handling pre-commit hook failures

If `git commit` fails because a pre-commit hook rejected the commit:

1. **Read the hook output carefully** — it tells you exactly what failed (linting, formatting, tests, etc.).
2. **Fix the issue** in the affected files.
3. **Re-stage the fixed files** with `git add <file>`.
4. **Create a NEW commit** — do NOT use `--amend`, because the original commit never happened. Amending would modify the *previous* commit and could destroy work.
5. Show the user the updated commit message and ask for approval again.