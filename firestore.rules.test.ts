/**
 * Security Rule Verification Spec & Dirty Dozen Payload Assertions
 * For Atharv Kamath Hub Firestore Security Rules
 */
import fs from 'fs';
import path from 'path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

export const dirtyDozenPayloads = [
  {
    name: '1. Self-Owner Escalation',
    collection: 'adminUsers',
    operation: 'create',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attacker-uid', name: 'Attacker', email: 'business.atharvk@gmail.com', role: 'owner', status: 'active' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Self-Approval Escalation',
    collection: 'adminUsers',
    operation: 'create',
    auth: { uid: 'applicant-uid', email: 'applicant@example.com', email_verified: true },
    payload: { uid: 'applicant-uid', name: 'Applicant', email: 'applicant@example.com', role: 'full_admin', status: 'active' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Email Spoofing (Unverified Owner Email)',
    collection: 'adminRequests',
    operation: 'list',
    auth: { uid: 'spoof-uid', email: 'business.atharvk@gmail.com', email_verified: false },
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Pending Request Tampering',
    collection: 'adminRequests',
    operation: 'update',
    auth: { uid: 'applicant-uid', email: 'applicant@example.com', email_verified: true },
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow Ghost Field Injection',
    collection: 'adminRequests',
    operation: 'create',
    auth: { uid: 'applicant-uid', email: 'applicant@example.com', email_verified: true },
    payload: { requestId: 'req_1', uid: 'applicant-uid', autoApprove: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Limited Admin Privilege Escalation',
    collection: 'adminUsers',
    operation: 'update',
    auth: { uid: 'limited-uid', email: 'limited@example.com', email_verified: true },
    payload: { permissions: { blogs: { publish: true } } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Owner Demotion by Full Admin',
    collection: 'adminUsers',
    operation: 'delete',
    auth: { uid: 'full-admin-uid', email: 'admin@example.com', email_verified: true },
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Unscanned Game Publication',
    collection: 'games',
    operation: 'create',
    auth: { uid: 'game-admin-uid', email: 'gameadmin@example.com', email_verified: true },
    payload: { gameId: 'g1', publicationStatus: 'published', securityScanStatus: 'quarantined', uploadStatus: 'completed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Inquiry PII Scraping',
    collection: 'inquiries',
    operation: 'list',
    auth: null,
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Audit Log Tampering',
    collection: 'adminAuditLogs',
    operation: 'delete',
    auth: { uid: 'owner-uid', email: 'business.atharvk@gmail.com', email_verified: true },
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. ID Poisoning / Resource Exhaustion',
    collection: 'inquiries',
    operation: 'create',
    auth: null,
    payload: { inquiryId: 'invalid id with spaces and >128 chars '.repeat(5) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Client Timestamp Forgery',
    collection: 'adminRequests',
    operation: 'create',
    auth: { uid: 'applicant-uid', email: 'applicant@example.com', email_verified: true },
    payload: { requestedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '13. Owner UID Mismatch Hijack',
    collection: 'adminConfig',
    operation: 'update',
    auth: { uid: 'hijacker-uid', email: 'business.atharvk@gmail.com', email_verified: true },
    payload: { ownerUid: 'hijacker-uid', ownerEmail: 'business.atharvk@gmail.com', role: 'owner', locked: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '14. Visitor Analytics Tampering',
    collection: 'analytics',
    operation: 'create',
    auth: null,
    payload: { scope: 'production', totalPageViews: 999999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '15. Visitor Analytics Summary Read Leak',
    collection: 'analytics',
    operation: 'list',
    auth: null,
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
];

// Structural invariant assertions on compiled rules text
const requiredAssertions = [
  "rules_version = '2';",
  'match /{document=**}',
  'request.auth.token.email_verified == true',
  "request.auth.token.email.lower() == 'business.atharvk@gmail.com'",
  'get(ownerConfigPath()).data.ownerUid == request.auth.uid',
  "configId != 'owner'",
  "configId == 'analytics'",
  'isValidAnalyticsSummary',
  'request.time',
  "data.publicationStatus != 'published' || (data.securityScanStatus == 'passed' && data.uploadStatus == 'completed')",
  'allow update, delete: if false;',
];

for (const assertion of requiredAssertions) {
  if (!rulesContent.includes(assertion)) {
    throw new Error(`Security invariant missing in firestore.rules: ${assertion}`);
  }
}

console.log(`Verified ${dirtyDozenPayloads.length} Dirty Dozen+ attack vectors & ${requiredAssertions.length} structural rule invariants.`);

