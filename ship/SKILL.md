---
name: ship
description: Commit, push, and/or create PR with conventional commit format and JIRA ticket ID
argument-hint: "[commit|push|pr]"
allowed-tools: Bash(git *), Bash(mkdir *), Read, Grep, Glob, AskUserQuestion, ToolSearch, mcp__mcp-github-server__create_pull_request, mcp__mcp-github-server__update_pull_request
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

If the argument is empty or unrecognised, display this help message and stop:

```
/ship commit  — Stage changed files and commit with conventional format
/ship push    — Stage, commit, and push to remote
/ship pr      — Stage, commit, push, and create a pull request
```

## Step 1: Gather context

1. Run `git status` to see changed/untracked files.
2. Run `git diff` and `git diff --cached` to see unstaged and staged changes.
3. Run `git branch --show-current` to get the current branch name.
4. Run `git log --oneline -5` to see recent commit style.

If there are no changes to commit (working tree clean and nothing staged), tell the user and stop.

## Step 2: Extract JIRA ticket ID

Parse the ticket ID from the branch name. Branches follow the pattern `type/ZER-XXXX-description`.

Example: `bugfix/ZER-8827-checkbox-styling` → `ZER-8827`

If no ticket ID can be extracted, ask the user for it.

## Step 3: Select and stage files

**Goal:** Only stage files that are genuinely part of the feature/fix work for this branch. Do NOT blindly stage everything in `git status`.

### 3a. Determine which files belong to this branch's work

1. Run `git diff master...HEAD --name-only` to see files already committed on this branch vs master. These establish the **scope** of the feature work.
2. Run `git status --porcelain` to see all uncommitted changes (modified, added, deleted, untracked).
3. For each uncommitted file, evaluate whether it belongs to this commit:

**INCLUDE** a file if:
- It was already modified in earlier commits on this branch (i.e., it appears in the `git diff master...HEAD --name-only` output) — this is continuation of the same feature work
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
  - path/to/scratch-file.js (untracked, not related to ZER-XXXX)
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
ZER-XXXX - type(scope): description

Optional body explaining the "why" if the change is non-trivial.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**Show the user the proposed commit message and ask for approval before committing.**

## Step 5: Push (if `push` or `pr`)

If the subcommand is `push` or `pr`:

```bash
git push -u origin <branch-name>
```

If the push is rejected, inform the user and suggest `git pull --rebase` but do NOT run it automatically.

## Step 6: Create PR (if `pr`)

If the subcommand is `pr`:

### 6a. Gather PR context

- Run `git log master..HEAD --oneline` to see all commits being merged.
- Run `git diff master...HEAD --stat` to see files changed vs master.

### 6b. Build the PR body

Construct this structure:

```markdown
## Summary
Fixes **[ZER-XXXX](https://jira.eg.dk/browse/ZER-XXXX)** — <title derived from branch/commits>

<1-3 sentences describing the change and motivation>

## Changes
- **`file1.ext`** — what changed
- **`file2.ext`** — what changed

## Test plan
- [ ] <verification step 1>
- [ ] <verification step 2>

Generated with [Claude Code](https://claude.com/claude-code)
```

### 6c. Create the PR via MCP

1. Use `ToolSearch` to load the GitHub MCP tools.
2. Create the PR with `mcp__mcp-github-server__create_pull_request`:
   - **owner:** `EG-A-S`
   - **repo:** `ZER-app`
   - **base:** `master`
   - **head:** current branch name
   - **title:** `ZER-XXXX - type(scope): description` (same as commit subject line)
   - **body:** `"Pending update"` (placeholder — the tool double-escapes newlines)

3. **Immediately** update the PR body with `mcp__mcp-github-server__update_pull_request`:
   - Pass the real markdown body as a plain multi-line string (no `\n` escapes)
   - This is the workaround for the MCP newline double-escaping bug

4. Return the PR URL to the user.

## Rules

- NEVER commit or push without showing the user the proposed message and getting approval.
- NEVER use `git add -A` or `git add .`.
- NEVER force-push.
- NEVER skip pre-commit hooks (`--no-verify`).
- If anything fails, report the error clearly and stop — do not retry destructively.
- `gh` CLI is NOT available. Always use MCP GitHub tools for PR operations.