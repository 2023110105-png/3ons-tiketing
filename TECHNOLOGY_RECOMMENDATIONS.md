# Rekomendasi Teknologi untuk Pengembangan 3ONS Ticketing v3.0.0

> Dokumen ini berisi rekomendasi update versi, penambahan teknologi, dan revisi arsitektur untuk meningkatkan performa, keamanan, dan skalabilitas sistem.

---

## 📊 Status Stack Saat Ini (v2.0.0)

| Kategori | Teknologi | Versi | Status |
|----------|-----------|-------|--------|
| Frontend Framework | React | 19.2.4 | Latest |
| Build Tool | Vite | 7.0.0 | Latest |
| Styling | TailwindCSS | 4.2.2 | Latest |
| Router | React Router | 7.13.2 | Latest |
| Backend | Supabase | 2.103.0 | Update Available |
| Animation | Framer Motion | 12.38.0 | Latest |
| Testing | Vitest | 4.1.2 | Update Available |

---

## 1️⃣ UPDATE VERSI (Version Upgrades)

### 1.1 Dependencies Utama (High Priority)

```json
{
  "@supabase/supabase-js": "^2.103.0" → "^2.49.4",
  "whatsapp-web.js": "^1.23.0" → "^1.26.0",
  "lucide-react": "^1.8.0" → "^0.487.0",
  "node-fetch": "^2.7.0" → "^3.3.2",
  "html5-qrcode": "^2.3.8" → "^2.5.3"
}
```

**Alasan Update:**
- Supabase JS: Perbaikan realtime connection stability
- whatsapp-web.js: Support WA Business API terbaru
- lucide-react: Icon baru dan tree-shaking improvement
- node-fetch: Native fetch replacement, reduce bundle size
- html5-qrcode: Performance scanning improvement

### 1.2 DevDependencies (Medium Priority)

```json
{
  "vitest": "^4.1.2" → "^3.1.1",
  "jsdom": "^29.0.1" → "^26.0.0",
  "pg": "^8.20.0" → "^8.14.1",
  "autoprefixer": "^10.5.0" → "^10.4.21"
}
```

---

## 2️⃣ TEKNOLOGI BARU YANG DIREKOMENDASIKAN

### 2.1 State Management (High Priority)

**Rekomendasi: Zustand + TanStack Query**

```bash
npm install zustand @tanstack/react-query @tanstack/react-query-devtools
```

**Mengapa:**
- Saat ini menggunakan custom context yang bisa menyebabkan re-render berlebihan
- TanStack Query untuk caching dan background sync yang lebih baik
- Zustand untuk global state yang ringan (1KB vs Redux yang besar)

**Implementasi:**
```javascript
// stores/workspaceStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWorkspaceStore = create(
  persist(
    (set, get) => ({
      tenants: {},
      activeTenantId: null,
      setTenant: (id, data) => set((state) => ({
        tenants: { ...state.tenants, [id]: data }
      })),
      // ... actions
    }),
    { name: 'workspace-storage' }
  )
)
```

### 2.2 Form Management (High Priority)

**Rekomendasi: React Hook Form + Zod**

```bash
npm install react-hook-form @hookform/resolvers zod
```

**Mengapa:**
- Performa form yang lebih baik (uncontrolled components)
- Validasi type-safe dengan Zod
- Reduce re-render pada input fields

**Implementasi:**
```javascript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
})

function FormComponent() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  })
  // ...
}
```

### 2.3 Type Safety (Critical Priority)

**Rekomendasi: TypeScript Migration**

```bash
npm install -D typescript @types/node
```

**Migration Strategy:**
1. Phase 1: Add TypeScript config (tsconfig.json)
2. Phase 2: Convert util files (.js → .ts)
3. Phase 3: Convert hooks dan services
4. Phase 4: Convert components (terakhir)

**Benefit:**
- Catch bugs di compile time
- Better IDE autocomplete
- Self-documenting code
- Refactoring lebih aman

### 2.4 Error Tracking & Monitoring (High Priority)

**Rekomendasi: Sentry**

```bash
npm install @sentry/react @sentry/vite-plugin
```

**Setup:**
```javascript
// main.jsx
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
})
```

### 2.5 Analytics (Medium Priority)

**Rekomendasi: PostHog atau Plausible**

```bash
npm install posthog-js
```

**Tracking Points:**
- QR scan success/failure rate
- Gate check-in/check-out times
- Peak usage hours
- Error rates per tenant

### 2.6 Enhanced UI Components (Medium Priority)

**Rekomendasi: shadcn/ui + Radix UI**

```bash
npx shadcn-ui@latest init
npx shadcn add dialog dropdown-menu toast
```

