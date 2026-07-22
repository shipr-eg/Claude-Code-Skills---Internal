# Ajour Knowledge Base Mapping for Test Case Generation

**Knowledge Base:** https://confluence.eg.dk/spaces/AJB/pages/393478390/Ajour+-+Solution+Knowledge+Base+KC

## Overview

The Ajour Knowledge Base contains **40 pages** organized into 9 categories:

```
📚 Ajour Solution Knowledge Base
│
├── 🎯 Product & Overview (6 pages)
│   ├── Ajour - Product Overview
│   ├── Ajour - Product Usecase
│   ├── Ajour - Product Functionality
│   ├── Overview of Process
│   ├── Overview of Tools used
│   └── EG - Construction Domain
│
├── 🏗️  Modules & Architecture (11 pages)
│   ├── ⭐ Ajour - Box Code walkthrough (AjourBox/Files/Folders)
│   ├── Ajour Inspect & QA - Code walkthrough
│   ├── Ajour - BIM Viewer - Code Walkthrough
│   ├── Ajour - Tender - Code Walkthrough
│   ├── Ajour - FM Code Walkthrough
│   ├── Ajour - Converter Service - Code walkthrough
│   ├── Ajour Administration - Code walkthrough
│   ├── Ajour - Hub
│   ├── Ajour App
│   ├── Ajour - AppSite
│   └── Ajour - Architecture (Overall)
│
├── ⚙️  Setup & Configuration (4 pages)
│   ├── Ajour - Installation and Setup Guide
│   ├── Ajour - Production Setup
│   ├── Ajour - Troubleshooting - Development
│   └── Ajour - Support setting
│
├── 🗄️  Database & Data (2 pages)
│   ├── Ajour - DataBase and Relationship Review
│   └── Ajour - Event Store Documentation
│
├── 📋 Features & Domain (4 pages)
│   ├── Ajour File System - Detailed Walkthrough
│   ├── Ajour - Recycle Bin
│   ├── Ajour - Document compare and Link feature - Apryse
│   └── Domain Knowledge Documents
│
├── 🧪 Testing & Quality (3 pages)
│   ├── Ajour - Architecture of Testing Framework
│   ├── Ajour - Unit Test Framework
│   └── Overview of Security Scans
│
├── 🔨 Build & Release (4 pages)
│   ├── Ajour - Web build
│   ├── Release Process Overview
│   ├── Ajour - Deployment Architecture
│   └── Ajour - Technical Debt
│
├── 📈 Processes & Workflows (3 pages)
│   ├── Overview of Customer Issue Workflow
│   ├── Ajour Q&A
│   └── Introduction to Stakeholders
│
└── 🎨 UI/UX & Assets (2 pages)
    ├── Instances of legacy EG logo (WEB)
    └── Instances of legacy EG logo (APP)
```

## Quick Reference: Ticket Type → KB Pages

### For AjourBox/Files/Folders Tickets (AJB-*)
```
🔍 Search: "box", "files", "folders", "project", "AjourBox"
📄 Primary Page: Ajour - Box Code walkthrough (ID: 393488008)
📄 Secondary: Ajour File System - Detailed Walkthrough (ID: 403815733)
📄 Related: Ajour - Recycle Bin (ID: 499921637)
```

### For Feature/Module Tickets
```
🔍 Search: Module name (BIM, Tender, FM, Inspect, Admin, etc.)
📄 Pages: Find corresponding module walkthrough
   - BIM Viewer → ID: 397640539
   - Tender → ID: 403803301
   - FM → ID: 400132233
   - Inspect & QA → ID: 400153352
   - Administration → ID: 400625304
```

### For Database/Schema Tickets
```
🔍 Search: "database", "schema", "relationship", "entity"
📄 Primary: Ajour - DataBase and Relationship Review (ID: 393488570)
📄 Related: Ajour - Event Store Documentation (ID: 434145514)
```

### For API/Integration Tickets
```
🔍 Search: "api", "converter", "integration", "service"
📄 Primary: Ajour - Converter Service (ID: 400140889)
```

