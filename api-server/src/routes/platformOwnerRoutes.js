import { Router } from 'express'
import { z } from 'zod'
import { getAuth, getFirestore } from '../firebaseAdmin.js'
import { safeErrorCode, sendError } from '../utils/http.js'
import { requestLog } from '../utils/logger.js'
import { createTenantUser, deleteTenantUser, patchTenantUser } from '../services/tenantUsersService.js'

const ParamsSchema = z.object({
  tenantId: z.string().trim().min(1)
})

const UserParamsSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1)
})

export function createPlatformOwnerRoutes({ platformSecretRequired, writeRateLimit }) {
  const router = Router()
  const statusFromCode = (code) => {
    if (code === 'tenant_not_found' || code === 'not_found') return 404
    if (code === 'invalid_payload') return 400
    if (code === 'unauthorized') return 401
    if (code === 'forbidden') return 403
    return 500
  }

  router.post('/platform/owner/tenants/:tenantId/users', platformSecretRequired, writeRateLimit, async (req, res) => {
    try {
      const { tenantId } = ParamsSchema.parse(req.params)
      const user = await createTenantUser({ tenantId, body: req.body, db: getFirestore(), auth: getAuth() })
      return res.json({ success: true, user, request_id: req.requestId || null })
    } catch (err) {
      const errorCode = safeErrorCode(err)
      requestLog(req, 'create_tenant_user_failed', { error_code: errorCode }, 'warn')
      if (err instanceof z.ZodError) return sendError(res, 400, req, 'invalid_payload')
      return sendError(res, statusFromCode(errorCode), req, errorCode)
    }
  })

  router.patch('/platform/owner/tenants/:tenantId/users/:userId', platformSecretRequired, writeRateLimit, async (req, res) => {
    try {
      const { tenantId, userId } = UserParamsSchema.parse(req.params)
      const user = await patchTenantUser({ tenantId, userId, body: req.body, db: getFirestore(), auth: getAuth() })
      if (!user) return sendError(res, 404, req, 'not_found')
      return res.json({ success: true, user, request_id: req.requestId || null })
    } catch (err) {
      const errorCode = safeErrorCode(err)
      requestLog(req, 'patch_tenant_user_failed', { error_code: errorCode }, 'warn')
      if (err instanceof z.ZodError) return sendError(res, 400, req, 'invalid_payload')
      return sendError(res, statusFromCode(errorCode), req, errorCode)
    }
  })

  router.delete('/platform/owner/tenants/:tenantId/users/:userId', platformSecretRequired, writeRateLimit, async (req, res) => {
    try {
      const { tenantId, userId } = UserParamsSchema.parse(req.params)
      const deleted = await deleteTenantUser({ tenantId, userId, db: getFirestore(), auth: getAuth() })
      if (!deleted) return sendError(res, 404, req, 'not_found')
      return res.json({ success: true, request_id: req.requestId || null })
    } catch (err) {
      const errorCode = safeErrorCode(err)
      requestLog(req, 'delete_tenant_user_failed', { error_code: errorCode }, 'warn')
      return sendError(res, statusFromCode(errorCode), req, errorCode)
    }
  })

  return router
}
