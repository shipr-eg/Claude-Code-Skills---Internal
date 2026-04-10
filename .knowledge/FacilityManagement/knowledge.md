# FacilityManagement — Knowledge Base

## Purpose
FacilityManagement (FM) manages building lifecycle data, facility components, maintenance schedules, and BD Cards. BD Cards (Bygningsdele = Building Parts in Danish) are the core entity—a structured data model capturing component specifications, installation dates, warranty information, responsible parties, and associated costs. FM tracks component lifecycle from creation through operation and warranty management, with file attachments and cost tracking.

## Architecture Decisions
- **Service-Based Architecture**: FM does not use event sourcing. Instead, uses synchronous service classes (IBDCardReadService, IBDCardWriteService, IBDGroupReadService) that directly query/update SQL database. [CODE]
- **BDCard as Core Entity**: BDCard is the main domain model, not an event-sourced aggregate. It's a POCO (Plain Old CLR Object) with properties for metadata, dates, costs, and references. [CODE]
- **Authorization via BDCardAuthorization**: Authorization is checked separately via IBDCardAuthorizationReadService and BDCardAuthorization class, which determines if a user can edit based on status (Open/Closed) and role (Creator, Warranty Responsible, Operation Responsible). [CODE]
- **BD Card Status States**: BDCard lifecycle follows a state machine with four statuses: Created → InProgress → Completed → Approved. BdCardStatus class provides helper methods (IsOpen, IsClosed). [CODE]
- **File Attachment Service**: FM supports file attachments via IBDCardFileAttachmentService. Files are stored in Box and referenced by IBDCardFileAttachmentService. [CODE]
- **Supplier Management**: Suppliers can be created (CreateSupplierCommand) and associated with BD Cards via SupplierCompany field. [CODE]
- **Component Hierarchy**: BD Cards can have multiple components (ComponentIds array). Components are managed separately and copied when BD Cards are copied. [CODE]
- **Comments and Logs**: BD Cards support comments (IBDCardCommentWriteService) and activity logs (IBDCardLogWriteService) for audit trail. [CODE]
- **Search and Filter**: BD Cards support search/filter via GetBDCardsBySearchFilter (Dictionary<Guid, BDCard[]>) and BdBoardFilter for complex queries. [CODE]
- **Maintenance Scheduling**: FM supports maintenance schedules (FilteredMaintenanceSchedule) with time intervals (day, week, month, year) and responsible parties. [CODE]

## Domain / Business Rules
- **BD Card Status Lifecycle**: Only certain transitions are allowed between statuses. Open status (Created, InProgress) allows editing. Closed status (Completed, Approved) restricts editing. [CODE]
- **Authorization by Status**: Users who created the card or are assigned as responsible can edit open cards. Only those with specific permissions can edit closed cards. [CODE]
- **Required Fields**: BDCard.Name is required. CreatedBy (with CompanyId and UserId) is required. [CODE]
- **Amount Type and Currency**: BD Cards track amounts (m, m2, pcs, m3) and costs (DKR, EUR, GBP, USD, ISK, PLN). Currency and AmountType are enums. [CODE]
- **Warranty and Operation Responsible**: Two separate responsible parties (WarrantyResponsible and OperationResponsible), each with optional CompanyId and UserId. [CODE]
- **Installation and Warranty Dates**: BDCard tracks CreatedDate, InstallationDate, WarrantyStartDate, WarrantyEndDate, OperationStartDate. These help determine lifecycle phase. [CODE]
- **Component Association**: ComponentIds array associates components with the card. ComponentCount property derives the count. Card references its components for copy/delete operations. [CODE]
- **BD Card Path/Hierarchy**: BDCard has BDCardPath (PropertyGroupId and BDGroupReference tree). FullBDCardNumber is derived from group hierarchy and IndexInGroup. [CODE]
- **Supplier Opt-In**: SupplierCompany is optional, allowing cards to be created without assigning a supplier initially. [CODE]
- **No Hard Delete**: Deleted BD Cards are typically soft-deleted or archived. No evidence of permanent deletion in the code. [CODE]

