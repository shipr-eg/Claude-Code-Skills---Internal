# Ajour Codebase — Master Index

## Stack

### Backend
- **Framework**: .NET 8.0 (WebApplication.CreateBuilder)
- **Architecture Pattern**: Domain-Driven Design (DDD) with Event Sourcing (EventStore v23.3.8)
- **Command/Query Dispatch**: MediatR for command/query pattern (ICommandHandler, IQueryHandler)
- **Dependency Injection**: Autofac (builder.RegisterModule pattern) and Microsoft.Extensions.DependencyInjection
- **ORM / Data Access**: Dapper for some modules (Geometry, FacilityManagement); Event Sourcing via custom EventStore implementation for domain modules
- **Database**: SQL Server
- **Logging**: Serilog
- **Telemetry**: OpenTelemetry with Azure Monitor integration

### Frontend
- **Primary**: React + TypeScript (React 18+, Redux Toolkit for state management)
- **Legacy**: Aurelia framework (migration in progress; new code should be React)
- **UI Library**: Material-UI (@mui/material 7.3.0), FontAwesome icons
- **Data Table**: DataTables.net (legacy), TanStack React Table (@tanstack/react-table)
- **Build Tool**: Webpack
- **Dev Server**: npm dev server with proxy to backend (port 5001 proxies to 5002)
- **Additional Libraries**: 
  - Redux Toolkit (@reduxjs/toolkit)
  - React Redux
  - PDF Viewer (@pdftron/webviewer 10.10.0)
  - BIM Viewer (bim-fragment)
  - Image Cropping (cropperjs)
  - Charting (chart.js)
  - Bootstrap 3.4.1 (legacy styling)

### Key Libraries & Frameworks
- **EventStore**: Custom EventStore implementation (Ajour.Technical.EventStore)
- **Validation**: Custom NullGuard, validation utilities
- **Domain Base Classes**: Ajour.Tech.Domain (Aggregate, IApplyEvent)
- **Cross-Cutting**: Ajour.Tech.* (utilities, abstractions, configuration)
- **Testing**: NUnit, AutoFixture for test data, Moq for mock testing
- **File Handling**: Custom FileStorage implementations per module
- **Background Jobs**: Scheduled tasks via Ajour.Web.Scheduling
- **Feature Toggles**: Ajour.System.FeatureToggles, Ajour.System.DevelopmentToggles

## Module Map

| Module | Folder | Responsibility | Architecture |
|--------|--------|----------------|--------------|
| **Box** | `Box/src/Ajour.Box` | Document storage, file versioning, folder hierarchy, recycle bin | Event-Sourced DDD Aggregates (Folder, BoxFile) |
| **FacilityManagement** | `FacilityManagement/src/Ajour.FacilityManagement` | Building lifecycle, BD Cards (building component specs), maintenance, supplier tracking | Service-Based (IBDCardReadService, IBDCardWriteService) |
| **Geometry** | `Geometry/Ajour.Geometry` | Blueprints (2D CAD files), project level hierarchies | Event-Sourced DDD Aggregates (BluePrint, ProjectLevel) |
| **Tender** | `Tender/src/Ajour.Tender` | Bidding process, contracts, offers, material management, evaluation | Event-Sourced DDD Aggregates (Tender) with saga handlers |
| **Construction** | `Construction/src/Ajour.Construction` | Construction projects, phases, cost tracking | Event-Sourced DDD Aggregates |
| **UserOrganizations** | `UserOrganizations/` | Users, companies, permissions, access control (cross-cutting) | Service-Based with authorization checks |
| **System** | `System/src/Ajour.System` | Feature toggles, development toggles, system settings (cross-cutting) | Utility services |
| **Projects** | `Projects/src/Ajour.Projects` | Project lifecycle, metadata | Event-Sourced DDD Aggregates |
| **Frontend (ClientApp)** | `Ajour.Web/ClientApp/src` | React & Aurelia UI, areas per module (box, tender, FM, etc.) | React Components + Redux + Aurelia (legacy) |

## Cross-Cutting Patterns

### Error Handling
- **Exception Hierarchy**: Domain exceptions (e.g., FolderNameNotProvidedException, ProjectIdNotProvidedException) thrown at domain layer
- **Result Types**: `OperationResult`, `CommandResult<T>` used to wrap success/failure
- **Async Task Handling**: Commands use `async Task<CommandResult>` with CancellationToken support
- **Authorization Failures**: Return `BDCardAuthorizationResponse.Reject()` with reason

