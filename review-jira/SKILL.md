---
name: review-jira
description: Analyse a JIRA ticket and provide an implementation plan
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, EnterPlanMode, ExitPlanMode, AskUserQuestion, Task, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_transitions, mcp__mcp-jira-service__jira_get_worklog, mcp__mcp-jira-service__jira_download_attachments, mcp__mcp-jira-service__jira_add_comment
argument-hint: <jira-url>
---

# Review JIRA Ticket & Plan Implementation

You have been given a JIRA ticket to analyse and plan an implementation for.

## Input

JIRA ticket URL or key: $ARGUMENTS

## Step 1: Extract the Ticket Key

Parse the JIRA ticket key from the input. It may be provided as:
- A full URL like `https://jira.eg.dk/browse/ZER-8827` — extract `ZER-8827`
- Just the key like `ZER-8827`

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

Based on the ticket details, explore the codebase to understand:
- Which modules, packages, or files are likely affected
- Existing patterns and conventions in those areas
- Related tests that exist or will need updating
- Any configuration or migration files that may need changes

Use Glob, Grep, and Read tools (or the Explore subagent for deeper research) to gather this information.

## Step 4: Enter Plan Mode & Present the Plan

**You MUST enter plan mode** using the `EnterPlanMode` tool before presenting the implementation plan.

Structure the plan as:

### Ticket Summary
- Ticket: [KEY] — [Summary]
- Type: [Bug/Story/Task/etc.] | Priority: [priority] | Status: [status]

### Analysis
- What the ticket is asking for (in your own words)
- Key acceptance criteria extracted from the ticket

### Affected Areas
- List of files/modules that will need changes
- Explanation of why each area is affected

### Implementation Steps
- Numbered, ordered list of concrete steps
- Each step should reference specific files and describe the change
- Include test steps (new tests to write, existing tests to update)
- Include any migration or configuration changes

### Risks & Considerations
- Potential side effects or breaking changes
- Open questions that need clarification
- Dependencies on other tickets or external factors

### Estimated Scope
- List of files to create/modify/delete

Then use `ExitPlanMode` to present the plan for user approval.

## Step 5: Implement (Only After User Approval)

**Do NOT begin implementation until the user explicitly approves the plan.**

Once approved, follow the plan step by step. After implementation:
- Run relevant tests if applicable
- Summarise what was done
- Ask the user if they want to commit, create a PR, or update the JIRA ticket

## Rules
- NEVER skip plan mode. Always plan first, implement after approval.
- NEVER commit or push without explicit user approval.
- Use MCP JIRA tools — do not fall back to WebFetch.
- If the MCP JIRA server is disconnected, tell the user immediately.