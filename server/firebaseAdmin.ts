import { initializeApp, cert, applicationDefault, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export const PROJECT_ID: string = firebaseConfig.projectId;
const rawDatabaseId = typeof firebaseConfig.firestoreDatabaseId === 'string'
  ? firebaseConfig.firestoreDatabaseId.trim()
  : '';
export const DATABASE_ID: string = rawDatabaseId || '(default)';
export const STORAGE_BUCKET: string = firebaseConfig.storageBucket;
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'business.atharvk@gmail.com').toLowerCase();
export const ENV_OWNER_UID = (process.env.OWNER_UID || '').trim();

const OWNER_LOCK_FILE = path.resolve(process.cwd(), 'storage', 'owner_lock.json');

export interface OwnerLockRecord {
  ownerUid: string;
  ownerEmail: string;
  lockedAt: string;
}

export function readOwnerLock(): OwnerLockRecord | null {
  try {
    if (!fs.existsSync(OWNER_LOCK_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(OWNER_LOCK_FILE, 'utf8'));
    if (raw && typeof raw.ownerUid === 'string' && raw.ownerUid.trim()) {
      return {
        ownerUid: raw.ownerUid.trim(),
        ownerEmail: String(raw.ownerEmail || OWNER_EMAIL).toLowerCase(),
        lockedAt: String(raw.lockedAt || new Date().toISOString()),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeOwnerLock(ownerUid: string, ownerEmail: string): OwnerLockRecord {
  const existing = readOwnerLock();
  if (existing) {
    if (existing.ownerUid !== ownerUid) {
      throw new Error('Owner UID lock already bound to a different UID.');
    }
    return existing;
  }
  const dir = path.dirname(OWNER_LOCK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const rec: OwnerLockRecord = {
    ownerUid,
    ownerEmail: ownerEmail.toLowerCase(),
    lockedAt: new Date().toISOString(),
  };
  fs.writeFileSync(OWNER_LOCK_FILE, JSON.stringify(rec, null, 2), 'utf8');
  return rec;
}

let adminInitialized = false;
let hasAdminCredentials = false;
let adminApp: App | null = null;

export function initFirebaseAdmin() {
  if (adminInitialized) return;
  adminInitialized = true;
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      hasAdminCredentials = true;
      return;
    }

    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountRaw && serviceAccountRaw.trim().startsWith('{')) {
      const cred = JSON.parse(serviceAccountRaw);
      if (cred.project_id && cred.project_id !== PROJECT_ID) {
        console.warn(
          `[FirebaseAdmin] Skipping FIREBASE_SERVICE_ACCOUNT_JSON because credential project_id (${cred.project_id}) does not match configured projectId (${PROJECT_ID}). Using verified JWT + Firestore REST bridge.`
        );
        return;
      }
      adminApp = initializeApp({
        credential: cert(cred),
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
      hasAdminCredentials = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(credPath)) {
        const cred = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
        if (cred.project_id && cred.project_id !== PROJECT_ID) {
          console.warn(
            `[FirebaseAdmin] Skipping GOOGLE_APPLICATION_CREDENTIALS because credential project_id (${cred.project_id}) does not match configured projectId (${PROJECT_ID}). Using verified JWT + Firestore REST bridge.`
          );
          return;
        }
      }
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
      hasAdminCredentials = true;
    }
  } catch (err) {
    console.warn('[FirebaseAdmin] Running without service-account credentials; using verified JWT + Firestore REST bridge.', err);
    hasAdminCredentials = false;
  }
}

initFirebaseAdmin();

export function isAdminSdkAvailable(): boolean {
  return hasAdminCredentials && adminApp !== null;
}

function getAdminDb() {
  if (!adminApp) throw new Error('Firebase Admin app not initialized.');
  return DATABASE_ID && DATABASE_ID !== '(default)'
    ? getFirestore(adminApp, DATABASE_ID)
    : getFirestore(adminApp);
}

export function getAdminStorageBucket() {
  if (!hasAdminCredentials || !adminApp) return null;
  try {
    return getStorage(adminApp).bucket(STORAGE_BUCKET);
  } catch {
    return null;
  }
}

// === CRYPTOGRAPHIC FIREBASE ID TOKEN VERIFICATION ===
interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}
let certCache: CertCache | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) {
    return certCache.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google public keys (${resp.status})`);
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  const certs = (await resp.json()) as Record<string, string>;
  certCache = { certs, expiresAt: now + maxAgeSec * 1000 };
  return certs;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

function base64UrlDecode(str: string): Buffer {
  const pad = str.length % 4;
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded, 'base64');
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase ID token.');
  }

  if (hasAdminCredentials && adminApp) {
    const decoded = await getAuth(adminApp).verifyIdToken(idToken, true);
    return {
      uid: decoded.uid,
      email: (decoded.email || '').toLowerCase(),
      email_verified: Boolean(decoded.email_verified),
      name: decoded.name,
    };
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT.');
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Malformed JWT header or payload.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token algorithm or key ID.');
  }

  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Signing certificate not found for token kid.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = base64UrlDecode(signatureB64);
  if (!verifier.verify(certPem, signature)) {
    throw new Error('Invalid Firebase token signature.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) {
    throw new Error('Invalid token audience.');
  }
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new Error('Invalid token issuer.');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Invalid token subject.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Firebase token expired.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Invalid token issued-at time.');
  }

  return {
    uid: payload.sub,
    email: (payload.email || '').toLowerCase(),
    email_verified: Boolean(payload.email_verified),
    name: payload.name,
  };
}

// === FIRESTORE VALUE CONVERTERS ===
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function fromFirestoreDoc(doc: any): Record<string, any> | null {
  if (!doc || !doc.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;

function restHeaders(idToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  return headers;
}

export async function fsGetDoc(collectionPath: string, docId: string, idToken?: string): Promise<Record<string, any> | null> {
  if (hasAdminCredentials && adminApp) {
    const db = getAdminDb();
    const snap = await db.collection(collectionPath).doc(docId).get();
    return snap.exists ? (snap.data() as Record<string, any>) : null;
  }

  const url = `${FIRESTORE_BASE}/documents/${collectionPath}/${encodeURIComponent(docId)}`;
  const resp = await fetch(url, { headers: restHeaders(idToken) });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Firestore GET ${collectionPath}/${docId} failed (${resp.status}): ${txt}`);
  }
  const data = await resp.json();
  return fromFirestoreDoc(data);
}

