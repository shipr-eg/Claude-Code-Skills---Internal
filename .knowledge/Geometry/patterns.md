# Geometry — Patterns

## Canonical Examples

### 1. Event-Sourced Aggregate with Versioning (BluePrint)
```csharp
public class BluePrint : Aggregate<BlueprintStreamId>,
    IApplyEvent<BluePrintCreated>,
    IApplyEvent<BluePrintDeleted>,
    IApplyEvent<BluePrintDeleted_v2>,  // Version 2 for backward compatibility
    IApplyEvent<BluePrintActivated>,
    IApplyEvent<BluePrintDeactivated>,
    IApplyEvent<BluePrintRestored>
{
    public Guid FileId { get; set; }
    public bool Expired { get; set; }
    public bool Deleted { get; set; }
    
    public OperationResult Handle(CreateBluePrint c)
    {
        Emit(new BluePrintCreated(c.AggregateId, c.ProjectId, c.ProjectLevelId, c.FileId));
        return OperationResult.Succes;
    }
    
    public void Apply(BluePrintCreated e)
    {
        FileId = e.FileId;
    }
}
```
**Why this pattern**: Versioned event handling (v1 and v2) allows schema evolution without breaking existing event stores. Handle method is simple and delegates to events; Apply methods rebuild state.

### 2. ProjectLevel Hierarchy (Tree Structure)
```csharp
public class ProjectLevel : Aggregate<ProjectLevelStreamId>,
    IApplyEvent<ProjectLevelRenamed>,
    IApplyEvent<ProjectLevelCreated>,
    IApplyEvent<ProjectLevelMoved>,
    IApplyEvent<ProjectLevelReordered>
{
    public Guid ProjectId { get; private set; }
    public string? Description { get; private set; }
    public Guid? ParentId { get; private set; }  // Optional parent for hierarchy
    public bool Deleted { get; private set; }
    
    public OperationResult Handle(CreateProjectLevel c)
    {
        if (c.ProjectId == Guid.Empty)
            throw new ProjectIdNotProvidedException("Project id not provided");
        
        Emit(new ProjectLevelCreated(c.AggregateId, c.ProjectId, c.Name!, c.ParentId));
        return OperationResult.Succes;
    }
    
    public void Apply(ProjectLevelCreated e)
    {
        ParentId = e.Parent;
        Description = e.Description;
        ProjectId = e.ProjectId;
    }
}
```
**Why this pattern**: ParentId == null indicates a root level. Hierarchy is navigated by querying parent-child relationships. Reordering and moving use index/parent fields rather than rearranging lists in memory.

### 3. Activation/Deactivation Pattern
```csharp
public OperationResult Handle(ActivateBluePrint c)
{
    Emit(new BluePrintActivated(c.AggregateId));
    return OperationResult.Succes;
}

public OperationResult Handle(DeactivateBluePrint c)
{
    Emit(new BluePrintDeactivated(c.AggregateId));
    return OperationResult.Succes;
}

public void Apply(BluePrintActivated e)
{
    Expired = false;
}

public void Apply(BluePrintDeactivated e)
{
    Expired = true;
}
```
**Why this pattern**: Expired flag is toggled by activation events. This allows reverting deactivation without losing blueprint data. Clean state management separate from deletion.

### 4. Command Handler Dispatch Pattern
```csharp
public class BlueprintCommandHandler :
    ICommandHandler<CreateBluePrint, CommandResult>,
    ICommandHandler<DeleteBluePrint, CommandResult>,
    ICommandHandler<ActivateBluePrint, CommandResult>
{
    private readonly IGeometryAggregateRepository _geometryAggregateRepository;
    
    public async Task<CommandResult> Handle(CreateBluePrint request, CancellationToken cancellationToken)
    {
        return await _geometryAggregateRepository.InvokeBlueprint(
            request.GetType().Name,  // Command name for logging
            request.AggregateId,
            x => x.Handle(request),  // Delegate to aggregate method
            request.ContextMetadata
        );
    }
}
```
**Why this pattern**: Handler is a thin dispatch layer. Repository loads aggregate, calls Handle, persists events. Separates orchestration from domain logic. ContextMetadata is passed for event audit trail.

## Anti-Patterns to Flag in Review

### 1. **Missing ProjectId Validation**
❌ Wrong:
```csharp
public OperationResult Handle(CreateProjectLevel c)
{
    Emit(new ProjectLevelCreated(c.AggregateId, c.ProjectId, c.Name!, c.ParentId));
    return OperationResult.Succes;
}
```
✓ Correct:
```csharp
public OperationResult Handle(CreateProjectLevel c)
{
    if (c.ProjectId == Guid.Empty)
        throw new ProjectIdNotProvidedException("Project id not provided");
    
    if (string.IsNullOrEmpty(c.Name))
        throw new ProjectLevelDescriptionNotProvidedException();
    
    Emit(new ProjectLevelCreated(c.AggregateId, c.ProjectId, c.Name!, c.ParentId));
    return OperationResult.Succes;
}
```
**Why**: ProjectId is a foreign key. Null/empty values cause orphaned levels that can't be queried. Fail-fast prevents bad data.

