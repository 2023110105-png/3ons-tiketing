import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Login from './Login'

const navigateMock = vi.fn()
const loginMock = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock
}))

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ login: loginMock })
}))

describe('Login', () => {
  it('redirects owner accounts to the owner panel', async () => {
    loginMock.mockResolvedValueOnce({
      success: true,
      user: { role: 'owner' }
    })

    render(<Login />)

    fireEvent.change(screen.getByPlaceholderText('Contoh: admin, petugas depan, petugas belakang'), { target: { value: 'owner' } })
    fireEvent.change(screen.getByPlaceholderText('Masukkan kata sandi'), { target: { value: 'owner123' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Masuk' }).closest('form'))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('owner', 'owner123')
      expect(navigateMock).toHaveBeenCalledWith('/owner')
    })
  })
})