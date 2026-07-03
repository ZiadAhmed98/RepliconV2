# MDS Premium Dashboard
## Technical Architecture & System Documentation
### Version 2.0.0 — June 2026
### Confidential — Midis Services

---

> **How to convert to Word:** Open this file in VS Code → install "Markdown PDF" or "Pandoc" extension → export to DOCX. Or paste into Word and apply the built-in Heading styles.

---

## Table of Contents

0. As-Built Update Log (latest changes)
1. Executive Summary
2. System Architecture Overview
3. Technology Stack
4. Infrastructure & Deployment
5. Application File Structure
6. Database Schema
7. API Reference
8. Frontend Pages & Components
9. Security Architecture
10. Data Flow Diagrams
11. External Integrations
12. Configuration Reference
13. Deployment Procedures
14. Environment Environments (Prod / Test / Dev)

---

# 0. As-Built Update Log

> This section records changes made after the original v2.0.0 documentation so the document stays an accurate **as-built**. Outstanding gaps to reach full production hardening are tracked in `PRODUCTION_READINESS.md`.

## July 2026 — v2.1.0

**New subsystems**
- **Settings & Configuration** — a 32-page Administration settings area backed by `routes/settings.js` and ~15 config tables (categories, tiers, billing rates, SLA, workflow rules, holidays, API keys, webhooks, alert rules, email templates, …). UI under `src/pages/settings/` using shared components in `src/components/settings/`. **Note:** several pages persist configuration that is not yet consumed by a runtime engine (email delivery, webhook dispatch, alert evaluation) — see PRODUCTION_READINESS.md → Tier 1.
- **In-app Support / Ticketing** — `support_tickets` table + `routes/support.js`. Employees raise tickets via a global "Help & Support" modal (`src/components/support/SupportModal.jsx` + `src/context/SupportContext.jsx`); admins manage them at Administration → Support (`src/pages/settings/SupportTickets.jsx`).
- **Global error handling** — every route is wrapped in a per-route `ErrorBoundary` with a "Report this issue" hand-off to the ticket modal; an `OfflineBanner` shows on connectivity loss. Both overlays are portalled to `document.body`.

**Security (Tier 0 hardening)**
- `app.set('trust proxy', 1)` — correct client IP behind nginx (fixes rate-limit keying + IP logging).
- CORS now **exact-matches** origins (localhost any-port allowed for dev), closing the previous `startsWith()` suffix-bypass.
- Removed the legacy `localStorage` session fallback — auth is **cookie-only**.
- Added `.gitignore` and `scripts/backup-db.mjs` (online SQLite backup + retention; `npm run backup`).

**UI/UX**
- Login redesigned ("Aurora Split": animated 3D brand panel + mouse-tilt card).
- Design-system fix: defined ~300 previously-undefined CSS custom properties (`--text-main/muted/sub`, `--accent-*`, `--radius-lg`) that were collapsing visual hierarchy and leaving chart icons colorless; added reusable primitives (`.surface`, `.page-head`, `.chip`, `.tbl`, `.tag`). Premium card surfaces rolled across the main pages; Home header + stat cards rebuilt.

---

# 1. Executive Summary

**Product Name:** MDS Premium Dashboard
**Version:** 2.0.0
**Developed by:** Midis Services

## What It Is

MDS Premium is a full-stack enterprise workforce management platform designed to replace Replicon's native dashboard. It provides real-time timesheet tracking, project and task management, AI-powered workforce insights, compliance monitoring, and resource utilization analytics — all in a modern, responsive web interface.

## Business Value

| Capability | Description |
|---|---|
| Timesheet Management | Employees submit weekly timesheets; PMs and admins approve, reject, or return them |
| Project Portfolio | Track all active projects, budgets, burn rates, and team assignments |
| Compliance Monitoring | Daily and weekly utilization deficits flagged in real-time |
| AI Insights | Claude-powered analysis generates 6–12 workforce insights weekly |
| AI Chatbot | Natural language assistant answers workforce questions and triggers actions |
| Account Managers | Separate entity tracking client relationships |
| Programs | Group projects into 14 standard program types |
| Data Migration | One-click import of Replicon historical data into local database |
| RBAC | Per-user page-level permission system with audit logging |

## Target Users

| Role | Access Level |
|---|---|
| Admin | Full access — user management, audit log, all data |
| Supervisor | All pages except administration panel |
| Project Manager (PM) | Projects, clients, timesheet approval for own projects |
| Resource | My Timesheet and chatbot only |

---

# 2. System Architecture Overview

## High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                              │
│                                                                      │
│   React 18 SPA (Vite build)                                          │
│   ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │Dashboard│ │Timesheets│ │ Projects │ │Employees │ │ AI Chat  │  │
│   └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│        └───────────┴────────────┴─────────────┴────────────┘        │
│                              HTTPS / Cookie Auth                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  HTTPS (port 8081)
┌──────────────────────────────▼───────────────────────────────────────┐
│                      UBUNTU SERVER (OCI Cloud)                       │
│                      IP: 129.151.146.210                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     NGINX (Reverse Proxy)                      │  │
│  │  :80  → redirect 443    :443 → prod    :8081 → test            │  │
│  │  :8082 → dev            :8888 → sqlite-web (password protected)│  │
│  └──────────────────┬──────────────────┬───────────────────────────  │
│                     │                  │                            │
│  ┌──────────────────▼─┐  ┌────────────▼────────┐  ┌────────────┐  │
│  │ Docker: prod        │  │ Docker: test        │  │ Docker: dev│  │
│  │ mds_dashboard_prod  │  │ mds_dashboard_test  │  │ mds_..._dev│  │
│  │ Node.js :3000       │  │ Node.js :3001       │  │ Node :3002 │  │
│  │ data/mds_prod.db    │  │ data/mds.db         │  │ data/...   │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  sqlite-web UI  :8889 (localhost only) ← nginx :8888 + auth    │ │
│  │  Views: /var/www/replicon/test/data/mds.db                      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────────┐
              ▼                ▼                    ▼
    ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐
    │ Replicon API │  │ Anthropic Claude │  │  Microsoft     │
    │ap1.replicon  │  │ (AI Insights +   │  │  Graph API     │
    │   .com       │  │  Chatbot)        │  │  (Calendar)    │
    └──────────────┘  └──────────────────┘  └────────────────┘
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       EXPRESS.JS SERVER                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │  CORS    │  │ Cookie   │  │  Rate    │  │ Security      │   │
│  │ Allowlist│  │  Parser  │  │  Limiter │  │ Headers       │   │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   │
│                         MIDDLEWARE CHAIN                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      ROUTE MODULES                         │ │
│  │  auth │ admin │ dashboard │ employees │ projects │ clients │ │
│  │  psaTimesheets │ psaProjects │ psaTasks │ psaClients       │ │
│  │  programs │ accountManagers │ templates │ csvImport        │ │
│  │  migration │ ai │ graph │ home                             │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                    LIB MODULES                             │ │
│  │  auth.js     - Sessions, hashing, middleware               │ │
│  │  db.js       - SQLite init, schema, query helpers          │ │
│  │  rbac.js     - Permissions, audit log, default users       │ │
│  │  helpers.js  - CSV parse, date utils, file I/O, logger     │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │              SQLite Database (better-sqlite3)               │ │
│  │              WAL mode │ Foreign keys ON                     │ │
│  │              /app/data/mds.db                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. Technology Stack