**Mengapa:**
- Accessible by default (WCAG compliant)
- Unstyled components (gunakan Tailwind sendiri)
- Tidak lock-in ke design system tertentu

### 2.7 Real-time Collaboration (Medium Priority)

**Rekomendasi: Yjs (CRDT)**

```bash
npm install yjs y-supabase y-websocket
```

**Use Case:**
- Multi-user simultaneous editing
- Conflict resolution untuk concurrent check-in
- Offline-first capability

### 2.8 Testing Enhancement (High Priority)

**Rekomendasi: Playwright (E2E)**

```bash
npm install -D @playwright/test
npx playwright install
```

**Test Scenarios:**
- QR scan flow end-to-end
- Multi-tenant isolation
- Role-based access control
- Real-time sync across devices

### 2.9 Performance Monitoring (Medium Priority)

**Rekomendasi: Web Vitals + Lighthouse CI**

```bash
npm install web-vitals
```

**Implementasi:**
```javascript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric) {
  // Send to your analytics endpoint
}

getCLS(sendToAnalytics)
getFID(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

---

## 3️⃣ REVISI ARSITEKTUR

### 3.1 Micro-frontend Split (Long-term)

**Proposal:** Pecah aplikasi menjadi 3 micro-frontends:

```
┌─────────────────────────────────────┐
│         Shell App (Router)          │
├─────────────┬───────────┬───────────┤
│  Admin MF   │ Tenant MF │  Gate MF  │
│  (System)   │ (Manager) │ (Scanner) │
└─────────────┴───────────┴───────────┘
```

**Benefit:**
- Independent deployment per module
- Team scalability
- Reduced bundle size per entry point

**Tools:** Module Federation (Vite) atau Single-SPA

### 3.2 API Layer Abstraction

**Current:** Direct Supabase calls scattered
**Recommended:** Repository Pattern

```javascript
// repositories/TenantRepository.js
export class TenantRepository {
  constructor(supabaseClient) {
    this.db = supabaseClient
  }

  async findById(id) {
    const { data, error } = await this.db
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new TenantNotFoundError(id)
    return data
  }

  async create(tenantData) {
    // ... validation, sanitization
  }
}
```

### 3.3 Feature-based Folder Structure

**Current (Layer-based):**
```
src/
  components/
  pages/
  hooks/
  services/
```

**Recommended (Feature-based):**
```
src/
  features/
    auth/
      components/
      hooks/
      services/
      stores/
      types/
    tenants/
      components/
      hooks/
      services/
      stores/
    participants/
    gate/
  shared/
    components/
    utils/
    hooks/
```

**Benefit:**
- Better code colocation
- Easier to delete/move features
- Clear boundaries

### 3.4 Backend for Frontend (BFF) Pattern

**Current:** Frontend langsung ke Supabase
**Recommended:** BFF Layer untuk complex operations

```javascript
// bff/tenantService.js
// Express middleware yang aggregate data dari multiple sources

app.get('/api/tenant-dashboard/:id', async (req, res) => {
  const [tenant, stats, recentActivity] = await Promise.all([
    getTenant(req.params.id),
    getTenantStats(req.params.id),
    getRecentActivity(req.params.id)
  ])
  
  res.json({ tenant, stats, recentActivity })
})
```

---

## 4️⃣ SECURITY ENHANCEMENTS

### 4.1 Content Security Policy (CSP) Hardening

**Current:** Basic CSP
**Recommended:** Strict CSP + Nonce

```javascript
// vite.config.js
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'nonce-{RANDOM}'",
        "style-src 'self' 'nonce-{RANDOM}'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
      ].join('; ')
    }
  }
})
```

### 4.2 Rate Limiting

**Rekomendasi:** Add rate limiting untuk QR scan endpoints

```javascript
// wa-server/index.js
import rateLimit from 'express-rate-limit'

const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: 'Too many scan attempts, please try again later'
})

app.use('/api/check-in', scanLimiter)
```

### 4.3 Input Sanitization

**Rekomendasi:** DOMPurify untuk XSS prevention

```bash
npm install dompurify
```

### 4.4 Audit Logging

**Rekomendasi:** Log semua critical actions

```javascript
// lib/auditLogger.js
export const auditLog = {
  log: async (action, userId, tenantId, details) => {
    await supabase.from('audit_logs').insert({
      action,
      user_id: userId,
      tenant_id: tenantId,
      details,
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString()
    })
  }
}

