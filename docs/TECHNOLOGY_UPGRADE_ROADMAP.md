# 🚀 ROADMAP UPGRADE TEKNOLOGI
## 3ONS Ticketing System - Modernization Plan 2026

---

## 📋 EXECUTIVE SUMMARY

**Current Stack:** React 19 + Vite + Supabase + Tailwind + JavaScript  
**Target Stack:** TypeScript + Next.js 15 + React Server Components + tRPC + Testing Suite + CI/CD

**Timeline:** 3-4 Bulan (Phased)  
**Impact:** 3x developer productivity, 50% less bugs, enterprise-ready

---

## 🎯 PHASE 1: FOUNDATION (Bulan 1)
### Type Safety & Developer Experience

### 1.1 TypeScript Migration
**Prioritas:** 🔴 CRITICAL  
**Effort:** 2-3 minggu  
**Impact:** 40% reduction bugs, autocomplete, refactoring mudah

#### Langkah:
```bash
# Week 1: Setup
npm install -D typescript @types/react @types/react-dom @types/node
npx tsc --init

# Update vite.config.ts (rename dari .js)
# Update semua .jsx → .tsx bertahap
```

#### Struktur Types:
```typescript
// src/types/index.ts
export interface Participant {
  id: string;
  ticketNumber: string;
  name: string;
  phone: string;
  email?: string;
  eventId: string;
  gate: string;
  qrCodeUrl: string | null;
  waStatus: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed' | 'read';
  waMessageSid: string | null;
  waSentAt: string | null;
  waErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  eventDate: string;
  location: string;
  organizerName: string;
  contactPhone: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  participantCount: number;
  maxParticipants?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  id: string;
  participantId: string;
  ticketNumber: string;
  gate: string;
  operatorId: string;
  scannedAt: string;
  syncedAt: string | null;
  offline: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### Migration Strategy:
```
Minggu 1:
├── Setup TS config
├── Create types/ directory
├── Migrate utils/ (pure functions)
└── Migrate hooks/ (useAuth, useParticipants)

Minggu 2:
├── Migrate components/ui/ (Button, Card, Badge)
├── Migrate contexts/
└── Migrate api/ layer

Minggu 3:
├── Migrate pages/ (operator, admin)
├── Fix type errors
└── Update build pipeline
```

---

### 1.2 Modern State Management: Zustand + TanStack Query
**Prioritas:** 🔴 CRITICAL  
**Effort:** 1 minggu  
**Ganti:** React Context (prop drilling, re-render issues)

#### Kenapa Zustand?
- ⚡ 10x lebih cepat dari Redux
- 🎯 Minimal boilerplate
- 🔧 DevTools built-in
- 💾 Persist middleware (localStorage)

#### Implementation:
```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: async (email, password) => {
        // API call
        const user = await api.auth.login(email, password);
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user, isAuthenticated: !!user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// src/store/eventStore.ts
import { create } from 'zustand';
import { Event, Participant } from '@/types';

interface EventState {
  currentEvent: Event | null;
  participants: Participant[];
  selectedParticipant: Participant | null;
  setCurrentEvent: (event: Event) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  selectParticipant: (participant: Participant | null) => void;
}

export const useEventStore = create<EventState>((set) => ({
  currentEvent: null,
  participants: [],
  selectedParticipant: null,
  setCurrentEvent: (event) => set({ currentEvent: event }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) => 
    set((state) => ({ participants: [...state.participants, participant] })),
  updateParticipant: (id, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  selectParticipant: (participant) => set({ selectedParticipant: participant }),
}));
```

#### TanStack Query (React Query): Data Fetching
```typescript
// src/hooks/useParticipants.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Participant } from '@/types';
import { api } from '@/lib/api';

// Fetch participants
export function useParticipants(eventId: string) {
  return useQuery({
    queryKey: ['participants', eventId],
    queryFn: () => api.participants.getByEvent(eventId),
    staleTime: 30000, // 30s cache
    refetchInterval: 30000, // Auto refresh tiap 30s
    enabled: !!eventId,
  });
}

// Create participant
export function useCreateParticipant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Omit<Participant, 'id' | 'createdAt'>) => 
      api.participants.create(data),
    onSuccess: (newParticipant, variables) => {
      // Invalidate cache
      queryClient.invalidateQueries({ 
        queryKey: ['participants', newParticipant.eventId] 
      });
      // Optimistic update
      queryClient.setQueryData(
        ['participants', newParticipant.eventId],
        (old: Participant[] = []) => [...old, newParticipant]
      );
    },
  });
}