## Backend

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 18 LTS | JavaScript runtime |
| Framework | Express.js | 4.18.2 | HTTP server and routing |
| Database | better-sqlite3 | 9.4.3 | SQLite client (synchronous, fast) |
| Database Engine | SQLite3 | Built-in | Embedded relational database |
| Auth | crypto (built-in) | — | Session tokens, password hashing |
| Password Hashing | scrypt (crypto) | — | Adaptive KDF with random salt |
| Session Storage | SQLite sessions table | — | Persistent login across restarts |
| Rate Limiting | express-rate-limit | 7.4.0 | Brute force protection on login |
| CORS | cors | 2.8.5 | Cross-origin request control |
| Cookie Parsing | cookie-parser | 1.4.6 | Read httpOnly session cookie |
| Logging | pino | 9.0.0 | Structured JSON logging |
| Validation | zod | 3.22.4 | Schema validation for API inputs |
| Environment | dotenv | 16.3.1 | Load .env configuration |
| AI | Anthropic SDK | — | Claude for chat + insights |
| HTTP Client | axios | 1.6.0 | Replicon API calls |

## Frontend

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.2.0 | UI component library |
| Build Tool | Vite | 5.0 | Fast bundler and dev server |
| Routing | react-router-dom | 6.20.0 | Client-side SPA routing |
| Charts | ApexCharts | 3.44.0 | All dashboard charts and graphs |
| PDF Export | jspdf + jspdf-autotable | 2.5.1 | Export reports to PDF |
| Excel Export | xlsx | 0.18.5 | Export data to Excel |
| Screenshot | html2canvas | 1.4.1 | Capture chart screenshots |
| Drag & Drop | @dnd-kit | 6.1.0 | Kanban board drag-and-drop |
| Icons | Boxicons | CDN | UI icon library |
| Fonts | Google Fonts | CDN | Inter font family |

## Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Containerization | Docker | Isolated app environments |
| Orchestration | Docker Compose | Multi-container management |
| Reverse Proxy | nginx 1.24.0 | SSL termination, port routing |
| SSL | Self-signed certificate | HTTPS encryption |
| OS | Ubuntu (latest LTS) | Server operating system |
| Cloud | Oracle Cloud Infrastructure (OCI) | VM hosting |
| DB Admin UI | sqlite-web 0.7.2 | Browser-based DB viewer |
| Process Manager | Docker (restart: always) | Auto-restart on crash |

---

# 4. Infrastructure & Deployment

## Server Specifications

| Property | Value |
|---|---|
| IP Address | 129.151.146.210 |
| Operating System | Ubuntu (OCI Cloud VM) |
| SSH User | ubuntu |
| App Directory | /var/www/replicon/ |
| DB Directory | /var/www/replicon/test/data/mds.db |
| nginx Config | /etc/nginx/sites-available/replicon-matrix |

## Port Mapping

| External Port | Protocol | nginx Target | Environment | Description |
|---|---|---|---|---|
| 80 | HTTP | — | All | Redirects to HTTPS port 443 |
| 443 | HTTPS/SSL | localhost:3000 | Production | Main production app |
| 8081 | HTTPS/SSL | localhost:3001 | Test | Test environment |
| 8082 | HTTPS/SSL | localhost:3002 | Dev | Development environment |
| 8888 | HTTP | localhost:8889 | All | sqlite-web DB viewer (password protected) |
| 8889 | HTTP | — | All | sqlite-web internal (localhost only, not internet-facing) |

## Docker Container Map

| Container Name | Port | Database | Branch |
|---|---|---|---|
| mds_dashboard_production | 3000 | data/mds_prod.db | main |
| mds_dashboard_test | 3001 | data/mds.db | test |
| mds_dashboard_development | 3002 | data/mds_dev.db | dev |

## nginx Configuration

File: `/etc/nginx/sites-available/replicon-matrix`

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}

# Production (port 443)
server {
    listen 443 ssl;
    ssl_certificate     /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}

# Test (port 8081)
server {
    listen 8081 ssl;
    ssl_certificate     /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;
    location / {
        proxy_pass http://localhost:3001;
        ...
    }
}

# SQLite Web UI (port 8888, password protected)
server {
    listen 8888;
    auth_basic "Database Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
    location / {
        proxy_pass http://127.0.0.1:8889;
    }
}
```

## Dockerfile (Multi-Stage Build)

```
Stage 1 — Builder (node:18-alpine)
  ├── Install: python3, make, g++ (for compiling better-sqlite3 native module)
  ├── npm ci (install all dependencies)
  └── npm run build (Vite compiles React → dist/)

Stage 2 — Production (node:18-alpine, minimal)
  ├── Copy: node_modules/ from builder
  ├── Copy: dist/ (compiled React SPA)
  ├── Copy: server.js, lib/, routes/
  ├── Expose: port 3000
  └── CMD: node server.js
```

## Deploy Command

```bash
# On your Windows machine — push to server
git push origin test

