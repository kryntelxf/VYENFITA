
```markdown
# VYENFITA Frontend Module

Frontend UI for **VYENFITA** — AI-native business application & automation platform.

This module provides a complete, production-ready web interface for VYENFITA that integrates with the VYENFITA AI backend service.

---

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Features](#features)
- [Installation](#installation)
- [Integration with Appsmith](#integration-with-appsmith)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)
- [API Client](#api-client)
- [Routing](#routing)
- [Pages](#pages)
- [Components](#components)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The VYENFITA frontend module is a **self-contained React application** that can be mounted into the existing Appsmith client router. It provides the complete user interface for managing:

- **Applications** — create, edit, delete, and generate applications using AI
- **Workflows** — create, execute, and monitor automation workflows
- **Team** — invite members, manage roles, configure permissions
- **Settings** — tenant configuration and preferences

The module communicates exclusively with the **VYENFITA AI Backend** at `/api/v1/*` endpoints, using JWT-based authentication.

---

## Directory Structure

```

app/client/src/vyenfita/
├── api/
│   └── client.ts              # Centralized HTTP client with auth
├── contexts/
│   └── AuthContext.tsx        # Global auth state management
├── components/
│   └── Layout.tsx             # App shell (sidebar + topbar)
├── pages/
│   ├── LoginPage.tsx          # Login UI
│   ├── RegisterPage.tsx       # Registration UI
│   ├── DashboardPage.tsx      # Overview dashboard
│   ├── ApplicationsPage.tsx   # Applications list
│   ├── NewApplicationPage.tsx # AI-powered application generation
│   ├── WorkflowsPage.tsx      # Workflows list & execution
│   └── SettingsPage.tsx       # Tenant & team settings
├── routes.tsx                 # Route definitions & guards
├── index.ts                   # Public module exports
└── README.md                  # This file

```

---

## Features

### Authentication

- **Register** — create a new user and tenant in one step
- **Login** — JWT-based authentication with email, password, and tenant ID
- **Logout** — invalidate session server-side
- **Token refresh** — automatic refresh on 401 responses
- **Session persistence** — tokens stored in `localStorage`
- **Protected routes** — redirect to login if unauthenticated
- **Public routes** — redirect to dashboard if already authenticated

### Dashboard

- **Tenant statistics** — members, applications, workflows, audit events
- **Recent applications** — 5 most recently updated
- **Recent workflows** — 5 most recently created
- **Quick actions** — shortcuts to generate application, create workflow, invite team member

### Applications

- **List** — all applications with search
- **Create via AI** — describe the application in natural language, AI generates the spec
- **Create manually** — start from a blank specification
- **View details** — full application information
- **Delete** — soft delete with confirmation
- **Version history** — see all versions of an application

### Workflows

- **List** — all workflows in the tenant
- **Execute** — run a workflow manually and see the result
- **View executions** — history of all runs with status and duration
- **Delete** — remove a workflow

### Settings

- **Tenant info** — name, slug, tenant ID, plan
- **Team members** — list of all members with roles and status
- **Invite members** — send invitations with role assignment
- **Roles & permissions** — view available roles in the tenant

---

## Installation

The module is part of the main repository. No separate installation is needed.

### Prerequisites

- Node.js 24.14.1
- Yarn 1.22+
- VYENFITA AI Backend running on port 3001 (or configured via env)

### Install dependencies

From the repository root:

```bash
cd app/client
yarn install
```

---

Integration with Appsmith

To mount the VYENFITA frontend into the existing Appsmith client router, add a single route in the main Appsmith router file.

Step 1: Locate the main router

The main router is typically at:

```
app/client/src/ce/AppRouter.tsx
```

or

```
app/client/src/AppRouter.tsx
```

Step 2: Add the VYENFITA route

```tsx
import VYENFITARoutes from './vyenfita/routes';

// Inside your main <Routes> element:
<Route path="/vyenfita/*" element={<VYENFITARoutes />} />
```

Step 3: Verify the route order

The VYENFITA route must be placed before any catch-all routes to avoid conflicts.

Step 4: Access the UI

Once integrated, open:

```
http://localhost:3000/vyenfita
```

You will be redirected to /vyenfita/login.

---

Environment Variables

The API client reads the backend URL from the following sources, in priority order:

1. Runtime — window.VYENFITA_API_URL
2. Build time — process.env.REACT_APP_VYENFITA_API_URL
3. Default — http://localhost:3001

Development

For local development, no configuration is needed if the backend runs on port 3001.

Production

In production, inject the URL via window.VYENFITA_API_URL in the HTML template before the app bundle loads:

```html
<script>
  window.VYENFITA_API_URL = 'https://api.vyenfita.com';
</script>
```

Or set the environment variable in .env:

```
REACT_APP_VYENFITA_API_URL=https://api.vyenfita.com
```

---

Authentication Flow

```
┌──────────────┐
│   Login UI   │
└──────┬───────┘
       │ POST /api/v1/auth/login
       ▼
┌──────────────────────┐
│  AuthController      │
│  (backend)           │
└──────┬───────────────┘
       │ Returns: user + tenant + tokens
       ▼
┌──────────────────────┐
│  AuthContext         │
│  Stores in state     │
└──────┬───────────────┘
       │ localStorage.setItem('vyenfita.accessToken', ...)
       ▼
┌──────────────────────┐
│  ApiClient           │
│  Adds Bearer token   │
│  to every request    │
└──────┬───────────────┘
       │ On 401 response
       ▼
┌──────────────────────┐
│  Auto-refresh        │
│  POST /auth/refresh  │
└──────┬───────────────┘
       │ Retry original request
       ▼
┌──────────────────────┐
│  Success             │
└──────────────────────┘
```

Storage keys

Key Purpose
vyenfita.accessToken JWT access token (short-lived)
vyenfita.refreshToken JWT refresh token (long-lived)
vyenfita.tenantId Current tenant UUID

Security notes

· Tokens are stored in localStorage (not cookies) because the backend is stateless and uses Authorization: Bearer headers.
· On logout, both tokens are removed and the session is revoked server-side.
· On 401, the client attempts a single refresh. If refresh fails, the user is redirected to login.
· Concurrent refresh requests are deduplicated using a shared promise.

---

API Client

The API client (api/client.ts) provides typed methods for all backend endpoints.

Usage

```tsx
import { api } from './vyenfita';

// Login
const result = await api.login({
  email: 'user@example.com',
  password: 'password',
  tenantId: 'uuid',
});

// List applications
const { data, pagination } = await api.listApplications({ limit: 20 });

// Generate application from AI
const spec = await api.generateApplication(
  'Build a customer support platform'
);

// Execute workflow
const result = await api.executeWorkflow('workflow-uuid', { input: 'value' });
```

Error handling

All errors are instances of ApiError:

```tsx
import { ApiError } from './vyenfita';

try {
  await api.createApplication({ ... });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.message, error.statusCode, error.code);
  }
}
```

Available methods

Category Method Description
Auth register Create user + tenant
Auth login Authenticate
Auth logout End session
Auth me Get current user info
Tenant getTenant Get tenant details
Tenant getTenantStats Get tenant statistics
Tenant listMembers List team members
Tenant listRoles List available roles
Tenant inviteMember Send invitation
Applications listApplications List applications
Applications getApplication Get one application
Applications createApplication Create new
Applications updateApplication Update existing
Applications deleteApplication Delete
Applications getApplicationVersions Version history
Applications generateApplication AI generation
Workflows listWorkflows List workflows
Workflows getWorkflow Get one workflow
Workflows createWorkflow Create new
Workflows deleteWorkflow Delete
Workflows executeWorkflow Run workflow
Workflows listWorkflowExecutions Execution history

---

Routing

Routes are defined in routes.tsx using React Router v6.

Route Component Access
/vyenfita/login LoginPage Public
/vyenfita/register RegisterPage Public
/vyenfita/dashboard DashboardPage Protected
/vyenfita/applications ApplicationsPage Protected
/vyenfita/applications/new NewApplicationPage Protected
/vyenfita/applications/:id ApplicationDetailPage Protected
/vyenfita/workflows WorkflowsPage Protected
/vyenfita/settings SettingsPage Protected
/vyenfita/settings/team SettingsPage Protected
/vyenfita/ Redirect → dashboard
/vyenfita/* Redirect → dashboard

Route guards

· ProtectedRoute — wraps authenticated pages. If not authenticated, redirects to /vyenfita/login preserving the intended destination.
· PublicRoute — wraps auth pages. If already authenticated, redirects to /vyenfita/dashboard.

---

Pages

LoginPage

Form with email, password, and tenant ID. On success, redirects to dashboard.

RegisterPage

Form with name, email, password, and optional organization name. On success, creates user, tenant, and initial role, then redirects to dashboard.

DashboardPage

Displays:

· Stat cards (members, applications, workflows, audit events)
· Quick action buttons
· Recent applications list
· Recent workflows list

ApplicationsPage

Grid of application cards with:

· Search
· Status badge
· Update timestamp
· Open/Delete actions
· New Application button

NewApplicationPage

Two modes:

1. AI Generation — natural language description → AI-generated spec
2. Manual — blank specification

Preview of generated spec (entity/page/role count) before creating.

WorkflowsPage

List of workflows with:

· Name, description, creation date
· Status badge
· Execute action (with confirmation)
· Delete action

SettingsPage

Three sections:

1. Organization — read-only tenant info
2. Team Members — table of members with roles and status
3. Invite Member — form to send invitations

---

Components

Layout

App shell that wraps all protected pages:

· Sidebar — brand, navigation, tenant info, sign out
· Topbar — placeholder for future notifications/search
· Content — page content area

Uses inline styles (no external CSS dependency) for portability.

---

Development

Run the frontend

```bash
cd app/client
yarn start
```

The app will be available at http://localhost:3000.

Access the VYENFITA UI at:

```
http://localhost:3000/vyenfita
```

Run the backend

```bash
cd app/ai
yarn dev
```

Backend runs at http://localhost:3001.

Seed demo data

```bash
cd app/ai
yarn db:seed
```

Creates:

· Demo tenant
· Demo user (demo@vyenfita.com / demo123456)
· Default roles and permissions

---

Testing

Manual testing

1. Start backend: cd app/ai && yarn dev
2. Start frontend: cd app/client && yarn start
3. Open http://localhost:3000/vyenfita
4. Register a new account or use demo credentials

Demo credentials

```
Email:    demo@vyenfita.com
Password: demo123456
Tenant:   (copy from seed output)
```

---

Contributing

Code style

· TypeScript strict mode
· Functional components with hooks
· Inline styles for portability (no CSS modules)
· All UI text in English
· All code identifiers in English

Commit message format

```
feat(vyenfita): add new page
fix(vyenfita): correct login redirect
refactor(vyenfita): extract API client
docs(vyenfita): update README
```

Pull requests

1. Create feature branch from vyenfita-development
2. Make changes with tests
3. Ensure CI passes
4. Request review

---

Security Considerations

· Never store secrets in the frontend code
· Never log tokens or passwords
· Always use the API client for backend calls (it handles auth automatically)
· Always validate user input on the backend (frontend validation is UX only)
· Always assume the frontend can be compromised — server-side authorization is the source of truth

---

License

Apache License 2.0 — see the LICENSE file in the repository root.

---

Related Documentation

· Backend API Reference
· Deployment Guide
· Architecture Overview

---

Built with ❤️ by the VYENFITA Team

```

---
