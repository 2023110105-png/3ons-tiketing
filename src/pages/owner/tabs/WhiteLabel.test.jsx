import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import WhiteLabel from './WhiteLabel'
import { updateTenantBranding } from '../../../store/mockData'

vi.mock('../../../store/mockData', () => ({
  getTenants: () => [
    { id: 'tenant-1', brandName: 'Acme Event', eventName: 'Acme Expo', branding: { primaryColor: '#0ea5e9', appName: 'Acme', logo: '' } }
  ],
  updateTenantBranding: vi.fn(() => ({ success: true }))
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

afterEach(() => cleanup())

describe('WhiteLabel', () => {
  it.skip('selects tenant and saves branding', () => {
    render(<WhiteLabel />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tenant-1' } })

    expect(screen.getByDisplayValue('Acme')).toBeTruthy()

    fireEvent.change(screen.getByDisplayValue('Acme'), { target: { value: 'Acme new' } })
    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan Branding/i }))

    expect(updateTenantBranding).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ appName: 'Acme new' }), expect.any(Object))
  })
})