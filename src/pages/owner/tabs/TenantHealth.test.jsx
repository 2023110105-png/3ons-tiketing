import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import TenantHealth from './TenantHealth'

vi.mock('../../../store/mockData', () => ({
  bootstrapStoreFromFirebase: vi.fn(async () => true),
  getTenantHealth: () => [
    { tenantId: 'tenant-1', brandName: 'Acme Event', status: 'active', isOnline: true, lastBackup: new Date().toISOString(), totalCheckins: 300, totalParticipants: 500, usageParticipants: 60 }
  ]
}))

afterEach(() => cleanup())

describe('TenantHealth', () => {
  it('renders health cards and refresh button', () => {
    render(<TenantHealth />)
    expect(screen.getByRole('heading', { name: /Kesehatan tenant/i })).toBeTruthy()
    expect(screen.getByText('Acme Event')).toBeTruthy()
  })

  it('refreshes data when refresh clicked', async () => {
    vi.useFakeTimers()
    render(<TenantHealth />)

    const refreshBtn = screen.getByRole('button', { name: /Segarkan data/i })
    fireEvent.click(refreshBtn)
    expect(refreshBtn.disabled).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(800)
    })

    expect(screen.getByRole('button', { name: /Segarkan data/i }).disabled).toBe(false)
    vi.useRealTimers()
  })
})