# On the server — pull and rebuild
cd /var/www/replicon/test
git pull
docker compose down && docker compose up -d --build
```

---

# 5. Application File Structure

## Root Directory

```
Test Environment/
│
├── server.js                   # Express entry point — middleware, routes, error handler
├── package.json                # NPM config, scripts, all dependencies
├── Dockerfile                  # Multi-stage Docker build definition
├── docker-compose.yml          # Container orchestration config
├── vite.config.js              # Vite bundler configuration
├── .gitignore                  # Ignores node_modules, dist, data, .env, *.db
│
├── scripts/
│   └── backup-db.mjs           # Online SQLite backup + retention (npm run backup)
│
├── lib/                        # Server-side shared modules
│   ├── auth.js                 # Session management, password hashing, middleware
│   ├── db.js                   # SQLite schema, migrations, query helpers
│   ├── helpers.js              # Utilities: CSV parse, date calc, logger, file I/O
│   └── rbac.js                 # RBAC permissions, audit log, default users
│
├── routes/                     # Express route handlers (one file per domain)
│   ├── auth.js                 # Login, logout, /me, /health
│   ├── admin.js                # User CRUD, audit log
│   ├── dashboard.js            # Replicon data SSE stream
│   ├── employees.js            # Local employee CRUD
│   ├── clients.js              # Replicon client operations + legacy timesheet action
│   ├── psaClients.js           # Local client CRUD
│   ├── psaProjects.js          # Local project CRUD + resource management
│   ├── psaTasks.js             # Local task CRUD + XML import
│   ├── psaTimesheets.js        # Timesheet CRUD + approve/reject
│   ├── accountManagers.js      # Account manager CRUD
│   ├── programs.js             # Program CRUD + CSV import
│   ├── templates.js            # Document template management
│   ├── csvImport.js            # Bulk 3-file CSV import
│   ├── migration.js            # Replicon → local DB migration
│   ├── ai.js                   # AI chat + insights
│   ├── graph.js                # Microsoft Graph calendar integration
│   ├── home.js                 # Home page API
│   ├── settings.js             # Admin settings + config CRUD (categories, SLA, API keys, webhooks, …)
│   ├── support.js              # In-app support ticket CRUD (user + admin)
│   └── projects.js             # Replicon project creation/edit
│
├── src/                        # React frontend (Vite SPA)
│   ├── App.jsx                 # Router, auth gate, session management
│   ├── main.jsx                # React root mount
│   │
│   ├── api/
│   │   └── replicon.js         # Axios API client with 401 interceptor
│   │
│   ├── config/
│   │   └── adminRoutes.js      # Obfuscated admin path constants
│   │
│   ├── constants/
│   │   └── index.js            # Report URIs, colors, thresholds, excluded users
│   │
│   ├── context/
│   │   ├── ThemeContext.jsx     # Dark/light mode
│   │   ├── ToastContext.jsx     # Toast notification system
│   │   ├── PermissionContext.jsx# Per-page permission checking (useCan hook)
│   │   └── SupportContext.jsx   # Global "report an issue" modal + client-error capture
│   │
│   ├── hooks/
│   │   ├── useRepliconData.js  # Dashboard data fetching, caching, processing
│   │   └── useCardTilt.js      # Card 3D tilt effect
│   │
│   ├── workers/
│   │   └── dataProcessor.js    # Web Worker for heavy star-schema processing
│   │
│   ├── components/             # Reusable UI components
│   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   ├── Ribbon.jsx           # Top navigation bar
│   │   ├── Login.jsx            # Login form
│   │   ├── ChatBot.jsx          # AI chatbot panel
│   │   ├── GlobalSearch.jsx     # Full-text search
│   │   ├── SessionManager.jsx   # Session timeout warnings
│   │   ├── NotificationsCenter.jsx
│   │   ├── KeyboardShortcuts.jsx
│   │   ├── LoadingScreen.jsx
│   │   ├── LoadingOverlay.jsx
│   │   ├── Skeleton.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Toast.jsx
│   │   ├── ComplianceModal.jsx
│   │   ├── OfflineBanner.jsx      # Global offline-connectivity banner (portalled)
│   │   ├── support/              # Support ticket modal
│   │   └── settings/             # Shared settings-page components (CrudTable, ModalForm, styles)
│   │
│   └── pages/                  # Full-page React components (one per route)
│       ├── Home.jsx             # Landing/dashboard home
│       ├── Dashboard.jsx        # Analytics dashboard (40+ charts)
│       ├── Employees.jsx        # Employee list
│       ├── Employee.jsx         # Employee detail
│       ├── Clients.jsx          # Client list
│       ├── ClientCreate.jsx     # Create client form
│       ├── ClientEdit.jsx       # Edit client form
│       ├── Projects.jsx         # Project list (user view)
│       ├── ProjectsAdmin.jsx    # Project list (admin view)
│       ├── ProjectDetail.jsx    # Project detail + tasks
│       ├── ProjectEdit.jsx      # Edit project form
│       ├── ProjectDeepDive.jsx  # Detailed project analytics
│       ├── Programs.jsx         # Program management
│       ├── AccountManagers.jsx  # Account manager list
│       ├── AccountManagerDetail.jsx # AM detail + clients
│       ├── TimesheetOps.jsx     # Timesheet entry (legacy Replicon)
│       ├── MyTimesheet.jsx      # PSA weekly timesheet
│       ├── TimesheetApproval.jsx# Approve/reject timesheets (admin/PM)
│       ├── AIInsights.jsx       # AI-generated insights
│       ├── SmartInitiator.jsx   # Create Replicon project wizard
│       ├── Templates.jsx        # Document templates
│       ├── Profile.jsx          # User profile
│       ├── Administration.jsx   # User management (obfuscated path)
│       ├── AuditLog.jsx         # Audit log viewer (obfuscated path)
│       ├── Migration.jsx        # Data migration tool (obfuscated path)
│       └── settings/            # 32 admin settings pages + SupportTickets (admin inbox)
│
├── data/                       # SQLite database files (volume-mounted in Docker)
│   └── mds.db                  # Main database (test environment)
│
└── dist/                       # Compiled React SPA (generated by npm run build)
    └── index.html              # SPA entry point served for all non-API routes
```

---

# 6. Database Schema

## Entity-Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    users    │       │    employees     │       │   clients   │
│─────────────│       │──────────────────│       │─────────────│
│ id (PK)     │──────▶│ userId (FK,UNIQ) │  ┌───│ id (PK)     │
│ displayName │       │ id (PK)          │  │   │ name        │
│ passwordHash│       │ firstName        │  │   │ code        │
│ isAdmin     │       │ lastName         │  │   │ industry    │
│ permissions │       │ displayName      │◀─┤   │ managerId──┐│
│ createdAt   │       │ email            │  │   │ status     ││
│ updatedAt   │       │ employeeId       │  │   │ createdAt  ││
│ msEmail     │       │ role             │  │   └────────────┘│
└─────────────┘       │ skills (JSON)    │  │                 │
                      │ supervisorId─┐  │  │   ┌─────────────▼──────┐
┌─────────────┐       │ startDate    │  │  │   │  account_managers  │
│  sessions   │       │ endDate      │  │  │   │────────────────────│
│─────────────│       │ status       │  │  │   │ id (PK)            │
│ token (PK)  │       │ hourlyRate   │  │  └──▶│ firstName          │
│ user (JSON) │       │ jobTitle     │  │      │ lastName           │
│ expiresAt   │       │ department   │  │      │ displayName        │
│ createdAt   │       │ officeLocation│  │      │ email              │
└─────────────┘       │ createdAt    │  │      │ phone              │
                      │ updatedAt    │◀─┘      │ title              │
                      └──────┬───────┘         │ status             │
                             │                 └────────────────────┘
                             │
            ┌────────────────┼────────────────────┐
            │                │                    │
            ▼                ▼                    ▼
┌───────────────────┐ ┌────────────────┐ ┌──────────────────┐
│ project_resources │ │    projects    │ │   task_resources  │
│───────────────────│ │────────────────│ │──────────────────│
│ projectId (FK,PK) │ │ id (PK)        │ │ taskId (FK,PK)   │
│ employeeId(FK,PK) │ │ clientId (FK)  │ │ employeeId(FK,PK)│
│ assignedAt        │ │ name           │ │ assignedAt       │
└─────────┬─────────┘ │ code           │ └────────┬─────────┘
          │           │ status         │          │
          │           │ projectManagerId│         │
          │           │ startDate      │          │
          │           │ endDate        │          │
          └──────────▶│ budgetHours    │◀─────────┘
                      │ billingType    │
                      │ programId (FK) │
                      │ quotedHours    │──┐
                      │ ticketAlloc    │  │  ┌────────────┐
                      │ monthlyAlloc   │  │  │  programs  │
                      │ createdAt      │  │  │────────────│
                      └───────┬────────┘  └─▶│ id (PK)    │
                              │              │ name       │
                              │              │ description│
                  ┌───────────┴───────┐      └────────────┘
                  ▼                   ▼
          ┌──────────────┐    ┌──────────────────────────┐
          │    tasks     │    │    project_access_reqs   │
          │──────────────│    │──────────────────────────│
          │ id (PK)      │    │ id (PK)                  │
          │ projectId(FK)│    │ projectId (FK)           │
          │ parentTaskId │    │ employeeId (FK)          │
          │ name         │    │ requestedBy              │
          │ code         │    │ status                   │
          │ description  │    │ note                     │
          │ startDate    │    │ reviewedBy               │
          │ endDate      │    │ reviewedAt               │
          │ status       │    │ createdAt                │
          │ estimatedHrs │    └──────────────────────────┘
          │ sortOrder    │
          └──────┬───────┘
                 │
    ┌────────────▼────────────────────┐
    │         psa_timesheets          │
    │─────────────────────────────────│
    │ id (PK)                         │
    │ userId (NOT NULL)               │
    │ weekStart (NOT NULL)            │
    │ status                          │
    │ rejectedReason                  │
    │ createdAt / updatedAt           │
    │ UNIQUE(userId, weekStart)       │
    └────────────┬────────────────────┘
                 │
    ┌────────────▼────────────────────┐
    │       psa_timesheet_rows        │
    │─────────────────────────────────│
    │ id (PK)                         │
    │ timesheetId (FK, CASCADE)       │
    │ projectId (FK)                  │
    │ taskId (FK)                     │
    │ note                            │
    │ sortOrder                       │
    │ createdAt / updatedAt           │
    └────────────┬────────────────────┘
                 │
    ┌────────────▼────────────────────┐
    │       psa_timesheet_hours       │
    │─────────────────────────────────│
    │ rowId (FK, CASCADE)             │
    │ date                            │
    │ hours (REAL)                    │
    │ note                            │
    │ PRIMARY KEY (rowId, date)       │
    └─────────────────────────────────┘
```

