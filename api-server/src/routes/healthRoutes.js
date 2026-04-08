import { Router } from 'express'
import { getFirestore } from '../firebaseAdmin.js'

export function createHealthRoutes() {
  const router = Router()

  router.get('/health', (req, res) => {
    res.json({
      success: true,
      service: 'api-server',
      time: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      request_id: req.requestId
    })
  })

  router.get('/health/deep', async (req, res) => {
    const startedAt = Date.now()
    try {
      const db = getFirestore()
      await db.collection('tenants').limit(1).get()
      return res.json({
        success: true,
        service: 'api-server',
        checks: { api: 'ok', firestore: 'ok' },
        elapsed_ms: Date.now() - startedAt,
        time: new Date().toISOString(),
        request_id: req.requestId
      })
    } catch {
      return res.status(500).json({
        success: false,
        service: 'api-server',
        checks: { api: 'ok', firestore: 'fail' },
        error: 'Server error',
        elapsed_ms: Date.now() - startedAt,
        time: new Date().toISOString(),
        request_id: req.requestId
      })
    }
  })

  return router
}
