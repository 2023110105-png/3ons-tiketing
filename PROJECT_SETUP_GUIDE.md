# Panduan Setup Awal Proyek 3ONS Ticketing v3.0.0

> Step-by-step guide untuk memulai pengembangan aplikasi dari nol

---

## 📋 Prasyarat (Prerequisites)

### Hardware Minimum
| Komponen | Spesifikasi |
|----------|-------------|
| Laptop/PC | Intel i5 / AMD Ryzen 5 atau lebih tinggi |
| RAM | 16 GB (32 GB direkomendasikan) |
| Storage | SSD 256 GB |
| OS | Windows 10/11, macOS, atau Linux |

### Software yang Harus Diinstall

#### 1. Node.js & Package Manager
```bash
# Install Node.js 20 LTS
download dari: https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi

# Verifikasi
node --version  # v20.12.2
npm --version   # 10.5.0

# Install pnpm (lebih cepat dari npm)
npm install -g pnpm
```

#### 2. Git & GitHub
```bash
# Install Git
download dari: https://git-scm.com/download/win

# Konfigurasi Git
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
git config --global init.defaultBranch main

# Install GitHub CLI (opsional)
winget install --id GitHub.cli
```

#### 3. Code Editor
**VS Code** (Direkomendasikan)
```bash
download dari: https://code.visualstudio.com/download

# Extension yang wajib install:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Thunder Client (API Testing)
- GitLens
- Error Lens
- Auto Rename Tag
- Path Intellisense
- ES7+ React/Redux/React-Native snippets
```

#### 4. Database Tools
```bash
# Supabase CLI
npm install -g supabase

# PostgreSQL Client (pgAdmin atau DBeaver)
download DBeaver: https://dbeaver.io/download/
```

#### 5. Browser & Tools
```bash
# Chrome (untuk testing)
download: https://www.google.com/chrome/

# Install Extensions:
- React Developer Tools
- Redux DevTools
- Lighthouse
- JSON Viewer

# Firefox (opsional untuk cross-browser testing)
```

#### 6. Design Tools
```bash
# Figma (Web/Desktop)
download: https://www.figma.com/downloads/

# atau menggunakan web version langsung
```

---

## 🚀 STEP 1: Setup Repository Git

### 1.1 Buat Repository GitHub
```bash
# Login ke GitHub
# Create new repository: 3ons-ticketing-v3
# Private repository (jika aplikasi komersial)
# Public repository (jika open source)

# Settings yang perlu diaktifkan:
- ✓ Issues
- ✓ Discussions
- ✓ Projects (GitHub Projects untuk kanban)
- ✓ Wiki (untuk dokumentasi)
```

### 1.2 Inisialisasi Repository Lokal
```bash
# Buat folder project
mkdir 3ons-ticketing-v3
cd 3ons-ticketing-v3

# Inisialisasi Git
git init

# Tambahkan remote
git remote add origin https://github.com/username/3ons-ticketing-v3.git

# Initial commit
echo "# 3ONS Ticketing v3.0.0" > README.md
git add README.md
git commit -m "Initial commit"
git push -u origin main
```

### 1.3 Setup Branch Strategy
```bash
# Buat branch untuk development
git checkout -b develop
git push -u origin develop

# Setup branch protection (di GitHub web interface)
# Settings > Branches > Add rule
# - Require pull request reviews before merging
# - Require status checks to pass before merging
# - Include administrators
```

---

## 🚀 STEP 2: Setup Project Structure

### 2.1 Initialize Project dengan Vite
```bash
# Buat project dengan Vite + React + TypeScript
npm create vite@latest . -- --template react-ts

# atau dengan pnpm
pnpm create vite . -- --template react-ts

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

### 2.2 Install Dependencies Utama

#### Core Dependencies
```bash
# React & Router
npm install react@^19.2.0 react-dom@^19.2.0
npm install react-router-dom@^7.0.0

# Styling
npm install -D tailwindcss@^4.0.0 postcss autoprefixer
npm install clsx tailwind-merge
npm install @tailwindcss/forms

# State Management
npm install zustand @tanstack/react-query @tanstack/react-query-devtools

# Form Management
npm install react-hook-form @hookform/resolvers zod

# Backend
npm install @supabase/supabase-js

