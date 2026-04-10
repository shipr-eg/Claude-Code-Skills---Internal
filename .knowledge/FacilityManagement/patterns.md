# FacilityManagement — Patterns

## Canonical Examples

### 1. Authorization Check Pattern (BDCardAuthorization)
```csharp
public class BDCardAuthorization : IBDCardAuthorization
{
    private readonly IBDCardAuthorizationReadService _authorizationReader;
    
    public async Task<BDCardAuthorizationResponse> UserMayEditBDCard(Guid bdCardId, FMUserAccessScope ua)
    {
        // Step 1: Fetch authorization rules from read service
        var auth = await _authorizationReader.GetAuthorizationForBDCard(bdCardId);
        
        // Step 2: Check if user is creator or responsible party
        if (IsUserCreatorOrResponsible(ua.UserId, auth) == false)
        {
            // User is not directly involved, check project-level permission
            return ua.HasPermissionOnCurrentProject(PermissionNames.BPDEditOthers)
                ? BDCardAuthorizationResponse.Authorize()
                : BDCardAuthorizationResponse.Reject(FMCommandResult.RejectedResult.RejectReason.NotAuthorized);
        }
        
        // Step 3: Determine permission based on status
        var neededPermission = auth.Status.IsOpen
            ? PermissionNames.BPDEditResponsibleOrCreatedByOpen
            : PermissionNames.BPDEditResponsibleOrCreatedByClosed;
        
        return ua.HasPermissionOnCurrentProject(neededPermission)
            ? BDCardAuthorizationResponse.Authorize()
            : BDCardAuthorizationResponse.Reject(...);
    }
}
```
**Why this pattern**: Separation of concerns—authorization reads from persistence layer, then applies rules. Status-dependent permission checks protect closed cards.

### 2. Service Interface Pattern (IBDCardReadService)
```csharp
public interface IBDCardReadService
{
    Task<BDCard> GetBdCardDetailData(Guid bdCardId);
    Task<Dictionary<Guid, BDCard[]>> GetBDCardsBySearchFilter(Guid projectId, BDSearchValues searchValues);
    Task<IEnumerable<BDCard>> GetBDCardsByPropertyGroup(int propertyGroupId);
    Task<BDCardState> ExistingBDCardState(Guid bdCardId);
}
```
**Why this pattern**: Clean separation between read and write concerns. Async-first interface for database operations. Specialized return types (Dictionary for grouped results, IEnumerable for lists, State objects for specific queries).

### 3. Status State Helper Pattern (BdCardStatus)
```csharp
public class BdCardStatus
{
    public BdCardStatus(BDCardStatus status)
    {
        Status = status;
    }
    
    public readonly BDCardStatus Status;
    public bool IsOpen => Status == BDCardStatus.Created || Status == BDCardStatus.InProgress;
    public bool IsClosed => Status == BDCardStatus.Completed || Status == BDCardStatus.Approved;
}
```
**Why this pattern**: Encapsulates status logic. Easier to read `status.IsOpen` than `status == Created || status == InProgress`. Changes to status logic only need to be made in one place.

### 4. Command Model Pattern (SaveBDCardCommand)
```csharp
public class SaveBDCardCommand
{
    public Guid BDCardId { get; set; }
    public string Name { get; set; } = null!; // Null forgiving operator
    public Guid? WarrantyResponsibleUserId { get; set; }
    public Guid? WarrantyResponsibleCompanyId { get; set; }
    public Guid? OperationResponsibleUserId { get; set; }
    public Guid? OperationResponsibleCompanyId { get; set; }
    // ... more properties
}
```
**Why this pattern**: Command object encapsulates all inputs for a write operation. Nullable types (Guid?) allow optional responsible parties. Null-forgiving operator signals intentional null defaults.

### 5. Complex Authorization Check (Status + Role)
```csharp
if (IsUserCreatorOrResponsible(ua.UserId, auth) == false)
{
    // Not involved directly, check project permission
    return ua.HasPermissionOnCurrentProject(PermissionNames.BPDEditOthers)
        ? BDCardAuthorizationResponse.Authorize()
        : BDCardAuthorizationResponse.Reject(...);
}

// Involved, check status-dependent permission
var neededPermission = auth.Status.IsOpen
    ? PermissionNames.BPDEditResponsibleOrCreatedByOpen
    : PermissionNames.BPDEditResponsibleOrCreatedByClosed;
```
**Why this pattern**: Two-tier authorization: first check user role, then check status-dependent permissions. Supports both creator/responsible edits and admin overrides.

## Anti-Patterns to Flag in Review

### 1. **Forgetting Status Check in Authorization**
❌ Wrong:
```csharp
if (userId == auth.CreatedBy)
    return BDCardAuthorizationResponse.Authorize();
```
✓ Correct:
```csharp
var neededPermission = auth.Status.IsOpen
    ? PermissionNames.BPDEditResponsibleOrCreatedByOpen
    : PermissionNames.BPDEditResponsibleOrCreatedByClosed;
return ua.HasPermissionOnCurrentProject(neededPermission)
    ? BDCardAuthorizationResponse.Authorize()
    : BDCardAuthorizationResponse.Reject(...);
```
**Why**: Status changes permission requirements. A closed card requires different permissions than an open one, even for the creator.

