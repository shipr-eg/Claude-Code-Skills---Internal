# Tender — Knowledge Base

## Purpose
Tender manages the bidding process for construction projects. A tender is a formal solicitation for proposals/bids on work or supplies. Tender handles the complete lifecycle: creation, invitation of companies to bid, material management (folders for bidding documents stored in Box), offer submission, offer evaluation, and awarding. Core entities include Tender (main aggregate), Contracts (work packages within a tender), OfferLists (evaluation criteria), and Offers (bids from companies). Tender integrates with Box for material storage and with UserOrganizations for company/user management.

## Architecture Decisions
- **Event Sourcing**: Tender uses event sourcing with TenderCommandHandler dispatching to Tender aggregate. Events are persisted and state rebuilt via event replay. [CODE]
- **Tender as Root Aggregate**: Tender is the main aggregate, containing Contracts, OfferLists, and Offers as nested structures. Complex state machine with multiple status transitions. [CODE]
- **Contract Hierarchy**: Contracts form a tree structure (Contract contains ContractComponents) supporting nested work packages. ContractComponent is the abstract base. [CODE]
- **OfferList and Evaluation**: OfferLists represent evaluation criteria/sections. Each OfferList contains OfferListItems. Offers map to OfferListItems. [CODE]
- **Material Folder Structure**: Tender creates a material folder in Box (TenderRootFolder) for storing tender documents. Material management via TenderMaterialCommandHandler. [CODE]
- **Assignment Criteria**: Tender can define assignment criteria (evaluation weighting) that guide offer selection. [CODE]
- **Selection Criteria**: Selection criteria define how offers are evaluated and winners selected. [CODE]
- **Company Participation**: Companies are invited to make offers on specific contracts. Participation is tracked via events. [CODE]
- **Status and Workflow**: Tender has status transitions (Created → Active → Approved/Rejected/Closed). Deadlines for questions, answers, and offers control workflow. [CODE]
- **External Integration**: Tender can have external provider URLs, contact person details, and external notificationhandling. [CODE]
- **Multi-Role Support**: Tender tracks users, companies, and their roles (creator, evaluator, participant). Authorization likely depends on these roles. [CODE]

## Domain / Business Rules
- **Tender Creation**: CreateTender command requires ProjectId, Name, CreatedByUserId, EnableVisiblePrices flag. [CODE]
- **Activation Workflow**: Tender must be activated (ActivateTender) before offers can be submitted. Status transitions are controlled (Create → Activate → Approve/Close). [CODE]
- **Deadline Constraints**: SetTenderDeadlineQuestionsAndAswers and SetTenderDeadlineForOffers control when Q&A and offers close. Deadline changes trigger notifications. [CODE]
- **Offer Submission**: MakeOffer requires offer to conform to OfferList/OfferListItem structure. Offers cannot be submitted after deadline. [CODE]
- **Contract-Based Offers**: Companies can only make offers on contracts they've been invited to (InviteCompanyToMakeAnOfferOnContract). [CODE]
- **Currency and VAT**: Tender can set currency (SetCurrency), and VAT inclusion (SetPricesToIncludeVat/SetPricesToExcludeVat). [CODE]
- **Tender Number and Image**: Tender can have a number (SetTenderNumber) and image (SetTenderImage) for identification. [CODE]
- **Selection Results**: SaveContractSelectionResult records winner determination. Results can be sent to participants (SendResultListToTenderParticipants). [CODE]
- **Tender Closure**: CloseTender finalizes a tender. CancelTender cancels it. RejectTender and ReopenTender allow state changes. [CODE]
- **Material Archive**: Tender can request download of material folder (RequestDownloadMaterialFolder), likely triggering zip creation in background. [CODE]
- **Visibility Control**: EnableTenderInAjourBox/DisableTenderInAjourBox controls whether tender is visible in document box. [CODE]

## Public Contracts
### Core Aggregates
- **Tender** (Aggregate<TenderId>): Main aggregate representing a tender/bidding process
  - Key Properties: TenderId, ProjectId, Name, Description, CreatedByUserId, Status, Currency, TenderForm, TenderType
  - Key Nested: Contracts (tree of work packages), OfferLists, Offers, Questions/Answers
  - Key Commands: CreateTender, ActivateTender, RenameTender, ApproveTender, ArchiveTender, CancelTender, CloseTender
  
- **Contract**: Work package within tender, can be nested
  - Extends ContractComponent
  - Properties: Id, Name, ParentId, ContractComponents (nested), UserIds, CompanyIds
  - Methods: Add/Remove components, Add/Remove users/companies, GetOfferListIds, ClearAllOffers
  
- **ContractComponent**: Abstract base for Contract and potentially other component types
  - Properties: Id, Name, ParentId, UserIds, CompanyIds
  - Methods: Add/Remove/Get components, Get all users, Get offers
  
- **OfferList**: Evaluation criteria section within a tender
  - Contains OfferListItems (the actual offer lines)
  - Supports ClearAllOffers
  
- **Offer**: A company's bid on specific contract/offer list items
  - Links to company, contract, OfferListItem
  - Can be cancelled, revised, or rejected

### Key Interfaces
- **ITenderTransaction**: Transaction wrapper for tender commands
  - Invoke(...): Execute command on tender, persist events
  