## Public Contracts
### Core Models
- **BDCard**: Main domain model representing a building component.
  - Key Properties: Id, GroupId, ProjectId, Name, Description, AmountNumber, AmountType, UnitCost, Currency, ExpectedLifeTimeNumber, TimeInterval, CreatedDate, InstallationDate, WarrantyStartDate, WarrantyEndDate, OperationStartDate, SupplierCompany, CreatedBy, WarrantyResponsible, OperationResponsible, Status, ComponentIds
  
- **BdCardStatus**: Status wrapper class with helper properties (IsOpen, IsClosed)
  - Statuses: Created (0), InProgress (1), Completed (2), Approved (3)

- **BDCardAuthorization**: Authorization checker with method UserMayEditBDCard
  - Returns: BDCardAuthorizationResponse (Authorize/Reject)

- **BDCard Responsible**: Two-tier responsible model
  - WarrantyResponsible: User/Company responsible during warranty period
  - OperationResponsible: User/Company responsible during operation

### Key Interfaces
- **IBDCardReadService**: Read-only access to BD Cards
  - GetBdCardDetailData(Guid bdCardId): Task<BDCard>
  - GetBDCardsBySearchFilter(Guid projectId, BDSearchValues): Task<Dictionary<Guid, BDCard[]>>
  - GetBDCardsByPropertyGroup(int propertyGroupId): Task<IEnumerable<BDCard>>
  
- **IBDCardWriteService**: Write operations on BD Cards
  - SaveBDCardCommand: Persist BD Card changes
  
- **IBDCardFileAttachmentService**: File management for BD Cards
  - Attach/detach files from Box
  
- **IBDCardCommentWriteService**: Comment management
  - Create/update comments on BD Cards
  
- **IBDCardLogWriteService**: Activity logging
  - Log changes and user actions on BD Cards

- **IBDCardAuthorizationReadService**: Read authorization rules
  - GetAuthorizationForBDCard(Guid bdCardId): Returns AuthorizationRulesForBdCard

### Commands
- **SaveBDCardCommand**: Create/update BD Card with all properties
- **CreateSupplierCommand**: Create supplier company for BD Cards
- **CopyBDCardComponentsCommand**: Copy components between cards
- **BDCardDeleteCommand**: Delete/archive BD Card

## Key Dependencies
- **Box Module**: BD Cards store file attachments in Box. IBDCardFileAttachmentService manages this integration.
- **UserOrganizations Module**: FMUserAccessScope and authorization checks rely on user roles and project permissions (PermissionNames.BPDEditOthers, etc.)
- **Construction Module** (inferred): BD Cards may be associated with construction projects.

## Known Gotchas
- **Status-Dependent Authorization**: The same user action (edit) has different authorization requirements depending on BDCard status. Open vs. Closed status requires different permissions. Review authorization logic carefully when status is being changed.
- **Component Copy Without Cascading**: When copying a BD Card, components are copied separately via CopyBDCardComponentsCommand. If component copy fails but card copy succeeds, you have orphaned components.
- **Full BD Card Number Derivation**: FullBDCardNumber is calculated from BDCardPath (PropertyGroupId → BDGroupReference tree → GroupNumber at each level). This is complex to derive; use the property, don't reconstruct manually.
- **Optional Responsible Parties**: Both WarrantyResponsible and OperationResponsible can be null/partially null (CompanyId or UserId may be null individually). Code using these must null-check.
- **Service-Based, No Event Audit Trail**: Unlike Box (event-sourced), FM doesn't have event history. All audit information comes from BDCardLogEvent/IBDCardLogWriteService. If logging fails, changes are not audited.
- **User Access Scope**: FMUserAccessScope encapsulates user permissions. Authorization checks depend on this being correctly populated. Ensure context metadata includes user scope.
- **Supplier Deletion**: No evidence of supplier cleanup when a BD Card is deleted. Supplier records may orphan if they're only referenced by cards.
- **File Storage Integration**: File attachment relies on Box module. If Box file is deleted independently, FM doesn't cascade-delete the reference; manual cleanup may be needed.
