import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import TenantList from './TenantList'

afterEach(() => cleanup())

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

const sampleTenants = [
  {
    id: 'tenant-1',
    brandName: 'Acme Test',
    eventName: 'Acme Event',
    status: 'active',
    expires_at: null,
    contract: { package: 'pro', payment_status: 'paid' },
    isExpired: false
  },
  {
    id: 'tenant-2',
    brandName: 'Bandung Expo',
    eventName: 'Expo 2026',
    status: 'inactive',
    expires_at: null,
    contract: { package: 'starter', payment_status: 'unpaid' },
    isExpired: false
  }
]

vi.mock('../../../store/mockData', () => ({
  getTenants: () => sampleTenants,
  getActiveTenant: () => sampleTenants[0],
  switchActiveTenant: vi.fn(() => ({ success: true })),
  setTenantStatus: vi.fn(() => ({ success: true })),
  deleteTenant: vi.fn(() => ({ success: true })),
  createTenant: vi.fn(() => ({ success: true, tenant: sampleTenants[1] }))
}))

describe('TenantList', () => {
  it('renders tenant list and filters by search', () => {
    render(<TenantList onManageUsers={() => {}} onEditContract={() => {}} />)

    expect(screen.getByText('Acme Test')).toBeTruthy()
    expect(screen.getByText('Bandung Expo')).toBeTruthy()

    const searchInput = screen.getByPlaceholderText('Cari tenant...')
    fireEvent.change(searchInput, { target: { value: 'Acme' } })

    expect(screen.getByText('Acme Test')).toBeTruthy()
    expect(screen.queryByText('Bandung Expo')).toBeNull()
  })

  it('opens create modal when pressing Tambah Tenant', () => {
    render(<TenantList onManageUsers={() => {}} onEditContract={() => {}} />)

    const [button] = screen.getAllByText(/Tenant Baru/i)
    fireEvent.click(button)

    expect(screen.getByText('Tambah Tenant Baru')).toBeTruthy()
    expect(screen.getByPlaceholderText('Contoh: Acme Corp')).toBeTruthy()

    const cancelBtn = screen.getByText('Batal')
    fireEvent.click(cancelBtn)

    expect(screen.queryByText('Tambah Tenant Baru')).toBeNull()
  })
})
