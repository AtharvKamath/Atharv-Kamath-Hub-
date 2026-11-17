import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAdminStorageBucket } from './firebaseAdmin';

export const ALLOWED_GAME_EXTENSIONS = ['.zip', '.rar', '.7z', '.exe', '.apk', '.msi'] as const;
export const MAX_GAME_FILE_SIZE_BYTES = parseInt(process.env.MAX_GAME_FILE_SIZE_MB || '500', 10) * 1024 * 1024;
export const STORAGE_QUOTA_BYTES = parseInt(process.env.STORAGE_QUOTA_MB || '5120', 10) * 1024 * 1024;

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const QUARANTINE_DIR = path.join(STORAGE_ROOT, 'quarantine');
const GAMES_VAULT_DIR = path.join(STORAGE_ROOT, 'games');

// EICAR standard antivirus test string (split to avoid static false positives while remaining functionally identical)
const EICAR_PART_A = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-';
const EICAR_PART_B = 'ANTIVIRUS-TEST-FILE!$H+H*';
const EICAR_SIGNATURE = EICAR_PART_A + EICAR_PART_B;

// Ephemeral fallback secret per server boot if DOWNLOAD_TOKEN_SECRET is unset
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');
function getTokenSecret(): string {
  return process.env.DOWNLOAD_TOKEN_SECRET || EPHEMERAL_SECRET;
}

export function ensureGameStorageDirs() {
  for (const dir of [STORAGE_ROOT, QUARANTINE_DIR, GAMES_VAULT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._\-]/g, '_');
  return base.slice(0, 140) || 'game_package.zip';
}

export function getFileExtension(name: string): string {
  return path.extname(name).toLowerCase();
}

export function isAllowedGameExtension(name: string): boolean {
  const ext = getFileExtension(name);
  return (ALLOWED_GAME_EXTENSIONS as readonly string[]).includes(ext);
}

export function getTotalVaultUsageBytes(): number {
  ensureGameStorageDirs();
  let total = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  };
  walk(GAMES_VAULT_DIR);
  walk(QUARANTINE_DIR);
  return total;
}

export interface SecurityScanResult {
  passed: boolean;
  sha256: string;
  details: string;
}

export async function runFileSecurityScan(filePath: string, expectedExt: string): Promise<SecurityScanResult> {
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { passed: false, sha256: '', details: 'Uploaded file is empty (0 bytes).' };
  }
  if (stat.size > MAX_GAME_FILE_SIZE_BYTES) {
    return { passed: false, sha256: '', details: 'File exceeds maximum configured size limit.' };
  }

  // Read header bytes for magic-byte signature verification
  const fd = fs.openSync(filePath, 'r');
  const headerBuf = Buffer.alloc(Math.min(512, stat.size));
  fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
  fs.closeSync(fd);

  // Magic byte checks per allowed binary/archive type
  let magicValid = false;
  switch (expectedExt) {
    case '.zip':
    case '.apk':
      // PK\x03\x04 or empty zip PK\x05\x06 or spanned PK\x07\x08
      magicValid =
        headerBuf.length >= 4 &&
        headerBuf[0] === 0x50 &&
        headerBuf[1] === 0x4b &&
        (headerBuf[2] === 0x03 || headerBuf[2] === 0x05 || headerBuf[2] === 0x07);
      break;
    case '.rar':
      // Rar! (RAR4 or RAR5)
      magicValid =
        headerBuf.length >= 6 &&
        headerBuf[0] === 0x52 &&
        headerBuf[1] === 0x61 &&
        headerBuf[2] === 0x72 &&
        headerBuf[3] === 0x21 &&
        headerBuf[4] === 0x1a &&
        headerBuf[5] === 0x07;
      break;
    case '.7z':
      // 7z\xBC\xAF\x27\x1C
      magicValid =
        headerBuf.length >= 6 &&
        headerBuf[0] === 0x37 &&
        headerBuf[1] === 0x7a &&
        headerBuf[2] === 0xbc &&
        headerBuf[3] === 0xaf &&
        headerBuf[4] === 0x27 &&
        headerBuf[5] === 0x1c;
      break;
    case '.exe':
      // MZ PE header
      magicValid = headerBuf.length >= 2 && headerBuf[0] === 0x4d && headerBuf[1] === 0x5a;
      break;
    case '.msi':
      // OLE Compound File header D0 CF 11 E0 A1 B1 1A E1
      magicValid =
        headerBuf.length >= 8 &&
        headerBuf[0] === 0xd0 &&
        headerBuf[1] === 0xcf &&
        headerBuf[2] === 0x11 &&
        headerBuf[3] === 0xe0 &&
        headerBuf[4] === 0xa1 &&
        headerBuf[5] === 0xb1 &&
        headerBuf[6] === 0x1a &&
        headerBuf[7] === 0xe1;
      break;
    default:
      magicValid = false;
  }

  // Reject disguised HTML/script/shell payloads
  const headerAscii = headerBuf.toString('utf8').trimStart().toLowerCase();
  if (
    headerAscii.startsWith('<!doctype') ||
    headerAscii.startsWith('<html') ||
    headerAscii.startsWith('<script') ||
    headerAscii.startsWith('<?php') ||
    headerAscii.startsWith('#!/')
  ) {
    return {
      passed: false,
      sha256: '',
      details: `Disguised web/script payload detected inside ${expectedExt} upload.`,
    };
  }

  if (!magicValid) {
    return {
      passed: false,
      sha256: '',
      details: `File content magic bytes do not match declared ${expectedExt} format.`,
    };
  }

  // Compute SHA-256 and scan stream for EICAR test signature
  const hash = crypto.createHash('sha256');
  let eicarDetected = false;
  let tailOverlap = '';

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    stream.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      hash.update(buf);
      const text = tailOverlap + buf.toString('latin1');
      if (text.includes(EICAR_SIGNATURE)) {
        eicarDetected = true;
      }
      tailOverlap = text.slice(-EICAR_SIGNATURE.length);
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  const sha256 = hash.digest('hex');

  if (eicarDetected) {
    return {
      passed: false,
      sha256,
      details: 'Quarantined: Malicious test signature (EICAR) detected.',
    };
  }

  // Optional VirusTotal hash reputation check if API key is configured
  const vtKey = process.env.VIRUSTOTAL_API_KEY;
  if (vtKey) {
    try {
      const vtResp = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
        headers: { 'x-apikey': vtKey },
      });
      if (vtResp.ok) {
        const vtData: any = await vtResp.json();
        const stats = vtData?.data?.attributes?.last_analysis_stats;
        if (stats && (stats.malicious > 0 || stats.suspicious > 2)) {
          return {
            passed: false,
            sha256,
            details: `Quarantined by VirusTotal (${stats.malicious} malicious detections).`,
          };
        }
      }
    } catch {
      // Non-fatal if VirusTotal hash isn't indexed yet
    }
  }

  return {
    passed: true,
    sha256,
    details: `Verified ${expectedExt.toUpperCase()} binary signature and SHA-256 integrity.`,
  };
}

