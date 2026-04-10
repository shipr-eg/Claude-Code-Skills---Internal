# Box — Patterns

## Canonical Examples

### 1. Command Handler Pattern (AjourBoxFolderHandler)
```csharp
public class AjourBoxFolderHandler : 
    ICommandHandler<CreateProjectFolder, CommandResult>,
    ICommandHandler<CreateSystemFolder, CommandResult>,
    // ... more command types
{
    private readonly IAjourBoxAggregateRepository _repo;
    
    public async Task<CommandResult> Handle(CreateProjectFolder request, CancellationToken cancellationToken)
    {
        return await _repo.InvokeFolder(
            request.GetType().Name,
            request.AggregateId,
            x => x.Handle(request),  // Delegate to aggregate's Handle method
            request.ContextMetadata
        );
    }
}
```
**Why this pattern**: Handler loads aggregate from repository, calls aggregate.Handle(command) to emit events, and repository persists the result. Separates command handling orchestration from domain logic.

### 2. Aggregate Command Handler (Folder.Handle)
```csharp
public OperationResult Handle(CreateProjectFolder c)
{
    GuardAgainstAlreadyCreated();
    if (string.IsNullOrEmpty(c.Name))
        throw new FolderNameNotProvidedException();
    if (c.ProjectId == default)
        throw new ProjectIdNotProvidedException("ProjectId cannot be empty");
    
    Emit(new FolderCreated(c.AggregateId, c.ParentId, c.ProjectId, c.Name));
    return OperationResult.Succes;
}
```
**Why this pattern**: All validation happens first (fail fast). Domain rules are enforced before emitting any events. Each Handle method emits exactly one event representing the change.

### 3. Event Application (Folder.Apply)
```csharp
public void Apply(FolderCreated e)
{
    FilesInFolder = new List<Guid>();
    Subfolders = new List<Guid>();
    _assignedCompanies.Clear();
    ParentId = e.ParentId;
    Name = e.Name;
    ProjectId = e.ProjectId;
    CreatedByUserId = e.UserId;
    HasBeenCreated = true;
}
```
**Why this pattern**: Apply methods rebuild aggregate state from events during event replay. Initialize all collections and properties from event data. This method runs during both initial creation and replay.

### 4. Idempotent Collection Operations
```csharp
public OperationResult Handle(AttachFileToFolder c)
{
    if (FilesInFolder?.Contains(c.FileId) ?? false)
        return OperationResult.Succes;  // Already attached, idempotent
    
    Emit(new FileAttachedToFolder(c.AggregateId, c.FileId, MapFileAttachedReason(c.Reason)));
    return OperationResult.Succes;
}
```
**Why this pattern**: Prevents duplicate attachments. If file is already in the folder, succeed without emitting event. Safe to retry operations without side effects.

## Anti-Patterns to Flag in Review

### 1. **Bypassing Guard Clauses in Apply Methods**
❌ Wrong:
```csharp
public void Apply(FileDetachedFromFolder e)
{
    FilesInFolder.Remove(e.FileId);  // May throw if FilesInFolder is null
}
```
✓ Correct:
```csharp
public void Apply(FileDetachedFromFolder e)
{
    if (!(FilesInFolder?.Contains(e.FileId) ?? false))
        return;  // Guard first
    FilesInFolder.Remove(e.FileId);
}
```
**Why**: Apply can be called on partially-initialized aggregates during event replay. Always null-coalesce collections.

### 2. **Modifying Non-Root Folder as if It Were Root**
❌ Wrong:
```csharp
public void SetParent(Guid? newParent)
{
    ParentId = newParent;  // Doesn't check invariants
}
```
✓ Correct:
```csharp
public OperationResult Handle(MoveFolder c)
{
    // Guard: cannot move root (ParentId == null stays null until it's a root)
    Emit(new FolderMoved(c.AggregateId, c.CurrentParentId, c.NewParentId, c.NewIndex));
    return OperationResult.Succes;
}
```
**Why**: Root folder invariant is critical for hierarchy integrity. Commands must validate moves respect folder type.

### 3. **Emitting Events Without Validation**
❌ Wrong:
```csharp
public OperationResult Handle(CreateProjectFolder c)
{
    Emit(new FolderCreated(c.AggregateId, c.ParentId, c.ProjectId, c.Name));
    return OperationResult.Succes;
}
```
✓ Correct:
```csharp
public OperationResult Handle(CreateProjectFolder c)
{
    if (string.IsNullOrEmpty(c.Name))
        throw new FolderNameNotProvidedException();
    if (c.ProjectId == default)
        throw new ProjectIdNotProvidedException("...");
    GuardAgainstAlreadyCreated();
    
    Emit(new FolderCreated(...));
    return OperationResult.Succes;
}
```
**Why**: Validation must happen before Emit. Once an event is emitted, it's immutable in the event store. Validate first, emit second.

### 4. **Forgetting to Guard Against Multiple Creation**
❌ Wrong:
```csharp
public OperationResult Handle(CreateProjectFolder c)
{
    Emit(new FolderCreated(...));
}
// If Handle is called twice on same aggregate, two FolderCreated events are emitted
```
✓ Correct:
```csharp
public OperationResult Handle(CreateProjectFolder c)
{
    GuardAgainstAlreadyCreated();  // Checks HasBeenCreated flag
    Emit(new FolderCreated(...));
}
```
**Why**: Aggregates must enforce their own invariants. HasBeenCreated prevents duplicate creation.

### 5. **Failing to Track Reason for File Attachment/Detachment**
❌ Wrong:
```csharp
public OperationResult Handle(AttachFileToFolder c)
{
    Emit(new FileAttachedToFolder(c.AggregateId, c.FileId));  // Missing reason
}
```
✓ Correct:
```csharp
Emit(new FileAttachedToFolder(c.AggregateId, c.FileId, MapFileAttachedReason(c.Reason)));
```
**Why**: Reason (Created, Moved, FromCopy, Restored) helps audit and understand file lineage.

### 6. **Assuming Soft Delete is the Only State**
❌ Wrong:
```csharp
if (folder.Deleted) { /* folder is gone */ }
```
✓ Correct:
```csharp
if (folder.Deleted && !folder.PermanentlyDeleted) {
    // In recycle bin, can be restored
} else if (folder.PermanentlyDeleted) {
    // Hard deleted, unrecoverable
}
```
**Why**: Soft and permanent deletion are different states. Recycle bin logic depends on this distinction.

## Naming Conventions
- **Aggregate Classes**: PascalCase, singular noun (Folder, BoxFile)
- **Command Classes**: PascalCase, imperative verb + noun (CreateProjectFolder, RenameFolder, LockFolder)
- **Event Classes**: PascalCase, past tense (FolderCreated, FileAttachedToFolder, FolderRenamed)
- **Interfaces**: IPascalCase (IAjourBoxAggregateRepository, IAjourBoxFolderReadService)
- **Enum Names**: PascalCase (BDCardStatus, AmountType, FileStatusTypes)
- **Helper/Service Classes**: PascalCase + "Service"/"Helper"/"Reader" suffix (AjourBoxFolderReadService, AjourBoxFolderTreeSearcher)
- **Private Fields**: _camelCase (e.g., _assignedCompanies)
- **Constants**: UPPER_SNAKE_CASE (rarely seen in this domain, but convention follows .editorconfig)
- **File Names**: Match class name (Folder.cs, BoxFile.cs, AjourBoxFolderHandler.cs)