export async function fsListDocs(collectionPath: string, idToken?: string): Promise<Record<string, any>[]> {
  if (hasAdminCredentials && adminApp) {
    const db = getAdminDb();
    const snap = await db.collection(collectionPath).get();
    return snap.docs.map((d) => d.data());
  }

  const url = `${FIRESTORE_BASE}/documents/${collectionPath}?pageSize=200`;
  const resp = await fetch(url, { headers: restHeaders(idToken) });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Firestore LIST ${collectionPath} failed (${resp.status}): ${txt}`);
  }
  const data = (await resp.json()) as { documents?: any[] };
  return (data.documents || []).map((d) => fromFirestoreDoc(d)).filter(Boolean) as Record<string, any>[];
}

export async function fsCommitWrite(
  collectionPath: string,
  docId: string,
  fieldsData: Record<string, any>,
  serverTimestampFields: string[] = [],
  updateMaskFields?: string[],
  idToken?: string
): Promise<void> {
  if (hasAdminCredentials && adminApp) {
    const db = getAdminDb();
    const payload: Record<string, any> = { ...fieldsData };
    for (const f of serverTimestampFields) {
      payload[f] = FieldValue.serverTimestamp();
    }
    if (updateMaskFields && updateMaskFields.length > 0) {
      await db.collection(collectionPath).doc(docId).update(payload);
    } else {
      await db.collection(collectionPath).doc(docId).set(payload);
    }
    return;
  }

  const docName = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${collectionPath}/${docId}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fieldsData)) {
    if (v !== undefined && !serverTimestampFields.includes(k)) {
      fields[k] = toFirestoreValue(v);
    }
  }

  const writeOp: any = {
    update: {
      name: docName,
      fields,
    },
  };

  if (updateMaskFields && updateMaskFields.length > 0) {
    writeOp.updateMask = { fieldPaths: updateMaskFields };
    writeOp.currentDocument = { exists: true };
  }

  if (serverTimestampFields.length > 0) {
    writeOp.updateTransforms = serverTimestampFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    }));
  }

  const resp = await fetch(`${FIRESTORE_BASE}/documents:commit`, {
    method: 'POST',
    headers: restHeaders(idToken),
    body: JSON.stringify({ writes: [writeOp] }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Firestore COMMIT ${collectionPath}/${docId} failed (${resp.status}): ${txt}`);
  }
}

export async function fsDeleteDoc(collectionPath: string, docId: string, idToken?: string): Promise<void> {
  if (hasAdminCredentials && adminApp) {
    const db = getAdminDb();
    await db.collection(collectionPath).doc(docId).delete();
    return;
  }
  const url = `${FIRESTORE_BASE}/documents/${collectionPath}/${encodeURIComponent(docId)}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: restHeaders(idToken),
  });
  if (!resp.ok && resp.status !== 404) {
    const txt = await resp.text();
    throw new Error(`Firestore DELETE ${collectionPath}/${docId} failed (${resp.status}): ${txt}`);
  }
}