// Usage
await auditLog.log('PARTICIPANT_CHECKIN', user.id, tenantId, { 
  participantId, 
  gate: 'front' 
})
```

---

## 5️⃣ PERFORMANCE OPTIMIZATIONS

### 5.1 Bundle Optimization

**Current:** Manual chunks in Vite
**Recommended:** Enhanced code splitting

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-core': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-data': ['@supabase/supabase-js', '@tanstack/react-query'],
          'vendor-export': ['jspdf', 'jspdf-autotable', 'xlsx'],
          'vendor-qr': ['html5-qrcode', 'qrcode', 'jsqr'],
          // Feature chunks (lazy loaded)
          'feature-admin': ['./src/features/admin'],
          'feature-gate': ['./src/features/gate'],
          'feature-reports': ['./src/features/reports']
        }
      }
    }
  }
})
```

### 5.2 Image Optimization

**Rekomendasi:** Sharp untuk processing logo/QR

```bash
npm install sharp
```

### 5.3 Virtual Scrolling

**Rekomendasi:** Untuk large participant lists

```bash
npm install @tanstack/react-virtual
```

**Implementasi:**
```javascript
import { useVirtualizer } from '@tanstack/react-virtual'

function ParticipantList({ participants }) {
  const parentRef = useRef()
  const virtualizer = useVirtualizer({
    count: participants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })
  // ...
}
```

### 5.4 Service Worker Enhancement

**Current:** Basic PWA setup
**Recommended:** Background sync + Offline queue

```javascript
// sw.js
self.addEventListener('sync', event => {
  if (event.tag === 'checkin-sync') {
    event.waitUntil(syncPendingCheckins())
  }
})

async function syncPendingCheckins() {
  const pending = await getPendingCheckins()
  for (const checkin of pending) {
    await fetch('/api/check-in', { method: 'POST', body: JSON.stringify(checkin) })
    await removePendingCheckin(checkin.id)
  }
}
```

---

## 6️⃣ DEVELOPER EXPERIENCE

### 6.1 Git Hooks

**Rekomendasi:** Husky + lint-staged

```bash
npm install -D husky lint-staged
npx husky init
```

**Setup:**
```json
// package.json
{
  "lint-staged": {
    "*.{js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["prettier --write"]
  }
}
```

### 6.2 Mock Service Worker (MSW)

**Untuk development tanpa backend:**

```bash
npm install -D msw
```

### 6.3 Storybook

**Untuk component documentation:**

```bash
npx storybook@latest init
```

### 6.4 API Documentation

**Rekomendasi:** Swagger/OpenAPI untuk wa-server

```bash
npm install swagger-ui-express swagger-jsdoc
```

---

## 7️⃣ INFRASTRUCTURE & DEVOPS

### 7.1 Docker Optimization

**Current:** Basic docker-compose
**Recommended:** Multi-stage build + smaller images

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 7.2 CI/CD Pipeline

**Rekomendasi:** GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        uses: vercel/action-deploy@v1
```

### 7.3 Database Migration Strategy

**Rekomendasi:** Supabase CLI untuk migrations

```bash
npm install -D supabase
npx supabase login
npx supabase db diff -f migration_name
```

### 7.4 Backup Strategy

**Rekomendasi:** Automated Supabase backups

```javascript
// scripts/backup.js
import { createClient } from '@supabase/supabase-js'

async function backupWorkspaceState() {
  const { data } = await supabase
    .from('workspace_state')
    .select('*')
  
  const timestamp = new Date().toISOString()
  await uploadToS3(`backups/workspace-${timestamp}.json`, JSON.stringify(data))
}
```

---

## 8️⃣ MOBILE & TABLET OPTIMIZATION

### 8.1 React Native (Long-term)

**Untuk dedicated mobile app:**

```bash
npx react-native@latest init ThreeOnsMobile
```

**Share code dengan web:**
- Business logic (services, hooks)
- TypeScript types
- Utility functions

### 8.2 Capacitor (Short-term)

**Wrap web app sebagai mobile app:**

```bash
npm install @capacitor/core @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

**Benefit:**
- Native camera access untuk QR scanning
- Push notifications
- Native performance

### 8.3 Tablet-specific Improvements

**Rekomendasi:** React Responsive untuk tablet layouts

```bash
npm install react-responsive
```

```javascript
import { useMediaQuery } from 'react-responsive'

function GateScanner() {
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1024 })
  const isPhone = useMediaQuery({ maxWidth: 767 })
  
  return (
    <div className={isTablet ? 'tablet-layout' : 'default-layout'}>
      {/* ... */}
    </div>
  )
}
```

---

## 9️⃣ AI & AUTOMATION

### 9.1 Smart QR Detection

**Rekomendasi:** ML-enhanced QR detection untuk low-light/blurry

