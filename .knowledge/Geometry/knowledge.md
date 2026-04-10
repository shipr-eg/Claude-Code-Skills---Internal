# Geometry — Knowledge Base

## Purpose
Geometry manages blueprints (2D architectural drawings/plans) and project level hierarchies. Blueprints are CAD files (typically .DWG, SVG, or other formats) associated with project levels, representing floor plans, sections, or elevation drawings. ProjectLevels form a hierarchical structure (e.g., Ground Floor, Level 1, Level 2) under a project. Geometry integrates with Box for file storage and supports blueprint activation/deactivation for version control.

## Architecture Decisions
- **Event Sourcing**: Both BluePrint and ProjectLevel aggregates use event sourcing. State is rebuilt by replaying events stored in EventStore. [CODE]
- **Dual Aggregates**: Two main aggregates: BluePrint (represents a single blueprint file) and ProjectLevel (represents a level/story in a building hierarchy). [CODE]
- **ProjectLevel Hierarchy**: ProjectLevels form a tree structure with optional ParentId. Root levels have ParentId == null. Supports reordering and movement. [CODE]
- **Blueprint Activation/Deactivation**: Blueprints have an Expired flag that controls activation state. ActivateBluePrint sets Expired=false; DeactivateBluePrint sets Expired=true. [CODE]
- **Blueprint Soft Deletion**: Blueprints support soft deletion (Deleted flag) and hard deletion. Supports restore operations (BluePrintRestored event). [CODE]
- **File Association**: Each Blueprint references a single FileId (from Box module). ProjectLevelId is optional—blueprints can exist without being assigned to a level. [CODE]
- **Blueprint Selection**: Blueprints have a Selected flag (likely for UI purposes to track which blueprint is currently active). [CODE]
- **Event Versioning**: ProjectLevel has event versions (ProjectLevelDeleted_v1, ProjectLevelDeleted_v2) for backward compatibility. [CODE]
- **Command Handler Pattern**: Separate command handlers (BlueprintCommandHandler, ProjectLevelCommandHandler) dispatch to aggregates via repository. [CODE]
- **Repository Pattern**: IGeometryAggregateRepository loads/saves aggregates and manages event persistence. [CODE]

## Domain / Business Rules
- **ProjectId Required**: ProjectLevel must have a ProjectId. Creating a level without a project throws ProjectIdNotProvidedException. [CODE]
- **Level Description Required**: ProjectLevel name/description is required (non-null, non-empty). ProjectLevelDescriptionNotProvidedException is thrown if missing. [CODE]
- **ProjectLevel Hierarchy**: ProjectLevels can have a ParentId, forming a tree. Levels without parents are root levels. Hierarchy supports reordering and movement. [CODE]
- **Blueprint File Linking**: BluePrint.FileId links to a file in Box module. The file is uploaded separately; BluePrint just maintains the reference. [CODE]
- **Blueprint Expiration State**: Expired flag indicates whether a blueprint is active. An expired blueprint is deactivated but not deleted. [CODE]
- **Deletion vs. Expiration**: Deletion (Deleted flag) is permanent (soft). Expiration is a state toggle. A blueprint can be expired and not deleted, or deleted independently of expiration. [CODE]
- **ProjectLevel Deletion Propagation**: When a ProjectLevel is deleted, its blueprints may need to be handled. No explicit cascade evident, but likely expected behavior. [CODE]
- **Blueprint Selection**: Only one blueprint per ProjectLevel should be Selected=true. No explicit constraint in aggregate, but data integrity expectation. [CODE]

## Public Contracts
### Core Aggregates
- **BluePrint** (Aggregate<BlueprintStreamId>): Represents a blueprint file version
  - Key Properties: FileId, ProjectLevelId, Selected, Expired, Deleted
  - Key Commands: CreateBluePrint, DeleteBluePrint, ActivateBluePrint, DeactivateBluePrint
  - Key Events: BluePrintCreated, BluePrintDeleted, BluePrintActivated, BluePrintDeactivated, BluePrintRestored
  
