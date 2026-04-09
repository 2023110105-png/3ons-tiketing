import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/firebase', () => ({
  auth: null,
  isFirebaseEnabled: false
}))

vi.mock('../lib/firebaseSync', () => ({
  syncAuditLog: vi.fn(async () => true),
  fetchFirebaseWorkspaceSnapshot: vi.fn(async () => null),
  syncCheckInLog: vi.fn(async () => true),
  syncEventDelete: vi.fn(async () => true),
  syncEventSnapshot: vi.fn(async () => true),
  syncParticipantDelete: vi.fn(async () => true),
  syncParticipantUpsert: vi.fn(async () => true),
  syncTenantDelete: vi.fn(async () => true),
  syncTenantUserDelete: vi.fn(async () => true),
  syncTenantUserUpsert: vi.fn(async () => true),
  syncTenantUpsert: vi.fn(async () => true)
}))

const TENANT_REGISTRY_KEY = 'ons_tenant_registry'
const STORE_KEY = 'ons_event_data'

function makeTenant({ id, brandName, eventName, users = [] }) {
  return {
    id,
    brandName,
    eventName,
    status: 'active',
    expires_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    activeEventId: null,
    contract: {
      package: 'starter',
      start_at: '2026-01-01T00:00:00.000Z',
      payment_status: 'paid',
      amount: 0
    },
    quota: {
      maxParticipants: 500,
      maxGateDevices: 3,
      maxActiveEvents: 1
    },
    users,
    branding: { primaryColor: '#0ea5e9' },
    invoices: []
  }
}

function makeParticipant({ id, name, ticketId, tenantId, eventId }) {
  return {
    id,
    ticket_id: ticketId,
    name,
    secure_code: 'SECURE123',
    secure_ref: 'REF123',
    phone: '081234567890',
    email: `${id}@example.com`,
    category: 'Regular',
    day_number: 1,
    qr_data: JSON.stringify({
      v: 1,
      t: tenantId,
      e: eventId,
      id: ticketId,
      n: name,
      d: 1,
      sc: 'SECURE123',
      sr: 'REF123',
      sig: 'fake-signature'
    }),
    is_checked_in: false,
    checked_in_at: null,
    checked_in_by: null,
    created_at: '2026-01-01T00:00:00.000Z'
  }
}

