import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import NotificationCenter from './NotificationCenter'

vi.mock('../../../store/mockData', () => ({
  getOwnerNotifications: () => [
    { id: 'n-1', message: 'Quota hampir penuh', created_at: new Date().toISOString(), type: 'quota_warning', read: false },
    { id: 'n-2', message: 'Auto-backup selesai', created_at: new Date().toISOString(), type: 'info', read: true }
  ],
  markNotificationRead: vi.fn()
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

afterEach(() => cleanup())

describe('NotificationCenter', () => {
  it('renders notification items and search works', () => {
    render(<NotificationCenter />)
    expect(screen.getByText(/Total:\s*2/i)).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/Cari notifikasi/i), { target: { value: 'Backup' } })
    expect(screen.getByText(/Auto-backup selesai/i)).toBeTruthy()
  })

  it('marks all read on button click', () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /Tandai Semua Sudah Dibaca/i }))
    expect(screen.getByRole('button', { name: /Tandai Semua Sudah Dibaca/i })).toBeTruthy()
  })
})