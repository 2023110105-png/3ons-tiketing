import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as mockData from '../../../store/mockData'
import { afterEach, describe, it, expect, vi } from 'vitest'
import BillingInvoice from './BillingInvoice'

vi.mock('../../../store/mockData', () => {
  const tenantMocks = [
    {
      id: 'tenant-1',
      brandName: 'Acme Zone',
      invoices: [
        { id: 'inv-01', tenantId: 'tenant-1', tenantName: 'Acme Zone', period: '2026-04', issued_at: '2026-04-01T00:00:00Z', amount: 500000, status: 'unpaid', notes: 'PPOB' }
      ]
    },
    {
      id: 'tenant-2',
      brandName: 'Bandung Expo',
      invoices: [
        { id: 'inv-02', tenantId: 'tenant-2', tenantName: 'Bandung Expo', period: '2026-04', issued_at: '2026-04-02T00:00:00Z', amount: 750000, status: 'paid', notes: 'Event package' }
      ]
    }
  ]
  const getTenants = vi.fn(() => tenantMocks)
  const addTenantInvoice = vi.fn((tenantId, invoice) => ({ success: true, invoice: { ...invoice, id: 'inv-03' } }))
  const updateInvoiceStatus = vi.fn(() => ({ success: true }))

  return {
    getTenants,
    addTenantInvoice,
    updateInvoiceStatus
  }
})

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

afterEach(() => cleanup())

describe('BillingInvoice', () => {
  it('renders invoices and filters by search', () => {
    render(<BillingInvoice />)

    const acmeOptions = screen.getAllByText(/Acme Zone/i)
    const bandungOptions = screen.getAllByText(/Bandung Expo/i)
    expect(acmeOptions.length).toBeGreaterThanOrEqual(2) // row + select option
    expect(bandungOptions.length).toBeGreaterThanOrEqual(2)

    fireEvent.change(screen.getByPlaceholderText(/Cari tagihan atau akun/i), { target: { value: 'Bandung' } })
    expect(screen.queryByText('Acme Zone', { selector: 'td' })).toBeNull()
    expect(screen.getByText('Bandung Expo', { selector: 'td' })).toBeTruthy()
  })

  it('filters invoices by tenant select', () => {
    render(<BillingInvoice />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tenant-1' }})
    expect(screen.getByRole('cell', { name: 'Acme Zone' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: 'Bandung Expo' })).toBeNull()
  })

  it('toggles invoice status and calls updateInvoiceStatus', () => {
    render(<BillingInvoice />)

    const unpaidButton = screen.getByRole('button', { name: /BELUM LUNAS/i })
    fireEvent.click(unpaidButton)

    expect(mockData.updateInvoiceStatus).toHaveBeenCalledWith('tenant-1', 'inv-01', 'paid', expect.any(Object))
  })
})