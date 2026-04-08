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

  router.post('/platform/owner/tenants/:tenantId/users', platformSecretRequired, writeRateLimit, async (req, res) => {
    try {
      const { tenantId } = ParamsSchema.parse(req.params)
      const user = await createTenantUser({ tenantId, body: req.body, db: getFirestore(), auth: getAuth() })
      return res.json({ success: true, user })
    } catch (err) {
      requestLog(req, 'create_tenant_user_failed', { error_code: safeErrorCode(err) }, 'warn')
      if (err instanceof z.ZodError) return sendError(res, 400, req, 'invalid_payload')
      return sendError(res, 500, req, safeErrorCode(err))
    }
  })

  router.patch('/platform/owner/tenants/:tenantId/users/:userId', platformSecretRequired, writeRateLimit, async (req, res) => {
    try {
      const { tenantId, userId } = UserParamsSchema.parse(req.params)
      const user = await patchTenantUser({ tenantId, userId, body: req.body, db: getFirestore(), auth: getAuth() })
      if (!user) return sendError(res, 404, req, 'not_found')
      return res.json({ success: true, user })
    } catch (err) {
      requestLog(req, 'patch_tenant_user_failed', { error_code: safeErrorCode(err) }, 'warn')
      if (err instanceof z.ZodError) return sendError(res, 400, req, 'invalid_payload')
      return sendError(res, 500, req, safeErrorCode(err))
    }
  })

  router.delete('/platform/owner/tenants/:tenantId/users/:userId', platformSecretRequired, writeRateLimit, async (req, res) => {
    try {
      const { tenantId, userId } = UserParamsSchema.parse(req.params)
      const deleted = await deleteTenantUser({ tenantId, userId, db: getFirestore(), auth: getAuth() })
      if (!deleted) return sendError(res, 404, req, 'not_found')
      return res.json({ success: true })
    } catch (err) {
      requestLog(req, 'delete_tenant_user_failed', { error_code: safeErrorCode(err) }, 'warn')
      return sendError(res, 500, req, safeErrorCode(err))
    }
  })

  return router
}
