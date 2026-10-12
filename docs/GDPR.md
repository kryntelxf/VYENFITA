# GDPR Compliance

VYENFITA implements the following GDPR rights:

| Article | Right | Implementation |
|---------|-------|----------------|
| Art. 15 | Right of access | `GET /api/v1/users/me/export` |
| Art. 17 | Right to erasure | `DELETE /api/v1/users/me` |
| Art. 20 | Right to data portability | `GET /api/v1/users/me/export` (JSON) |

---

## Data Export (Article 15 & 20)

### Export my data

```http
GET /api/v1/users/me/export
Authorization: Bearer <access-token>
X-Tenant-Id: <tenant-id>
```

Returns a JSON file with:

- User profile (email, name, preferences)
- All memberships (tenants + roles)
- All sessions (with IP, user agent, timestamps)
- Audit events (last 10,000)
- Activity logs (last 10,000)
- Usage records (last 10,000)
- Consent records

Format: JSON, `Content-Disposition: attachment`

### Export tenant data (admin only)

```http
GET /api/v1/tenants/me/export
Authorization: Bearer <access-token>
X-Tenant-Id: <tenant-id>
```

Returns a JSON file with:

- Tenant profile
- Data counts (members, applications, workflows, etc.)
- Member list (excluding secrets)

Requires `tenant:manage` permission.

---

## Data Deletion (Article 17)

### Request account deletion

```http
DELETE /api/v1/users/me
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "confirmEmail": "your-email@example.com",
  "reason": "Optional reason"
}
```

Behavior:

1. Immediately soft-deletes the account (user can no longer log in)
2. Revokes all sessions
3. Schedules hard delete after 30-day grace period
4. Anonymizes all PII after grace period expires
5. Preserves audit trail (required for legal compliance)

Response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "scheduledDeletionAt": "2026-11-10T12:00:00.000Z",
    "gracePeriodDays": 30,
    "message": "Your account has been scheduled for deletion on 2026-11-10..."
  }
}
```

### Cancel deletion

```http
POST /api/v1/users/me/deletion/cancel
Authorization: Bearer <access-token>
```

Behavior:

1. Reactivates the account
2. Cancels scheduled hard delete
3. User can log in again

Response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Account deletion has been cancelled."
  }
}
```

### Protection: Sole owner

Users who are the sole owner of a tenant cannot delete their account.
They must first:

1. Transfer ownership to another member, OR
2. Delete the tenant

---

## Data Anonymization

When hard delete executes after the grace period, we anonymize instead of
physically deleting. This is required because:

1. Foreign keys — many tables reference `user.id`
2. Audit trail — legal requirement to preserve for 90 days
3. Billing records — may be required by tax law

**What is anonymized:**

- `email` → `deleted-{userId}@deleted.vyenfita.local`
- `passwordHash` → `null`
- `name` → `null`
- `avatarUrl` → `null`
- `ssoProviderId` → `null`
- Session `ipAddress` and `userAgent` → `null` / `"anonymized"`
- Audit event `ipAddress` and `userAgent` → `null` / `"anonymized"`

**What is kept:**

- User `id` (as anonymous identifier)
- Audit event action, resource, timestamp
- Membership history (anonymized)
- A SHA-256 hash of the original email (for abuse detection)

---

## Retention Periods

Automated cleanup runs daily at 03:00 UTC. See `docs/DATA_RETENTION.md`
for details.

| Data Type | Default Retention |
|-----------|-------------------|
| Audit events | 90 days |
| Workflow executions | 30 days |
| Agent steps | 90 days |
| Expired sessions | +30 days after expiry |
| Expired OAuth states | +60 minutes after expiry |
| Deleted user accounts | +30 days after deletion |

---

## Data Residency

Users can request data residency in a specific region (US, EU, APAC).
See `docs/REGIONS.md` (coming soon) for details.

---

## Compliance Auditing

Every GDPR action is logged:

| Action | Audit Event |
|--------|-------------|
| User export | `gdpr.user_export` |
| Tenant export | `gdpr.tenant_export` |
| Deletion request | `gdpr.user_deletion_requested` |
| Deletion cancel | `gdpr.user_deletion_cancelled` |
| User anonymized | `gdpr.user_anonymized` |

Query audit events:

```http
GET /api/v1/enterprise/audit/events?action=gdpr.user_export
```

---

## Testing

Unit tests: `src/__tests__/unit/gdpr/`

```bash
cd app/ai
yarn jest src/__tests__/unit/gdpr/ --verbose
```

---

## See Also

- `docs/SECURITY.md`
- `docs/DATA_RETENTION.md` (coming soon)
- `docs/API.md`