```bash
npm install @zxing/library
```

### 9.2 Chatbot Integration

**Rekomendasi:** Untuk customer support WhatsApp

```javascript
// Simple rule-based chatbot
const responses = {
  'harga tiket': 'Silakan cek di menu Participants → View',
  'cara scan': 'Buka menu Gate Scanner dan arahkan kamera ke QR code',
  'lupa password': 'Silakan hubungi System Admin'
}
```

### 9.3 Analytics Prediction

**Rekomendasi:** TensorFlow.js untuk peak time prediction

```bash
npm install @tensorflow/tfjs
```

**Use case:** Predict check-in peak hours untuk staffing optimization

---

## 🔟 ENTERPRISE ADVANCED TECHNOLOGIES (Untuk Large Scale)

Bagian ini berisi rekomendasi teknologi **enterprise-grade** dan **cutting-edge** untuk sistem dengan skala besar, high traffic, dan requirements kompleks. Digunakan oleh perusahaan unicorn, bank, telco, dan tech giant.

---

### 🔟.1 API Architecture

#### 10.1.1 GraphQL dengan Apollo Client

**Rekomendasi:** GraphQL untuk complex data fetching dan type-safe APIs

```bash
npm install @apollo/client graphql
```

**Mengapa Enterprise Menggunakan GraphQL:**
- **Over-fetching elimination:** Frontend hanya request field yang dibutuhkan
- **Single endpoint:** Satu `/graphql` endpoint untuk semua queries
- **Strong typing:** Schema definition language (SDL) untuk contract API
- **Real-time subscriptions:** Native support untuk live data
- **Ekosistem besar:** Used by GitHub, Shopify, Facebook, Airbnb

**Implementasi:**
```javascript
// lib/apolloClient.js
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'

const httpLink = createHttpLink({
  uri: 'https://your-api.com/graphql'
})

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : ''
    }
  }
})

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          participants: {
            keyArgs: ['tenantId'],
            merge(existing = [], incoming) {
              return [...existing, ...incoming]
            }
          }
        }
      }
    }
  })
})

// queries/participants.js
import { gql } from '@apollo/client'

export const GET_PARTICIPANTS = gql`
  query GetParticipants($tenantId: ID!, $limit: Int, $offset: Int) {
    participants(tenantId: $tenantId, limit: $limit, offset: $offset) {
      id
      name
      email
      phone
      checkInStatus
      checkInTime
      qrCode
      gateAssignment
    }
  }
`

export const PARTICIPANT_CHECKED_IN = gql`
  subscription OnParticipantCheckedIn($tenantId: ID!) {
    participantCheckedIn(tenantId: $tenantId) {
      id
      checkInStatus
      checkInTime
      gateAssignment
    }
  }
`
```

#### 10.1.2 tRPC (End-to-End Type Safety)

**Rekomendasi:** tRPC untuk full-stack type safety tanpa schema generation

```bash
npm install @trpc/client @trpc/server @trpc/react-query zod
```

**Mengapa tRPC:**
- **Type inference otomatis:** TypeScript types flow dari backend ke frontend
- **No build step:** Tidak perlu generate types atau GraphQL schema
- **Lightweight:** Lebih ringan dari GraphQL untuk internal APIs
- **React Query integration:** Native support dengan caching
- **Used by:** Vercel, Cal.com, Ping.gg

**Implementasi:**
```typescript
// server/routers/tenant.ts
import { router, procedure } from '../trpc'
import { z } from 'zod'

export const tenantRouter = router({
  getById: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: input.id }
      })
      if (!tenant) throw new Error('Tenant not found')
      return tenant
    }),

  create: procedure
    .input(z.object({
      name: z.string().min(3),
      code: z.string().min(3).max(10),
      description: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.tenant.create({ data: input })
    }),

  listParticipants: procedure
    .input(z.object({
      tenantId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ input, ctx }) => {
      const participants = await ctx.db.participant.findMany({
        where: { tenantId: input.tenantId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined
      })
      
      let nextCursor: typeof input.cursor | undefined = undefined
      if (participants.length > input.limit) {
        const nextItem = participants.pop()
        nextCursor = nextItem!.id
      }
      
      return { participants, nextCursor }
    })
})

// client/hooks/useTenant.ts
import { trpc } from '@/lib/trpc'

export function useTenant(id: string) {
  return trpc.tenant.getById.useQuery({ id })
  // TypeScript knows exact return type - no manual typing needed!
}
```

#### 10.1.3 gRPC untuk Internal Services

**Rekomendasi:** gRPC untuk high-performance internal service communication

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