function seedIsolationFixture() {
  const tenantAId = 'tenant-a'
  const tenantBId = 'tenant-b'
  const eventAId = 'event-a'
  const eventBId = 'event-b'

  const tenantRegistry = {
    // Sengaja diset ke tenant yang salah untuk memastikan session guard bekerja.
    activeTenantId: tenantAId,
    tenants: {
      'tenant-default': makeTenant({
        id: 'tenant-default',
        brandName: 'Platform',
        eventName: 'Platform Event'
      }),
      [tenantAId]: makeTenant({
        id: tenantAId,
        brandName: 'Brand A',
        eventName: 'Event A',
        users: [
          {
            id: 'user-a',
            username: 'juki@3ons',
            email: 'juki-a@example.com',
            password: 'passA123',
            name: 'Juki A',
            role: 'admin_client',
            tenantId: tenantAId,
            is_active: true
          }
        ]
      }),
      [tenantBId]: makeTenant({
        id: tenantBId,
        brandName: 'Brand B',
        eventName: 'Event B',
        users: [
          {
            id: 'user-b',
            username: 'fag',
            email: 'fag-b@example.com',
            password: 'passB123',
            name: 'Fag B',
            role: 'admin_client',
            tenantId: tenantBId,
            is_active: true
          }
        ]
      })
    }
  }

  const store = {
    tenants: {
      'tenant-default': {
        activeEventId: 'event-default',
        events: {
          'event-default': {
            id: 'event-default',
            name: 'Platform Event',
            isArchived: false,
            created_at: '2026-01-01T00:00:00.000Z',
            currentDay: 1,
            participants: [],
            checkInLogs: [],
            adminLogs: [],
            pendingCheckIns: [],
            offlineQueueHistory: [],
            offlineConfig: { maxPendingAttempts: 5 },
            waTemplate: null,
            waSendMode: 'message_only'
          }
        }
      },
      [tenantAId]: {
        activeEventId: eventAId,
        events: {
          [eventAId]: {
            id: eventAId,
            name: 'Event A',
            isArchived: false,
            created_at: '2026-01-01T00:00:00.000Z',
            currentDay: 1,
            participants: [
              makeParticipant({
                id: 'p-a-1',
                name: 'Peserta Tenant A',
                ticketId: 'A-D1-001',
                tenantId: tenantAId,
                eventId: eventAId
              })
            ],
            checkInLogs: [],
            adminLogs: [],
            pendingCheckIns: [],
            offlineQueueHistory: [],
            offlineConfig: { maxPendingAttempts: 5 },
            waTemplate: null,
            waSendMode: 'message_only'
          }
        }
      },
      [tenantBId]: {
        activeEventId: eventBId,
        events: {
          [eventBId]: {
            id: eventBId,
            name: 'Event B',
            isArchived: false,
            created_at: '2026-01-01T00:00:00.000Z',
            currentDay: 1,
            participants: [
              makeParticipant({
                id: 'p-b-1',
                name: 'Peserta Tenant B',
                ticketId: 'B-D1-001',
                tenantId: tenantBId,
                eventId: eventBId
              })
            ],
            checkInLogs: [],
            adminLogs: [],
            pendingCheckIns: [],
            offlineQueueHistory: [],
            offlineConfig: { maxPendingAttempts: 5 },
            waTemplate: null,
            waSendMode: 'message_only'
          }
        }
      }
    }
  }

  localStorage.setItem(TENANT_REGISTRY_KEY, JSON.stringify(tenantRegistry))
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

describe('mockData tenant isolation', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    seedIsolationFixture()
  })

  it.skip('mengunci active tenant sesuai session user agar data peserta tidak bocor lintas tenant', async () => {
    const mod = await import('./mockData.js')

    const loginA = mod.login('juki@3ons', 'passA123')
    expect(loginA.success).toBe(true)
    expect(mod.getSession().tenant.id).toBe('tenant-a')
    expect(mod.getActiveTenant().id).toBe('tenant-a')

    const pesertaA = mod.getParticipants().map((p) => p.name)
    expect(pesertaA).toContain('Peserta Tenant A')
    expect(pesertaA).not.toContain('Peserta Tenant B')

    // Simulasi perubahan tenant aktif dari UI/admin tools.
    mod.switchActiveTenant('tenant-b', 'test-script')

    // Guard baru harus memaksa balik ke tenant session user A.
    expect(mod.getActiveTenant().id).toBe('tenant-a')
    const pesertaAAfterSwitch = mod.getParticipants().map((p) => p.name)
    expect(pesertaAAfterSwitch).toContain('Peserta Tenant A')
    expect(pesertaAAfterSwitch).not.toContain('Peserta Tenant B')

    mod.logout()

    const loginB = mod.login('fag', 'passB123')
    expect(loginB.success).toBe(true)
    expect(mod.getSession().tenant.id).toBe('tenant-b')
    expect(mod.getActiveTenant().id).toBe('tenant-b')

    const pesertaB = mod.getParticipants().map((p) => p.name)
    expect(pesertaB).toContain('Peserta Tenant B')
    expect(pesertaB).not.toContain('Peserta Tenant A')
  })

  it.skip('menyediakan admin bawaan pada tenant default Event Platform', async () => {
    const mod = await import('./mockData.js')

    const tenants = mod.getTenants()
    const defaultTenant = tenants.find((tenant) => tenant.id === 'tenant-default')

    expect(defaultTenant).toBeTruthy()

    const users = mod.getTenantUsers('tenant-default')
    expect(users.some((user) => user.username === 'admin_eventplatform')).toBe(true)
    expect(users.some((user) => user.role === 'admin_client')).toBe(true)
  })
})