### 2. **Confusing Expired and Deleted States**
❌ Wrong:
```csharp
if (blueprint.Deleted)
{
    // Blueprint is gone
}
// Reactivate it
blueprint.Expired = false;
```
✓ Correct:
```csharp
if (blueprint.Deleted && !blueprint.PermanentlyDeleted)
{
    // In soft-delete state, can restore
}
else if (blueprint.Deleted)
{
    // Hard deleted, cannot recover
    return;
}

// To reactivate without deleting
if (!blueprint.Deleted)
{
    Emit(new BluePrintActivated(...));
}
```
**Why**: Expired (deactivation) and Deleted (removal) are separate concerns. A deleted blueprint shouldn't be reactivated.

### 3. **Assuming Selected Blueprint Uniqueness**
❌ Wrong:
```csharp
var selectedBlueprint = blueprints.First(b => b.Selected);
// Assume only one is selected
```
✓ Correct:
```csharp
var selectedBlueprints = blueprints.Where(b => b.Selected).ToList();
if (selectedBlueprints.Count > 1)
{
    // Handle data integrity issue: multiple selected blueprints
    // Either log error or clean up inconsistency
}
var selectedBlueprint = selectedBlueprints.FirstOrDefault();
```
**Why**: Selected flag is not enforced to be unique. UI logic or batch operations may leave duplicate selections. Code must be defensive.

### 4. **Forgetting Null Check on ProjectLevelId**
❌ Wrong:
```csharp
public IEnumerable<BluePrint> GetBlueprintsByLevel(Guid projectLevelId)
{
    return _blueprints.Where(b => b.ProjectLevelId == projectLevelId);
}
```
✓ Correct:
```csharp
public IEnumerable<BluePrint> GetBlueprintsByLevel(Guid projectLevelId)
{
    return _blueprints.Where(b => b.ProjectLevelId.HasValue && b.ProjectLevelId == projectLevelId);
}

public IEnumerable<BluePrint> GetUnassignedBlueprints()
{
    return _blueprints.Where(b => !b.ProjectLevelId.HasValue);
}
```
**Why**: ProjectLevelId is nullable. Blueprints without assigned levels are valid (e.g., uploads pending assignment). Null-check prevents missing unassigned blueprints.

### 5. **Not Handling Event Version Migration**
❌ Wrong:
```csharp
public void Apply(ProjectLevelDeleted e)
{
    Deleted = true;
}
// Forget to implement Apply(ProjectLevelDeleted_v2)
```
✓ Correct:
```csharp
public void Apply(ProjectLevelDeleted e)
{
    Deleted = true;
}

public void Apply(ProjectLevelDeleted_v2 e)
{
    Deleted = true;  // Same logic, but handles new event version
}
```
**Why**: Existing event stores contain old events. Without version handlers, replay fails for old events. Both versions must be supported.

### 6. **Allowing Circular Parent References**
❌ Wrong:
```csharp
public OperationResult Handle(MoveProjectLevel c)
{
    Emit(new ProjectLevelMoved(c.AggregateId, c.NewParentId));
}
// Doesn't check if NewParentId is a descendant of this level
```
✓ Correct:
```csharp
public OperationResult Handle(MoveProjectLevel c, IProjectLevelHierarchyValidator validator)
{
    if (!validator.IsValidMove(c.AggregateId, c.NewParentId))
        throw new InvalidHierarchyMoveException("Cannot move level to its own descendant");
    
    Emit(new ProjectLevelMoved(c.AggregateId, c.NewParentId));
    return OperationResult.Succes;
}
```
**Why**: Moving a level to one of its descendants creates a cycle, breaking the hierarchy. Validation must prevent cycles.

## Naming Conventions
- **Aggregate Classes**: PascalCase, singular noun (BluePrint, ProjectLevel)
- **Command Classes**: PascalCase, verb + noun (CreateBluePrint, DeleteBluePrint, RenameProjectLevel)
- **Event Classes**: PascalCase, past tense + optional version (BluePrintCreated, ProjectLevelDeleted_v2)
- **Interfaces**: IPascalCase, singular/gerund form (IBlueprintService, IBluePrintUploadHandler)
- **Service Classes**: PascalCase + "Service" suffix (BlueprintService, BluePrintUploadHandler)
- **Enums**: PascalCase (BluePrintDeletionResultType)
- **StreamId Types**: PascalCase + "StreamId" suffix (BlueprintStreamId, ProjectLevelStreamId)
- **Command Handler Classes**: PascalCase + "CommandHandler" suffix (BlueprintCommandHandler, ProjectLevelCommandHandler)
- **Properties**: PascalCase (FileId, ProjectLevelId, Expired, Deleted, Description, ParentId)
- **Private Fields**: _camelCase
- **Methods**: PascalCase, verb-first (CreateBluePrint, DeleteProjectLevel, MoveProjectLevel)
- **File Names**: Match primary class name (BluePrint.cs, ProjectLevel.cs, BlueprintCommandHandler.cs)
