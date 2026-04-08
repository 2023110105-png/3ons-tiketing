# Backend Launch Checklist

## Secrets & Config
- Set `WA_ADMIN_SECRET` (wa-server).
- Set `TICKET_SIGNING_SECRET` (wa-server).
- Set `SMTP_USER` and `SMTP_PASS` (wa-server) if email sending is enabled.
- Set `PLATFORM_ADMIN_SECRET` (api-server).
- Set Firebase Admin envs on `api-server`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- Verify `API_DEV_BYPASS_AUTH=false` in production.
- Set `CORS_ALLOWED_ORIGINS` explicitly on both backends.

## Health & Readiness
- Verify `GET /health` on `wa-server` returns `ok: true` and session summary.
- Verify `GET /health` and `GET /health/deep` on `api-server`.
- Confirm at least one tenant session can reach `ready` state in `wa-server`.

## Security Smoke Test
- Confirm protected endpoints reject missing/invalid secrets:
  - `POST /api/ticket/verify`
  - `POST /api/import/barcode`
  - `POST /api/import/verify-and-register`
  - `GET /api/import/logs`
  - `/platform/owner/*` endpoints on `api-server`
- Confirm no raw stack traces are returned to clients.

## Reliability Smoke Test
- Test `POST /api/send-ticket` with valid secret and reachable WA session.
- Test rate limit behavior (429) for burst requests on write endpoints.
- Check structured logs include `request_id`, path, status, and latency.

## Rollback Plan
1. Keep previous deployment image tagged (`stable-last`).
2. If critical error occurs, redeploy `stable-last` image for both services.
3. Revert only environment changes that are tied to new release (`TICKET_SIGNING_SECRET`, CORS list updates).
4. Re-run health endpoints and one end-to-end send-ticket smoke test.
