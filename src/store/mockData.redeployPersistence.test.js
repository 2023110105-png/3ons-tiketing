import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/firebase', () => ({
  auth: null,
  isFirebaseEnabled: true
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

function seedRedeployFixture() {
  const tenantId = 'tenant-redeploy'
  const eventId = 'event-redeploy'

  localStorage.setItem('ons_tenant_registry', JSON.stringify({
    activeTenantId: 'tenant-default',
    tenants: {
      'tenant-default': {
        id: 'tenant-default',
        brandName: 'Platform',
        eventName: 'Platform Event',
        status: 'active',
        expires_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        activeEventId: 'event-default',
        contract: { package: 'pro', payment_status: 'paid' },
        quota: { maxParticipants: 5000, maxGateDevices: 10, maxActiveEvents: 5 },
        users: [],
        branding: { primaryColor: '#0ea5e9' },
        invoices: []
      },
      [tenantId]: {
        id: tenantId,
        brandName: 'Brand Redeploy',
        eventName: 'Event Redeploy',
        status: 'active',
        expires_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        activeEventId: eventId,
        contract: { package: 'starter', payment_status: 'paid' },
        quota: { maxParticipants: 500, maxGateDevices: 3, maxActiveEvents: 1 },
        users: [
          {
            id: 'tenant-user-1',
            username: 'tenant.user',
            email: 'tenant.user@example.com',
            password: 'pass123',
            name: 'Tenant User',
            role: 'admin_client',
            tenantId,
            is_active: true
          }
        ],
        branding: { primaryColor: '#0ea5e9' },
        invoices: []
      }
    }
  }))

  localStorage.setItem('ons_event_data', JSON.stringify({
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
      [tenantId]: {
        activeEventId: eventId,
        events: {
          [eventId]: {
            id: eventId,
            name: 'Event Redeploy',
            isArchived: false,
            created_at: '2026-01-01T00:00:00.000Z',
            currentDay: 1,
            participants: [
              {
                id: 'p-1',
                ticket_id: 'RD-D1-001',
                name: 'Peserta Persisten',
                secure_code: 'SECURE',
                secure_ref: 'REF',
                phone: '08123456789',
                email: 'persisten@example.com',
                category: 'Regular',
                day_number: 1,
                qr_data: '{"v":1}',
                is_checked_in: false,
                checked_in_at: null,
                checked_in_by: null,
                created_at: '2026-01-01T00:00:00.000Z'
              }
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
  }))

  localStorage.setItem('ons_session', JSON.stringify({
    id: 'tenant-user-1',
    username: 'tenant.user',
    email: 'tenant.user@example.com',
    role: 'admin_client',
    tenant: {
      id: tenantId,
      brandName: 'Brand Redeploy',
      eventName: 'Event Redeploy'
    }
  }))
}

describe('mockData redeploy persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    seedRedeployFixture()
  })

  it.skip('tetap memuat session tenant dan data peserta setelah cold start redeploy di strict mode', async () => {
    const mod = await import('./mockData.js')

    const session = mod.getSession()
    expect(session).toBeTruthy()
    expect(session.tenant.id).toBe('tenant-redeploy')

    const activeTenant = mod.getActiveTenant()
    expect(activeTenant.id).toBe('tenant-redeploy')

    const participants = mod.getParticipants()
    expect(participants).toHaveLength(1)
    expect(participants[0].name).toBe('Peserta Persisten')
  })
})
