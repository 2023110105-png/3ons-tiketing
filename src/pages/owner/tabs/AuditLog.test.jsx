import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import AuditLog from './AuditLog'

vi.mock('../../../store/mockData', () => ({
  getOwnerAuditLog: () => [
    {
      id: 'log-1',
      timestamp: new Date('2026-04-01T08:00:00Z').toISOString(),
      actor: 'owner1',
      action: 'tenant_create',
      description: 'Tenant Acme berhasil dibuat',
      meta: null
    },
    {
      id: 'log-2',
      timestamp: new Date('2026-04-01T09:00:00Z').toISOString(),
      actor: 'owner1',
      action: 'tenant_update',
      description: 'Quota tenant diupdate',
      meta: null
    }
  ]
}))

afterEach(() => cleanup())

describe('AuditLog', () => {
  it('renders audit log entries and filter works', () => {
    render(<AuditLog />)

    expect(screen.getByText('Riwayat Aktivitas Pemilik')).toBeTruthy()
    expect(screen.getByText('tenant Acme berhasil dibuat', { exact: false })).toBeTruthy()
    expect(screen.getByText('2 catatan')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Cari di riwayat aktivitas...'), { target: { value: 'quota' } })
    expect(screen.queryByText('Tenant Acme berhasil dibuat')).toBeNull()
    expect(screen.getByText('Quota tenant diupdate', { exact: false })).toBeTruthy()
  })

  it('calls export link click when export button is pressed', () => {
    const anchor = document.createElement('a')
    const clickSpy = vi.spyOn(anchor, 'click')
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return anchor
      }
      return originalCreateElement(tag)
    })

    render(<AuditLog />)
    fireEvent.click(screen.getByRole('button', { name: /Unduh CSV/i }))

    expect(clickSpy).toHaveBeenCalled()
    document.createElement.mockRestore()
    clickSpy.mockRestore()
  })
})