// Update WhatsApp status (real-time)
export function useUpdateWAStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Participant['waStatus'] }) =>
      api.participants.updateStatus(id, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ['participants', updated.eventId],
        (old: Participant[] = []) =>
          old.map((p) => (p.id === updated.id ? updated : p))
      );
    },
  });
}
```

---

### 1.3 Modern React Patterns
**Prioritas:** 🟡 MEDIUM  
**Effort:** 1 minggu

#### React Hooks Lanjutan:
```typescript
// Custom hooks untuk common patterns

// useDebounce - untuk search
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// useLocalStorage - dengan type safety
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// useOnlineStatus - untuk offline mode
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

---

## 🎯 PHASE 2: BACKEND MODERNIZATION (Bulan 2)

### 2.1 tRPC: Type-Safe API
**Prioritas:** 🔴 CRITICAL  
**Effort:** 2-3 minggu  
**Ganti:** Direct Supabase calls, REST API yang fragmented

#### Kenapa tRPC?
- 🎯 End-to-end type safety (frontend ↔ backend)
- ⚡ No build step untuk API
- 🔍 Autocomplete di seluruh stack
- 🧹 Clean architecture (procedures, routers)

#### Setup tRPC:
```typescript
// src/server/trpc.ts
import { initTRPC } from '@trpc/server';
import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

export function createContext({ req, res }: CreateFastifyContextOptions) {
  return {
    req,
    res,
    user: req.user, // dari auth middleware
  };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new Error('Unauthorized');
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
```

#### Routers:
```typescript
// src/server/routers/participantRouter.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { supabase } from '@/lib/supabase';

export const participantRouter = router({
  // Get all participants by event
  getByEvent: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('event_id', input.eventId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    }),

  // Create participant
  create: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      name: z.string().min(1),
      phone: z.string().regex(/^\+?[0-9]{10,15}$/),
      email: z.string().email().optional(),
      gate: z.string().default('Front'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await supabase
        .from('participants')
        .insert({
          event_id: input.eventId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          gate: input.gate,
          ticket_number: await generateTicketNumber(input.eventId),
          wa_status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Bulk create from CSV
  bulkCreate: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      participants: z.array(z.object({
        name: z.string().min(1),
        phone: z.string(),
        email: z.string().email().optional(),
        gate: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const participantsWithTickets = await Promise.all(
        input.participants.map(async (p, i) => ({
          event_id: input.eventId,
          ...p,
          ticket_number: await generateTicketNumber(input.eventId, i),
          wa_status: 'pending',
        }))
      );

      const { data, error } = await supabase
        .from('participants')
        .insert(participantsWithTickets)
        .select();

      if (error) throw new Error(error.message);
      return data;
    }),

  // Update WhatsApp status (webhook handler)
  updateWAStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['pending', 'processing', 'sent', 'delivered', 'failed', 'read']),
      messageSid: z.string().optional(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { data, error } = await supabase
        .from('participants')
        .update({
          wa_status: input.status,
          wa_message_sid: input.messageSid,
          wa_error_message: input.errorMessage,
          wa_sent_at: input.status === 'sent' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }),
});

// src/server/routers/eventRouter.ts
export const eventRouter = router({
  getAll: protectedProcedure.query(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('events')
        .select('*, participants(count)')
        .eq('id', input.id)
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    }),

  // ... more procedures
});

// src/server/routers/_app.ts
import { router } from '../trpc';
import { participantRouter } from './participantRouter';
import { eventRouter } from './eventRouter';
import { checkinRouter } from './checkinRouter';
import { whatsappRouter } from './whatsappRouter';

export const appRouter = router({
  participants: participantRouter,
  events: eventRouter,
  checkins: checkinRouter,
  whatsapp: whatsappRouter,
});

export type AppRouter = typeof appRouter;
```

