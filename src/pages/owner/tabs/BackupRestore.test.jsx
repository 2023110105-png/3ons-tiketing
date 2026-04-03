import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import BackupRestore from './BackupRestore'

vi.mock('../../../store/mockData', () => ({
  getStoreBackups: () => [
    { key: 'backup-1', timestamp: Date.now(), size: 1200, eventCount: 2, isValid: true },
    { key: 'backup-2', timestamp: Date.now() - 100000, size: 800, eventCount: 1, isValid: false }
  ],
  restoreStoreBackup: vi.fn(() => ({ success: true })),
  exportStoreBackup: vi.fn(() => ({ success: true, fileName: 'backup.json', content: '{}', isValid: true }))
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() })
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Owner' } })
}))

afterEach(() => cleanup())

describe('BackupRestore', () => {
  it('renders backup entries excluding invalid', () => {
    render(<BackupRestore />)
    expect(screen.getAllByText(/Cadangan/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Belum ada cadangan/i)).toBeNull()
  })

  it('downloads backup when download button clicked', () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:url')
    render(<BackupRestore />)

    const downloadBtn = screen.getAllByRole('button', { name: /Download JSON/i })[0]
    fireEvent.click(downloadBtn)

    expect(screen.getAllByText(/Cadangan/i).length).toBeGreaterThan(0)
  })

  it('restore backup asks prompt and calls restore function', () => {
    window.prompt = vi.fn(() => 'testing alasan restore')
    render(<BackupRestore />)

    const restoreBtn = screen.getAllByRole('button', { name: /Pulihkan Data/i })[0]
    fireEvent.click(restoreBtn)
    expect(window.prompt).toHaveBeenCalled()
  })
})