## Table Reference

### employees
Stores all team members. Linked optionally to a login user account via `userId`.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT UNIQUE | Links to users.id (nullable) |
| firstName | TEXT | Required |
| lastName | TEXT | Required |
| displayName | TEXT | Auto-computed if empty |
| email | TEXT UNIQUE | |
| employeeId | TEXT UNIQUE | Replicon employee ID |
| role | TEXT | admin, supervisor, pm, resource |
| skills | TEXT | JSON array of skill strings |
| supervisorId | TEXT FK | References employees.id |
| startDate | TEXT | ISO date |
| endDate | TEXT | ISO date (null = active) |
| status | TEXT | active, inactive |
| hourlyRate | REAL | Cost rate |
| jobTitle | TEXT | |
| department | TEXT | |
| officeLocation | TEXT | |

### clients
Customer organizations.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | Required |
| code | TEXT UNIQUE | Short client code |
| industry | TEXT | |
| contactName | TEXT | Primary contact |
| contactEmail | TEXT | |
| contactPhone | TEXT | |
| website | TEXT | |
| managerId | TEXT FK | References account_managers.id |
| status | TEXT | active, inactive |
| notes | TEXT | |

### projects
Work engagements for clients.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| clientId | TEXT FK | References clients.id |
| name | TEXT | Required |
| code | TEXT UNIQUE | Short project code (uppercase) |
| status | TEXT | tentative, in_progress, completed, deferred, cancelled, archived |
| projectManagerId | TEXT FK | References employees.id |
| startDate / endDate | TEXT | ISO dates |
| budgetHours | REAL | Approved budget hours |
| quotedHours | REAL | Hours in quote/proposal |
| ticketAllocation | REAL | Hours reserved for tickets |
| monthlyAllocation | REAL | Monthly recurring hours |
| billingType | TEXT | time_material, fixed_bid, non_billable, adoption_tm, sla_retainer, staff_aug |
| programId | TEXT FK | References programs.id |
| notes | TEXT | |

### tasks
Work items within projects. Supports hierarchy via parentTaskId.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| projectId | TEXT FK | CASCADE on delete |
| parentTaskId | TEXT FK | Self-reference (nullable) |
| name | TEXT | Required |
| code | TEXT | |
| description | TEXT | |
| startDate / endDate | TEXT | ISO dates |
| status | TEXT | open, in_progress, completed, closed |
| estimatedHours | REAL | |
| sortOrder | INTEGER | Display order |

### psa_timesheets
One row per user per week.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT | Login username |
| weekStart | TEXT | ISO date (always Monday) |
| status | TEXT | not_submitted → submitted → approved / rejected |
| rejectedReason | TEXT | Populated on rejection |

### psa_timesheet_rows
Each row = one project+task combination in a timesheet.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| timesheetId | TEXT FK | CASCADE on delete |
| projectId | TEXT FK | |
| taskId | TEXT FK | |
| note | TEXT | General note for the row |
| sortOrder | INTEGER | |

### psa_timesheet_hours
Individual day hours per row. One row per (rowId, date) pair.

| Column | Type | Notes |
|---|---|---|
| rowId | TEXT FK | CASCADE on delete |
| date | TEXT | ISO date (e.g., 2026-06-02) |
| hours | REAL | Decimal hours logged |
| note | TEXT | Day-specific note |

### users
Login accounts for the application. Separate from employees.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Lowercase username (e.g., ziad.shafik) |
| displayName | TEXT | Display name |
| passwordHash | TEXT | scrypt: salt:hash format |
| isAdmin | INTEGER | 0 or 1 |
| permissions | TEXT | JSON: { dashboard: true, employees: false, ... } |
| msEmail | TEXT | Microsoft 365 email (Graph integration) |

### sessions
Active login sessions. Cleaned up every 15 minutes.

| Column | Type | Notes |
|---|---|---|
| token | TEXT PK | 32-byte hex random string (64 chars) |
| user | TEXT | JSON snapshot of user at login time |
| expiresAt | INTEGER | Unix timestamp (ms) |
| createdAt | TEXT | ISO datetime |

### account_managers
Client relationship owners. Separate from employees.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| firstName / lastName | TEXT | |
| displayName | TEXT | |
| email / phone / title | TEXT | |
| status | TEXT | active, inactive |

### programs
High-level work classifications. 14 pre-seeded values.

| Name | Example Projects |
|---|---|
| Application Modernization Assessment | Legacy system reviews |
| Copilot | Microsoft Copilot deployments |
| Deployment Projects | Software rollouts |
| Internal | Admin, internal work |
| Managed Services (On-Site) | On-site support contracts |
| Managed Services (Remote) | Remote support contracts |
| Proof of Concept | PoC engagements |
| Service Level Agreements | SLA-based contracts |
| ... and 6 more | |

### templates
Document templates shared across the team.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| title | TEXT | |
| category | TEXT | |
| documentUrl | TEXT | Link to document |
| submittedBy | TEXT | User ID |
| status | TEXT | pending, approved, rejected |
| reviewedBy / reviewedAt | TEXT | Admin review |
| rejectionNote | TEXT | |