# Utilities
npm install date-fns
npm install lucide-react
npm install framer-motion

# QR Code
npm install qrcode html5-qrcode

# Export
npm install jspdf jspdf-autotable xlsx

# Charts
npm install chart.js react-chartjs-2
```

#### Dev Dependencies
```bash
# TypeScript
npm install -D typescript @types/react @types/react-dom @types/node

# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Linting & Formatting
npm install -D eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh
npm install -D prettier

# Git Hooks
npm install -D husky lint-staged
```

### 2.3 Setup Tailwind CSS v4
```bash
# Tailwind v4 menggunakan CSS-based configuration
# Buat file: src/index.css

# Isi dengan:
@import "tailwindcss";
@import "@tailwindcss/forms";

@theme {
  --color-primary-50: #fef2f2;
  --color-primary-100: #fee2e2;
  --color-primary-500: #ef4444;
  --color-primary-600: #dc2626;
  --color-primary-700: #b91c1c;
}
```

### 2.4 Setup Folder Structure
```bash
# Buat struktur folder
mkdir -p src/{features,components,hooks,lib,utils,types,services,stores,api}
mkdir -p src/features/{auth,tenants,participants,gate,reports}
mkdir -p src/components/{ui,layout,forms}
mkdir -p public/{icons,images,fonts}
mkdir -p supabase/migrations
mkdir -p docs
mkdir -p scripts

# Struktur akhir:
# 3ons-ticketing-v3/
# ├── src/
# │   ├── features/
# │   │   ├── auth/
# │   │   ├── tenants/
# │   │   ├── participants/
# │   │   ├── gate/
# │   │   └── reports/
# │   ├── components/
# │   │   ├── ui/           # Reusable UI components
# │   │   ├── layout/       # Layout components
# │   │   └── forms/        # Form components
# │   ├── hooks/            # Custom React hooks
# │   ├── lib/              # Core utilities
# │   ├── utils/            # Helper functions
# │   ├── types/            # TypeScript types
# │   ├── services/         # API services
# │   ├── stores/           # Zustand stores
# │   └── api/              # API clients
# ├── supabase/
# │   └── migrations/       # Database migrations
# ├── public/               # Static assets
# ├── docs/                 # Documentation
# └── scripts/              # Utility scripts
```

---

## 🚀 STEP 3: Setup TypeScript

### 3.1 Konfigurasi tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/features/*": ["src/features/*"],
      "@/components/*": ["src/components/*"],
      "@/lib/*": ["src/lib/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3.2 Setup Path Aliases di Vite
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
})
```

---

## 🚀 STEP 4: Setup Code Quality Tools

### 4.1 ESLint Configuration
```javascript
// eslint.config.js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
```

### 4.2 Prettier Configuration
```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

```bash
# Install Prettier plugins
npm install -D prettier-plugin-tailwindcss
```

### 4.3 Git Hooks dengan Husky
```bash
# Setup Husky
npx husky init

# Install lint-staged
npm install -D lint-staged

# Buat file: .lintstagedrc.json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,scss}": ["prettier --write"]
}
```

```bash
# Tambahkan hook pre-commit
npx husky add .husky/pre-commit "npx lint-staged"
```

---

## 🚀 STEP 5: Setup Supabase Backend

### 5.1 Buat Project Supabase
```bash
# 1. Login ke https://supabase.com
# 2. Create new project
# 3. Pilih region terdekat (Singapore untuk Indonesia)
# 4. Simpan:
#    - Project URL
#    - Project API Keys (anon & service_role)
```

### 5.2 Setup Environment Variables
```bash
# Buat file: .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_KEY=your-service-role-key

# Jangan lupa tambahkan ke .gitignore!
```

```bash
# .gitignore
# Environment variables
.env
.env.local
.env.production
```

### 5.3 Buat Supabase Client
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export type Database = {
  // Define your database types here
}
```

### 5.4 Setup Database Schema
```bash
# Login ke Supabase CLI
supabase login

# Link project
supabase link --project-ref your-project-ref

# Buat migration pertama
supabase migration new initial_schema

# Edit file migration di: supabase/migrations/[timestamp]_initial_schema.sql
```

---

## 🚀 STEP 6: Setup State Management

