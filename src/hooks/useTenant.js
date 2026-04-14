/**
 * useTenant Hook
 * Get current tenant context
 */
import { useState, useEffect } from 'react'
import { getTenantById } from '../services/tenantService'

export function useTenant(tenantId) {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    async function loadTenant() {
      try {
        setLoading(true)
        const data = await getTenantById(tenantId)
        setTenant(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadTenant()
  }, [tenantId])

  return { tenant, loading, error }
}