### 2. **Allowing Responsible Party Null Without Handling**
❌ Wrong:
```csharp
var warranty = auth.WarrantyResponsibleUserId;
if (warranty == userId) { /* edit allowed */ }
```
✓ Correct:
```csharp
if (auth.WarrantyResponsibleUserId.HasValue && auth.WarrantyResponsibleUserId == userId)
    return true;
```
**Why**: Responsible parties are optional (nullable Guid?). Null-checking prevents false matches.

### 3. **Missing File Attachment Cleanup on Delete**
❌ Wrong:
```csharp
public void DeleteBDCard(Guid bdCardId)
{
    // Just delete the card, don't clean up attached files
    _cardWriteService.Delete(bdCardId);
}
```
✓ Correct:
```csharp
public async Task DeleteBDCard(Guid bdCardId)
{
    var card = await _cardReadService.GetBdCardDetailData(bdCardId);
    
    // Delete file attachments first
    await _fileAttachmentService.DetachAllFiles(bdCardId);
    
    // Then delete the card
    await _cardWriteService.Delete(bdCardId);
}
```
**Why**: File attachments reference Box files. Without cleanup, Box files are orphaned and consume storage.

### 4. **Ignoring Component Copy Failures**
❌ Wrong:
```csharp
_cardWriteService.CopyCard(sourceId, targetId);
_componentService.CopyComponents(sourceId, targetId);
// If component copy fails, card is orphaned with wrong component IDs
```
✓ Correct:
```csharp
using (var transaction = _unitOfWork.BeginTransaction())
{
    try
    {
        var newCard = _cardWriteService.CopyCard(sourceId);
        _componentService.CopyComponents(sourceId, newCard.Id);
        await transaction.CommitAsync();
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}
```
**Why**: Card copy and component copy must be transactional. Partial copies leave inconsistent state.

### 5. **Bypassing Authorization in Logging**
❌ Wrong:
```csharp
public async Task LogCardChange(Guid bdCardId, string change)
{
    // Log without checking authorization
    await _logService.LogActivity(bdCardId, change);
}
```
✓ Correct:
```csharp
public async Task LogCardChange(Guid bdCardId, string change, FMUserAccessScope ua)
{
    var auth = await _authorizationChecker.UserMayViewBDCard(bdCardId, ua);
    if (!auth.Authorized)
        throw new UnauthorizedException("Cannot log changes on card you can't view");
    
    await _logService.LogActivity(bdCardId, change);
}
```
**Why**: Logging should respect authorization. Users shouldn't be able to log/audit cards they can't access.

### 6. **Not Validating Supplier Existence**
❌ Wrong:
```csharp
public async Task SaveBDCard(SaveBDCardCommand cmd)
{
    var card = new BDCard { SupplierCompany = cmd.SupplierCompanyId, /* ... */ };
    await _cardWriteService.Save(card);
}
```
✓ Correct:
```csharp
public async Task SaveBDCard(SaveBDCardCommand cmd)
{
    if (cmd.SupplierCompanyId.HasValue)
    {
        var supplierExists = await _supplierService.SupplierExists(cmd.SupplierCompanyId.Value);
        if (!supplierExists)
            throw new InvalidOperationException("Supplier not found");
    }
    
    var card = new BDCard { SupplierCompany = cmd.SupplierCompanyId, /* ... */ };
    await _cardWriteService.Save(card);
}
```
**Why**: Orphaned supplier references cause data integrity issues. Validate before assigning.

## Naming Conventions
- **Classes**: PascalCase, domain entity names (BDCard, BDGroup, BDCardAuthorization)
- **Commands**: PascalCase, verb + noun (SaveBDCardCommand, CreateSupplierCommand, BDCardDeleteCommand)
- **Interfaces**: IPascalCase, singular noun (IBDCardReadService, IBDCardWriteService, IBDCardFileAttachmentService)
- **Service Classes**: PascalCase + "Service" suffix (BdBoardReadService, BDCardSupplierWriteService)
- **Enums**: PascalCase, plural or singular as appropriate (BDCardStatus, ActivityStatus, TimeInterval, AmountType, Currency)
- **Properties**: PascalCase (Name, Description, CreatedDate, WarrantyStartDate, SupplierCompany)
- **Private Fields**: _camelCase (e.g., _authorizationReader)
- **Methods**: PascalCase, verb-first (GetBdCardDetailData, UserMayEditBDCard, IsUserCreatorOrResponsible)
- **File Names**: Match primary class name (BDCard.cs, BDCardAuthorization.cs, IBDCardReadService.cs)
- **BD Abbreviation**: Consistently use "BD" for Bygningsdele domain language (BDCard, BDGroup, BDCardPath)
