import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import ContractManager from './ContractManager'

vi.mock('../../../store/mockData', () => ({
  bootstrapStoreFromFirebase: vi.fn(async () => true),
  getTenants: () => [
    {
      id: 'tenant-1',
      brandName: 'Acme Event',
      eventName: 'Acme Expo',
      contract: { package: 'pro', start_at: '2026-04-01', end_at: '2026-04-30', payment_status: 'unpaid', amount: 1000000, notes: '' }
    }
  ],
  updateTenantContract: vi.fn(() => ({ success: true }))
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

afterEach(() => cleanup())

describe('ContractManager', () => {
  it('renders tenant card and supports search filtering', () => {
    render(<ContractManager />)
    expect(screen.getByText('Acme Event')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Cari akun untuk kontrak...'), { target: { value: 'Nonexistent' } })
    expect(screen.queryByText('Acme Event')).toBeNull()
  })

  it('opens edit form and saves contract updates', async () => {
    render(<ContractManager />)
    fireEvent.click(screen.getByRole('button', { name: /Kelola Kontrak/i }))

    expect(screen.getByText(/Simpan Perubahan Kontrak/i)).toBeTruthy()

    const amountInput = screen.getByLabelText('Nominal (Rp)')
    fireEvent.change(amountInput, { target: { value: '1500000' } })

    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan Kontrak/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Simpan Perubahan Kontrak/i)).toBeNull()
      expect(screen.getByText('Acme Event')).toBeTruthy()
    })
  })
})