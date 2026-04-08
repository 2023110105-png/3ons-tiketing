import { Router } from 'express'
import { z } from 'zod'
import { getFirestore } from '../firebaseAdmin.js'
import { safeErrorCode, sendError } from '../utils/http.js'
import { requestLog } from '../utils/logger.js'

const ParamsSchema = z.object({
  tenantId: z.string().trim().min(1)
})

export function createTenantRoutes({ platformSecretRequired }) {
  const router = Router()

  router.get('/api/tenants', platformSecretRequired, async (req, res) => {
    try {
      const snapshot = await getFirestore().collection('tenants').limit(50).get()
      const tenants = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      return res.json({ success: true, tenants })
    } catch (err) {
      requestLog(req, 'get_tenants_failed', { error_code: safeErrorCode(err) }, 'warn')
      return sendError(res, 500, req, safeErrorCode(err))
    }
  })

  router.get('/api/tenants/:tenantId/snapshot', platformSecretRequired, async (req, res) => {
    try {
      const { tenantId } = ParamsSchema.parse(req.params)
      const db = getFirestore()
      const tenantDoc = await db.collection('tenants').doc(tenantId).get()
      if (!tenantDoc.exists) return sendError(res, 404, req, 'not_found')
      const eventsSnap = await db.collection('tenants').doc(tenantId).collection('events').limit(25).get()
      const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      return res.json({ success: true, tenant: { id: tenantDoc.id, ...tenantDoc.data() }, events })
    } catch (err) {
      if (err instanceof z.ZodError) return sendError(res, 400, req, 'invalid_tenant_id')
      requestLog(req, 'get_tenant_snapshot_failed', { error_code: safeErrorCode(err) }, 'warn')
      return sendError(res, 500, req, safeErrorCode(err))
    }
  })

  return router
}
