# Box — Knowledge Base

## Purpose
Box manages document storage, folder hierarchies, and file lifecycles for projects. It is the central document repository for the Ajour system, supporting file uploads, versioning, folder organization (project/system/tender level), folder locking, company assignments, and the recycle bin. Box handles both direct file management and integration with other modules (Tender, FacilityManagement) that store documents in Box-managed structures.

## Architecture Decisions
- **Event Sourcing**: All state changes (folder creation, deletion, file attachment, locking) are captured as domain events in EventStore v23.3.8. State is rebuilt by replaying events. [CODE]
- **Aggregate Pattern**: Folder and BoxFile are event-sourced aggregates. Each aggregate is loaded, modified via command handlers, and events are emitted and stored. [CODE]
- **Multi-Root Folder Types**: Supports three root folder types (ProjectRootFolder, SystemRootFolder, TenderRootFolder) with different ownership and lifecycle rules. Root folders cannot have parents. [CODE]
- **Folder Locking**: Folders can be locked and unlocked, with option to cascade to subfolders. Locked state affects permission and UI visibility. [CODE]
- **Company Assignment**: Folders (except root) can be assigned to companies, controlling access. Assignments track whether they apply to the folder only or cascade to subfolders. [CODE]
- **File Versioning**: Files support multiple revisions/versions with independent metadata (description, revision name) per revision. Newest revision is tracked. [CODE]
- **Folder as Container**: Folders maintain lists of FilesInFolder and Subfolders as collections. Relations are managed via FileAttachedToFolder/FileDetachedFromFolder events. [CODE]
- **Projection-Based Reads**: Aggregates are event-sourced for writes; projections (AjourBoxProjection, FolderContentProvider) provide optimized read models for queries. [CODE]
- **Copy/Template Processes**: Folder copy and template creation emit FolderCreatedFromCopy/FolderCreatedFromTemplate events to track lineage. [CODE]
- **Recycle Bin**: Deleted files/folders are soft-deleted (Deleted flag), supporting restore operations. PermanentlyDeleted flag distinguishes soft vs. hard delete. [CODE]
- **Admin-Only/Public States**: Folders can be marked as admin-only (closed) or public, controlling visibility. IsClosed flag tracks this state. [CODE]

## Domain / Business Rules
- **Root Folder Invariant**: A folder with no parent (ParentId == null) is a root folder. Root folders cannot have a parent assigned and serve as entry points for project/system/tender hierarchies. [CODE]
- **Folder Naming**: Folder names are required (non-null/empty), max 250 characters. Name validation is performed at domain level (FolderNameNotProvidedException, FolderNameToLongException). [CODE]
- **Company Assignment to Root**: Cannot assign companies to root folders; CannotAssignCompanyToRootFolder exception is thrown. [CODE]
- **File Attachment**: Files can only be attached to folders if they are not already attached (idempotent operation). FileAttachedToFolder tracks the reason (Created, Moved, FromCopy, Restored). [CODE]
- **Subfolder Attachment**: Subfolders can only be attached if not already present. SubFolderAttachedToFolder/SubFolderDetachedFromFolder manage hierarchy. [CODE]
- **Folder Deletion**: Only non-root folders with a ParentId can be deleted. Root folders remain permanent (though they can be marked as deleted). [CODE]
- **File Status Tracking**: Files track status (BinaryFileName, MimeType, Size, LogicalFileName, Status enum). Deleted files are soft-deleted and can be restored. [CODE]
- **Revision Tracking**: Each file version (revision) has a unique RevisionId. FileRevisionTracker maps revision IDs to file revision IDs for version history. [CODE]
- **Project ID Association**: Project folders and system folders are treated differently. System folders have ProjectId == null. [CODE]
- **Folder Movement**: Folders can be reordered within their parent (ReorderFolder) or moved to a different parent (MoveFolder with NewParentId). [CODE]
- **Download Request**: Folders can request downloads via RequestDownloadFolder command, emitting DownloadFolderRequested event (likely triggering background zip process). [CODE]

