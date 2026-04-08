import { useEffect, useState } from 'react'
import { apiFetch } from '../utils/api'

export function useWaStatus({ tenantId, pollMs = 2500 } = {}) {
  const [wa, setWa] = useState({ status: 'checking', isReady: false })

  useEffect(() => {
    if (!tenantId) return

    let stopped = false
    let timer

    const tick = async () => {
      try {
        const res = await apiFetch(`/api/wa/status?tenant_id=${encodeURIComponent(tenantId)}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        if (stopped) return
        setWa({ status: String(data?.status || 'checking').toLowerCase(), isReady: !!data?.isReady })
      } catch {
        if (stopped) return
        setWa({ status: 'offline', isReady: false })
      }
      if (stopped) return
      timer = window.setTimeout(tick, pollMs)
    }

    tick()

    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [tenantId, pollMs])

  return wa
}