### Logging
- **Implementation**: Serilog with structured logging
- **Conventions**: Log at boundaries (handlers, services); domain logic avoids logging
- **Sensitive Data**: No passwords or tokens in logs

### Metadata and Audit Trail
- **ContextMetadata**: Passed with every command, includes UserId, IP, Timestamp for event audit
- **Event Sourcing Audit**: All state changes captured as immutable events
- **BD Card Logging**: BDCardLogEvent/IBDCardLogWriteService for detailed change tracking
- **Access Logging**: Module-specific access logging (Ajour.Box.AccessLogging)

### Authentication & Authorization
- **Protocol**: OpenID Connect + JWT Bearer tokens
- **Validation**: [Authenticated] attribute on protected endpoints; [AllowAnonymous] for public
- **Current User**: ICurrentUserProvider interface; context.User for identity
- **Role/Permission Checks**: 
  - UserOrganizations module defines PermissionNames (e.g., BPDEditOthers, BPDEditResponsibleOrCreatedByOpen)
  - Authorization services check user scope (FMUserAccessScope) against required permissions
  - Cascade rules: creator/responsible can edit open cards; permissions control closed card edits

### Shared Data Transfer Objects (DTOs)
- **Domain Contracts**: Each module has `*.Contracts` project with Commands, Events, DTOs
- **Box Contracts**: ProjectRootFolderAdded, FolderCreated, FileAttachedToFolder, etc.
- **Tender Contracts**: CreateTender, AddContract, MakeOffer, SetAssignmentCriteria, etc.
- **Geometry Contracts**: CreateBluePrint, CreateProjectLevel, ActivateBluePrint, etc.
- **No Circular Dependencies**: Module contracts reference Tech.Domain only; modules reference other modules' contracts but not implementations

### Dependency Resolution
- **Constructor Injection**: All services injected via constructor
- **Autofac Modules**: Each domain module (Box, Tender, Geometry, FM) defines Autofac registration module
- **Startup Registration**: Ajour.Web.Composition registers all modules
- **Connection Strings**: IConnectionStringProvider abstraction; environment-specific in appsettings

### Database Patterns
- **EventStore**: Custom implementation stores events, replayed to rebuild aggregate state
- **Projections**: Read models derived from event streams (DiskUsageReadService, AjourBoxProjection, etc.)
- **Migrations**: Custom patch system (Ajour.Init/Migration/Patches/) rather than EF migrations
- **Metadata Tables**: SQL metadata classes marked with [MetadataForContext(Context.Ajour)]

### File Storage
- **Box FileStorage**: Stores binary files on disk; FileId tracks location
- **Module-Specific**: Geometry.FileStorage, Construction.FileStorage, FM.FileStorage for module-specific file handling
- **Interfaces**: IFileProvider, IFileWriter for abstraction

### Testing Patterns
- **Unit Tests**: Focus on domain logic; aggregates tested in isolation
- **BDD Style**: Arrange/Act/Assert with AutoFixture for data generation
- **Integration Tests**: Hit real database or EventStore
- **Event Replay**: Events replayed to verify aggregate state rebuilds correctly
- **Mocking**: Avoid mocking persistence layer; use real EventStore or test database

## Inter-Module Dependencies

```
                        ┌─────────────────┐
                        │  UserOrganizations │ ← All modules depend
                        │  (cross-cutting)  │
                        └──────────────────┘
                                 ↑
                    ┌────┬──────┴──────┬──────┐
                    ↓    ↓             ↓      ↓
                 ┌──────┐          ┌────────┐ ┌────────────┐
                 │ Box  │          │Tender  │ │FacilityMgmt│
                 └──────┘          └────────┘ └────────────┘
                    ↑                  ↑           ↑
                    │ (stores files)   │           │ (stores docs)
                    │                  │           │
               ┌────┴──────────────────┴───────────┘
               │
               │ (TenderRootFolder)
               │
         ┌─────────┐
         │ Tender  │
         └─────────┘
             ↑
             │ (imports Box TenderRootFolder)
             │
         ┌──────────┐
         │Geometry  │
         │Blueprints│
         └──────────┘
             ↑
             │ (stores files in Box)
             │
         ┌────────────┐
         │Construction│
         └────────────┘
             ↑
             │ (references projects)
             │
         ┌──────────┐
         │ Projects │
         └──────────┘
```