### For Testing/QA Tickets
```
🔍 Search: "test", "framework", "automation", "quality"
📄 Pages:
   - Ajour - Architecture of Testing Framework (ID: 390904409)
   - Ajour - Unit Test Framework (ID: 393482710)
   - Overview of Security Scans (ID: 390903075)
```

### For Setup/Installation Tickets
```
🔍 Search: "setup", "install", "configuration", "environment"
📄 Pages:
   - Ajour - Installation and Setup Guide (ID: 390899452)
   - Ajour - Production Setup (ID: 400132794)
   - Ajour - Troubleshooting - Development (ID: 390899499)
```

### For Build/Release Tickets
```
🔍 Search: "build", "release", "deployment", "process"
📄 Pages:
   - Ajour - Web build (ID: 400154272)
   - Release Process Overview (ID: 400150963)
```

## How /create-testcases Skill Uses KB

### Phase 1 (Jira-only)
1. Extract ticket summary and component
2. Search KB with primary keywords
3. Find relevant specification pages
4. Extract feature specs and procedures
5. Include KB references in test cases

### Phase 2 (Jira + Git)
1. All Phase 1 steps, PLUS:
2. Map git implementation changes to KB specifications
3. Validate test scenarios against KB documented procedures
4. Extract boundary values and constraints from KB
5. Reference KB specs in test case expected results

## Most Frequently Used KB Pages for Test Generation

| Rank | Page | ID | Relevance |
|------|------|-----|-----------|
| 1️⃣ | Ajour - Box Code walkthrough | 393488008 | AjourBox (Files, Folders, Projects) |
| 2️⃣ | Ajour File System | 403815733 | File operations and storage |
| 3️⃣ | Ajour - DataBase and Relationship | 393488570 | Data constraints and relationships |
| 4️⃣ | Ajour - Recycle Bin | 499921637 | Delete/restore operations |
| 5️⃣ | Ajour - Architecture of Testing | 390904409 | Test patterns and approaches |

## Example: Using KB in Test Case Generation

**Scenario:** Generating test cases for AJB-14080 (Project selector dropdown width)

```
1. Extract Ticket: "Project selector dropdown too wide with long names"
2. Search KB: "project selector", "dropdown", "box"
3. Find: Ajour - Box Code walkthrough (ID: 393488008)
4. Extract Specs:
   - Dropdown width constraints
   - Long project name handling
   - UI layout specifications
5. Generate Test Cases:
   ✓ Test with short project name (< 20 chars)
   ✓ Test with long project name (> 50 chars)
   ✓ Verify dropdown doesn't exceed screen width (per KB spec)
   ✓ Test with maximum width project names
6. Include in Output:
   - Reference: "Per Ajour - Box Code walkthrough specs..."
   - KB URL: https://confluence.eg.dk/pages/viewpage.action?pageId=393488008
```

## Integration Points

### In SKILL.md
- **Phase 1 Step A4b:** "Reference Knowledge Base Pages (Jira-only)"
- **Phase 2 Step 4b:** "Reference Knowledge Base Pages (Full context)"

### In Test Case Output
- Knowledge Base references in functional understanding section
- KB page URLs in test case metadata
- KB specifications in preconditions and expected results

### In Zephyr Upload
- KB page URLs stored in test case comments
- KB specifications included in test objective descriptions
- Traceability link: Test Case → KB Page → Implementation

## Configuration for Skill

The skill uses these Confluence MCP tools:
- `confluence_search` — Find KB pages by keywords
- `confluence_get_page` — Extract page content and specifications

**Search Strategy:**
1. Primary search: Ticket summary keywords
2. Secondary search: Jira component name
3. Tertiary search: Feature area from git commits (Phase 2)

---

**Last Updated:** 2026-05-18
**Total KB Pages:** 40
**Categories:** 9
**Most Used:** Ajour - Box Code walkthrough (AjourBox/Files/Folders)