### Settings & Configuration Tables

Backing the Administration settings area. All created idempotently on server start (`lib/db.js`).

| Table | Purpose |
|---|---|
| app_settings | Generic key/value settings by group (general, branding, localization, notifications, calendar, …) |
| project_categories / task_categories | Classification + colour |
| priority_levels | Task priority tiers |
| client_tiers | Client segmentation tiers |
| billing_rates | Role-based billing rates |
| cost_centers | Cost-centre / P&L mapping |
| holidays | Company / public holidays |
| sla_tiers | SLA response / resolution targets |
| workflow_rules | Status-transition automation rules |
| email_templates | Named email subject / body templates |
| project_templates / project_template_tasks | Reusable project + task structures |
| api_keys | Programmatic API credentials (stored hashed) |
| webhooks | Event → URL subscriptions |
| alert_rules | Threshold-based alert definitions |

> Several of these persist configuration not yet enforced by a runtime engine (email delivery, webhook dispatch, alert evaluation). See PRODUCTION_READINESS.md → Tier 1.

### support_tickets

In-app issue reporting.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | UUID |
| userId / userName | TEXT | Reporter |
| category | TEXT | bug, question, feature, access, other |
| subject / message | TEXT | Required |
| route | TEXT | Page the user was on |
| severity | TEXT | low, normal, high, urgent |
| status | TEXT | open, in_progress, resolved, closed |
| clientError | TEXT | Captured client error / stack (optional) |
| adminNote | TEXT | Admin response (shown to the reporter) |
| resolvedBy / resolvedAt | TEXT | Set on resolve / close |

---

# 7. API Reference

## Authentication Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | None | Health check — returns `{status: "ok"}` |
| POST | /api/v1/login | Rate-limited | Login. Body: `{username, password}`. Sets httpOnly cookie. |
| POST | /api/login | Rate-limited | Legacy login (same as above) |
| GET | /api/v1/me | Session | Get current user session info |
| POST | /api/v1/logout | None | Clear session cookie, delete from DB |

**Login Response:**
```json
{ "success": true, "displayName": "Ziad Shafik" }
```

**Me Response:**
```json
{
  "user": {
    "id": "ziad.shafik",
    "name": "Ziad Shafik",
    "isAdmin": true,
    "role": "admin",
    "permissions": { "dashboard": true, "employees": true, ... }
  }
}
```

---

## Admin Endpoints

All require admin session.

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/admin/users | List all login users |
| POST | /api/v1/admin/users | Create user `{id, displayName, password, isAdmin, permissions}` |
| PUT | /api/v1/admin/users/:uid | Update user fields |
| DELETE | /api/v1/admin/users/:uid | Delete user (cannot delete self) |
| GET | /api/v1/admin/audit | Last 500 audit log entries |
| POST | /api/v1/audit/pageview | Log page view (requires session, called by frontend) |

---

## Employee Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/employees | Session | List employees. Query: `?status=active&role=pm&search=john` |
| GET | /api/v1/employees/:id | Session | Get employee by ID |
| POST | /api/v1/employees | Admin | Create employee |
| PUT | /api/v1/employees/:id | Admin | Update employee |
| DELETE | /api/v1/employees/:id | Admin | Soft-deactivate employee |
| GET | /api/v1/employees/:id/account | Admin | Get linked user account |
| PUT | /api/v1/employees/:id/account | Admin | Create/link user account for employee |
| GET | /api/v1/profile | Session | Get own employee profile |
| PUT | /api/v1/profile | Session | Update own profile |

---

## Client Endpoints (Local PSA)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/clients | Session | List clients. Query: `?status=active&search=acme` |
| GET | /api/v1/clients/:id | Session | Get client with account manager info |
| POST | /api/v1/clients | Admin | Create client |
| PUT | /api/v1/clients/:id | Admin | Update client |
| DELETE | /api/v1/clients/:id | Admin | Deactivate client |

---

## Project Endpoints (Local PSA)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/psa/projects | Session | List projects. Query: `?status=in_progress&mine=true&search=x` |
| GET | /api/v1/psa/projects/:id | Session | Get project with actual hours |
| POST | /api/v1/psa/projects | Admin | Create project |
| PUT | /api/v1/psa/projects/:id | Admin | Update project |
| DELETE | /api/v1/psa/projects/:id | Admin | Archive project |
| GET | /api/v1/psa/projects/:id/resources | Session | List assigned team members |
| POST | /api/v1/psa/projects/:id/resources | Admin/PM | Assign employee to project |
| DELETE | /api/v1/psa/projects/:id/resources/:empId | Admin/PM | Remove employee |
| POST | /api/v1/psa/projects/:id/request-access | Session | Request project access |
| GET | /api/v1/psa/projects/:id/access-requests | Admin/PM | List pending requests |
| PATCH | /api/v1/psa/project-access-requests/:id | Admin/PM | Approve or reject request |
| GET | /api/v1/psa/my-access-requests | Session | Get own access requests |

---

## Task Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/psa/tasks | Session | List tasks. Query: `?projectId=x&mine=true` |
| GET | /api/v1/psa/projects/:id/tasks | Session | All tasks in a project with team |
| POST | /api/v1/psa/projects/:id/tasks | Admin | Create task |
| POST | /api/v1/psa/projects/:id/tasks/bulk | Admin | Bulk import task hierarchy |
| PUT | /api/v1/psa/tasks/:id | Admin | Update task |
| DELETE | /api/v1/psa/tasks/:id | Admin | Delete task |
| POST | /api/v1/psa/tasks/:id/resources | Admin/PM | Assign employee to task |
| DELETE | /api/v1/psa/tasks/:id/resources/:empId | Admin/PM | Remove employee from task |
| POST | /api/v1/psa/parse-xml | Session | Parse MS Project XML → task list |

---

## Timesheet Endpoints (PSA)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/psa/timesheets | Session | Get/create own timesheet for week. Query: `?weekStart=2026-06-02` |
| POST | /api/v1/psa/timesheet-rows | Session | Add project/task row to timesheet |
| PUT | /api/v1/psa/timesheet-rows/:id | Session | Update row (project, task, note) |
| PUT | /api/v1/psa/timesheet-rows/:id/hours | Session | Save day hours `{hours: {"2026-06-02": 8}}` |
| PUT | /api/v1/psa/timesheet-rows/:id/day-notes | Session | Add note to a specific day |
| DELETE | /api/v1/psa/timesheet-rows/:id | Session | Delete row |
| POST | /api/v1/psa/timesheets/:id/submit | Session | Submit for approval |
| POST | /api/v1/psa/timesheets/:id/copy-last-week | Session | Copy last week's project structure |
| GET | /api/v1/admin/psa/timesheets | Admin/PM | List all timesheets (PMs see own projects only) |
| POST | /api/v1/admin/psa/timesheets/:id/approve | Admin/PM | Approve timesheet |
| POST | /api/v1/admin/psa/timesheets/:id/reject | Admin/PM | Reject with reason |

---