### 6.1 Zustand Store Setup
```typescript
// src/stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
```

### 6.2 TanStack Query Setup
```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// src/main.tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
)
```

---

## 🚀 STEP 7: Setup Routing

### 7.1 Router Configuration
```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

// Layouts
import { MainLayout } from '@/components/layout/MainLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'

// Pages
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { TenantListPage } from '@/features/tenants/pages/TenantListPage'
import { ParticipantListPage } from '@/features/participants/pages/ParticipantListPage'
import { GateScannerPage } from '@/features/gate/pages/GateScannerPage'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tenants" element={<TenantListPage />} />
            <Route path="/participants" element={<ParticipantListPage />} />
            <Route path="/gate" element={<GateScannerPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
```

---

## 🚀 STEP 8: Setup Testing

### 8.1 Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 8.2 Test Setup File
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})
```

### 8.3 Contoh Test
```typescript
// src/features/auth/components/LoginForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('renders login form', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })
})
```

---

## 🚀 STEP 9: Setup GitHub Actions (CI/CD)

### 9.1 Buat Workflow File
```bash
mkdir -p .github/workflows
```

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
```

---

## 🚀 STEP 10: First Commit & Push

```bash
# Commit semua setup awal
git add .
git commit -m "chore: initial project setup

- Setup Vite + React + TypeScript
- Configure Tailwind CSS v4
- Setup ESLint + Prettier
- Setup Husky + lint-staged
- Setup Supabase client
- Setup Zustand + TanStack Query
- Setup testing with Vitest
- Setup CI/CD with GitHub Actions
- Configure path aliases
- Add project structure"

git push origin develop
```

---

## 📋 CHECKLIST SETUP

### ✅ Pre-Development
- [ ] Install Node.js 20+
- [ ] Install Git & setup config
- [ ] Install VS Code + extensions
- [ ] Install browser extensions
- [ ] Buat GitHub repository
- [ ] Invite team members

### ✅ Project Setup
- [ ] Initialize Vite project
- [ ] Install all dependencies
- [ ] Setup TypeScript config
- [ ] Setup Tailwind CSS v4
- [ ] Setup folder structure
- [ ] Configure path aliases

### ✅ Code Quality
- [ ] Setup ESLint
- [ ] Setup Prettier
- [ ] Setup Husky pre-commit hooks
- [ ] Test pre-commit hooks

### ✅ Backend
- [ ] Buat Supabase project
- [ ] Setup environment variables
- [ ] Test Supabase connection
- [ ] Create initial migration

### ✅ State Management
- [ ] Setup Zustand stores
- [ ] Setup TanStack Query
- [ ] Test state management

### ✅ Development
- [ ] Setup routing
- [ ] Create layout components
- [ ] Setup testing framework
- [ ] Create first page/component

### ✅ CI/CD
- [ ] Setup GitHub Actions
- [ ] Test CI pipeline
- [ ] Setup branch protection rules

---

## 🎯 LANGKAH BERIKUTNYA

Setelah setup selesai:

1. **Buat design system** (colors, typography, spacing)
2. **Buat komponen UI reusable** (Button, Input, Modal, dll)
3. **Setup authentication flow**
4. **Implementasi fitur pertama** (misal: login)
5. **Buat dokumentasi** (README, CONTRIBUTING, CODE_OF_CONDUCT)

---

## 🆘 TROUBLESHOOTING

### Common Issues:

**1. `npm install` error**
```bash
# Solusi: Hapus node_modules dan reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**2. TypeScript path alias tidak jalan**
```bash
# Pastikan di tsconfig.json dan vite.config.ts sudah sama
# Restart VS Code
# Jalankan: npx tsc --noEmit untuk check errors
```

**3. Husky tidak berjalan**
```bash
# Reinstall husky
npx husky install
chmod +x .husky/pre-commit  # untuk Linux/Mac
```

**4. Supabase connection error**
```bash
# Cek environment variables
# Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY benar
# Cek network/firewall
```

---

**Setup selesai! Selamat coding! 🚀**

Untuk bantuan lebih lanjut, cek:
- [Project Documentation](./docs)
- [Team Onboarding Guide](./docs/ONBOARDING.md)
- [Architecture Decision Records](./docs/ADR)