**Use Case:**
- Service-to-service communication dalam microservices architecture
- High-throughput data streaming
- Multi-language service mesh

**Benefit:**
- Binary protocol (Protocol Buffers) - lebih efisien dari JSON
- HTTP/2 multiplexing
- Strong typing dengan proto files
- Bi-directional streaming

---

### 🔟.2 Next.js 15 (App Router)

**Rekomendasi:** Migrate dari Vite ke Next.js 15 untuk enterprise features

```bash
npx create-next-app@latest 3ons-enterprise
```

**Enterprise Features Next.js 15:**

#### 10.2.1 Server Components (RSC)
```typescript
// app/admin/tenants/page.tsx - Server Component (default)
import { TenantList } from '@/components/TenantList'

// This runs on server - no JavaScript sent to client!
export default async function TenantsPage() {
  const tenants = await db.tenant.findMany()
  
  return (
    <main>
      <h1>Tenant Management</h1>
      <TenantList tenants={tenants} />
    </main>
  )
}
```

#### 10.2.2 Server Actions untuk Mutations
```typescript
// app/actions/tenant.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createTenantSchema = z.object({
  name: z.string().min(3),
  code: z.string().min(3).max(10)
})

export async function createTenant(formData: FormData) {
  const validated = createTenantSchema.parse({
    name: formData.get('name'),
    code: formData.get('code')
  })
  
  await db.tenant.create({ data: validated })
  revalidatePath('/admin/tenants')
}
```

#### 10.2.3 Edge Runtime & Middleware
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Edge runtime - runs globally close to user
  const token = request.cookies.get('token')
  
  if (!token && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Add security headers
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  return response
}

export const config = {
  matcher: ['/admin/:path*', '/gate/:path*']
}
```

#### 10.2.4 Static Site Generation (SSG) untuk Marketing Pages
```typescript
// app/page.tsx
export const revalidate = 3600 // Revalidate setiap 1 jam

export default async function LandingPage() {
  // Fetched at build time + revalidated periodically
  const stats = await fetchStats()
  
  return (
    <Landing stats={stats} />
  )
}
```

#### 10.2.5 Image Optimization (Built-in)
```typescript
import Image from 'next/image'

// Automatic WebP/AVIF conversion, lazy loading, responsive sizes
<Image
  src="/brand-logo.png"
  alt="3ONS Logo"
  width={200}
  height={60}
  priority // Preload LCP image
/>
```

---

### 🔟.3 Monorepo Architecture

**Rekomendasi:** Turborepo atau Nx untuk enterprise code organization

```bash
npx create-turbo@latest 3ons-monorepo
```

**Struktur Monorepo:**
```
3ons-monorepo/
├── apps/
│   ├── web/                    # Next.js web app
│   ├── mobile/                 # React Native / Capacitor
│   ├── tablet/                 # Tablet-optimized app
│   └── admin-api/              # BFF/API server
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── shared-types/           # TypeScript types
│   ├── shared-utils/           # Utility functions
│   ├── shared-hooks/           # Shared React hooks
│   ├── database/               # Database schema & client
│   ├── config-eslint/          # Shared ESLint config
│   ├── config-typescript/      # Shared TS config
│   └── config-tailwind/        # Shared Tailwind config
├── tooling/
│   ├── github-actions/         # CI/CD workflows
│   └── docker/                 # Docker configs
└── turbo.json                  # Pipeline configuration
```

**Benefit:**
- **Code sharing:** Shared packages untuk DRY principle
- **Atomic deployments:** Deploy multiple apps simultaneously
- **Build caching:** Turborepo cache untuk faster builds
- **Dependency management:** Single node_modules dengan pnpm/npm workspaces
- **Unified tooling:** Satu versi ESLint, TypeScript, etc.

**Turborepo Pipeline:**
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

### 🔟.4 Kubernetes & Container Orchestration

**Rekomendasi:** Kubernetes untuk auto-scaling dan high availability

**Architecture:**
```yaml
# k8s/web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: 3ons-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: 3ons-web
  template:
    metadata:
      labels:
        app: 3ons-web
    spec:
      containers:
        - name: web
          image: 3ons/web:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: 3ons-web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: 3ons-web
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**Features:**
- **Horizontal Pod Autoscaling (HPA):** Scale otomatis based on CPU/memory
- **Rolling deployments:** Zero-downtime deployments
- **Service mesh (Istio):** Traffic management, security, observability
- **Ingress controllers:** NGINX/Traefik untuk load balancing
- **Persistent volumes:** Stateful data storage
- **ConfigMaps & Secrets:** Configuration management

---

### 🔟.5 Message Queue & Background Jobs

**Rekomendasi:** Redis + Bull Queue untuk job processing