### Module Relationships
- **Box ← All**: Tender, Geometry, Construction, FM all store files/documents in Box
- **Tender → Box**: Creates TenderRootFolder in Box for material/bidding documents
- **Geometry → Box**: Stores blueprint files referenced by BluePrint aggregate
- **FacilityManagement → Box**: Stores building component documents, attachments
- **All → UserOrganizations**: User/company IDs, permissions, access control
- **All → System**: Feature toggles, development toggles for feature gating
- **Construction → Projects**: Construction projects relate to general projects

## Confluence Index

| Module | Confluence Page | Status | Last Verified |
|--------|----------------|--------|--------------|
| Box | https://confluence.eg.dk/spaces/AJB/pages/393488008/Ajour+-+Box+Code+walkthrough+and+Architectural+Review | Access Denied | 2026-04-09 |
| FacilityManagement | https://confluence.eg.dk/spaces/AJB/pages/400132233/Ajour+-+FM+Code+Walkthrough | Access Denied | 2026-04-09 |
| Geometry | https://confluence.eg.dk/spaces/AJB/pages/400153352/Ajour+Inspect+QA+-+Code+walkthrough+and+Architectural+Review | Access Denied | 2026-04-09 |
| Tender | https://confluence.eg.dk/spaces/AJB/pages/403803301/Ajour+-+Tender+-+Code+Walkthrough+Architecture+Review | Access Denied | 2026-04-09 |


## How to Use This Knowledge Base

### For Code Review / Implementation Tasks

1. **Start Here**: Read this CODEBASE.md to understand the module map and cross-cutting patterns
2. **Load Module Context**: Read the relevant module's `knowledge.md` to understand:
   - Architecture decisions and why they were made
   - Domain rules enforced in the module
   - Public contracts (aggregates, commands, events, interfaces)
   - Dependencies on other modules
3. **Review Patterns**: Read the module's `patterns.md` to:
   - See canonical examples of correct implementations
   - Identify anti-patterns to flag during code review
   - Understand naming conventions
4. **Verify Contracts**: When touching cross-module boundaries, check both modules' contract definitions
5. **Audit Event Sourcing**: For event-sourced modules (Box, Geometry, Tender, Projects), verify:
   - All state changes emit events (no direct property sets)
   - Events are immutable (no setters)
   - Apply methods rebuild state from events
   - Event versions are handled for backward compatibility

### For Module Integration

1. **Check Dependencies**: Review "Key Dependencies" in the module's knowledge.md
2. **Validate Contracts**: Ensure commands and events are defined in the module's Contracts project
3. **Authorization**: Check if the module requires user authorization checks (FacilityManagement does; Box enforces at endpoint level)
4. **File Storage**: If storing files, integrate with module-specific FileStorage (Box, Geometry, FM each have their own)

### For Cross-Module Communication

1. **Use Contracts, Not Implementations**: Import from `Ajour.<Module>.Contracts`, never internal modules
2. **Event Sourcing Boundary**: If receiving events from another module, consume via event handlers in Sagas or Projections
3. **Service Abstraction**: Call other modules via defined service interfaces, not direct aggregate access
4. **Transaction Scope**: Be aware of transaction boundaries—commands are atomic; events eventually consistent

## Structure

This knowledge base is organized as follows:

```
.knowledge/
├── CODEBASE.md                      ← You are here
├── Box/
│   ├── knowledge.md                 ← Purpose, decisions, rules, contracts
│   └── patterns.md                  ← Examples, anti-patterns, naming
├── FacilityManagement/
│   ├── knowledge.md
│   └── patterns.md
├── Geometry/
│   ├── knowledge.md
│   └── patterns.md
└── Tender/
    ├── knowledge.md
    └── patterns.md
```

Each module's `knowledge.md` contains domain knowledge, architecture decisions, and business rules. Each `patterns.md` contains code patterns, best practices, and anti-patterns specific to that module.

## Coverage Note

This knowledge base covers the 4 main domain modules of the Ajour system:
- **Box** (document storage)
- **FacilityManagement** (building lifecycle)
- **Geometry** (blueprints)
- **Tender** (bidding process)

Additional modules exist (Construction, Projects, UserOrganizations, System) but are not detailed here. UserOrganizations and System are documented as dependencies because they are cross-cutting. Construction and Projects follow similar event-sourcing patterns as the 4 main modules.
