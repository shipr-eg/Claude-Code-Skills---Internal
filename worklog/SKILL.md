---
name: worklog
description: Create a concise Jira worklog entry summarizing work done on the current branch. Extracts the YBL ticket from the branch name, summarizes commits, and submits to Jira via the mcp-jira-service MCP after explicit user approval.
argument-hint: [time-spent, e.g. 2h]
allowed-tools: Bash(git branch:*), Bash(git log:*), AskUserQuestion, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_add_worklog
---

# /worklog — Jira worklog entry from branch context

Create a concise Jira worklog entry by gathering context from git commits and the Jira ticket, then submit it after user approval.

## Step 0: Extract Jira ticket from branch

Run `git branch --show-current` and parse the ticket key matching `YBL-\d+`.

If no ticket key is found in the branch name, ask the user:

> AskUserQuestion: "No Jira ticket found in branch name. What is the ticket key? (e.g. YBL-1234)"

Store the ticket key for later steps.

## Step 1: Gather context

Run these two in parallel:

- `git log master..HEAD --oneline` — get all commits on this branch
- `mcp__mcp-jira-service__jira_get_issue` with the ticket key — get the ticket summary, type, and status

## Step 2: Parse time argument

Check `$ARGUMENTS` for a valid Jira time string (patterns like `2h`, `1h 30m`, `1d`, `30m`, `4h 15m`).

- If a valid time string is present → use it as the time spent.
- **Normalize day units to hours at `1 day = 7 hours`** before using or submitting the value.
  Convert every `Nd` token to hours and fold it into any existing hour component:
  - `1d` → `7h`
  - `2d` → `14h`
  - `1d 4h` → `11h`
  - `1d 30m` → `7h 30m`

  Strings with no day component (`2h`, `1h 30m`, `30m`, `4h 15m`) pass through unchanged.
  The submitted `time_spent` must contain only `h`/`m` units — never `d`.
- If `$ARGUMENTS` is empty or contains no valid time string → ask the user:
  > AskUserQuestion: "How much time did you spend?"
  > Options: "30min", "1h", "2h", "1d", plus free-text Other

  (If the user picks `1d`, apply the same `1d = 7h` normalization before submitting.)

## Step 3: Generate worklog comment

Write a concise 2–4 sentence plain-text summary:

- Sentence 1: What was done (derived from commit messages, grouped by theme)
- Sentence 2–3: Key technical details (files/modules changed, approach taken)
- Sentence 4 (optional): Current status or next steps

Rules:

- Use past tense ("Fixed...", "Implemented...", "Updated...")
- Be specific — mention actual file names, components, or endpoints
- Only reference work visible in commits and the Jira ticket — NEVER fabricate work
- No filler phrases ("worked on", "spent time on")
- Plain text only, no markdown formatting (Jira worklog renders plain text)
- Maximum 2–4 sentences — this is a worklog, not documentation

## Step 4: User review — CONFIRMATION GATE

Show the user the full worklog entry:

```
Ticket:  YBL-XXXX — <ticket summary>
Time:    <time>
Comment:
  <generated 2-4 sentence summary>
```

Then ask with `AskUserQuestion`: "Submit this worklog?" with options:

- **Submit** — post to Jira
- **Edit** — user provides revised text, then re-confirm with this same gate
- **Cancel** — abort without submitting

NEVER submit a worklog without explicit user approval through this gate.

## Step 5: Submit worklog

Call `mcp__mcp-jira-service__jira_add_worklog` with:

- `issue_key`: the extracted ticket key
- `time_spent`: the validated time string
- `comment`: the approved summary text

On success, report: `"Logged to YBL-XXXX."`

On failure, show the error and do not retry automatically.

## Rules

- NEVER submit a worklog without user approval at the confirmation gate
- NEVER fabricate work — only summarize what is in git commits and the Jira ticket
- Keep the comment to 2–4 sentences maximum
- If Jira MCP is unavailable or disconnected, tell the user immediately and stop
