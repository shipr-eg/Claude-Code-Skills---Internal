---
name: review-jira
description: Analyse a YBL (EG Lønservice) Jira ticket and produce an implementation plan tailored to the lonservice-app Angular codebase (standalone components, Signals, BaseHttpService, ModalService, shared components, $localize i18n). Read-only on code; after the plan, optionally suggest/create sub-tasks, post the plan as a comment, or transition the ticket — each only after explicit confirmation.
argument-hint: "<jira-url-or-YBL-XXXX>"
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Task, Agent, ToolSearch, mcp__mcp-jira-service__jira_get_issue, mcp__mcp-jira-service__jira_search, mcp__mcp-jira-service__jira_get_transitions, mcp__mcp-jira-service__jira_transition_issue, mcp__mcp-jira-service__jira_add_comment, mcp__mcp-jira-service__jira_create_issue, mcp__mcp-jira-service__jira_batch_create_issues, mcp__mcp-jira-service__jira_utility_deeplink, mcp__mcp-confluence-service__confluence_search, mcp__mcp-confluence-service__confluence_get_page
---

# /review-jira — analyse a YBL ticket & plan the implementation

Take an **already-created** YBL ticket, analyse it, explore the **lonservice-app** Angular
codebase, and present a concrete, layer-by-layer **implementation plan** the team can execute.
This skill **plans only — it never edits application code.** After the plan it can, only on
explicit opt-in, suggest/create sub-tasks, post the plan as a comment, or transition the ticket.

**Tenant facts (this instance is Jira Server/DC, _not_ Cloud):**

- Instance: `jira.eg.dk` — browse URLs are `https://jira.eg.dk/browse/YBL-XXXX`.
- Project key: `YBL`. Base branch for this repo: `master`.
- Descriptions/comments use **Jira wiki markup** (`h3.` headings, `*bold*`, `#` ordered list,
  leading `*` for bullets) — **never** markdown.
- Custom-field IDs (verified for this tenant):
  - **Issue category** → `customfield_10213` (select)
  - **Epic Link** → `customfield_10101`
  - **Security Level** → `"ALL EG"` (No GDPR sensitive data)
- Sub-task issue type is named **`Sub-task`** (hyphenated).

**Project conventions this plan must respect** (from `CLAUDE.md`):

- Angular 20, **standalone components only** — no NgModules.
- All HTTP goes through **`BaseHttpService`** — never `HttpClient` directly.
- All dialogs go through **`ModalService`** — never browser `alert`/`confirm`.
- **Reuse shared components** (`src/app/shared/components/`) before creating new UI.
- State via **Angular Signals**; reactive forms only; i18n via **`$localize`** (`en-US` + `da`).

---

## Input

JIRA ticket URL or key: `$ARGUMENTS`

---

## Step 0: Check Jira MCP availability

Use `ToolSearch` to verify `mcp__mcp-jira-service__jira_get_issue` is available. If the Jira MCP
tools are **not** available, display this and STOP (fail fast):

```
⛔ Jira MCP server is not connected. Cannot review a ticket.
Make sure the mcp-jira-service MCP is running and try again.
```

---

## Step 1: Parse the ticket key

Extract the first `YBL-XXXX` token from `$ARGUMENTS`. It may be:

- a full URL like `https://jira.eg.dk/browse/YBL-928` → extract `YBL-928`, or
- a bare key like `YBL-928`.

If no key is present, ask for it with **one** `AskUserQuestion` and stop until provided.

---

## Step 2: Fetch the ticket (read-only)

Fetch via `mcp__mcp-jira-service__jira_get_issue` with
`fields: "summary,description,issuetype,status,priority,labels,components,attachment,issuelinks,parent,comment"`.

- Read the description, acceptance criteria, comments, labels, components, priority, status, and
  **issue type** (you need this for Step 4b).
- If the description/comments/links reference **other** YBL tickets (parent epic, blockers, related),
  fetch those too for full context.
- **Attachments:** list their **names** only. There is **no attachment-download tool** in this
  tenant — tell the user to open the files in Jira if their content matters to the plan.
- **Confluence:** when product behaviour is unclear, query
  `mcp__mcp-confluence-service__confluence_search`, then `confluence_get_page` to read the relevant
  page. If Confluence is **unreachable**, print
  `⚠️ Confluence is unreachable — proceeding with codebase and ticket input only.` and continue.

If the fetch fails (bad key, not found), surface the error and STOP.

---

## Step 3: Explore the codebase (layer-by-layer)

Understand which part of lonservice-app the ticket touches, then map the affected layers. Use the
**Explore** subagent for breadth when the scope spans several areas; otherwise search directly with
`Grep`/`Glob`/`Read`. Map **only the relevant feature** — do not read unrelated code.

