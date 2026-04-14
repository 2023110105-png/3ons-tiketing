# 🏗️ Yamaha Scan Ticketing - Project Architecture

## 📁 Struktur Folder

```
yamaha-scan-tiketing/
├── 📦 src/                          # Source code utama
│   ├── 🎯 main.jsx                  # Entry point aplikasi
│   ├── 🎯 App.jsx                   # Root component & routing
│   │
│   ├── 📂 api/                      # API layer (Supabase clients)
│   │   └── supabase.js              # Supabase client configuration
│   │
│   ├── 📂 contexts/                 # React Contexts (Global State)
│   │   ├── AuthContextSaaS.jsx      # Auth: system_admin, tenant_admin, gate_user
│   │   ├── ToastContext.jsx         # Toast notifications
│   │   └── index.js                 # Context barrel exports
│   │
│   ├── 📂 hooks/                    # Custom React Hooks
│   │   ├── useAuth.js               # Authentication hook
│   │   ├── useTenant.js             # Tenant context hook
│   │   └── useDataSync.js           # Data synchronization hook
│   │
│   ├── 📂 lib/                      # Utilities & Core Logic
│   │   ├── dataSync.js              # Core: workspace sync, mutations
│   │   ├── qrSecurity.js            # QR code generation & validation
│   │   └── utils.js                 # General utilities
│   │
│   ├── 📂 components/               # Shared UI Components
│   │   ├── Layout/
│   │   │   ├── Layout.jsx           # Main layout with navigation
│   │   │   ├── Sidebar.jsx          # Sidebar navigation
│   │   │   └── Header.jsx           # Top header bar
│   │   ├── ui/                      # Reusable UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Table.jsx
│   │   ├── ErrorBoundary.jsx        # Error handling
│   │   ├── OfflineIndicator.jsx     # Offline status
│   │   └── WaConnectBanner.jsx      # WhatsApp connection status
│   │
│   ├── 📂 pages/                    # Route Pages (by role)
│   │   ├── 📂 auth/                 # Authentication pages
│   │   │   └── Login.jsx
│   │   │
│   │   ├── 📂 admin-panel/          # System Admin (Super Admin)
│   │   │   ├── AdminPanel.jsx       # Layout with tabs
│   │   │   ├── tabs/
│   │   │   │   ├── OverviewTab.jsx  # System overview
│   │   │   │   ├── TenantsTab.jsx   # Tenant management
│   │   │   │   ├── GateUsersTab.jsx # Gate user management
│   │   │   │   └── AuditTab.jsx     # Audit logs
│   │   │   └── GateUsers.jsx        # (legacy - to be moved)
│   │   │
│   │   ├── 📂 admin-tenant/         # Tenant Admin
│   │   │   ├── Dashboard.jsx        # Main dashboard
│   │   │   ├── Participants.jsx     # Participant management
│   │   │   ├── Settings.jsx         # Event settings
│   │   │   ├── OpsMonitor.jsx       # Operations monitoring
│   │   │   ├── Reports.jsx          # Reporting & analytics
│   │   │   ├── Analytics.jsx        # Data analytics
│   │   │   ├── QRGenerate.jsx       # QR code generation
│   │   │   ├── BarcodeImport.jsx    # Barcode import
│   │   │   ├── ConnectDevice.jsx    # Device connection
│   │   │   └── WaDelivery.jsx       # WhatsApp delivery
│   │   │
│   │   └── 📂 gate/                 # Gate User (Scanner)
│   │       ├── FrontGate.jsx        # Front gate check-in
│   │       └── BackGate.jsx         # Back gate check-in
│   │
│   ├── 📂 services/                 # Business Logic Services
│   │   ├── authService.js           # Auth operations
│   │   ├── tenantService.js         # Tenant CRUD
│   │   ├── participantService.js    # Participant operations
│   │   └── gateService.js           # Gate check-in/out
│   │
│   ├── 📂 stores/                   # State Management (Zustand/Redux)
│   │   ├── authStore.js             # Auth state
│   │   ├── tenantStore.js           # Tenant state
│   │   └── workspaceStore.js        # Workspace/sync state
│   │
│   ├── 📂 styles/                   # Global Styles
│   │   ├── index.css                # Main stylesheet
│   │   └── variables.css            # CSS variables
│   │
│   └── 📂 types/                    # TypeScript Types (or JSDoc)
│       ├── auth.types.js
│       ├── tenant.types.js
│       └── api.types.js
│
├── 📦 public/                       # Static assets
│   ├── logo.svg
│   └── favicon.ico
│
├── 📦 scripts/                      # Build & utility scripts
│   └── setup-supabase.js            # Database setup
│
├── 📦 supabase/                     # Supabase migrations & SQL
│   ├── migrations/
│   │   ├── 001_create_tables.sql
│   │   └── 002_seed_data.sql
│   └── functions/                   # Edge functions (if any)
│
├── 📦 docs/                         # Documentation
│   ├── ARCHITECTURE.md              # System architecture declaration
│   ├── PROJECT_STRUCTURE.md         # This file
│   └── UI_UX_PLAN.md                # UI/UX improvement roadmap
│
├── 📦 wa-server/                    # WhatsApp server (separate service)
│   └── ...
│
└── 📝 Root Config Files
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── tailwind.config.js
    └── README.md
```

