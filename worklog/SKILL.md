---
name: worklog
description: Create a concise JIRA worklog entry summarizing work done on the current branch
argument-hint: "[time-spent, e.g. 2h]"
allowed-tools: Bash(git *), AskUserQuestion, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_add_worklog, mcp__mcp-jira-service__jira_get_worklogs
---

# /worklog — JIRA worklog entry from branch context

Create a concise JIRA worklog entry by gathering context from git commits and the JIRA ticket, then submit it after user approval.

## Step 0: Extract JIRA ticket and validate branch

Run `git branch --show-current` and parse the ticket key matching `XNA-\d+`.

**Branch safety check:** If the current branch is `main`, `master`, `development`, `develop`, or `release/*`, display this message and STOP:

```
⛔ You are on a protected branch (<branch-name>).
/worklog requires a feature/bugfix branch with commits to summarize.
```

If no ticket key is found in the branch name, ask the user:

```
AskUserQuestion: "No JIRA ticket found in branch name. What is the ticket key? (e.g. XNA-12345)"
```

Store the ticket key for later steps.

## Step 0b: Check JIRA MCP availability

Use `ToolSearch` to verify that `mcp__mcp-jira-service__jira_add_worklog` and `mcp__mcp-jira-service__jira_get_issue` are available.

If the JIRA MCP tools are **not available**, display this message and STOP:

```
⛔ JIRA MCP server is not connected. Cannot submit worklog.
Make sure the JIRA MCP server is running and try again.
```

Do this check **before** gathering git context to avoid wasted work.

## Step 1: Gather context

Run these in parallel:

1. `git log development..HEAD --oneline` — get all commits on this branch
2. `git diff development...HEAD --stat` — get a summary of files/lines changed (useful for describing scope)
3. `git log development..HEAD --format="%aI"` — get commit timestamps for time estimation (Step 2b)
4. `mcp__mcp-jira-service__jira_get_issue` with the ticket key — get the ticket summary, type, and status

### Empty branch guard

If `git log development..HEAD` returns **no commits**, display this message and STOP:

```
⛔ No commits found on this branch since development.
There is no work to summarize. Commit your changes first, then run /worklog.
```

### Scope narrowing for long-lived branches

If the branch has **more than 15 commits**, the user likely doesn't want the entire history summarized. Ask:

```
AskUserQuestion: "This branch has <N> commits. What scope should the worklog cover?"
Options:
  - "Today's commits only"
  - "Last session (last <M> commits since <timestamp>)"
  - "All <N> commits"
  - "Custom — I'll specify"
```

- **Today's commits only:** filter to commits with today's date using `git log development..HEAD --oneline --since="midnight"`
- **Last session:** identify the most recent gap of 2+ hours between commits and use everything after that gap
- **All:** use the full list
- **Custom:** ask the user for a `--since` date or number of commits

Use the scoped commit list for all subsequent steps.

## Step 2: Parse time argument

Check `$ARGUMENTS` for a valid Jira time string (patterns like `2h`, `1h 30m`, `1d`, `30m`, `4h 15m`).

Valid JIRA time format: combinations of `Nd`, `Nh`, `Nm` (e.g., `1d`, `2h`, `4h 15m`, `1d 2h`).
Invalid formats to reject: `2hours`, `90min`, `1.5h`, bare numbers like `2`.

- If a valid time string is present → use it as the time spent
- If `$ARGUMENTS` is empty or contains no valid time string → estimate from git and suggest

### 2b. Estimate time from commit timestamps

Using the commit timestamps from Step 1 (item 3), calculate the timespan from the **first scoped commit** to the **last scoped commit**. Round to the nearest 30 minutes (minimum `30m`).

Present the estimate as a suggestion, not a decision:

```
AskUserQuestion: "How much time did you spend? (Estimated ~<estimate> from commit timestamps)"
Options: "<estimate>", "1h", "2h", "4h", Other (free text)
```

The estimate is a starting point — the user always decides.

### 2c. Parse worklog date (optional)