### 3a. Identify the feature/domain

Top-level features live under `src/app/features/`: `company`, `dashboard`, `employees`, `login`,
`messages`, `payroll`, `report`. From the ticket text, decide which feature(s) are involved and
`Grep`/`Glob` for the relevant component, service, and model names.

### 3b. Routing

- `src/app/app.routes.ts` — routes are lazy-loaded standalone (`loadComponent: () => import(...)`),
  added as **children of `MainLayout`**, with `data: { breadcrumb: '...' }`.
- Confirm whether a new route/child route is needed or an existing one changes.

### 3c. Service & API surface

- Feature service: `src/app/features/<feature>/services/<feature>.service.ts` — **extends
  `BaseHttpService`** (`get/getWithLoader/post/postWithLoader/put/putWithLoader/delete...`). Never
  `HttpClient` directly.
- List the endpoints the work touches; note whether **new API endpoints** are required and that
  their contracts must be confirmed with backend.

### 3d. Models

- Check `src/app/shared/models/` **first** — `ApiResponse<T>` (`api-response.model.ts`),
  `SelectOption` (`select-option.model.ts`), `TableColumnConfig` (`ui.model.ts`), and domain models
  (`employee.model.ts`, `payroll.model.ts`, `company.model.ts`, etc.).
- Then the feature's own `models/` folder if present (e.g.
  `src/app/features/company/models/company.model.ts`).

### 3e. Components & shared-component reuse

- Feature components: `<feature>-list/`, `<feature>-details/`, and `sections/` sub-tabs.
- **Reuse shared components** from `src/app/shared/components/` before proposing new UI — e.g.
  `app-form-input`, `app-form-select`, `app-form-textarea`, `app-searchable-dropdown`,
  `app-custom-checkbox`, `app-custom-radio`, `app-table-component`, `app-action-table`,
  `app-stepper-component`, `app-tab-groups`, `app-toggle-button`, modals (`ModalService`).
- All form components implement `ControlValueAccessor` (use with `formControlName`).

### 3f. State

- Angular **Signals** (`signal`, `computed`, `linkedSignal`); reactive forms via `FormBuilder`.

### 3g. i18n

- Strings use `$localize` tagged templates with stable ids: `` $localize`:@@feature.key:Default text` ``.
- Locale files: `src/locale/features/<feature>/*.xlf` (+ `*.da.xlf`). **Reuse existing keys** before
  adding new ones; new strings need both `en-US` and `da`.

### 3h. Tests

- Co-located `*.spec.ts` (Jasmine + Karma, `TestBed`). Note which specs to add/update.

For every relevant file, **read it** to understand the existing pattern, then mirror it in the plan.

---

## Step 4: Present the implementation plan

Output a structured Markdown report (this is the skill's deliverable — it does **not** edit code and
does **not** call the harness ExitPlanMode). Use this shape:

### Ticket Summary
- Ticket: `YBL-XXXX` — [summary]
- Type: [type] | Priority: [priority or "Not prioritized"] | Status: [status]
- Epic / Parent: [key or "none"] | Labels: [labels or "none"]

### Analysis
- What the ticket asks for, in your own words.
- Acceptance criteria extracted from the ticket.
- How similar functionality works today — cite real files (clickable paths).

### Affected Areas (by layer)
- **Routing** — routes in `src/app/app.routes.ts` to add/change.
- **Service / API** — methods in `src/app/features/<feature>/services/<feature>.service.ts`;
  endpoints touched; new endpoints to confirm with backend.
- **Models** — shared vs. feature models to add/change.
- **Components** — list / details / sections to create/modify.
- **Shared components to reuse** — name the exact `app-*` components.
- **State** — signals/computed to introduce.
- **i18n** — new/reused `$localize` keys and the `.xlf` files affected (both locales).
- **Tests** — `*.spec.ts` to add/update.

### Implementation Steps
Numbered and in **dependency order**: models / service → routing → components →
shared-component wiring → i18n → tests. Each step names the specific file(s) and the change.

### Risks & Considerations
- Company / tenant (active-company) scoping.
- `ModalService` (no browser dialogs) and `BaseHttpService` (no direct `HttpClient`).
- Standalone components (no NgModules); reuse shared components (no duplicates).
- Both `en-US` and `da` locales.
- Unknown API contracts to confirm with backend; dependencies on other tickets.

### Estimated Scope
- Files to create / modify / delete.
- Rating: **small** (1–5 files) / **medium** (5–15) / **large** (15+).