## Account Manager Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/account-managers | Session | List AMs with client counts |
| GET | /api/v1/account-managers/:id | Session | AM detail with clients/projects |
| POST | /api/v1/account-managers | Admin | Create AM |
| PUT | /api/v1/account-managers/:id | Admin | Update AM |
| DELETE | /api/v1/account-managers/:id | Admin | Deactivate AM |

---

## Program Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/programs | Session | List programs with project counts |
| POST | /api/v1/programs | Admin | Create program |
| PUT | /api/v1/programs/:id | Admin | Update program |
| DELETE | /api/v1/programs/:id | Admin | Delete program |
| POST | /api/v1/programs/import-csv | Admin | Import CSV to link projects to programs |

---

## AI Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/chat | Session | Stream chat response (SSE). Body: `{messages: [...], summaryData: {...}}` |
| POST | /api/v1/chat/feedback | Session | Rate chat response `{responseId, rating: 'good'/'bad'}` |
| POST | /api/v1/chat/action | Session | Execute chat action (e.g., create-client) |
| POST | /api/v1/insights/cache-summary | Session | Cache workforce summary data |
| GET | /api/v1/insights/cached | Session | Get cached insights |
| POST | /api/v1/insights/generate | Session | Generate fresh AI insights |
| POST | /api/v1/insights/feedback | Session | Rate insight `{insightId, helpful: true/false}` |

---

## Dashboard Endpoint (Replicon Live Data)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/dashboard | Session | Server-Sent Events (SSE) stream of live Replicon data |

**SSE Event Types:** `dictionaries`, `roster`, `drafts`, `cube`, `timesheets`, `complete`, `error`

---

## Replicon Project/Client Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/projects | Session | Create project in Replicon (streamed progress) |
| GET | /api/v1/projects/search | Session | Search Replicon projects by name |
| POST | /api/v1/projects/details | Session | Fetch Replicon project details |
| POST | /api/v1/projects/edit | Session | Edit Replicon project |
| GET | /api/v1/clients/search | Session | Search Replicon clients |
| POST | /api/v1/clients/details | Session | Fetch Replicon client details |
| POST | /api/v1/clients/create | Session | Create client in Replicon |

---

## Import / Migration Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/admin/import-csv | Admin | Bulk 3-file CSV import (employees, AMs, projects/tasks) |
| POST | /api/v1/admin/migrate-from-replicon | Admin | Full Replicon → local DB migration |

## Settings Endpoints (Admin)

Base: `/api/v1/admin`. All require an admin session.

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/admin/settings?group=X | Get key/value settings for a group |
| PUT | /api/v1/admin/settings | Save settings `{group, updates}` |
| GET/POST/PUT/DELETE | /api/v1/admin/{resource} | CRUD for config resources: project-categories, task-categories, priorities, client-tiers, billing-rates, cost-centers, holidays, sla, workflows, email-templates, project-templates, api-keys, webhooks, alert-rules |

---

## Support Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/support/tickets | Session | Create a ticket `{category, severity, subject, message, route, clientError}` |
| GET | /api/v1/support/tickets | Session | List the caller's own tickets |
| GET | /api/v1/admin/support-tickets | Admin | List all tickets (optional `?status=`) |
| PUT | /api/v1/admin/support-tickets/:id | Admin | Update status / adminNote / severity |
| DELETE | /api/v1/admin/support-tickets/:id | Admin | Delete a ticket |

---

# 8. Frontend Pages & Components

## Page Route Map

| Route | Page Component | Auth Required | Description |
|---|---|---|---|
| /home | Home.jsx | Session | Landing page with role-based content |
| /dashboard | Dashboard.jsx | Session + permission | Full analytics dashboard |
| /employees | Employees.jsx | Session + permission | Employee directory |
| /employees/:id | Employee.jsx | Session | Employee detail |
| /clients | Clients.jsx | Session + permission | Client list |
| /clients/new | ClientCreate.jsx | Admin | Create client form |
| /clients/:id/edit | ClientEdit.jsx | Admin | Edit client |
| /projects | Projects.jsx | Session | My projects (resource view) |
| /projects-admin | ProjectsAdmin.jsx | Session + permission | All projects (admin view) |
| /projects-admin/:id | ProjectDetail.jsx | Session | Project detail + tasks |
| /projects-admin/:id/edit | ProjectEdit.jsx | Admin | Edit project |
| /projects-admin/:id/deep | ProjectDeepDive.jsx | Session | Advanced project analytics |
| /programs | Programs.jsx | Session | Program management |
| /account-managers | AccountManagers.jsx | Session | Account manager list |
| /account-managers/:id | AccountManagerDetail.jsx | Session | AM detail + clients |
| /my-timesheet | MyTimesheet.jsx | Session | Weekly timesheet entry |
| /timesheet-approval | TimesheetApproval.jsx | Admin/PM | Approve/reject timesheets |
| /timesheets | TimesheetOps.jsx | Session + permission | Replicon timesheet view |
| /ai-insights | AIInsights.jsx | Session + permission | AI workforce insights |
| /smart-initiator | SmartInitiator.jsx | Session | Replicon project wizard |
| /templates | Templates.jsx | Session | Document templates |
| /profile | Profile.jsx | Session | User profile management |
| /sys/3a7f | Administration.jsx | Admin | User management (obfuscated) |
| /sys/8b4e | AuditLog.jsx | Admin | Audit log (obfuscated) |
| /sys/5c9d | Migration.jsx | Admin | Data migration (obfuscated) |

## Key Page Descriptions

### Dashboard.jsx
The core analytics page. Fetches live Replicon data via SSE, caches in IndexedDB, processes in a Web Worker. Renders:
- Utilization heatmap (last 8 weeks)
- Budget burn progress bars per project
- Compliance sparklines
- Timesheet status table
- At-risk projects list (>80% burn)
- Top 10 clients by hours
- Team utilization donut
- Resource rolloff timeline

### MyTimesheet.jsx
Weekly timesheet entry interface. Features:
- Navigate between weeks
- Add project + task rows
- Enter hours per day
- Add day-specific notes
- Copy last week's structure (one click)
- Submit for PM/admin review
- View rejection reason if returned

### TimesheetApproval.jsx
Admin/PM view for reviewing submitted timesheets:
- Filter by employee, status, week
- See all hours per project per day
- Approve with one click
- Reject with a required reason (returned to employee)

### Administration.jsx (at /sys/3a7f)
User management panel:
- Create user accounts with role and page permissions
- Toggle individual page access per user
- Reset passwords
- Promote/demote admin status
- Delete accounts

### Migration.jsx (at /sys/5c9d)
One-time or incremental data import:
- Pull full employee roster from Replicon
- Import all projects, tasks, client assignments
- Optionally create login accounts for all employees
- Optionally import historical timesheet data
- Returns counts of created/skipped/failed records

## Core Components

### Sidebar.jsx
Persistent left-side navigation. Items shown based on user permissions:
- Dashboard, Employees, Clients, Projects, Programs, Account Managers
- My Timesheet, Timesheet Approval, AI Insights, Chatbot
- Admin section: User Management, Audit Log, Migration (obfuscated paths)
- Collapses to icon-only mode (state saved in localStorage)

