import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ServerVerifyTools from './ServerVerifyTools'

vi.mock('../../../utils/api', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ total: 0, sessions: [] })
  }))
}))

vi.mock('../../../store/mockData', () => ({
  bootstrapStoreFromServer: vi.fn(async () => true),
  getCheckInLogs: vi.fn(() => []),
  getCurrentDay: vi.fn(() => 1),
  getCurrentEventId: vi.fn(() => 'event-1'),
  getEvents: vi.fn(() => [{ id: 'event-1', name: 'Event 1' }]),
  getOwnerAuditLog: vi.fn(() => []),
  getOwnerNotifications: vi.fn(() => []),
  getParticipants: vi.fn(() => []),
  getTenantHealth: vi.fn(() => []),
  getTenants: vi.fn(() => [{ id: 'tenant-default', brandName: 'Default' }])
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

beforeEach(() => {
  window.localStorage.setItem('ons_owner_it_tools_settings_v1', JSON.stringify({
    alertRules: {
      enabled: true,
      autoMonitor: false,
      offlineMinutes: 10,
      nonReadyTenantThreshold: 3,
      cooldownMinutes: 5
    },
    safeMode: { enabled: false, note: '' }
  }))
})

describe('ServerVerifyTools Alert Preset', () => {
  it('applies aggressive and conservative presets to alert inputs', async () => {
    render(<ServerVerifyTools />)

    const offlineInput = screen.getByPlaceholderText(/Batas offline \(menit\)/i)
    const thresholdInput = screen.getByPlaceholderText(/Ambang tenant non-ready/i)
    const cooldownInput = screen.getByPlaceholderText(/Cooldown alert \(menit\)/i)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Preset Aggressive/i }))
      await Promise.resolve()
    })
    expect(offlineInput.value).toBe('5')
    expect(thresholdInput.value).toBe('2')
    expect(cooldownInput.value).toBe('3')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Preset Conservative/i }))
      await Promise.resolve()
    })
    expect(offlineInput.value).toBe('15')
    expect(thresholdInput.value).toBe('5')
    expect(cooldownInput.value).toBe('10')
  })
})