Check `$ARGUMENTS` for a date indicator. Examples: `yesterday`, `2026-04-11`, `friday`.

- If a date is present → convert it to ISO format (`YYYY-MM-DDTHH:mm:ss.000+0000`) for the `started` field
- If no date is present → default to the current date/time (JIRA's default behaviour)

This allows the user to run `/worklog 2h yesterday` to backdate a worklog entry.

## Step 3: Check for duplicate worklogs

Before generating a comment, check if the user has already logged time on this ticket today.

Call `mcp__mcp-jira-service__jira_get_worklogs` (if available) with the ticket key, and scan the results for any worklog entry with today's date by the current user.

If a worklog already exists for today:

```
⚠️  You already logged <time> to XNA-XXXXX today:
   "<existing comment preview...>"

Continue adding another worklog entry? [y/n]
```

If the user says no, STOP. If yes (or if the tool is unavailable), proceed normally.

## Step 4: Generate worklog comment

Write a concise 2-4 sentence plain-text summary:

- **Sentence 1:** What was done (derived from the **scoped** commit messages, grouped by theme)
- **Sentence 2-3:** Key technical details (files/modules changed, approach taken)
- **Sentence 4 (optional):** Current status or next steps

Rules:
- Use past tense ("Fixed...", "Implemented...", "Updated...")
- Be specific — mention actual file names, components, or endpoints
- Only reference work visible in the scoped commits and the JIRA ticket — NEVER fabricate work
- No filler phrases ("worked on", "spent time on")
- Plain text only, no markdown formatting (JIRA worklog renders plain text)
- Maximum 2-4 sentences — this is a worklog, not documentation

## Step 5: User review — CONFIRMATION GATE

Show the user the full worklog entry:

```
Ticket:  XNA-XXXXX — <ticket summary>
Time:    <time>
Date:    <date if backdated, otherwise "today">
Comment:
  <generated 2-4 sentence summary>
```

Then ask with AskUserQuestion: "Submit this worklog?" with options:
- **Submit** — post to JIRA
- **Edit** — let the user revise (see Edit flow below)
- **Cancel** — abort without submitting

NEVER submit a worklog without explicit user approval through this gate.

### Edit flow

If the user chooses **Edit**:

1. Ask with AskUserQuestion: "What would you like to change?" with options:
   - **Comment** — "Enter your revised comment text:"
   - **Time** — "Enter the corrected time (e.g. 2h, 1h 30m):"
   - **Both** — ask for comment first, then time
2. After receiving the revised input, display the full updated worklog entry again (same format as above).
3. Ask "Submit this worklog?" again — same Submit/Edit/Cancel options.
4. Repeat until the user chooses Submit or Cancel.

## Step 6: Submit worklog

Call `mcp__mcp-jira-service__jira_add_worklog` with:
- `issue_key`: the extracted ticket key
- `time_spent`: the validated time string
- `comment`: the approved summary text
- `started`: the ISO date string from Step 2c (omit if defaulting to now)

### On success

Display a full receipt:

```
✅ Worklog submitted
   Ticket:  XNA-XXXXX — <ticket summary>
   Time:    <time>
   Date:    <date>
   Comment: <first 80 chars of comment>...
```

### On failure

Display the error clearly, then **preserve the approved comment and time** so the user can retry without losing their work:

```
❌ Failed to submit worklog: <error message>

Your approved entry is preserved:
   Time:    <time>
   Comment: <full comment>

You can retry by running /worklog again — or submit manually in JIRA.
```

Do NOT retry automatically.

## Rules

- NEVER submit a worklog without user approval at the confirmation gate
- NEVER fabricate work — only summarize what is in git commits and the JIRA ticket
- NEVER run on protected branches (`main`, `master`, `development`, `develop`, `release/*`)
- Keep the comment to 2-4 sentences maximum
- Check JIRA MCP availability **before** gathering git context — fail fast
- Valid JIRA time formats only: `Nd`, `Nh`, `Nm` and combinations (e.g., `2h`, `1h 30m`, `1d 4h`)