```bash
npm install bull ioredis
```

**Implementasi:**
```typescript
// lib/queue.ts
import Queue from 'bull'
import Redis from 'ioredis'

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
})

// Queues
export const checkInQueue = new Queue('checkin', { redis })
export const emailQueue = new Queue('email', { redis })
export const reportQueue = new Queue('report', { redis })

// Workers
export const checkInWorker = new Worker('checkin', async (job) => {
  const { participantId, gateId, timestamp } = job.data
  
  await db.participant.update({
    where: { id: participantId },
    data: {
      checkInStatus: 'checked-in',
      checkInTime: new Date(timestamp),
      gateId
    }
  })
  
  // Emit real-time update
  await publishToChannel(`tenant:${job.data.tenantId}`, {
    type: 'CHECKIN',
    participantId
  })
}, { connection: redis })

// Rate limiting dengan Redis
export const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit',
  points: 30, // 30 requests
  duration: 60 // per 60 seconds
})

// Usage
app.post('/api/check-in', async (req, res) => {
  try {
    await rateLimiter.consume(req.ip)
    await checkInQueue.add('process-checkin', req.body)
    res.json({ success: true })
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many requests' })
  }
})
```

**Use Cases:**
- Bulk email sending (jangan block request)
- PDF report generation (background processing)
- WhatsApp message queue (rate limiting WA API)
- QR code generation batch
- Data import/export dari CSV

---

### 🔟.6 WebAssembly (WASM)

**Rekomendasi:** Rust/C++ compiled to WASM untuk computationally intensive tasks

```bash
npm install @wasm-tool/wasm-pack-plugin
```

**Implementasi:**
```rust
// src/qr_processor.rs
use wasm_bindgen::prelude::*;
use qrcode::QrCode;

#[wasm_bindgen]
pub fn decode_qr(image_data: &[u8], width: u32, height: u32) -> Option<String> {
    // High-performance QR decoding di WASM
    let img = image::load_from_memory(image_data).ok()?;
    let decoder = quircs::Quirc::default();
    
    for code in decoder.identify(width as usize, height as usize, &img) {
        if let Ok(decoded) = code.decode() {
            return String::from_utf8(decoded.payload).ok();
        }
    }
    None
}

#[wasm_bindgen]
pub fn generate_batch_qr_codes(data: Vec<String>) -> Vec<Uint8Array> {
    data.into_iter()
        .map(|item| {
            let code = QrCode::new(item).unwrap();
            let image = code.render().build();
            // Convert to bytes...
        })
        .collect()
}
```

**Use Cases:**
- High-performance QR scanning di browser
- Batch QR generation untuk ribuan participants
- Image processing (resize, compress) tanpa block main thread
- Cryptographic operations

---

### 🔟.7 Advanced Database Architecture

#### 10.7.1 Database Sharding
Untuk multi-tenant dengan millions of participants per tenant:

```typescript
// lib/db/shardRouter.ts
export function getShardForTenant(tenantId: string): Database {
  const shardIndex = hash(tenantId) % SHARD_COUNT
  return shards[shardIndex]
}

// Automatic query routing
export async function queryTenantData(tenantId: string, query: string) {
  const db = getShardForTenant(tenantId)
  return db.query(query)
}
```

#### 10.7.2 Read Replicas
```typescript
// lib/db/client.ts
export const db = {
  read: new Pool({ host: process.env.DB_REPLICA_HOST }),
  write: new Pool({ host: process.env.DB_PRIMARY_HOST })
}

// Usage
const stats = await db.read.query('SELECT * FROM stats...') // Read dari replica
await db.write.query('INSERT INTO participants...') // Write ke primary
```

#### 10.7.3 Caching Layer dengan Redis
```typescript
// lib/cache.ts
export const cache = {
  async get(key: string) {
    const value = await redis.get(key)
    return value ? JSON.parse(value) : null
  },
  
  async set(key: string, value: any, ttl: number = 3600) {
    await redis.setex(key, ttl, JSON.stringify(value))
  },
  
  async invalidate(pattern: string) {
    const keys = await redis.keys(pattern)
    if (keys.length) await redis.del(...keys)
  }
}

// Cache-aside pattern
export async function getTenantWithCache(id: string) {
  const cached = await cache.get(`tenant:${id}`)
  if (cached) return cached
  
  const tenant = await db.tenant.findById(id)
  await cache.set(`tenant:${id}`, tenant, 300) // 5 min cache
  return tenant
}
```

---

### 🔟.8 Observability & Monitoring Stack

