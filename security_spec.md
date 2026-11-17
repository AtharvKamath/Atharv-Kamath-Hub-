# Security Specification — Atharv Kamath Hub

## 1. Data Invariants
1. **Owner Sovereignty**: Only the verified identity `business.atharvk@gmail.com` (`email_verified == true`) bound to the immutable `ownerUid` in `/adminConfig/owner` holds the `owner` role. No client registration or admin mutation can assign, modify, suspend, or remove the Owner.
2. **Email Verification Gate**: Unverified accounts (`email_verified == false`) cannot submit `adminRequests`, cannot read admin collections, and cannot access admin routes.
3. **Approval Isolation**: Newly registered users cannot create documents in `adminUsers`. Only the Owner can approve requests and create/update `adminUsers` documents.
4. **Least-Privilege RBAC**: Limited administrators can only mutate `siteContent`, `games`, or `inquiries` when their active `adminUsers/{uid}` record explicitly grants the required section & action permission (`view`, `create`, `edit`, `delete`, `publish`).
5. **Gaming Zone Security Gate**: Uploaded games cannot transition to `publicationStatus == 'published'` unless `securityScanStatus == 'passed'` and `uploadStatus == 'completed'`. Public visitors can only read published, scan-passed games.
6. **PII Isolation**: Visitor `inquiries` and `adminUsers` / `adminRequests` contain PII (`email`) and are never publicly readable.
7. **Immutable Audit Logs**: `adminAuditLogs` are append-only (`create` only, no `update` or `delete`) and readable only by the Owner.
8. **Temporal Integrity**: Creation and update timestamps (`createdAt`, `updatedAt`, `requestedAt`, `timestamp`) must match `request.time`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Owner Escalation**: Client attempts to create `/adminUsers/{uid}` with `{ role: 'owner', email: 'business.atharvk@gmail.com' }` using an unverified or different account. -> `PERMISSION_DENIED`.
2. **Self-Approval Escalation**: Verified applicant attempts to create `/adminUsers/{uid}` with `{ role: 'full_admin', status: 'active' }`. -> `PERMISSION_DENIED`.
3. **Email Spoofing**: Unverified user (`email_verified: false`) with email `business.atharvk@gmail.com` tries to read `adminRequests`. -> `PERMISSION_DENIED`.
4. **Pending Request Tampering**: Applicant tries to update `/adminRequests/{reqId}` changing `status` from `'pending'` to `'approved'`. -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: Applicant creates `/adminRequests/{reqId}` with extra field `{ autoApprove: true }`. -> `PERMISSION_DENIED` (`keys().hasOnly(...)`).
6. **Limited Admin Privilege Escalation**: Limited admin updates `/adminUsers/{theirUid}` to add `blogs: { publish: true }`. -> `PERMISSION_DENIED`.
7. **Owner Demotion by Full Admin**: Full admin attempts to update or delete Owner's `/adminUsers/{ownerUid}` doc. -> `PERMISSION_DENIED`.
8. **Unscanned Game Publication**: Gaming Zone admin attempts to create/update `/games/{gameId}` with `publicationStatus: 'published'` while `securityScanStatus: 'quarantined'`. -> `PERMISSION_DENIED`.
9. **Inquiry PII Scraping**: Unauthenticated visitor or unauthorized Blogs admin calls `list` or `get` on `/inquiries`. -> `PERMISSION_DENIED`.
10. **Audit Log Tampering**: Active admin attempts to `update` or `delete` `/adminAuditLogs/{logId}`. -> `PERMISSION_DENIED`.
11. **ID Poisoning / Resource Exhaustion**: Client tries to write a 500-char doc ID or 1MB description field into `/inquiries/{longId}`. -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Client creates `/adminRequests/{reqId}` with backdated `requestedAt` (`2020-01-01T00:00:00Z`) instead of `request.time`. -> `PERMISSION_DENIED`.
13. **Analytics Tampering & Scraping**: Unauthenticated visitors or non-owner admins attempt to write to `/analytics/*` or `/adminConfig/analytics`, or visitors attempt to read `/analytics/*`. -> `PERMISSION_DENIED`.