#### Client Setup:
```typescript
// src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

// src/components/Providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/lib/trpc';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers: () => ({
        authorization: `Bearer ${localStorage.getItem('token')}`,
      }),
    }),
  ],
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

#### Usage in Components:
```typescript
// Using tRPC with full type safety
function ParticipantList({ eventId }: { eventId: string }) {
  // Autocomplete works! TypeScript knows exact return type
  const { data: participants, isLoading } = trpc.participants.getByEvent.useQuery({ eventId });
  
  const createMutation = trpc.participants.create.useMutation({
    onSuccess: () => {
      // Auto invalidate cache
      utils.participants.getByEvent.invalidate({ eventId });
    },
  });

  if (isLoading) return <Loading />;

  return (
    <div>
      {participants?.map((p) => (
        <ParticipantCard key={p.id} participant={p} />
      ))}
      
      <button
        onClick={() =>
          createMutation.mutate({
            eventId,
            name: 'Budi Santoso',
            phone: '+628123456789',
            // ❌ TypeScript error kalau field salah!
          })
        }
      >
        Tambah Peserta
      </button>
    </div>
  );
}
```

---

### 2.2 Modern Backend Server: Fastify
**Prioritas:** 🟡 MEDIUM  
**Effort:** 1 minggu  
**Ganti:** Express/Node.js (jika ada) atau Supabase Functions untuk heavy tasks

#### Kenapa Fastify?
- ⚡ 2x lebih cepat dari Express
- 📦 Schema-based validation (JSON Schema)
- 🔌 Plugin architecture
- 🚀 Async/await native

```typescript
// src/server/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/_app';
import { createContext } from './trpc';

const server = Fastify({
  logger: true,
  // Performance tuning
  http2: true,
  bodyLimit: 10 * 1024 * 1024, // 10MB for file uploads
});

// Plugins
await server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});

await server.register(jwt, {
  secret: process.env.JWT_SECRET!,
});

// Auth middleware
server.addHook('onRequest', async (request, reply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = await request.jwtVerify<{ userId: string }>();
      request.user = decoded;
    }
  } catch {
    // Continue without user
  }
});

// tRPC endpoint
await server.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

// Health check
server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// WhatsApp webhook (Twilio)
server.post('/webhook/whatsapp', async (request, reply) => {
  const { MessageSid, MessageStatus, To } = request.body as any;
  
  // Update database via tRPC
  await updateMessageStatus(MessageSid, MessageStatus);
  
  reply.status(200).send('OK');
});

// Bulk WhatsApp endpoint dengan rate limiting
server.post('/api/whatsapp/bulk-send', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
}, async (request, reply) => {
  const { eventId } = request.body as { eventId: string };
  
  // Background job
  await sendBulkWhatsApp(eventId);
  
  return { success: true, message: 'Bulk send initiated' };
});

// Start server
try {
  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Server running at http://localhost:3001');
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
```

---

## 🎯 PHASE 3: TESTING & QUALITY (Bulan 2-3)

### 3.1 Testing Suite
**Prioritas:** 🔴 CRITICAL  
**Effort:** 2-3 minggu

#### Unit Testing (Vitest):
```typescript
// src/utils/__tests__/ticketNumber.test.ts
import { describe, it, expect } from 'vitest';
import { generateTicketNumber } from '../ticketNumber';

describe('generateTicketNumber', () => {
  it('should generate unique ticket number', () => {
    const eventId = 'event-123';
    const ticket = generateTicketNumber(eventId);
    
    expect(ticket).toMatch(/^T\d{6}$/);
    expect(ticket).toHaveLength(7);
  });

  it('should include timestamp for sequential', () => {
    const tickets = Array.from({ length: 5 }, (_, i) => 
      generateTicketNumber('event-123', i)
    );
    
    // All unique
    expect(new Set(tickets).size).toBe(5);
  });
});

// src/hooks/__tests__/useDebounce.test.ts
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';
import { vi } from 'vitest';

describe('useDebounce', () => {
  it('should debounce value', async () => {
    vi.useFakeTimers();
    
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    expect(result.current).toBe('initial');
    
    rerender({ value: 'changed' });
    expect(result.current).toBe('initial'); // Still debounced
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(result.current).toBe('changed');
    
    vi.useRealTimers();
  });
});
```

#### Integration Testing:
```typescript
// src/components/__tests__/ParticipantCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ParticipantCard } from '../ParticipantCard';
import { Participant } from '@/types';

const mockParticipant: Participant = {
  id: '1',
  ticketNumber: 'T000001',
  name: 'Budi Santoso',
  phone: '+628123456789',
  eventId: 'event-1',
  gate: 'Front',
  waStatus: 'sent',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('ParticipantCard', () => {
  it('renders participant information', () => {
    render(<ParticipantCard participant={mockParticipant} />);
    
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('T000001')).toBeInTheDocument();
    expect(screen.getByText('+628123456789')).toBeInTheDocument();
  });

  it('shows correct status badge', () => {
    render(<ParticipantCard participant={mockParticipant} />);
    
    expect(screen.getByText('sent')).toHaveClass('bg-green-100');
  });

  it('calls onSend when button clicked', () => {
    const onSend = vi.fn();
    render(<ParticipantCard participant={mockParticipant} onSend={onSend} />);
    
    fireEvent.click(screen.getByText('Kirim WA'));
    expect(onSend).toHaveBeenCalledWith(mockParticipant);
  });
});
```

#### E2E Testing (Playwright):
```typescript
// e2e/checkin-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Check-in Flow', () => {
  test('operator can scan and check-in participant', async ({ page }) => {
    // Login as operator
    await page.goto('/login');
    await page.fill('[name="username"]', 'operator1');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to scanner
    await page.waitForURL('/operator');
    await page.click('text=Scan QR');
    
    // Mock QR scan (simulate camera)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('qrScanned', { 
        detail: { ticketNumber: 'T000001' } 
      }));
    });
    
    // Verify participant info displayed
    await expect(page.locator('text=Budi Santoso')).toBeVisible();
    await expect(page.locator('text=T000001')).toBeVisible();
    
    // Confirm check-in
    await page.click('text=Check In');
    
    // Verify success
    await expect(page.locator('text=Check-in berhasil')).toBeVisible();
    
    // Verify status updated
    await expect(page.locator('[data-testid="status"]')).toHaveText('Checked In');
  });

  test('admin can view real-time check-in stats', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('/admin');
    
    // Stats should update when check-in happens
    const initialCount = await page.locator('[data-testid="checked-in-count"]').textContent();
    
    // Trigger check-in from another context (API call)
    // ...
    
    // Wait for real-time update
    await expect(page.locator('[data-testid="checked-in-count"]')).not.toHaveText(initialCount!);
  });
});

