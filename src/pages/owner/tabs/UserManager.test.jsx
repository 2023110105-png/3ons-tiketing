import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import UserManager from './UserManager'

vi.mock('../../../store/mockData', () => ({
  bootstrapStoreFromFirebase: vi.fn(async () => true),
  getTenants: () => [
    { id: 'tenant-1', brandName: 'Acme Beta', eventName: 'Alpha Event' },
    { id: 'tenant-2', brandName: 'Beta Co', eventName: 'Beta Event' }
  ],
  getTenantUsers: (tenantId) => tenantId === 'tenant-1' ? [
    { id: 'user-1', username: 'admin_acme', name: 'Admin Acme', role: 'admin_client', is_active: true }
  ] : [] ,
  createTenantUser: vi.fn(() => ({ success: true })),
  updateTenantUser: vi.fn(() => ({ success: true })),
  deleteTenantUser: vi.fn(() => ({ success: true }))
}))

const toastSuccess = vi.fn()

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

afterEach(() => cleanup())

describe('UserManager', () => {
  it('shows tenant selection when no tenant selected', async () => {
    render(<UserManager />)
    await waitFor(() => {
      expect(screen.getByText('Pilih akun brand', { exact: true })).toBeTruthy()
    })
  })

  it('loads users when tenant selected and allows adding user', async () => {
    render(<UserManager />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tenant-1' } })

    await waitFor(() => {
      expect(screen.getByText(/admin_acme/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /Tambah Pengguna Baru/i }))
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByLabelText('Password Awal'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: 'New User' } })
    fireEvent.click(screen.getByRole('button', { name: /Simpan/i }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Sukses', 'User newuser berhasil dibuat')
    })
  })
})