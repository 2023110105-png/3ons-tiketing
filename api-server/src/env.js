import { z } from 'zod'

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional().default(3002),

  // CSV list, e.g: "https://your-vercel.app,https://your-domain.com"
  CORS_ALLOWED_ORIGINS: z.string().optional().default(''),

  // Firebase Admin (recommended via Railway env vars).
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),

  // Shared secret for platform admin endpoints (Owner panel).
  PLATFORM_ADMIN_SECRET: z.string().min(1).optional().default(''),

  // Optional: temporary bypass for local/dev only.
  API_DEV_BYPASS_AUTH: z.string().optional().default('false')
})

export function readEnv(processEnv = process.env) {
  const parsed = EnvSchema.safeParse(processEnv)
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid env: ${msg}`)
  }

  const env = parsed.data
  return {
    ...env,
    corsAllowedOrigins: splitCsv(env.CORS_ALLOWED_ORIGINS),
    apiDevBypassAuth: String(env.API_DEV_BYPASS_AUTH || '').toLowerCase() === 'true'
  }
}