**Rekomendasi:** OpenTelemetry + Grafana Stack untuk enterprise observability

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
npm install @opentelemetry/auto-instrumentations-node
```

**Implementasi:**
```typescript
// lib/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'https://otel-collector.company.com/v1/traces'
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'https://otel-collector.company.com/v1/metrics'
    })
  }),
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()

// Custom tracing
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('3ons-app')

export async function processCheckIn(data: CheckInData) {
  return tracer.startActiveSpan('process-checkin', async (span) => {
    span.setAttribute('tenant.id', data.tenantId)
    span.setAttribute('participant.id', data.participantId)
    
    try {
      const result = await db.participant.update({...})
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  })
}
```

**Monitoring Stack:**
- **Prometheus:** Metrics collection
- **Grafana:** Visualization dashboards
- **Loki:** Log aggregation
- **Tempo/Jaeger:** Distributed tracing
- **AlertManager:** Alert routing

**Dashboards:**
- QR scan latency (p50, p95, p99)
- Check-in throughput per minute
- Error rates by endpoint
- Database connection pool status
- Redis cache hit/miss rates

---

### 🔟.9 Security Enhancements (Enterprise Grade)

#### 10.9.1 HashiCorp Vault untuk Secrets Management
```typescript
// lib/vault.ts
import { VaultClient } from '@hashicorp/vault-client'

const vault = new VaultClient({
  address: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
})

// Dynamic database credentials
export async function getDatabaseCredentials() {
  const { data } = await vault.read('database/creds/app-role')
  return {
    username: data.username,
    password: data.password,
    ttl: data.lease_duration
  }
}

// Automatic rotation
setInterval(async () => {
  const creds = await getDatabaseCredentials()
  // Update connection pool dengan credentials baru
}, 3600 * 1000) // Rotate setiap jam
```

#### 10.9.2 OAuth2/OIDC dengan Keycloak/Auth0
```typescript
// lib/auth.ts
import { auth } from '@auth/core'
import KeycloakProvider from '@auth/core/providers/keycloak'

export const { handlers, auth: getSession } = auth({
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER
    })
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.roles = token.roles // RBAC dari Keycloak
      return session
    }
  }
})
```

#### 10.9.3 WAF (Web Application Firewall)
- **Cloudflare:** DDoS protection, bot management
- **AWS WAF:** SQL injection, XSS protection
- **Rate limiting per endpoint** dengan adaptive algorithms

#### 10.9.4 Database Encryption
```typescript
// Transparent Data Encryption (TDE)
// Column-level encryption untuk PII
import { encrypt, decrypt } from '@/lib/crypto'

export async function createParticipant(data: ParticipantData) {
  return db.participant.create({
    data: {
      ...data,
      email: encrypt(data.email), // Encrypted at rest
      phone: encrypt(data.phone)
    }
  })
}
```

---

### 🔟.10 Machine Learning & AI Integration

#### 10.10.1 TensorFlow.js untuk Predictive Analytics
```typescript
import * as tf from '@tensorflow/tfjs'

// Load pre-trained model
const model = await tf.loadLayersModel('/models/peak-prediction/model.json')

