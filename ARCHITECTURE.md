# 🏛️ Yamaha Scan Ticketing v2.0.0 - Architecture Declaration

## 📋 Overview

**Project**: Yamaha Scan Ticketing  
**Version**: 2.0.0  
**Architecture**: Multi-Tenant SaaS Platform  
**Last Updated**: April 2026

---

## 🎯 System Declaration

### Core Philosophy
> **"Single codebase, multi-tenant, real-time event management system"**

### Design Principles
1. **Simplicity**: Minimal abstraction, direct Supabase connection
2. **Real-time**: Live data synchronization across all clients
3. **Security**: Role-based access control (RBAC) at 3 levels
4. **Scalability**: Cloud-native PostgreSQL backend

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ System Admin │  │ Tenant Admin │  │  Gate User   │  │   QR Scan    │   │
│  │  (Browser)   │  │  (Browser)   │  │  (Tablet)    │  │   (Mobile)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                              │                                             │
└──────────────────────────────┼─────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────────────────┐
│                         FRONTEND LAYER (Vite + React)                       │
│                              │                                             │
│  ┌───────────────────────────┴───────────────────────────┐                 │
│  │                    App.jsx (Router)                   │                 │
│  │  ┌─────────────────────────────────────────────────┐   │                 │
│  │  │  /login    →  Login.jsx (Auth entry)            │   │                 │
│  │  │  /admin-panel/* →  System Admin Views           │   │                 │
│  │  │  /admin-tenant/* →  Tenant Admin Views         │   │                 │
│  │  │  /gate/*   →  Gate Check-in Views             │   │                 │
│  │  └─────────────────────────────────────────────────┘   │                 │
│  │                                                         │                 │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │                 │
│  │  │  contexts/  │  │  services/  │  │   hooks/    │     │                 │
│  │  │ AuthContext │  │ authService │  │  useAuth    │     │                 │
│  │  │ dataSync    │  │tenantService│  │  useTenant  │     │                 │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │                 │
│  └─────────────────────────────────────────────────────────┘                 │
│                              │                                             │
│  ┌───────────────────────────┴───────────────────────────┐                 │
│  │                  lib/dataSync.js                        │                 │
│  │  • Workspace state management                           │                 │
│  │  • Real-time subscriptions                              │                 │
│  │  • CRUD operations (syncTenantUpsert, etc.)             │                 │
│  └─────────────────────────────────────────────────────────┘                 │
│                              │                                             │
└──────────────────────────────┼─────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────────────────┐
│                      BACKEND LAYER (Supabase)                               │
│                              │                                             │
│  ┌───────────────────────────┴───────────────────────────┐                 │
│  │                    PostgreSQL Database                │                 │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │                 │
│  │  │system_admins │ │   tenants    │ │  gate_users  │ │                 │
│  │  │──────────────│ │──────────────│ │──────────────│ │                 │
│  │  │ id (pk)      │ │ id (pk)      │ │ id (pk)      │ │                 │
│  │  │ username     │ │ name         │ │ tenant_id    │ │                 │
│  │  │ password_hash│ │ code         │ │ username     │ │                 │
│  │  │ is_active    │ │ is_active    │ │ gate_assign  │ │                 │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ │                 │
│  │                                                      │                 │
│  │  ┌──────────────────────────────────────────────┐   │                 │
│  │  │      workspace_state (JSONB realtime)        │   │                 │
│  │  │  • tenant_registry (JSONB)                 │   │                 │
│  │  │  • store (JSONB)                           │   │                 │
│  │  │  • Real-time subscriptions                 │   │                 │
│  │  └──────────────────────────────────────────────┘   │                 │
│  └───────────────────────────────────────────────────────┘                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐                 │
│  │              Supabase Realtime API                      │                 │
│  │  • WebSocket subscriptions                              │                 │
│  │  • Live data sync across clients                      │                 │
│  │  • Instant updates on mutations                       │                 │
│  └─────────────────────────────────────────────────────────┘                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐                 │
│  │                Supabase Auth (JWT)                      │                 │
│  │  • Token-based authentication                         │                 │
│  │  • Row Level Security (RLS) policies                  │                 │
│  └─────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Role-Based Access Control (RBAC)

### 3-Level Hierarchy

```
                    ┌─────────────────┐
                    │   SYSTEM_ADMIN  │ ← Developer/Super Admin
                    │   (Level 1)     │
                    └────────┬────────┘
                             │ manages
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────────┐    │     ┌────────▼────────┐
     │   TENANT_ADMIN  │◄───┘     │   TENANT_ADMIN  │
     │   (Level 2)     │          │   (Level 2)     │
     │   Tenant A      │          │   Tenant B      │
     └────────┬────────┘          └─────────────────┘
              │ manages
     ┌────────┴────────┐
     │   GATE_USER     │ ← Scanner Operator
     │   (Level 3)     │
     │   Front/Back    │
     └─────────────────┘
```

### Permission Matrix

| Feature | System Admin | Tenant Admin | Gate User |
|---------|-------------|--------------|-----------|
| Manage Tenants | ✅ Create/Edit/Delete | ❌ View only | ❌ No access |
| Manage Gate Users | ✅ All tenants | ✅ Own tenant only | ❌ No access |
| View Participants | ✅ All tenants | ✅ Own tenant only | ✅ Own tenant |
| Check-in/Check-out | ❌ No access | ✅ Manual override | ✅ Primary role |
| View Reports | ✅ All tenants | ✅ Own tenant only | ❌ Limited |
| System Settings | ✅ Full access | ❌ No access | ❌ No access |

---

## 🔄 Data Flow Architecture

### Read Flow (Workspace State)

```
User Login → AuthContext → fetchWorkspaceSnapshot()
                              ↓
                    ┌─────────────────┐
                    │  Supabase REST  │
                    │  /workspace_state
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │   _workspaceSnapshot
                    │   (local cache)
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │ subscribeWorkspaceChanges()
                    │   (WebSocket realtime)
                    └─────────────────┘
```

### Write Flow (Mutations)

```
User Action → syncTenantUpsert() / syncParticipantUpsert()
                              ↓
                    ┌─────────────────┐
                    │  Supabase REST  │
                    │  UPDATE/INSERT  │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │  Realtime Broadcast
                    │  (WebSocket)
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │  All Clients Update
                    │  (live sync)
                    └─────────────────┘
```

---

## 📊 Database Schema

### Core Tables

```sql
-- System Administrators (Level 1)
CREATE TABLE system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations/Tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant Administrators (Level 2)
CREATE TABLE tenant_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, username)
);

-- Gate Users/Operators (Level 3)
CREATE TABLE gate_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT,
    gate_assignment TEXT DEFAULT 'front', -- 'front' | 'back' | 'both'
    password_hash TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, username)
);

-- Real-time Workspace State (JSONB)
CREATE TABLE workspace_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    tenant_registry JSONB DEFAULT '{"activeTenantId": "", "tenants": {}}',
    store JSONB DEFAULT '{"tenants": {}}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🛠️ Technology Stack

### Frontend
| Tech | Purpose |
|------|---------|
| React 18 | UI Framework |
| Vite | Build Tool |
| React Router v6 | Routing |
| Supabase JS | Backend Client |
| Chart.js | Analytics |
| html5-qrcode | QR Scanner |

### Backend
| Tech | Purpose |
|------|---------|
| Supabase | Backend-as-a-Service |
| PostgreSQL | Database |
| Supabase Auth | JWT Authentication |
| Supabase Realtime | WebSocket Subscriptions |
| RLS Policies | Row Level Security |

### Infrastructure
| Tech | Purpose |
|------|---------|
| Supabase Cloud | Hosted Backend |
| Railway/Vercel | Frontend Hosting |
| Docker | Containerization |

---

## 📁 Project Structure Declaration

```
yamaha-scan-tiketing/                 ← Root Project
│
├── 📦 src/                            ← Frontend Source
│   ├── 📂 api/                        ← API Layer
│   │   └── supabase.js                # Supabase client
│   │
│   ├── 📂 components/                 ← UI Components
│   │   ├── 📂 Layout/                 # Layout components
│   │   ├── 📂 ui/                     # Reusable UI
│   │   └── index.js                   # Barrel export
│   │
│   ├── 📂 contexts/                   ← Global State
│   │   ├── AuthContextSaaS.jsx        # 3-level auth
│   │   └── index.js                   # Barrel export
│   │
│   ├── 📂 hooks/                      ← Custom Hooks
│   │   ├── useAuth.js
│   │   ├── useTenant.js
│   │   └── index.js                   # Barrel export
│   │
│   ├── 📂 lib/                        ← Core Utilities
│   │   ├── dataSync.js                # Workspace sync
│   │   ├── qrSecurity.js              # QR utilities
│   │   └── index.js                   # Barrel export
│   │
│   ├── 📂 pages/                      ← Route Pages
│   │   ├── 📂 auth/                   # Login
│   │   ├── 📂 admin-panel/            # System Admin
│   │   ├── 📂 admin-tenant/           # Tenant Admin
│   │   └── 📂 gate/                   # Gate User
│   │
│   ├── 📂 services/                   ← Business Logic
│   │   ├── authService.js              # Auth operations
│   │   ├── tenantService.js            # Tenant CRUD
│   │   └── index.js                    # Barrel export
│   │
│   ├── 📂 utils/                      ← Utilities
│   ├── App.jsx                        # Root component
│   ├── main.jsx                       # Entry point
│   └── index.css                      # Global styles
│
├── 📦 supabase/                       ← Database Migrations
│   └── 📂 migrations/
│       ├── 001_create_system_admins.sql
│       └── 002_create_workspace_and_gate_users.sql
│
├── 📦 scripts/                        ← Utility Scripts
├── 📦 docs/                           ← Documentation
├── 📦 public/                         ← Static Assets
├── 📦 wa-server/                      ← WhatsApp Server (separate)
│
├── 📜 package.json                    # v2.0.0
├── 📜 vite.config.js
├── 📜 index.html
└── 📜 README.md
```

---

## 🚀 Deployment Architecture

### Development
```
Local Machine
├── Vite Dev Server (http://localhost:5174)
└── Supabase (Cloud)
```

### Production
```
Internet
│
├─► Vercel/Railway (Frontend)
│   └── Static Build (npm run build)
│
└─► Supabase Cloud (Backend)
    ├── PostgreSQL Database
    ├── Auth Service
    └── Realtime API
```

---

## 📈 Scaling Strategy

### Horizontal Scaling
- **Frontend**: Static hosting (CDN-ready)
- **Backend**: Supabase auto-scales
- **Database**: PostgreSQL managed service

### Caching Strategy
- Local state: `_workspaceSnapshot` in memory
- Real-time updates: Supabase subscriptions
- No Redis needed (real-time is push-based)

---

## 🔒 Security Declaration

### Authentication
- JWT tokens from Supabase Auth
- Custom role claims in JWT
- Token refresh handled automatically

### Authorization
- RLS policies per table
- Role checks in frontend routes
- Server-side validation on mutations

### Data Isolation
- Tenant ID filtering on all queries
- Gate users only see own tenant data
- System admin sees all tenants

---

## 📝 API Contract

### DataSync Interface

```typescript
// Workspace Operations
fetchWorkspaceSnapshot(): Promise<WorkspaceSnapshot>
subscribeWorkspaceChanges(callback): UnsubscribeFn

// Tenant Operations
syncTenantUpsert({ tenantId, tenant }): Promise<void>
syncTenantDelete(tenantId): Promise<void>

// Gate User Operations
syncTenantUserUpsert(user): Promise<void>
syncTenantUserDelete(userId): Promise<void>

// Participant Operations
syncParticipantUpsert(participant): Promise<void>
```

---

## 🎯 Success Metrics

| Metric | Target |
|--------|--------|
| Page Load | < 2s |
| Real-time Latency | < 100ms |
| QR Scan Response | < 500ms |
| Concurrent Users | > 1000 |
| Uptime | > 99.9% |

---

## 📚 Related Documentation

- `PROJECT_STRUCTURE.md` - Folder organization
- `README.md` - Getting started guide
- `supabase/migrations/` - Database setup

---

## 👥 Maintainer

**Version 2.0.0** - Multi-Tenant SaaS Architecture  
**Date**: April 2026  
**Status**: Production Ready ✅

---

*This architecture declaration serves as the single source of truth for Yamaha Scan Ticketing system design.*
