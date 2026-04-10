# Tender — Patterns

## Canonical Examples

### 1. Complex Command Handler with Nested Dispatch (TenderCommandHandler)
```csharp
public class TenderCommandHandler :
    ICommandHandler<CreateTender, CommandResult>,
    ICommandHandler<ActivateTender, CommandResult>,
    ICommandHandler<AddContract, CommandResult>,
    // ... 70+ command types
{
    private readonly ITenderTransaction _tenderTransaction;
    
    public TenderCommandHandler(ITenderTransaction tenderTransaction)
    {
        _tenderTransaction = tenderTransaction;
    }
    
    public async Task<CommandResult> Handle(CreateTender request, CancellationToken cancellationToken)
    {
        return await _tenderTransaction.Invoke(
            request.GetType().Name,
            new TenderId(request.AggregateId),
            x => x.Handle(request),  // Delegate to Tender aggregate
            request.ContextMetadata
        );
    }
}
```
**Why this pattern**: Single handler for many related commands (70+). Transaction wrapper ensures atomicity. TenderId wraps aggregate ID. Delegate pattern isolates command dispatch from business logic.

### 2. Composite/Tree Structure (Contract Hierarchy)
```csharp
public class Contract : ContractComponent
{
    public List<ContractComponent>? ContractComponents { get; private set; }
    
    public override void Add(ContractComponent component)
    {
        ContractComponents?.Add(component);
    }
    
    public override ContractComponent? GetComponent(Guid id)
    {
        if (Id == id)
            return this;
        foreach (var contractComponent in ContractComponents ?? Enumerable.Empty<ContractComponent>())
        {
            var component = contractComponent.GetComponent(id);  // Recursive search
            if (component != null)
                return component;
        }
        return null;
    }
    
    public List<ContractComponent> GetOfferListIds()
    {
        var list = new List<ContractComponent>();
        foreach (var contractComponent in ContractComponents ?? Enumerable.Empty<ContractComponent>())
        {
            if (contractComponent.GetType() == typeof(OfferList))
                list.Add(contractComponent);
            else if (contractComponent is Contract contract)
                list.AddRange(contract.GetOfferListIds());  // Recursive aggregation
        }
        return list;
    }
}
```
**Why this pattern**: Composite pattern for hierarchical contract structures. Base class defines interface (Add, GetComponent). Contracts recursively aggregate nested components. Safe enumeration with null-coalesce.

### 3. Cascade User/Company Assignment
```csharp
public override void AddUser(Guid userId)
{
    UserIds?.Add(userId);
    foreach (var contractComponent in ContractComponents ?? Enumerable.Empty<ContractComponent>())
    {
        contractComponent.AddUser(userId);  // Cascade to all children
    }
}

public override void RemoveUser(Guid userId)
{
    UserIds?.Remove(userId);
    foreach (var contractComponent in ContractComponents ?? Enumerable.Empty<ContractComponent>())
    {
        contractComponent.RemoveUser(userId);  // Cascade removal
    }
}
```
**Why this pattern**: Assigning a user to a contract automatically assigns to all nested components. Removal cascades down the tree. Keeps tree consistent without requiring separate commands per component.

### 4. Aggregate Retrieval Pattern (GetAllUserIds)
```csharp
public override List<Guid> GetAllUserIds()
{
    var list = UserIds?.Select(x => x).ToList();
    foreach (var contractComponent in ContractComponents ?? Enumerable.Empty<ContractComponent>())
    {
        list?.AddRange(contractComponent.GetAllUserIds());  // Recursive aggregation
    }
    return list?.Distinct().ToList() ?? new List<Guid>();  // Deduplicate and default to empty
}
```
**Why this pattern**: Recursively collects all unique users from a contract tree. Deduplication handles cases where same user appears in multiple components. Safe fallback to empty list if null.

### 5. Conditional Type-Based Navigation (GetOfferListIds)
```csharp
foreach (var contractComponent in ContractComponents ?? Enumerable.Empty<ContractComponent>())
{
    if (contractComponent.GetType() == typeof(OfferList))
        list.Add(contractComponent);  // Found an OfferList
    else
    {
        if (contractComponent is Contract contract)
            list.AddRange(contract.GetOfferListIds());  // Recurse into nested contracts
    }
}
```
**Why this pattern**: Filters components by type (OfferList vs. Contract). Recurses only into Contract nodes. Prevents errors from calling GetOfferListIds on non-Contract types.

## Anti-Patterns to Flag in Review

### 1. **Missing Null Checks on Collections in Cascade Operations**
❌ Wrong:
```csharp
public override void AddUser(Guid userId)
{
    UserIds.Add(userId);  // May throw if UserIds is null
    foreach (var cc in ContractComponents)  // May throw if null
    {
        cc.AddUser(userId);
    }
}
```
✓ Correct:
```csharp
public override void AddUser(Guid userId)
{
    UserIds?.Add(userId);
    foreach (var cc in ContractComponents ?? Enumerable.Empty<ContractComponent>())
    {
        cc.AddUser(userId);
    }
}
```
**Why**: Collections can be null in event-sourced aggregates before Apply is called. Null-coalesce prevents null reference exceptions.

### 2. **Assuming GetComponent Doesn't Exist**
❌ Wrong:
```csharp
var contract = tender.GetComponent(contractId);
var renamed = contract.Name;  // May crash if component not found
```
✓ Correct:
```csharp
var component = tender.GetComponent(contractId);
if (component == null)
    throw new ContractNotFoundException($"Contract {contractId} not found");
var renamed = component.Name;
```
**Why**: GetComponent returns null if not found. Assuming existence leads to null reference errors. Explicit checks are safer.

