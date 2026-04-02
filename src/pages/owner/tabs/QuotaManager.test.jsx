import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import QuotaManager from './QuotaManager'

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

const tenantData = {
  id: 'tenant-1',
  brandName: 'Acme Test',
  quota: {
    maxParticipants: 500,
    maxGateDevices: 10,
    maxActiveEvents: 5
  }
}

const healthData = [
  {
    tenantId: 'tenant-1',
    brandName: 'Acme Test',
    totalParticipants: 250,
    usageParticipants: 50,
    usageGateDevices: 40,
    usageActiveEvents: 40
  }
]

vi.mock('../../../store/mockData', () => ({
  getTenants: () => [tenantData],
  getTenantHealth: () => healthData,
  updateTenantQuota: vi.fn((tenantId, newQuota) => ({ success: true, tenantId, newQuota }))
}))

afterEach(() => cleanup())

describe('QuotaManager', () => {
  it('renders quota cards and enters edit mode', () => {
    render(<QuotaManager />)

    expect(screen.getByText('Acme Test')).toBeTruthy()
    expect(screen.getByText(/Peserta Terdaftar/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Ubah Batas/i }))
    expect(screen.getByText(/Batas Peserta Total/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Simpan Perubahan Kuota/i })).toBeTruthy()
  })

  it('updates quota values and saves', () => {
    render(<QuotaManager />)
    fireEvent.click(screen.getByRole('button', { name: /Ubah Batas/i }))

    const numberInputs = screen.getAllByRole('spinbutton')
    expect(numberInputs.length).toBeGreaterThan(0)
    fireEvent.change(numberInputs[0], { target: { value: '600' } })

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan Kuota/i }))

    expect(screen.queryByText(/Simpan Perubahan Kuota/i)).toBeNull()
    expect(screen.getByText('Acme Test')).toBeTruthy()
  })
})