### ChatBot.jsx
Sliding AI chat panel:
- Sends last 20 messages as context
- Streams responses from Claude Haiku
- Renders `[NAVIGATE:/route|Label]` as clickable buttons
- Thumbs up/down feedback on each response
- Auto-suggests from workforce context data

### GlobalSearch.jsx
Full-text search across:
- Employees (name, email, ID)
- Projects (name, code)
- Clients (name, code)
- Results grouped by type, clickable to navigate

---

# 9. Security Architecture

## Authentication Flow

```
1. User enters username + password
         │
         ▼
2. POST /api/v1/login
   ├── Rate limit check (15 attempts / 15 min per IP)
   ├── Lookup user in users table by lowercase ID
   ├── scrypt verify (password against stored salt:hash)
   └── On success:
       ├── Create 64-char hex random session token
       ├── INSERT into sessions (token, user JSON, expiresAt = now + 1hr)
       └── Set-Cookie: mds_session=<token>; HttpOnly; Secure; SameSite=Lax
         │
         ▼
3. Every subsequent request
   ├── Cookie sent automatically by browser
   ├── requireAuth middleware reads cookie
   ├── SELECT from sessions WHERE token=?
   ├── Check expiresAt > now
   └── Attach user object to req.user
         │
         ▼
4. Logout
   ├── DELETE FROM sessions WHERE token=?
   ├── Clear cookie
   └── React navigates to / (replace: true, prevents back-button return)
```

## RBAC Permission Matrix

| Permission | Admin | Supervisor | PM | Resource |
|---|---|---|---|---|
| dashboard | ✓ | ✓ | ✓ | ✗ |
| employees | ✓ | ✓ | ✗ | ✗ |
| timesheets | ✓ | ✗ | ✗ | ✗ |
| projects | ✓ | ✓ | ✓ | ✗ |
| clients | ✓ | ✓ | ✓ | ✗ |
| aiInsights | ✓ | ✓ | ✗ | ✗ |
| chatbot | ✓ | ✓ | ✓ | ✓ |
| myTimesheet | ✓ | ✓ | ✓ | ✓ |
| timesheetApproval | ✓ | ✓ | ✓ | ✗ |
| administration | ✓ | ✓ | ✗ | ✗ |

Permissions are stored as a JSON object per user and can be overridden individually in the Administration panel (e.g., grant a resource access to dashboard).

## Security Headers (set on every response)

| Header | Value | Purpose |
|---|---|---|
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Force HTTPS for 1 year |
| X-Frame-Options | DENY | Block iframe embedding |
| X-Content-Type-Options | nosniff | Block MIME-type sniffing |
| X-XSS-Protection | 1; mode=block | Browser XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Limit referrer info leakage |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Disable unused browser APIs |
| Content-Security-Policy | (see below) | Block XSS via resource allowlist |
| X-Powered-By | (removed) | Do not reveal Express |

**Content Security Policy:**
```
default-src 'self'
script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com
font-src 'self' https://fonts.gstatic.com https://unpkg.com
img-src 'self' data: blob:
connect-src 'self' https://ap1.replicon.com https://cdnjs.cloudflare.com
worker-src 'self' blob:
```

## SQL Injection Protection

All database queries use `better-sqlite3` prepared statements with `?` parameter binding. User input is never interpolated into SQL strings. Dynamic WHERE clauses build the SQL structure statically and push values into a `params[]` array.

## Recent Hardening (July 2026)

- **Reverse-proxy awareness:** `app.set('trust proxy', 1)` so `req.ip` / `req.secure` reflect the real client behind nginx — the login rate-limiter now keys per client and audit logs record real IPs.
- **CORS:** exact-match allow-list (localhost any-port permitted for dev), replacing `startsWith()` which allowed suffix-bypass origins (e.g. `http://<ip>.evil.com`).
- **Cookie-only auth:** the legacy `localStorage` session fallback was removed; authentication relies solely on the httpOnly `mds_session` cookie + `/api/v1/me`.
- **Backups:** `scripts/backup-db.mjs` performs an online SQLite backup with retention (`npm run backup`); schedule via cron + offsite sync.
- **Error resilience:** every route is wrapped in a React `ErrorBoundary` (a page crash no longer white-screens the app); global overlays are portalled to `document.body`.

> Outstanding for full production readiness (CSRF tokens, password reset + email, MFA, centralized logging/monitoring, automated tests, pagination): see `PRODUCTION_READINESS.md`.

## Pentest Results (June 2026)

| Test | Result |
|---|---|
| SQL Injection (all 18 route files) | Pass — prepared statements throughout |
| IDOR: user A accessing user B timesheets | Pass — ownership checked every operation |
| Unauthenticated API access (8 endpoints) | Pass — all return 401 |
| Admin endpoints as regular user | Pass — all return 403 |
| Brute force (20 attempts) | Pass — rate limited at attempt 14 |
| CORS with evil origin | Pass — blocked |
| Session invalidation after logout | Pass — server-side delete confirmed |
| Stack trace leakage | Fixed June 2026 |
| Security headers | Fixed June 2026 |
| Cookie Secure flag | Fixed June 2026 |

---

# 10. Data Flow Diagrams

## Login Flow

```
Browser                    nginx                Express              SQLite
   │                          │                    │                   │
   │─── POST /api/v1/login ──▶│                    │                   │
   │                          │─── proxy ─────────▶│                   │
   │                          │                    │── SELECT users ──▶│
   │                          │                    │◀── user row ───────│
   │                          │                    │── scrypt verify    │
   │                          │                    │── INSERT sessions ▶│
   │◀─ Set-Cookie: mds_session│◀── 200 + cookie ───│                   │
   │                          │                    │                   │
```

## Dashboard Load Flow

```
Browser                    Express                    Replicon API
   │                          │                           │
   │─ GET /api/v1/dashboard ─▶│                           │
   │                          │──── parallel fetches ────▶│
   │                          │  ┌── dictionaries          │
   │                          │  ├── roster                │
   │                          │  ├── drafts                │
   │                          │  ├── cube (time entries)   │
   │                          │  └── timesheets            │
   │◀─ SSE: {dictionaries} ───│◀──────────────────────────│
   │◀─ SSE: {roster} ─────────│◀──────────────────────────│
   │◀─ SSE: {cube} ───────────│◀──────────────────────────│
   │◀─ SSE: {complete} ───────│                           │
   │                          │                           │
   │  IndexedDB cache write   │                           │
   │  Web Worker processing   │                           │
   │  React re-render         │                           │
```

## Timesheet Submission Flow

```
Employee         Express           SQLite          PM/Admin
    │               │                │                │
    │ Enter hours   │                │                │
    │─PUT /rows/hours▶              │                │
    │               │─── UPSERT ───▶│                │
    │◀─ 200 saved ──│               │                │
    │               │               │                │
    │─POST /submit ▶│               │                │
    │               │─UPDATE status▶│                │
    │               │    submitted  │                │
    │◀─ 200 ok ─────│               │                │
    │               │               │                │
    │               │               │──── appears ──▶│
    │               │               │   in approval  │
    │               │               │     queue      │
    │               │               │                │
    │               │               │◀──POST /approve│
    │               │◀─UPDATE───────│                │
    │               │  approved     │                │
    │◀─ notified ───│               │                │
```