---

## 🏛️ Architecture Pattern

### Multi-Tenant SaaS Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ System Admin │  │Tenant Admin │  │  Gate User  │     │
│  │  (/admin)    │  │(/dashboard) │  │  (/gate)    │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │              │
│         └────────────────┴────────────────┘              │
│                    │                                     │
│         ┌─────────┴──────────┐                          │
│         │   AuthContextSaaS  │  ← Role-based routing    │
│         └─────────┬──────────┘                          │
│                   │                                     │
│         ┌─────────┴──────────┐                          │
│         │     dataSync.js    │  ← Workspace sync        │
│         └─────────┬──────────┘                          │
└───────────────────┼─────────────────────────────────────┘
                    │
┌───────────────────┼─────────────────────────────────────┐
│                   │           BACKEND LAYER                │
│         ┌─────────┴──────────┐                          │
│         │      Supabase      │                          │
│         │  ┌──────────────┐  │                          │
│         │  │     Auth     │  │  ← JWT authentication    │
│         │  ├──────────────┤  │                          │
│         │  │  Database    │  │  ← PostgreSQL            │
│         │  │  - tenants   │  │                          │
│         │  │  - gate_users│  │                          │
│         │  │  - workspace │  │                          │
│         │  ├──────────────┤  │                          │
│         │  │   Realtime   │  │  ← Live subscriptions    │
│         │  └──────────────┘  │                          │
│         └────────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Role-Based Access Control (RBAC)

| Role | Route Prefix | Access |
|------|--------------|--------|
| `system_admin` | `/admin-panel/*` | Full system access, all tenants |
| `tenant_admin` | `/admin-tenant/*` | Single tenant management |
| `gate_user` | `/gate/*` | Check-in/check-out only |

---

## 📊 Database Schema (Supabase)

### Tables

```sql
system_admins      -- System-level administrators
tenants            -- Tenant/organization data  
tenant_admins      -- Tenant-level administrators
gate_users         -- Gate/scanner operators
workspace_state    -- Real-time sync data (JSONB)
```

---

## 🔄 Data Flow

```
1. User Login → AuthContextSaaS → Supabase Auth
2. Role Detection → Route Protection → Redirect to role-specific page
3. Data Fetch → dataSync.js → Workspace State → Real-time subscription
4. Mutations → sync* functions → Supabase → Real-time broadcast
```

---

## 🛠️ Development Guidelines

### Adding New Features

1. **New Page**: Add to `src/pages/{role-folder}/`
2. **New Component**: Add to `src/components/` (shared) or `src/pages/{folder}/components/` (page-specific)
3. **New API**: Add to `src/lib/dataSync.js` or `src/services/`
4. **New Hook**: Add to `src/hooks/`

### File Naming Conventions

- **Components**: PascalCase (e.g., `GateUsers.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.js`)
- **Services**: camelCase (e.g., `authService.js`)
- **Utils**: camelCase (e.g., `qrSecurity.js`)

---

## 📱 Future Improvements

- [ ] Migrate to TypeScript
- [ ] Add unit tests (Jest/Vitest)
- [ ] Add E2E tests (Playwright)
- [ ] Implement proper API layer (services/)
- [ ] Add proper error handling
- [ ] Add loading states
- [ ] Offline-first architecture (PWA)