- **ProjectLevel** (Aggregate<ProjectLevelStreamId>): Represents a building level/story
  - Key Properties: ProjectId, Description (name), ParentId, Deleted, HasBeenCreated
  - Key Commands: CreateProjectLevel, DeleteProjectLevel, RenameProjectLevel, ReorderProjectLevel, MoveProjectLevel
  - Key Events: ProjectLevelCreated, ProjectLevelDeleted, ProjectLevelRenamed, ProjectLevelMoved, ProjectLevelReordered

### Key Interfaces
- **IGeometryAggregateRepository**: Loads/saves BluePrint and ProjectLevel aggregates
  - InvokeBlueprint(...): Execute command on blueprint aggregate
  - InvokeProjectLevel(...): Execute command on project level aggregate
  
- **IBlueprintService**: Read-only blueprint queries
  - GetByProjectLevelIdWithFile(Guid? projectLevelId): Returns BluePrintDTO[] for a level
  
- **IBluePrintUploadHandler**: Blueprint file upload processing
  - Handles upload of blueprint files to Box and creation of BluePrint aggregate
  
- **IBlueprintRepository**: Persistence for Blueprint entity
  - Read/write Blueprint (EF Core entity)

### Events (Sample)
- BluePrintCreated, BluePrintDeleted, BluePrintDeleted_v2
- BluePrintActivated, BluePrintDeactivated
- BluePrintRestored
- ProjectLevelCreated, ProjectLevelDeleted, ProjectLevelDeleted_v2
- ProjectLevelRenamed, ProjectLevelMoved, ProjectLevelReordered

### Command Contracts
- **CreateBluePrint**: ProjectId, ProjectLevelId, FileId, AggregateId, ContextMetadata
- **DeleteBluePrint**: ProjectId, AggregateId, ContextMetadata
- **ActivateBluePrint**: AggregateId, ContextMetadata
- **DeactivateBluePrint**: AggregateId, ContextMetadata
- **CreateProjectLevel**: ProjectId, Name, ParentId, AggregateId, ContextMetadata
- **DeleteProjectLevel**: ProjectId, AggregateId, ContextMetadata
- **RenameProjectLevel**: OldDescription, Description, AggregateId, ContextMetadata

## Key Dependencies
- **Box Module**: BluePrints store file references to FileId (Box files). File upload/download/deletion is handled by Box. Geometry depends on Box for persistence.
- **EventStore**: Blueprints and ProjectLevels are event-sourced aggregates persisted in EventStore.
- **Tech.Domain**: Base Aggregate class, IApplyEvent interface, OperationResult types.
- **Construction Module** (inferred): ProjectLevels likely belong to construction projects and may be referenced by Construction aggregates.

## Known Gotchas
- **ProjectLevelId Optional for Blueprints**: A BluePrint can have ProjectLevelId == null, meaning it's not assigned to any level. Code querying blueprints by level must handle this case (null checks).
- **Event Versioning Complexity**: BluePrint and ProjectLevel use versioned events (v1, v2). Event replay must handle all versions. Watch for breaking changes in event structures.
- **Selection State Not Enforced**: The Selected flag on Blueprint is not enforced to be unique per ProjectLevel in the aggregate. Data integrity depends on application logic or database constraints.
- **Expiration vs. Deletion**: Expired and Deleted are separate flags. A blueprint can be Expired=true but Deleted=false (deactivated but recoverable), or Deleted=true (hard deleted). Logic must respect both flags.
- **ProjectLevel Hierarchy Integrity**: No explicit constraint preventing circular references (parent → child → parent). Application logic must validate moves to prevent cycles.
- **Blueprint File Orphans**: If a Box file is deleted but Blueprint.FileId still references it, no automatic cleanup happens. File references may be broken.
- **No Cascade on ProjectLevel Delete**: When a ProjectLevel is deleted, its blueprints are not automatically deleted. Cleanup must be handled separately, or blueprints remain orphaned.
- **Reorder/Move Empty Handling**: ReorderProjectLevel and MoveProjectLevel emit events but don't validate the new index/parent. Invalid indices may cause UI issues.

## Confluence Status
Unable to access Confluence pages (authentication required). Knowledge extracted from source code only.
