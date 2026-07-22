# EG Ajour – System Hierarchy, Users, Roles & Licenses
 
## Tenancy model: the "System"
 
Each customer gets a **system** — an isolated tenant portal with:
- Its own subdomain (e.g. `customer.ajoursystem.net`)
- Its own database (on a shared DB server)
- Fully separated file storage
There is always a **1-to-1 relationship** between a customer (company) and a system. A system is the top-level container for everything: projects, users, and all module data.
 
## Data hierarchy
 
```
System (tenant)
└── Projects
    ├── AjourInspect & AjourQA registrations
    ├── AjourBox files, blueprints, and folders
    └── AjourFM data (BE-cards, operation plans)
```
 
All modules are project-scoped. Projects are fully isolated within their system and cannot span systems.
 
## Users
 
- Users are **created at the system level** and then given access to individual projects.
- A real person can have **separate user accounts on multiple systems** — each with separate credentials. There is no global identity linking them.
- **AjourID** is an in-progress initiative to introduce global login and SSO across systems. It is not in production and should be treated as a sidenote only.
### External users (subcontractors)
 
A user from another company (e.g. a subcontractor) is **invited by the System Administrator** of the host system. Once added, they either:
- Are assigned one of the host system's licenses, or
- Use the **shared license** feature, where a system lends a license from their own pool to a user on another system.
Shared licenses are not commonly used in practice.
 
## Roles
 
Roles are **predefined by EG** — customers cannot create or rename them. A role is a label with a default set of permissions attached. There are 8 roles:
 
| Level | Role name | Key access |
|---|---|---|
| 1 | System Administrator | All modules + Administration module. Full permissions. Manages the whole system. |
| 2 | Project Administrator | All modules + Administration module. Manages projects and users on their own projects. |
| 3 | Project Manager | AjourInspect+QA, AjourBox, AjourFM. Full project access, cannot edit/delete other companies' content. |
| 4 | Project Assistant | AjourBox and AjourFM at assistant level; AjourInspect+QA at user level. |
| 5 | User | AjourInspect+QA (own/assigned registrations only), AjourBox (assigned + public folders), AjourFM. |
| 6 | Observer | Read-only access to Inspect+QA, AjourBox, and AjourFM. |
| 7 | AjourBox User | AjourBox only. |
| 8 | AjourTender User | AjourTender only (participation in tenders). |
 
**Note:** "Sysadmin" is a separate internal EG employee role used for customer support access. It is not part of the standard role set above.
 
## Permissions
 
- Each user has **one assigned role**, which sets a default permission profile.
- Permissions are **fully customizable per user** via a tree-based checkbox structure in the Administration module. The role is just a starting point — individual permissions can be enabled or disabled freely.
- Permissions exist at both **system level** and **project level**, and can differ per project for the same user.
- A role standard can be applied or reset at any time ("Select role standard").
- It is possible to clone another user's permission set.
**Key implication:** A user's assigned role name does not guarantee their actual access. Always refer to their specific permission configuration.
 
## Licenses
 
Licenses are assigned **per user** and control whether a user can create registrations. They are independent from roles.
 
| License | Cost | Can create Inspect registrations | Can create QA registrations | Other access |
|---|---|---|---|---|
| C | Free | No | No | AjourBox, AjourFM, AjourTender, view + respond to registrations |
| B | Paid | No | Yes | AjourBox, AjourFM, AjourTender, view + respond to registrations |
| A | Paid | Yes | Yes | Full access to all modules |
 
- A- and B-licenses are **assigned to one user at a time**, but can be moved between users by the customer's user administrator.
- C-licenses are free and unlimited — commonly used for external participants (e.g. subcontractors) who only need to view and respond.