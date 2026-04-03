import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import ImpersonateView from './ImpersonateView'

const mockLogin = vi.fn(() => ({ success: true }))

vi.mock('../../../store/mockData', () => ({
  getTenants: () => [
    { id: 'tenant-1', brandName: 'Acme Event', eventName: 'Acme Expo' }
  ],
  getTenantUsers: () => [
    { id: 'user-1', username: 'guest', name: 'Guest User', role: 'gate_front', password: '123456', is_active: true }
  ]
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ login: mockLogin })
}))

afterEach(() => { cleanup(); window.confirm = vi.fn() })

describe('ImpersonateView', () => {
  it('selects tenant and lists users', async () => {
    render(<ImpersonateView />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tenant-1' } })

    expect(await screen.findByText(/Guest User/i)).toBeTruthy()
  })

  it('impersonates an active user when confirmed', () => {
    window.confirm = vi.fn(() => true)
    render(<ImpersonateView />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tenant-1' } })

    fireEvent.click(screen.getByRole('button', { name: /Masuk Sebagai/i }))
    expect(window.confirm).toHaveBeenCalled()
    expect(mockLogin).toHaveBeenCalledWith('guest', '123456')
  })
})