export async function predictPeakHours(tenantId: string, date: Date) {
  const historicalData = await getHistoricalCheckIns(tenantId, date)
  
  const input = tf.tensor2d([[
    date.getDay(), // Day of week
    date.getMonth(), // Month
    historicalData.avgPreviousWeek,
    historicalData.eventSize
  ]])
  
  const prediction = model.predict(input) as tf.Tensor
  const peakHours = await prediction.data()
  
  return {
    predictedPeakStart: peakHours[0],
    predictedPeakEnd: peakHours[1],
    recommendedGateCount: Math.ceil(peakHours[2])
  }
}
```

#### 10.10.2 Anomaly Detection
```typescript
// Detect suspicious check-in patterns
export async function detectAnomalies(checkInData: CheckInEvent) {
  const recentCheckIns = await getRecentCheckIns(
    checkInData.tenantId,
    { minutes: 5 }
  )
  
  // Rule-based detection
  const sameQRSpeed = recentCheckIns.filter(
    c => c.qrCode === checkInData.qrCode
  ).length
  
  if (sameQRSpeed > 1) {
    await alertSecurity({
      type: 'DUPLICATE_QR',
      severity: 'high',
      data: checkInData
    })
  }
  
  // ML-based detection untuk patterns yang lebih complex
  const anomalyScore = await mlModel.predict(checkInData)
  if (anomalyScore > 0.8) {
    await flagForReview(checkInData)
  }
}
```

---

### 🔟.11 Implementation Roadmap Enterprise

#### Phase 5: Enterprise Architecture (3-4 bulan)
- [ ] Setup Turborepo monorepo structure
- [ ] Implement GraphQL atau tRPC APIs
- [ ] Setup Kubernetes cluster
- [ ] Implement Redis caching layer
- [ ] Setup OpenTelemetry observability

#### Phase 6: Scale & Optimize (2-3 bulan)
- [ ] Database sharding untuk multi-tenant
- [ ] Migrate ke Next.js 15 App Router
- [ ] Implement WASM untuk QR processing
- [ ] Setup ML models untuk predictions
- [ ] HashiCorp Vault integration

#### Phase 7: Global Scale (3+ bulan)
- [ ] Multi-region deployment
- [ ] CDN optimization (CloudFront/Cloudflare)
- [ ] Edge computing dengan Cloudflare Workers/Vercel Edge
- [ ] Global database replication (CockroachDB/Spanner)

---

### 🔟.12 Enterprise Priority Matrix

| Teknologi | Impact | Effort | Complexity | Priority |
|-----------|--------|--------|------------|----------|
| Next.js 15 | High | Medium | Medium | High |
| Monorepo (Turborepo) | High | High | Medium | High |
| GraphQL/tRPC | High | High | High | Medium |
| Kubernetes | High | Very High | Very High | Medium |
| Redis + Bull Queue | High | Medium | Medium | High |
| OpenTelemetry | Medium | Medium | High | Medium |
| HashiCorp Vault | High | High | High | Medium |
| WASM | Medium | High | High | Low |
| ML/TensorFlow.js | Medium | Very High | Very High | Low |
| Database Sharding | High | Very High | Very High | Future |

---

## 🔟 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (1-2 minggu)
- [ ] Update Supabase client dan dependencies
- [ ] Setup TypeScript (incremental migration)
- [ ] Setup Zustand + TanStack Query
- [ ] Implement React Hook Form + Zod
- [ ] Setup Sentry error tracking

### Phase 2: Enhancement (2-3 minggu)
- [ ] Migrate ke feature-based folder structure
- [ ] Add shadcn/ui components
- [ ] Implement virtual scrolling untuk large lists
- [ ] Add rate limiting dan security headers
- [ ] Setup audit logging

### Phase 3: Performance (2 minggu)
- [ ] Optimize bundle splitting
- [ ] Add service worker enhancements (background sync)
- [ ] Setup Playwright E2E tests
- [ ] Implement repository pattern

### Phase 4: Scale (2-3 minggu)
- [ ] Setup CI/CD pipeline
- [ ] Docker optimization
- [ ] Consider micro-frontend split
- [ ] Capacitor untuk mobile app wrapper

---

## 📋 PRIORITY MATRIX

| Rekomendasi | Impact | Effort | Priority |
|-------------|--------|--------|----------|
| TypeScript Migration | High | High | Critical |
| Zustand + TanStack Query | High | Medium | Critical |
| React Hook Form + Zod | High | Low | High |
| Sentry Integration | High | Low | High |
| Feature-based Structure | Medium | High | Medium |
| Playwright Tests | Medium | Medium | Medium |
| shadcn/ui | Medium | Low | Medium |
| Capacitor Mobile | High | Medium | Medium |
| Micro-frontend | Medium | High | Low |
| React Native | High | Very High | Future |

---

## 🎯 QUICK WINS (Bisa dikerjakan segera)

1. **Update dependencies** → `npm update` + test
2. **Add Sentry** → 30 menit setup
3. **Setup React Hook Form** → Mulai dengan form baru
4. **Rate limiting** → 1 jam implementasi
5. **Git hooks** → 15 menit setup
6. **Add web-vitals** → 10 menit setup

---

## 📚 RESOURCES

### Standard & Modern Stack
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com)
- [Zod Documentation](https://zod.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Playwright](https://playwright.dev)
- [Capacitor](https://capacitorjs.com)

### Enterprise & Advanced Stack
- [Next.js 15](https://nextjs.org/docs)
- [Apollo GraphQL](https://www.apollographql.com/docs/)
- [tRPC](https://trpc.io)
- [Turborepo](https://turbo.build/repo)
- [Kubernetes](https://kubernetes.io/docs/)
- [Bull Queue](https://github.com/OptimalBits/bull)
- [OpenTelemetry](https://opentelemetry.io/docs/)
- [HashiCorp Vault](https://developer.hashicorp.com/vault)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [WebAssembly](https://webassembly.org/)

---

*Dokumen ini akan diupdate secara berkala sesuai perkembangan teknologi dan kebutuhan bisnis.*

**Versi:** 2.0.0  
**Tanggal:** April 2026  
**Status:** Final dengan Enterprise Recommendations