## CSV Import Flow

```
Admin uploads 3 CSVs
         │
         ▼
POST /api/v1/admin/import-csv
         │
         ├── Phase 1: Parse File 3 (users CSV)
         │     ├── Create/update employee records
         │     ├── Map email → supervisor in second pass
         │     └── Optional: create user accounts with temp passwords
         │
         ├── Phase 2: Parse File 1 (account managers CSV)
         │     ├── Match client by name
         │     └── Create account_manager if not exists, link to client
         │
         └── Phase 3: Parse File 2 (projects CSV)
               ├── Create projects (match client by name)
               ├── Create tasks per project
               ├── Assign employees to project_resources
               └── Return counts: {employees: N, projects: M, tasks: K, errors: [...]}
```

---

# 11. External Integrations

## Replicon PSA (ap1.replicon.com)

**Purpose:** Source of truth for time entries, projects, clients, employee roster.

**Auth:** HTTP Bearer token (REPLICON_TOKEN env var)

**APIs Used:**

| Service | Operations |
|---|---|
| UserService1 | Get user details and roster |
| ProjectService1 | Create, edit, search projects |
| ClientService1 | Create, edit, search clients |
| TaskService1 | Create task hierarchy |
| GenericReportDataService | Fetch reports as CSV (roster, cube, drafts, timesheets) |

**Report IDs:** Defined in `src/constants/index.js` as UUIDs that map to saved Replicon report definitions.

**Data Flow:** Dashboard streams live data every page refresh. IndexedDB caches it for 2 hours to avoid unnecessary API calls.

---

## Anthropic Claude API

**Purpose:** AI chatbot + workforce insights generation.

**Model Used:** claude-haiku-4-5-20251001 (fast, cost-effective)

**Usage:**

| Feature | Endpoint Called | Purpose |
|---|---|---|
| AI Chat | /api/v1/chat | Stream natural language workforce Q&A |
| Insights | /api/v1/insights/generate | Generate 6-12 weekly workforce insights |
| Calendar Categorization | /api/v1/ai/categorize | Classify Outlook events into project categories |

**Rate Limiting:** Retry with exponential backoff (up to 3 retries on 429).

---

## Microsoft Graph API (Optional)

**Purpose:** Import Outlook calendar events as timesheet entries.

**Auth:** Azure AD OAuth2 client credentials flow (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)

**APIs Used:**
- `/v1.0/users/{email}/calendarView` — Fetch calendar events for a date range
- Token cached for 1 hour

**Configuration Required:** Employee must have `msEmail` field set in their user account linking their Microsoft 365 email address.

---

# 12. Configuration Reference

## Environment Variables

### Required

| Variable | Description | Example |
|---|---|---|
| REPLICON_TOKEN | Bearer token for Replicon API | `Bearer eyJ...` |
| REPLICON_COMPANY | Replicon tenant subdomain | `midisservices` |
| NODE_ENV | Environment name | `production` / `test` / `development` |
| PORT | Server port | `3001` (test), `3000` (prod) |

### Optional — Backend

| Variable | Default | Description |
|---|---|---|
| LOG_LEVEL | info | Pino log level: trace, debug, info, warn, error |
| SESSION_MS | 3600000 | Session duration in milliseconds (1 hour) |
| ALLOWED_ORIGINS | localhost, 129.151.146.210 | Comma-separated CORS origins |
| ANTHROPIC_API_KEY | — | Claude API key (required for AI features) |
| AZURE_TENANT_ID | — | Azure AD tenant (required for Graph/calendar) |
| AZURE_CLIENT_ID | — | Azure AD app client ID |
| AZURE_CLIENT_SECRET | — | Azure AD app client secret |
| AdminPWD | — | Password for default admin user on first start |
| ModPWD | — | Password for default mod user on first start |
| GMPWD | — | Password for default GM user on first start |

### Optional — Frontend (Vite Build)

| Variable | Default | Description |
|---|---|---|
| VITE_EXCLUDED_USERS | Habib Matta, Ziad Shafik, Irfan Najmi, Admin | Comma-separated names excluded from analytics |

## Default Users (Created on First Start)

| ID | Display Name | Role | Created When |
|---|---|---|---|
| ziad | Ziad Shafik | Admin | AdminPWD env var set |
| mod | Irfan Najmi | Standard | ModPWD env var set |
| gm | Habib Matta | Standard | GMPWD env var set |

These are only created if the users table is empty. After creation, passwords can be changed via the Administration panel.

---

# 13. Deployment Procedures

## Initial Server Setup

```bash
# SSH into server
ssh ubuntu@129.151.146.210

# Clone repository
git clone <repo-url> /var/www/replicon/test
cd /var/www/replicon/test

# Create .env file
nano .env
# Fill in REPLICON_TOKEN, REPLICON_COMPANY, NODE_ENV=test, PORT=3001, etc.

# Create data directory (SQLite volume mount)
mkdir -p data

# Build and start
docker compose up -d --build
```

## Routine Deploy (Code Update)

```bash
# On your Windows machine — push code
git push origin test

# On server — pull and rebuild
cd /var/www/replicon/test
git pull
docker compose down && docker compose up -d --build
```

## Check Logs

```bash
# Live logs
docker logs -f mds_dashboard_test

# Last 100 lines
docker logs --tail=100 mds_dashboard_test
```

## Restart Without Rebuild

```bash
docker compose restart
```

## Database Backup

```bash
# Copy DB to safe location
cp /var/www/replicon/test/data/mds.db /var/backups/mds_$(date +%Y%m%d).db
```

## sqlite-web Admin UI

The database can be browsed at `http://129.151.146.210:8888`

```bash
# Start sqlite-web (if not running)
nohup /home/ubuntu/.local/bin/sqlite_web \
  --host 127.0.0.1 --port 8889 \
  /var/www/replicon/test/data/mds.db \
  > /tmp/sqliteweb.log 2>&1 &

# Credentials: set in nginx /etc/nginx/.htpasswd
# Username: admin
```

---

# 14. Environments

## Three Environments Running Simultaneously

| Environment | URL | Docker Container | Port | Branch |
|---|---|---|---|---|
| Production | https://129.151.146.210 | mds_dashboard_production | 3000 | main |
| Test | https://129.151.146.210:8081 | mds_dashboard_test | 3001 | test |
| Development | https://129.151.146.210:8082 | mds_dashboard_dev | 3002 | dev |

Each environment has its own:
- Docker container (isolated process)
- `.env` file (separate API tokens, passwords)
- SQLite database file (separate data)
- nginx server block

## Promotion Process

```
dev branch → dev environment (8082)
     │
     │ review + test
     ▼
test branch → test environment (8081)   ← current main testing
     │
     │ UAT sign-off
     ▼
main branch → production (443)
```

---

*End of Documentation*
*Document generated: June 2026*
*MDS Premium Dashboard v2.0.0*
*Confidential — Midis Services*