// e2e/bulk-whatsapp.spec.ts
test.describe('Bulk WhatsApp Sender', () => {
  test('admin can upload CSV and send bulk messages', async ({ page }) => {
    await page.goto('/admin/bulk-sender');
    
    // Upload CSV
    const csvContent = `name,phone,email
Budi,08123456789,budi@test.com
Ani,08198765432,ani@test.com`;
    
    await page.setInputFiles('input[type="file"]', {
      name: 'participants.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Preview should show
    await expect(page.locator('text=2 peserta ditemukan')).toBeVisible();
    
    // Click send
    await page.click('text=Kirim ke Semua');
    
    // Verify progress
    await expect(page.locator('text=Mengirim')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('text=Terkirim: 2/2')).toBeVisible({ timeout: 60000 });
  });
});
```

#### Test Configuration:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 🎯 PHASE 4: PERFORMANCE & OPTIMIZATION (Bulan 3)

### 4.1 Next.js 15 Migration (Opsional, Major Change)
**Prioritas:** 🟢 LOW (jika Vite sudah cukup) / 🔴 HIGH (jika butuh SEO, SSR)  
**Effort:** 3-4 minggu

#### Kenapa Next.js 15?
- 🔍 SEO optimization (meta tags, sitemap)
- ⚡ React Server Components (RSC) - zero JS bundle
- 🖥️ Streaming SSR - halaman load lebih cepat
- 📱 Image optimization otomatis
- 🔀 App Router - nested layouts

#### Migration Strategy:
```typescript
// Next.js 15 App Router structure
app/
├── layout.tsx              # Root layout (auth context)
├── page.tsx                # Landing/marketing page
├── (dashboard)/            # Route group (no URL segment)
│   ├── layout.tsx          # Dashboard layout (sidebar)
│   ├── admin/
│   │   ├── page.tsx        # Admin overview (Server Component)
│   │   ├── events/
│   │   │   ├── page.tsx    # Event list (RSC + pagination)
│   │   │   └── [id]/
│   │   │       ├── page.tsx # Event detail (RSC)
│   │   │       └── participants/
│   │   │           ├── page.tsx # Participant list
│   │   │           └── loading.tsx # Loading UI
│   │   └── bulk-sender/
│   │       └── page.tsx    # Bulk sender (Client Component)
│   └── operator/
│       ├── page.tsx        # Operator dashboard
│       └── scan/
│           └── page.tsx    # QR Scanner (Client Component)
├── api/
│   └── trpc/
│       └── [...trpc]/
│           └── route.ts    # tRPC API handler
└── login/
    └── page.tsx            # Login page
```

#### Server Component Example:
```typescript
// app/admin/events/page.tsx - Server Component (no JS sent to client!)
import { trpc } from '@/server/trpc';
import { EventTable } from './EventTable';

// This runs on server only
export default async function EventsPage() {
  // Direct database query (no HTTP request!)
  const events = await trpc.events.getAll.query();
  
  return (
    <div>
      <h1>Events</h1>
      {/* Server-rendered table, zero client JS */}
      <EventTable events={events} />
      
      {/* Client component for interactivity */}
      <CreateEventButton />
    </div>
  );
}

// Auto-revalidate every 30 seconds
export const revalidate = 30;
```

### 4.2 Performance Optimizations
**Prioritas:** 🟡 MEDIUM  
**Effort:** 1-2 minggu

#### Code Splitting:
```typescript
// Lazy load heavy components
const QRScanner = lazy(() => import('./QRScanner'));
const BulkSender = lazy(() => import('./BulkSender'));
const Reports = lazy(() => import('./Reports'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/scan" element={<QRScanner />} />
        <Route path="/bulk" element={<BulkSender />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}
```

#### Virtualization untuk List Besar:
```typescript
// 1000+ participants - hanya render yang visible
import { useVirtualizer } from '@tanstack/react-virtual';

function ParticipantList({ participants }: { participants: Participant[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: participants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // row height
  });

  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ParticipantCard participant={participants[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Service Worker untuk Offline Mode:
```typescript
// sw.ts - Workbox service worker
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache build assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// API cache dengan network-first
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 menit
      }),
    ],
  })
);

// Image cache
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
      }),
    ],
  })
);

// Background sync untuk check-in offline
import { BackgroundSyncPlugin } from 'workbox-background-sync';

registerRoute(
  ({ url }) => url.pathname === '/api/checkin',
  new NetworkFirst({
    plugins: [
      new BackgroundSyncPlugin('checkin-queue', {
        maxRetentionTime: 24 * 60, // Retry up to 24 hours
      }),
    ],
  }),
  'POST'
);
```

---

## 🎯 PHASE 5: DEVOPS & MONITORING (Bulan 3-4)

### 5.1 CI/CD Pipeline
**Prioritas:** 🟡 MEDIUM  
**Effort:** 1 minggu

#### GitHub Actions:
```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

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
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload E2E report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        uses: vercel/action-deploy@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 5.2 Docker & Containerization
**Prioritas:** 🟢 LOW (jika Vercel/Railway sudah cukup)

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "dist/server.js"]
```

### 5.3 Monitoring & Error Tracking
**Prioritas:** 🟡 MEDIUM  
**Effort:** 2-3 hari

```typescript
// Sentry setup
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 1.0,
  environment: import.meta.env.MODE,
  beforeSend(event) {
    // Filter sensitive data
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.stacktrace) {
        // Remove user phone numbers from stack trace
        error.stacktrace.frames = error.stacktrace.frames.map((frame) => ({
          ...frame,
          vars: undefined, // Don't send local variables
        }));
      }
    }
    return event;
  },
});

// Performance monitoring
import { WebVitals } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <YourApp />
      <WebVitals />
    </>
  );
}
```

---

## 📊 SUMMARY ROADMAP

| Phase | Durasi | Tech Stack | Deliverable |
|-------|--------|------------|-------------|
| **1. Foundation** | 3-4 minggu | TypeScript, Zustand, TanStack Query | Type-safe codebase, modern state management |
| **2. Backend** | 2-3 minggu | tRPC, Fastify, Zod | End-to-end type safety, robust API |
| **3. Testing** | 2-3 minggu | Vitest, Playwright, React Testing Library | 80%+ coverage, automated testing |
| **4. Performance** | 2 minggu | Next.js 15 (opsional), virtualization, PWA | Lightning-fast UX, offline support |
| **5. DevOps** | 1-2 minggu | GitHub Actions, Docker, Sentry | CI/CD, monitoring, auto-deploy |

**Total Timeline:** 3-4 bulan (phased, bisa parallel)  
**Team Size:** 2-3 developers  
**Budget Impact:** ~$50-100/bulan untuk tools (Sentry, analytics)

---

## 🎯 PRIORITY QUICK WINS (Jika Resource Terbatas)

Jika hanya bisa pilih 3:

1. ✅ **TypeScript** (minggu 1-2) - Impact besar, foundation penting
2. ✅ **TanStack Query** (minggu 2) - Data fetching, caching, auto-sync
3. ✅ **Testing (Vitest + Playwright)** (minggu 3-4) - Quality assurance

**Skip dulu:** Next.js migration (jika Vite cukup), Docker (jika deployment sudah smooth)

---

Mau saya buatkan **starter template** untuk salah satu phase ini? (misal: setup TypeScript + Zustang + TanStack Query)