export async function moveQuarantinedToVault(
  quarantineFilePath: string,
  gameId: string,
  safeFileName: string
): Promise<{ storageProvider: 'firebase_storage' | 'server_vault'; filePath: string }> {
  ensureGameStorageDirs();
  const bucket = getAdminStorageBucket();

  if (bucket) {
    const remotePath = `games/${gameId}/${safeFileName}`;
    await bucket.upload(quarantineFilePath, {
      destination: remotePath,
      metadata: {
        contentType: 'application/octet-stream',
        cacheControl: 'private, max-age=0',
      },
    });
    if (fs.existsSync(quarantineFilePath)) {
      fs.unlinkSync(quarantineFilePath);
    }
    return { storageProvider: 'firebase_storage', filePath: remotePath };
  }

  const targetDir = path.join(GAMES_VAULT_DIR, gameId);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetPath = path.join(targetDir, safeFileName);
  fs.renameSync(quarantineFilePath, targetPath);
  return { storageProvider: 'server_vault', filePath: `${gameId}/${safeFileName}` };
}

export async function deleteStoredGameBinary(
  storageProvider: string | undefined,
  filePathRel: string
): Promise<void> {
  if (!filePathRel) return;
  if (storageProvider === 'firebase_storage') {
    const bucket = getAdminStorageBucket();
    if (bucket) {
      await bucket.file(filePathRel).delete({ ignoreNotFound: true });
    }
    return;
  }
  const resolved = path.resolve(GAMES_VAULT_DIR, filePathRel);
  if (resolved.startsWith(GAMES_VAULT_DIR) && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
    const parent = path.dirname(resolved);
    if (parent !== GAMES_VAULT_DIR && fs.readdirSync(parent).length === 0) {
      fs.rmdirSync(parent);
    }
  }
}

export function getVaultFileAbsolutePath(filePathRel: string): string | null {
  const resolved = path.resolve(GAMES_VAULT_DIR, filePathRel);
  if (!resolved.startsWith(GAMES_VAULT_DIR) || !fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

export function createSignedDownloadToken(payload: {
  gameId: string;
  filePath: string;
  downloadFileName: string;
  storageProvider: string;
}): string {
  const data = {
    ...payload,
    exp: Date.now() + 5 * 60 * 1000, // 5 minute expiry
  };
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedDownloadToken(token: string): {
  gameId: string;
  filePath: string;
  downloadFileName: string;
  storageProvider: string;
  exp: number;
} | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getTokenSecret()).update(encoded).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getQuarantinePath(uploadId: string, safeFileName: string): string {
  ensureGameStorageDirs();
  return path.join(QUARANTINE_DIR, `${uploadId}_${safeFileName}`);
}