End with a one-line reminder: *this skill plans only and changes no code.*

---

## Step 4b: Suggest sub-tasks (only when warranted)

Decide whether the work should be split into sub-tasks:

- **Skip entirely** if the ticket is **already type `Sub-task`** → say nothing about splitting.
- If the work is **small / single-layer**, print: `No sub-task split needed — this is a single, cohesive piece of work.`
- **Suggest a breakdown only when the work is large / multi-layer** (e.g. it spans service +
  components + i18n + tests, or is roughly more than ~1 day). List the proposed sub-tasks, each as
  **title + one-line scope**, mapped to the plan's layers, e.g.:
  - `Service & API wiring` — add `<service>` methods + models for the new endpoints.
  - `<Feature> UI (list/details)` — build the components reusing shared components.
  - `i18n strings (en + da)` — add/translate the new `$localize` keys.
  - `Unit tests` — specs for the new service methods and component behaviour.

Keep the breakdown **few and meaningful** — do not over-split.

---

## Step 5: Optional actions (explicit opt-in only)

Ask with **one** `AskUserQuestion` (multi-select). Offer:

- **Save as plan** — write the full implementation plan to
  `.claude/plans/ybl-<KEY>-<kebab-slug>.md` in the project root (e.g.
  `.claude/plans/ybl-939-change-company-temp.md`). The file must include: ticket key + link,
  context section, full implementation steps with file paths and code sketches, shared-component
  API reminders, i18n key table, and estimated scope. Use the `Write` tool. Confirm the saved path
  to the user.
- **Post plan as a comment** — format a concise summary of the plan in Jira **wiki markup** and push
  via `mcp__mcp-jira-service__jira_add_comment`.
- **Create the suggested sub-tasks** — *shown only when Step 4b proposed any.* Let the user deselect
  any first, then create each chosen sub-task via `mcp__mcp-jira-service__jira_batch_create_issues`
  (or `jira_create_issue` per item) with:
  - `project_key: "YBL"`, `issue_type: "Sub-task"`, `parent: <this ticket key>`
  - `summary`: the sub-task title; `description`: a short wiki-markup scope.
  - `additional_fields`: **inherit** the parent's Issue category (`customfield_10213`) and Epic Link
    (`customfield_10101`) if present, and always set Security Level `"ALL EG"`
    (e.g. `{"security": {"name": "ALL EG"}}`).
- **Transition status** — call `mcp__mcp-jira-service__jira_get_transitions` to list valid targets,
  confirm the chosen one, then `mcp__mcp-jira-service__jira_transition_issue`.
- **Nothing** — end without any write.

NEVER save a plan file or write to Jira without the explicit choice here. After any write, resolve
and report the deeplink via `mcp__mcp-jira-service__jira_utility_deeplink` (fallback
`https://jira.eg.dk/browse/<KEY>`) for the parent and for each created sub-task.

---

## Rules

- ALWAYS check Jira MCP availability first — fail fast.
- This skill **plans only** — never edit application code.
- ALWAYS fetch and read the ticket (and linked tickets) before planning.
- ALWAYS explore the codebase for the referenced feature and prefer **reuse** — standalone
  components, Signals, `BaseHttpService`, `ModalService`, shared components, `$localize` i18n.
- Reflect the project "Do Not" rules in the plan: no NgModules, no direct `HttpClient`, no browser
  `alert`/`confirm`, no duplicate shared components.
- Suggest sub-tasks **only when warranted**, and **never** when the ticket is already a `Sub-task`.
- NEVER write to Jira (comment / sub-task creation / transition) without explicit confirmation at
  Step 5.
- NEVER save the plan file to disk without explicit user confirmation at Step 5 — the `Write` tool
  must only be called after the user selects "Save as plan" in the `AskUserQuestion`. Do not save
  proactively, speculatively, or as a default action.
- Use MCP Jira tools — never WebFetch. If the MCP is disconnected, tell the user immediately.
- ALWAYS use Jira **wiki markup** (not markdown) for any comment or sub-task description.
- Attachments: list names only; tell the user to open them in Jira (no auto-download).

## Permissions & flow

- You have permission to read the ticket, search Jira/Confluence, and explore the codebase
  proactively — do it without asking.
- Keep friction low: fetch → explore → present plan → (only when warranted) suggest sub-tasks →
  offer optional Jira actions once. No redundant confirmations.

## Out of scope

- Implementing the code changes (a future separate dev skill). This skill may *create sub-tasks* on
  opt-in but never writes application code.
- Creating top-level tickets (use `/create-jira`) or editing the description
  (use `/update-jira`).
- Worklogs (use `/worklog`), Confluence page creation.
