import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConnectDevice from './ConnectDevice'

const authState = {
  user: {
    role: 'admin_client',
    tenant: { id: 'tenant-a' }
  }
}

const toastApi = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
}

const apiFetchMock = vi.fn(async (url) => {
  if (String(url).includes('/api/wa/sessions')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ total: 1, sessions: [{ tenant_id: 'tenant-a', status: 'ready' }] })
    }
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({
      tenant_id: 'tenant-a',
      status: 'ready',
      isReady: true,
      qrCode: null,
      lastError: null
    })
  }
})

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => authState
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => toastApi
}))

vi.mock('../../utils/api', () => ({
  apiFetch: (...args) => apiFetchMock(...args),
  getApiBaseUrl: () => ''
}))

describe('ConnectDevice tenant/session isolation', () => {
  beforeEach(() => {
    apiFetchMock.mockClear()
    toastApi.success.mockClear()
    toastApi.error.mockClear()
    toastApi.info.mockClear()
    toastApi.warning.mockClear()
  })

  it('admin_client hanya memanggil status tenant sendiri dan tidak memuat daftar semua sesi', async () => {
    authState.user = {
      role: 'admin_client',
      tenant: { id: 'tenant-a' }
    }

    render(<ConnectDevice />)

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/wa/status?tenant_id=tenant-a')
    })

    const allCalls = apiFetchMock.mock.calls.map((args) => String(args[0]))
    expect(allCalls.some((url) => url.includes('/api/wa/sessions'))).toBe(false)
  })

  it('owner memuat status tenant aktif dan endpoint monitor semua sesi', async () => {
    authState.user = {
      role: 'owner',
      tenant: { id: 'tenant-default' }
    }

    render(<ConnectDevice />)

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/wa/status?tenant_id=tenant-default')
      expect(apiFetchMock).toHaveBeenCalledWith('/api/wa/sessions')
    })
  })
})
