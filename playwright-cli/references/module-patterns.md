# Module-Specific UI Patterns

Known quirks and element patterns for each AjourSystem module. Add new modules here as you encounter them.

---

## AjourInspect & QA (`/construction`)

### Critical rule — project must be selected first

Always select the project **before** clicking any module tab (Supervisory, Project, Defect, Pre-registration, QA). Clicking a tab without a project selected triggers an alert dialog "Please select a project" — dismissing it and recovering wastes time.

**Correct execution order:**
1. Navigate to `/construction`
2. Select project from the project dropdown
3. Click module tab (Supervisory, etc.)
4. Select category group from left sidebar (e.g., Generelt)
5. Perform the action (e.g., Create registration)

### Project dropdown

The project dropdown is a **custom component** — there is no native `<select>` element. It appears as `button "-"` (showing a dash when empty) inside `#project-dropdown-container`, next to a `link "Project"` label.

- Do NOT click `link "Project"` — that is just a label, not the trigger
- Click the `button "-"` next to it to open the dropdown
- A search box (`textbox "Search"`) appears inside the dropdown — type the project name to filter
- Click the matching project name from the list

```bash
playwright-cli click e82           # button "-" next to "Project" label
playwright-cli fill e158 "Krypton" # search box inside the dropdown
playwright-cli click e305          # click the matching project name
```

### Module tabs

Rendered as `generic [cursor=pointer]` elements with a count badge:
```yaml
generic [ref=eXX] [cursor=pointer]:
  text: Supervisory
  generic: "2"    # count badge
```

### Category group sidebar

After selecting a tab, category groups appear as `listitem` elements in the left sidebar:
```yaml
listitem "Generelt" [ref=eXX] [cursor=pointer]:
  generic: Generelt
  generic: "2"
```

### Create registration modal fields

| Field | Selector |
|---|---|
| Subject | `textbox "Subject text"` |
| Drawing/GPS | `textbox` (first unlabelled textbox in modal) |
| Deadline Start date | `textbox` next to calendar icon |
| Category/List | custom dropdown `button "-"` inside modal |
| Save | `button "Save"` |
| Cancel | `button "Cancel"` |

### Step-to-operation mapping

| Zephyr Step | Code equivalent |
|---|---|
| Navigate to AjourInspect & QA | `navigation.navigateToModule(ModuleURL.InspectQA)` |
| Select project from dropdown | `inspectQAOperations.selectProject(projectName)` *(new op needed)* |
| Click Supervisory / tab | `inspectQAOperations.clickTab("Supervisory")` *(new op needed)* |
| Click Generelt / category | `inspectQAOperations.selectCategoryGroup("Generelt")` *(new op needed)* |
| Click Create registration | `inspectQAOperations.clickCreateRegistration()` *(new op needed)* |
| Fill subject and save | `inspectQAOperations.createRegistration({ subject })` *(new op needed)* |
| Verify registration in list | `expect(inspectQAComponent.registrationBySubject("Test")).toBeVisible()` |