## Public Contracts
### Core Aggregates
- **Folder** (Aggregate<FolderStreamId>): Manages folder state, children, file attachments, locking, company assignments, deletion
  - Key Properties: FilesInFolder, Subfolders, ParentId, Name, ProjectId, IsClosed, Locked, Deleted, AssignedCompanies
  - Key Commands: AddProjectRootFolder, CreateProjectFolder, CreateSystemFolder, RemoveFolder, MoveFolder, RenameFolder, LockFolder, UnlockFolder, AssignCompanyToFolder
  
- **BoxFile** (Aggregate<FileStreamId>): Manages file state, revisions, descriptions, versioning, deletion
  - Key Properties: BinaryFileName, LogicalFileName, NewestRevisionId, Size, MimeType, Status, Deleted, PermanentlyDeleted, RevisionDesciptions, RevisionNames
  - Key Commands: AddNewFileToProject, AddNewFileToSystem, DeleteFile, RenameFile, CreateNewVersion, RestoreFile

### Key Interfaces
- **IAjourBoxAggregateRepository**: Loads/saves Folder and BoxFile aggregates
- **IAjourBoxFolderReadService**: Read operations on folder tree, contents, permissions
- **IAjourBoxFileApiReadService**: Read operations on file metadata, revisions
- **IAjourBoxFolderTreeSearcher**: Search and filter folders by name, type, status
- **IAjourBoxCopyProcess**: Folder copy operations
- **IAjourBoxProjectFoldersWrite**: Write operations on project-level folders

### Events (Sample)
- ProjectRootFolderAdded, SystemRootFolderAdded, TenderRootFolderAdded
- FolderCreated, FolderRemoved, FolderRenamed, FolderMoved, FolderReordered
- FileAttachedToFolder, FileDetachedFromFolder, SubFolderAttachedToFolder, SubFolderDetachedFromFolder
- FolderLocked, FolderUnlocked
- CompanyAssignedToFolder, CompanyUnassignedFromFolder
- NewFileAddedToProject, FileDeleted, FileRenamed, NewVersionOfFileCreated

## Key Dependencies
- **Tender Module**: Box exposes folder hierarchies that Tender uses for bidding documents. Tender creates TenderRootFolder in Box via AddTenderRootFolder command.
- **FacilityManagement Module**: FM may store building/facility documents in Box folders.
- **UserOrganizations Module**: Company assignments rely on company IDs from UserOrganizations context.
- **EventStore**: All aggregates use EventStore for event persistence.
- **Tech.Domain**: Base Aggregate class, IApplyEvent interface, OperationResult, CommandResult types.

## Known Gotchas
- **Soft Delete with Recycle Bin**: Deleted flag marks soft deletion. PermanentlyDeleted is a separate flag. A folder can be Deleted == true but PermanentlyDeleted == false (in recycle bin). Ensure cleanup logic distinguishes between the two.
- **Idempotent Attachment**: FileAttachedToFolder and SubFolderAttachedToFolder silently succeed if the relation already exists. Code that depends on attachment can be called repeatedly without side effects.
- **Root Folder Special Handling**: Root folders never have a ParentId. Business logic must check `ParentId.HasValue == false` or similar to identify roots. RemoveFolder throws InvalidOperationException if no ParentId.
- **Event Versioning**: BoxFile has multiple event versions (NewFileAddedToProject, NewFileAddedToProject_v2, NewFileAddedToProject_v3). Replay logic must handle all versions for backward compatibility.
- **Folder Name Length Validation**: Enforced at domain level (250 char limit). UI may have its own validation; domain validation is the source of truth.
- **Company Assignment Cascade**: AssignCompanyToFolder has a SingleFolderOnly flag. When false, the assignment may apply to subfolders. Logic calling this must be aware of cascade semantics.
- **Deleted Folder Behavior**: If a folder is soft-deleted (Deleted == true), it may still be in projections/caches. Always check Deleted flag when querying or displaying folders.
- **Projection Lag**: Event-sourced aggregates may not be immediately visible in read-model projections (DiskUsageReadService, FolderContentProvider). Plan for eventual consistency in UI.

## Confluence Status
Unable to access Confluence pages (authentication required). Knowledge extracted from source code only.