### 3. **Circular Reference in Contract Hierarchy**
❌ Wrong:
```csharp
public void Move(Guid componentId, Guid newParentId)
{
    var component = GetComponent(componentId);
    component.ParentId = newParentId;  // No validation, allows cycles
}
```
✓ Correct:
```csharp
public bool CanMove(Guid componentId, Guid newParentId, out string error)
{
    var component = GetComponent(componentId);
    if (component == null)
    {
        error = "Component not found";
        return false;
    }
    
    var newParent = GetComponent(newParentId);
    if (IsDescendantOf(newParent, component))
    {
        error = "Cannot move component to its own descendant";
        return false;
    }
    
    error = "";
    return true;
}

public void Move(Guid componentId, Guid newParentId)
{
    if (!CanMove(componentId, newParentId, out var error))
        throw new InvalidOperationException(error);
    
    var component = GetComponent(componentId);
    component.ParentId = newParentId;
}
```
**Why**: Moving a parent to a child creates a cycle. Traversal breaks. Validation prevents cycles.

### 4. **Not Handling Duplicate Offers in ClearAllOffers**
❌ Wrong:
```csharp
public void ClearAllOffers()
{
    foreach (var offerList in ContractComponents?.OfType<OfferList>())
    {
        offerList.ClearAllOffers();
    }
}
```
✓ Correct:
```csharp
public void ClearAllOffers()
{
    var allOffers = new HashSet<Guid>();
    foreach (var offerList in ContractComponents?.OfType<OfferList>() ?? Enumerable.Empty<OfferList>())
    {
        var offersToDelete = offerList.ClearAllOffers();
        foreach (var offerId in offersToDelete)
            allOffers.Add(offerId);  // Deduplicate if same offer in multiple lists
    }
    // Audit log or notify about cleared offers
}
```
**Why**: If same offer appears in multiple lists, clearing without deduplication causes issues. Tracking cleared offers helps with audit trails.

### 5. **Ignoring Deadline Validation in Status Transitions**
❌ Wrong:
```csharp
public OperationResult Handle(SetTenderDeadlineForOffers c)
{
    Emit(new TenderDeadlineForOffersSet(c.AggregateId, c.Deadline));
    return OperationResult.Succes;
}
```
✓ Correct:
```csharp
public OperationResult Handle(SetTenderDeadlineForOffers c)
{
    if (c.Deadline <= DateTime.UtcNow)
        throw new InvalidOperationException("Deadline cannot be in the past");
    
    if (Status == TenderStatus.Closed || Status == TenderStatus.Archived)
        throw new InvalidOperationException($"Cannot set deadline for {Status} tender");
    
    Emit(new TenderDeadlineForOffersSet(c.AggregateId, c.Deadline));
    return OperationResult.Succes;
}
```
**Why**: Past deadlines are nonsensical. Closed/archived tenders shouldn't have new deadlines. Validation prevents invalid states.

### 6. **Not Tracking Offer Changes for Audit**
❌ Wrong:
```csharp
public void MakeOffer(Offer offer)
{
    Offers.Add(offer);
}
```
✓ Correct:
```csharp
public OperationResult Handle(MakeOffer c)
{
    var offer = new Offer(c.AggregateId, c.CompanyId, c.ContractId, c.Items);
    
    // Check if offer already exists for this company/contract
    var existing = Offers.FirstOrDefault(o => o.CompanyId == c.CompanyId && o.ContractId == c.ContractId);
    if (existing != null)
        Emit(new OfferRevised(c.AggregateId, existing.Id, offer));
    else
        Emit(new OfferMade(c.AggregateId, offer));
    
    return OperationResult.Succes;
}
```
**Why**: Replacing an offer without tracking the change makes audit difficult. OfferRevised event creates audit trail of offer changes.

## Naming Conventions
- **Aggregate Classes**: PascalCase, singular (Tender, Contract, Offer, OfferList)
- **Command Classes**: PascalCase, verb + noun (CreateTender, AddContract, MakeOffer, SetTenderDeadlineForOffers)
- **Event Classes**: PascalCase, past tense (TenderCreated, OfferMade, ContractAdded, OfferCancelled)
- **Abstract Base Classes**: PascalCase, end with "Base" or "Component" (ContractComponent)
- **Interfaces**: IPascalCase, singular/gerund form (ITenderTransaction, ITenderZipRequestHandler)
- **Service Classes**: PascalCase + "Service" or "Handler" suffix (TenderCommandHandler, TenderZipHandler, TenderMaterialCommandHandler)
- **Read Service Classes**: PascalCase + "Service" or "Reader" suffix (TenderQueryService, TenderMaterialReader)
- **Value Objects**: PascalCase (TenderId, OfferValue, AssignmentCriteria)
- **Enums**: PascalCase, singular or plural as appropriate (TenderStatus, ContractType, OfferStatus)
- **Properties**: PascalCase (Name, ParentId, ContractComponents, CompanyIds, UserIds, Deadline)
- **Private Fields**: _camelCase (e.g., _tenderTransaction)
- **Methods**: PascalCase, verb-first (Add, Remove, GetComponent, GetOfferListIds, GetAllUserIds, ClearAllOffers)
- **File Names**: Match primary class name (Tender.cs, Contract.cs, OfferList.cs, TenderCommandHandler.cs)