- **ITenderZipRequestHandler**: ZIP file generation for material downloads
  - Handle tender material download requests
  
- **Tender Read Services**: Projections for querying tender state
  - FindTenderById, GetTendersByProjectId, etc.

### Commands (Comprehensive)
- **Tender Lifecycle**: CreateTender, ActivateTender, ApproveTender, ArchiveTender, CancelTender, CloseTender, RejectTender, ReopenTender, ResumeTender
- **Tender Properties**: RenameTender, SetTenderNumber, SetTenderImage, ChangeTenderDescription, SetTenderType, ResetTenderType, SetTenderForm, ResetTenderForm
- **Dates/Deadlines**: SetTenderStart, SetTenderDeadlineQuestionsAndAswers, SetTenderDeadlineForOffers, RequestNotifyUsersOnTenderDeadlineHasChanged
- **Pricing**: SetPricesToIncludeVat, SetPricesToExcludeVat, EnableVisiblePricesOnTender, DisableVisiblePricesOnTender, SetCurrency
- **Evaluation**: SetAssignmentCriteria, ResetAssignmentCriteria, SetSelectionCriterias
- **Contracts**: AddContract, RenameContractComponent, DeleteContract
- **Company Participation**: InviteCompanyToMakeAnOfferOnContract, InviteCompanyToRejectOfferOnContract, RemoveCompanyFromContract, ConfirmTenderCompanyParticipation, RejectTenderUserParticipation
- **Users**: ReplaceUserOnContractComponent, RemoveUserFromContractComponent, InviteUserToTender, DeleteInvitedUserFromTender
- **Offers**: AddOfferList, RemoveOfferList, AddOfferListItem, RemoveOfferListItem, MakeOffer, CancelOffer, RemoveOfferAppendix, AddOfferAppendix, SaveContractSelectionResult
- **Material**: RequestDownloadMaterialFolder, EnableTenderInAjourBox, DisableTenderInAjourBox
- **External**: SetTenderExternalUrl, SetTenderProvider, SetTenderContactPersonDetails
- **Communication**: AskQuestionOnTender, AnswerQuestionsOnTender, SendResultListToTenderParticipants, SendUploadOfferConfirmation, AddRevisedPage

### Events (Sample)
- TenderCreated, TenderActivated, TenderApproved, TenderCancelled, TenderClosed, TenderArchived
- TenderRenamed, TenderDescriptionChanged, TenderNumberSet, TenderImageSet
- ContractAdded, ContractComponentRenamed, ContractDeleted
- OfferListAdded, OfferListRemoved, OfferListItemAdded, OfferListItemRemoved
- OfferMade, OfferCancelled, OfferAppendixAdded, OfferAppendixRemoved
- CompanyInvitedToMakeAnOfferOnContract, CompanyRemovedFromContract
- AssignmentCriteriaSet, SelectionCriteriaSet
- TenderQuestionAsked, TenderQuestionAnswered
- ContractSelectionResultSaved

## Key Dependencies
- **Box Module**: Tender creates TenderRootFolder in Box for material storage. Stores bidding documents in Box-managed folder hierarchy.
- **UserOrganizations Module**: User/company IDs, permissions, and company participation tracking depend on UserOrganizations module.
- **Construction Module** (inferred): Tenders are likely associated with construction projects.
- **EventStore**: Tender aggregate is event-sourced, persisted in EventStore.
- **Email/Notifications**: Tender sends notifications to participants, companies, and evaluators (via background job likely).

## Known Gotchas
- **Complex State Machine**: Tender has many status transitions. Not all transitions are valid. Code using Tender must respect status constraints (e.g., cannot activate an already-closed tender).
- **Nested Contract Hierarchy**: Contracts form a tree. GetComponent(id) requires tree traversal. Circular references are possible if validation is insufficient.
- **OfferList and OfferListItem Coupling**: Offers reference OfferListItems. Deleting an OfferListItem may orphan offers. Cascade behavior must be explicit.
- **Company Participation Double-Booking**: InviteCompanyToMakeAnOfferOnContract doesn't prevent re-inviting same company to same contract. Data may have duplicates requiring deduplication logic.
- **Deadline Past Handling**: No evidence of prevention of past deadlines. Setting deadline to a past date may confuse business logic. Validation should prevent this.
- **Material Folder Isolation**: Material folder is stored in Box as TenderRootFolder. If the folder is deleted independently in Box, Tender still references it (orphaned). Cross-module cleanup must be coordinated.
- **Offer Cancellation Implications**: CancelOffer doesn't cascade to related offer appendices or evaluation results. Partial cancellations may leave inconsistent state.
- **Selection Result Auditing**: SaveContractSelectionResult records winners. No evidence of immutability or audit trail for changing results. Changing winners after announcement may not be logged properly.
- **External URL and Provider Flexibility**: SetTenderExternalUrl and SetTenderProvider allow arbitrary external integration. No validation of URL format or provider existence. Invalid references may break integrations.
- **Notification and Email Failure Handling**: Commands like SendResultListToTenderParticipants trigger background jobs. No retry logic visible; failed notifications may be silent.

## Confluence Status
Unable to access Confluence pages (authentication required). Knowledge extracted from source code only.
