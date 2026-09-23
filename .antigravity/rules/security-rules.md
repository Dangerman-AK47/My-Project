# Security Rules

## Authentication & Authorization

- Hash all passwords with bcryptjs (cost factor ≥ 10). Never store plaintext passwords.
- Use secure HTTP-only, SameSite=Lax cookies for admin sessions.
- Sign session tokens with a secret from env (Jose JWT, HS256).
- Set session TTL (default 8 hours); expire cookies on logout (maxAge=0).
- Protect all admin pages server-side: call `requireAdminSession()` in layouts/pages.
- Protect all admin API routes: call `getAuthorizedAdmin()` at the top of every handler.
- The middleware performs the fast stateless check; `guard.ts` performs the authoritative DB check.
- Never trust session data alone — re-verify the admin account is still active in DB.

## Input Validation

- Validate all input server-side with Zod.
- Enforce maximum file size server-side (`MAX_FILE_SIZE_MB` env var). Do not rely on browser validation.
- Validate and normalize Device IDs on both client and server using the shared `deviceIdSchema`.
- Prevent duplicate pending registration requests via the `pendingDeviceKey` DB unique constraint.
- Sanitize all filenames before storage and before deriving extensions.
- Reject empty files (size ≤ 0).

## File Handling

- Do not trust browser-reported MIME types for security decisions.
- Sanitize filenames: strip path separators and dangerous characters.
- Generate unique, opaque storage keys (UUID-based) to prevent enumeration.
- Prevent path traversal: never use user-supplied values directly as filesystem paths.
- Do not expose internal filesystem paths in API responses.
- Protect file downloads with admin authentication and authorization.
- Rate limiting: add at the infrastructure/CDN/reverse-proxy layer.

## Error Handling

- Never expose stack traces, database errors, ORM error objects, or internal paths to clients.
- Return safe, user-friendly error messages in all error responses.
- Log full errors server-side (console.error) for debugging.
- Use a generic fallback message for unexpected errors.

## Secrets

- Store all secrets in environment variables (`.env.local`).
- Never commit real secrets to version control.
- Use `.env.example` to document required variables with placeholder values.
- Required secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

## Audit Trail

- Record all important administrative actions in `AdminAuditEvent`.
- Required fields: `adminId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`.
- Capture `ipAddress` and `userAgent` where available.
- Audit events must be written inside the same transaction as the action.
- Key auditable actions:
  - `FILE_UPLOADED`
  - `REGISTRATION_REQUEST_APPROVED`
  - `REGISTRATION_REQUEST_REJECTED`
  - `DEVICE_STATUS_CHANGED`
  - `FILE_DELETED`
  - `ADMIN_LOGIN`
