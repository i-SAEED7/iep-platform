# Security Baseline

## Repository
- Never commit `.env`, API keys, database credentials, student exports, raw signatures, or backups.
- Use environment variables in hosting.
- Keep production data outside GitHub.

## Authentication
- Email + password only.
- Password minimum 12 characters with strength checking.
- One active session per account.
- 30 minute inactivity timeout with 5 minute warning.
- Prefer server-managed HttpOnly + Secure + SameSite cookies.
- Password reset link: 30 minutes, single-use.
- Email activation link: 24 hours, single-use.

## Authorization
Every backend request must evaluate Identity → Permission → Scope.

Required negative tests include:
- Teacher cannot access any unassigned student.
- Guardian cannot access a student without an active approved link.
- Student cannot access another student's context.
- Organization/program boundaries cannot be bypassed by changing IDs.
- File download requires object-level authorization.

## Files
- MIME allowlist.
- Size limits.
- Private object storage.
- No predictable file URLs.
- Authorization check before every download.

## Audit
Log important events:
- role changes
- student edits
- guardian links/unlinks
- IEP versions
- assessment approvals
- account recovery
- AI agent actions and prompt/model version metadata

## AI
- Separate assessment and learning modes.
- Minimum necessary student context only.
- No cross-student memory/context.
- AI suggestions never become final IEP data until teacher approval.
