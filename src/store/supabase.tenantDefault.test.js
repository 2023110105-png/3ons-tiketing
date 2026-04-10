import { describe, it, expect } from 'vitest'
import { fetchFirebaseWorkspaceSnapshot } from '../lib/supabaseSync'

// Test Supabase tenant default existence and admin user

describe('Supabase tenant default', () => {
  it('should have tenant-default with admin_eventplatform user', async () => {
    const snapshot = await fetchFirebaseWorkspaceSnapshot()
    expect(snapshot).toBeTruthy()
    const tenants = snapshot.tenantRegistry?.tenants || {}
    const defaultTenant = tenants['tenant-default']
    expect(defaultTenant).toBeTruthy()
    const users = Array.isArray(defaultTenant.users) ? defaultTenant.users : []
    expect(users.some((u) => u.username === 'admin_eventplatform')).toBe(true)
    expect(users.some((u) => u.role === 'admin_client')).toBe(true)
  })
})
