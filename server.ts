import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  OWNER_EMAIL,
  ENV_OWNER_UID,
  PROJECT_ID,
  DATABASE_ID,
  verifyFirebaseIdToken,
  VerifiedFirebaseUser,
  fsGetDoc,
  fsListDocs,
  fsCommitWrite,
  fsDeleteDoc,
  isAdminSdkAvailable,
  getAdminStorageBucket,
  readOwnerLock,
  writeOwnerLock,
} from "./server/firebaseAdmin";
import {
  sendOrQueueEmail,
  startEmailRetryWorker,
  isEmailServiceConfigured,
  getEmailProviderSummary,
} from "./server/emailService";
import {
  ALLOWED_GAME_EXTENSIONS,
  MAX_GAME_FILE_SIZE_BYTES,
  STORAGE_QUOTA_BYTES,
  ensureGameStorageDirs,
  sanitizeFileName,
  getFileExtension,
  isAllowedGameExtension,
  getTotalVaultUsageBytes,
  getQuarantinePath,
  runFileSecurityScan,
  moveQuarantinedToVault,
  deleteStoredGameBinary,
  getVaultFileAbsolutePath,
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "./server/gameSecurity";
import {
  AnalyticsEnvironment,
  AnalyticsEventType,
  AnalyticsTimeRange,
  detectTrafficEnvironment,
  getAdminAnalyticsReport,
  getAnalyticsConfig,
  getPublicInteractionCounts,
  recordAnalyticsEvent,
  updateAnalyticsConfig,
} from "./server/analyticsService";
import { buildWebsiteKnowledgeContext } from "./server/knowledgeContext";

dotenv.config();
ensureGameStorageDirs();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));

// Initialize Gemini SDK securely
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

// === RATE LIMITERS ===
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count += 1;
  return true;
}

// === LOCAL DOWNLOAD COUNT OVERLAY (when Admin SDK is not attached) ===
const DOWNLOAD_COUNTS_FILE = path.resolve(process.cwd(), "storage", "download_counts.json");
function incrementLocalDownloadCount(gameId: string): number {
  try {
    let counts: Record<string, number> = {};
    if (fs.existsSync(DOWNLOAD_COUNTS_FILE)) {
      counts = JSON.parse(fs.readFileSync(DOWNLOAD_COUNTS_FILE, "utf8"));
    }
    counts[gameId] = (counts[gameId] || 0) + 1;
    fs.writeFileSync(DOWNLOAD_COUNTS_FILE, JSON.stringify(counts, null, 2), "utf8");
    return counts[gameId];
  } catch {
    return 1;
  }
}

function getLocalDownloadCounts(): Record<string, number> {
  try {
    if (!fs.existsSync(DOWNLOAD_COUNTS_FILE)) return {};
    return JSON.parse(fs.readFileSync(DOWNLOAD_COUNTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

// === AUTHENTICATION & AUTHORIZATION MIDDLEWARE ===
interface AuthenticatedRequest extends Request {
  user?: VerifiedFirebaseUser;
  idToken?: string;
  adminDoc?: Record<string, any> | null;
}

async function requireVerifiedFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication token required." });
    }
    const verifiedUser = await verifyFirebaseIdToken(token);
    if (!verifiedUser.email_verified) {
      return res.status(403).json({ success: false, message: "Email verification is required." });
    }
    req.user = verifiedUser;
    req.idToken = token;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, message: err?.message || "Invalid or expired session token." });
  }
}

interface OwnerLockCheckResult {
  ok: boolean;
  existingAdminDoc?: Record<string, any> | null;
  error?: { status: number; code: string; message: string };
}

async function checkOwnerLockMismatch(
  user: VerifiedFirebaseUser,
  idToken?: string
): Promise<OwnerLockCheckResult> {
  if (!user.email_verified) {
    return { ok: false, error: { status: 403, code: "EMAIL_NOT_VERIFIED", message: "Owner email verification is required." } };
  }
  if (user.email !== OWNER_EMAIL) {
    return { ok: false, error: { status: 403, code: "NOT_OWNER_EMAIL", message: "Owner authorization required." } };
  }

  // 1. Check optional ENV_OWNER_UID lock
  if (ENV_OWNER_UID && ENV_OWNER_UID !== user.uid) {
    return {
      ok: false,
      error: {
        status: 403,
        code: "OWNER_UID_MISMATCH",
        message: "Owner UID does not match the configured immutable Owner UID.",
      },
    };
  }

  // 2. Check server-side immutable owner lock file
  const serverLock = readOwnerLock();
  if (serverLock && serverLock.ownerUid !== user.uid) {
    return {
      ok: false,
      error: {
        status: 403,
        code: "OWNER_UID_MISMATCH",
        message: "An immutable Owner UID is already bound to a different Firebase user.",
      },
    };
  }

  // 3. Check Firestore immutable adminConfig/owner anchor (if readable/present)
  try {
    const ownerAnchor = await fsGetDoc("adminConfig", "owner", idToken);
    if (ownerAnchor && ownerAnchor.ownerUid && ownerAnchor.ownerUid !== user.uid) {
      return {
        ok: false,
        error: {
          status: 403,
          code: "OWNER_UID_MISMATCH",
          message: "Firestore immutable Owner UID anchor is bound to a different Firebase UID.",
        },
      };
    }
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("(403)") || msg.includes("PERMISSION_DENIED")) {
      console.warn("[OwnerVerify] adminConfig/owner read warning:", msg);
    }
  }

  // 4. Check existing adminUsers/{uid} and any existing owner records in adminUsers
  let existingAdminDoc: Record<string, any> | null = null;
  try {
    existingAdminDoc = await fsGetDoc("adminUsers", user.uid, idToken);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("(403)") || msg.includes("PERMISSION_DENIED")) {
      return {
        ok: false,
        error: {
          status: 403,
          code: "FIRESTORE_PERMISSION_DENIED",
          message: `Firestore rejected reading adminUsers/${user.uid} on project ${PROJECT_ID}. Deploy firestore.rules to Firebase Console.`,
        },
      };
    }
    throw err;
  }

  if (existingAdminDoc && existingAdminDoc.role && existingAdminDoc.role !== "owner") {
    if (existingAdminDoc.email?.toLowerCase() !== OWNER_EMAIL) {
      return {
        ok: false,
        error: {
          status: 403,
          code: "OWNER_ROLE_MISMATCH",
          message: "Account role is not configured as Owner.",
        },
      };
    }
  }

  // Check if another UID already holds role === 'owner' in adminUsers
  try {
    const allAdmins = await fsListDocs("adminUsers", idToken);
    const conflictingOwner = allAdmins.find(
      (a) => a.role === "owner" && a.uid && a.uid !== user.uid
    );
    if (conflictingOwner) {
      return {
        ok: false,
        error: {
          status: 403,
          code: "OWNER_UID_MISMATCH",
          message: "Another verified UID already holds the immutable Owner record in Firestore.",
        },
      };
    }
  } catch {
    // Non-fatal if list isn't readable before owner profile creation; checked again on verify
  }

  return { ok: true, existingAdminDoc };
}

async function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireVerifiedFirebaseAuth(req, res, async () => {
    try {
      const check = await checkOwnerLockMismatch(req.user!, req.idToken);
      if (!check.ok && check.error) {
        return res.status(check.error.status).json({
          success: false,
          code: check.error.code,
          message: check.error.message,
        });
      }
      // Require an active owner role record unless calling the initial verify/bootstrap endpoints
      const isVerifyRoute =
        req.path === "/api/admin/owner/verify" || req.path === "/api/admin/bootstrap-owner";
      if (!isVerifyRoute) {
        const doc = check.existingAdminDoc;
        if (!doc || doc.role !== "owner" || doc.status !== "active") {
          return res.status(403).json({
            success: false,
            code: "OWNER_NOT_PROVISIONED",
            message: "Owner role record is not active or verified on the backend.",
          });
        }
        req.adminDoc = doc;
      }
      next();
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || "Owner authorization verification failed.",
      });
    }
  });
}

function requireSectionPermission(section: string, action: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await requireVerifiedFirebaseAuth(req, res, async () => {
      try {
        const user = req.user!;
        const adminDoc = await fsGetDoc("adminUsers", user.uid, req.idToken);
        if (!adminDoc || adminDoc.status !== "active") {
          return res.status(403).json({ success: false, message: "Administrator access is not active." });
        }
        req.adminDoc = adminDoc;
        if (adminDoc.role === "owner") {
          const ownerCheck = await checkOwnerLockMismatch(user, req.idToken);
          if (!ownerCheck.ok && ownerCheck.error) {
            return res.status(ownerCheck.error.status).json({ success: false, message: ownerCheck.error.message });
          }
          return next();
        }
        if (adminDoc.role === "full_admin") {
          return next();
        }
        const hasPerm = Boolean(adminDoc.permissions?.[section]?.[action]);
        if (!hasPerm) {
          return res.status(403).json({
            success: false,
            message: `Insufficient permissions: requires ${section}.${action}.`,
          });
        }
        next();
      } catch (err: any) {
        return res.status(500).json({ success: false, message: err?.message || "Authorization check failed." });
      }
    });
  };
}

async function requireAuthorizedAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireVerifiedFirebaseAuth(req, res, async () => {
    try {
      const user = req.user!;
      const adminDoc = await fsGetDoc("adminUsers", user.uid, req.idToken);
      if (!adminDoc || adminDoc.status !== "active") {
        return res.status(403).json({ success: false, message: "Administrator access is not active." });
      }
      if (adminDoc.role === "owner") {
        const ownerCheck = await checkOwnerLockMismatch(user, req.idToken);
        if (!ownerCheck.ok && ownerCheck.error) {
          return res.status(ownerCheck.error.status).json({
            success: false,
            code: ownerCheck.error.code,
            message: ownerCheck.error.message,
          });
        }
      }
      req.adminDoc = adminDoc;
      next();
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Authorization check failed." });
    }
  });
}

function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function createFullPermissionsServer() {
  const full = { view: true, create: true, edit: true, delete: true, publish: true };
  return {
    home: { ...full },
    about: { ...full },
    links: { ...full },
    gallery: { ...full },
    projects: { ...full },
    videos: { ...full },
    library: { ...full },
    gamingZone: { ...full },
    blogs: { ...full },
    journey: { ...full },
    contact: { ...full },
    directInquiry: { ...full },
  };
}

async function writeAuditLog(
  actorUid: string,
  actorEmail: string,
  action: string,
  targetId: string,
  details: string,
  idToken?: string
) {
  const logId = `log_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  try {
    await fsCommitWrite(
      "adminAuditLogs",
      logId,
      {
        logId,
        actorUid,
        actorEmail,
        action: action.slice(0, 100),
        targetId: targetId.slice(0, 150),
        details: details.slice(0, 1000),
      },
      ["timestamp"],
      undefined,
      idToken
    );
  } catch (err) {
    console.warn("[AuditLog] Write warning:", err);
  }
}

// === SYSTEM STATUS ENDPOINT ===
app.get("/api/system/status", (_req, res) => {
  const emailSummary = getEmailProviderSummary();
  res.json({
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    emailConfigured: isEmailServiceConfigured(),
    emailProvider: emailSummary.provider,
    adminSdkConfigured: isAdminSdkAvailable(),
    ownerEmail: OWNER_EMAIL,
    hasLockedOwnerUid: Boolean(ENV_OWNER_UID || readOwnerLock()?.ownerUid),
    maxGameSizeMb: Math.round(MAX_GAME_FILE_SIZE_BYTES / (1024 * 1024)),
    storageQuotaMb: Math.round(STORAGE_QUOTA_BYTES / (1024 * 1024)),
  });
});

// === PART 2/3/4: OWNER UID/ROLE VERIFICATION, ADMIN BOOTSTRAP, REQUESTS & MANAGEMENT ===
async function handleVerifyAndProvisionOwner(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user!;
    const check = await checkOwnerLockMismatch(user, req.idToken);
    if (!check.ok && check.error) {
      return res.status(check.error.status).json({
        success: false,
        code: check.error.code,
        message: check.error.message,
      });
    }

    // Attempt to anchor immutable adminConfig/owner if not yet present
    let ownerRulesPendingDeploy = false;
    try {
      const existingAnchor = await fsGetDoc("adminConfig", "owner", req.idToken);
      if (!existingAnchor) {
        await fsCommitWrite(
          "adminConfig",
          "owner",
          {
            ownerUid: user.uid,
            ownerEmail: OWNER_EMAIL,
            role: "owner",
            locked: true,
          },
          ["provisionedAt", "updatedAt"],
          undefined,
          req.idToken
        );
      }
    } catch (anchorErr: any) {
      const msg = String(anchorErr?.message || "");
      if (msg.includes("(403)") || msg.includes("PERMISSION_DENIED")) {
        ownerRulesPendingDeploy = true;
      } else {
        console.warn("[OwnerVerify] adminConfig/owner anchor warning:", msg);
      }
    }

    // Bind server-side immutable owner lock
    writeOwnerLock(user.uid, OWNER_EMAIL);

    const existing = check.existingAdminDoc;
    const fullPermissions = createFullPermissionsServer();
    if (existing) {
      await fsCommitWrite(
        "adminUsers",
        user.uid,
        {
          name: existing.name || user.name || "Atharv Kamath",
          role: "owner",
          status: "active",
          permissions: fullPermissions,
          approvedBy: OWNER_EMAIL,
        },
        ["lastLoginAt"],
        ["name", "role", "status", "permissions", "approvedBy", "lastLoginAt"],
        req.idToken
      );
    } else {
      await fsCommitWrite(
        "adminUsers",
        user.uid,
        {
          uid: user.uid,
          name: user.name || "Atharv Kamath",
          email: OWNER_EMAIL,
          role: "owner",
          status: "active",
          permissions: fullPermissions,
          approvedBy: OWNER_EMAIL,
        },
        ["createdAt", "approvedAt", "lastLoginAt"],
        undefined,
        req.idToken
      );
      await writeAuditLog(user.uid, user.email, "OWNER_BOOTSTRAP", user.uid, "Owner profile provisioned and UID locked.", req.idToken);
    }

    const updatedProfile = await fsGetDoc("adminUsers", user.uid, req.idToken).catch(() => null);
    return res.json({
      success: true,
      verifiedOwner: true,
      ownerUid: user.uid,
      email: user.email,
      role: "owner",
      ownerRulesPendingDeploy,
      profile: updatedProfile || {
        uid: user.uid,
        name: existing?.name || user.name || "Atharv Kamath",
        email: OWNER_EMAIL,
        role: "owner",
        status: "active",
        permissions: fullPermissions,
        approvedBy: OWNER_EMAIL,
        createdAt: existing?.createdAt || new Date().toISOString(),
      },
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to verify owner.";
    const isPermDenied = msg.includes("(403)") || msg.includes("PERMISSION_DENIED");
    return res.status(isPermDenied ? 403 : 500).json({
      success: false,
      code: isPermDenied ? "FIRESTORE_PERMISSION_DENIED" : "OWNER_VERIFY_FAILED",
      message: isPermDenied
        ? `Firestore rejected reading/writing adminUsers on project ${PROJECT_ID}. Deploy the project's firestore.rules to Firebase Console → Firestore Database → Rules.`
        : msg,
    });
  }
}

app.post("/api/admin/owner/verify", requireOwner, handleVerifyAndProvisionOwner);
app.post("/api/admin/bootstrap-owner", requireOwner, handleVerifyAndProvisionOwner);

// Notify Owner when a verified applicant submits an admin access request
app.post("/api/admin/requests/notify-owner", requireVerifiedFirebaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    if (user.email === OWNER_EMAIL) {
      return res.status(400).json({ success: false, message: "Owner does not submit an approval request." });
    }
    const { requestId } = req.body;
    if (!requestId || typeof requestId !== "string") {
      return res.status(400).json({ success: false, message: "Missing requestId." });
    }
    if (!checkRateLimit(`notify_req_${user.uid}`, 3, 15 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: "Too many notification attempts. Please wait." });
    }

    const requestDoc = await fsGetDoc("adminRequests", requestId, req.idToken);
    if (!requestDoc || requestDoc.uid !== user.uid) {
      return res.status(404).json({ success: false, message: "Request record not found." });
    }
    if (requestDoc.status !== "pending") {
      return res.status(400).json({ success: false, message: `Request is ${requestDoc.status}.` });
    }

    const dashboardLink = `${getAppBaseUrl(req)}/?page=admin`;
    const emailBody = [
      `A new verified administrator access request has been submitted on Atharv Kamath Hub.`,
      ``,
      `Applicant Name: ${requestDoc.name}`,
      `Applicant Email: ${requestDoc.email}`,
      `Registration Date: ${requestDoc.requestedAt || new Date().toISOString()}`,
      `Email Verification Status: Verified`,
      `Review Deadline: ${requestDoc.expiresAt}`,
      ``,
      `Review and approve/reject this request in the secure Owner Approval Dashboard:`,
      `${dashboardLink}`,
      ``,
      `(Owner authentication is required to perform any approval or rejection action.)`,
    ].join("\n");

    const mailRes = await sendOrQueueEmail({
      to: OWNER_EMAIL,
      subject: "New Admin Access Request — Atharv Kamath Hub",
      text: emailBody,
    });

    if (isAdminSdkAvailable()) {
      try {
        await fsCommitWrite(
          "adminRequests",
          requestId,
          { notificationStatus: mailRes.status },
          [],
          ["notificationStatus"]
        );
      } catch (err) {
        console.warn("[NotifyOwner] notificationStatus update warning:", err);
      }
    }

    return res.json({
      success: true,
      notificationStatus: mailRes.status,
      notificationError: mailRes.error,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to notify owner.";
    const isPermDenied = msg.includes("(403)") || msg.includes("PERMISSION_DENIED");
    return res.status(isPermDenied ? 403 : 500).json({
      success: false,
      message: isPermDenied
        ? `Firestore rejected reading adminRequests on project ${PROJECT_ID}. Deploy firestore.rules to Firebase Console.`
        : msg,
    });
  }
});

// Owner approves an admin request
app.post("/api/admin/requests/:requestId/approve", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestId } = req.params;
    const { role, permissions } = req.body;
    if (!["full_admin", "limited_admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid assigned role." });
    }
    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ success: false, message: "Permissions object is required." });
    }

    const reqDoc = await fsGetDoc("adminRequests", requestId, req.idToken);
    if (!reqDoc) {
      return res.status(404).json({ success: false, message: "Admin request not found." });
    }
    if (reqDoc.status !== "pending") {
      return res.status(400).json({ success: false, message: `Request is already ${reqDoc.status}.` });
    }
    if (reqDoc.expiresAt && new Date(reqDoc.expiresAt).getTime() < Date.now()) {
      await fsCommitWrite(
        "adminRequests",
        requestId,
        { status: "expired" },
        ["reviewedAt"],
        ["status", "reviewedAt"],
        req.idToken
      );
      return res.status(400).json({ success: false, message: "Request has expired and cannot be approved." });
    }

    const finalPermissions = role === "full_admin" ? createFullPermissionsServer() : permissions;

    await fsCommitWrite(
      "adminRequests",
      requestId,
      {
        status: "approved",
        assignedRole: role,
        assignedPermissions: finalPermissions,
        reviewedBy: req.user!.email,
      },
      ["reviewedAt"],
      ["status", "assignedRole", "assignedPermissions", "reviewedAt", "reviewedBy"],
      req.idToken
    );

    const existingAdmin = await fsGetDoc("adminUsers", reqDoc.uid, req.idToken);
    if (existingAdmin) {
      await fsCommitWrite(
        "adminUsers",
        reqDoc.uid,
        {
          name: reqDoc.name,
          role,
          status: "active",
          permissions: finalPermissions,
          approvedBy: req.user!.email,
        },
        ["approvedAt"],
        ["name", "role", "status", "permissions", "approvedAt", "approvedBy"],
        req.idToken
      );
    } else {
      await fsCommitWrite(
        "adminUsers",
        reqDoc.uid,
        {
          uid: reqDoc.uid,
          name: reqDoc.name,
          email: reqDoc.email,
          role,
          status: "active",
          permissions: finalPermissions,
          approvedBy: req.user!.email,
        },
        ["createdAt", "approvedAt"],
        undefined,
        req.idToken
      );
    }

    await writeAuditLog(
      req.user!.uid,
      req.user!.email,
      "APPROVE_ADMIN_REQUEST",
      reqDoc.uid,
      `Approved ${reqDoc.email} as ${role}.`,
      req.idToken
    );

    const dashboardLink = `${getAppBaseUrl(req)}/?page=admin`;
    const mailRes = await sendOrQueueEmail({
      to: reqDoc.email,
      subject: "Administrator Access Approved — Atharv Kamath Hub",
      text: [
        `Hello ${reqDoc.name},`,
        ``,
        `Your administrator access request for Atharv Kamath Hub has been approved.`,
        `Assigned Role: ${role === "full_admin" ? "Full Administrator" : "Limited Administrator"}`,
        ``,
        `You can now sign in to your authorized dashboard at:`,
        `${dashboardLink}`,
      ].join("\n"),
    });

    return res.json({
      success: true,
      emailStatus: mailRes.status,
      emailError: mailRes.error,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Approval failed." });
  }
});

// Owner rejects an admin request
app.post("/api/admin/requests/:requestId/reject", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestId } = req.params;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";

    const reqDoc = await fsGetDoc("adminRequests", requestId, req.idToken);
    if (!reqDoc) {
      return res.status(404).json({ success: false, message: "Admin request not found." });
    }
    if (reqDoc.status !== "pending") {
      return res.status(400).json({ success: false, message: `Request is already ${reqDoc.status}.` });
    }

    await fsCommitWrite(
      "adminRequests",
      requestId,
      {
        status: "rejected",
        reviewedBy: req.user!.email,
        rejectionReason: reason,
      },
      ["reviewedAt"],
      ["status", "reviewedAt", "reviewedBy", "rejectionReason"],
      req.idToken
    );

    await writeAuditLog(
      req.user!.uid,
      req.user!.email,
      "REJECT_ADMIN_REQUEST",
      reqDoc.uid,
      `Rejected ${reqDoc.email}.${reason ? ` Reason: ${reason}` : ""}`,
      req.idToken
    );

    const mailRes = await sendOrQueueEmail({
      to: reqDoc.email,
      subject: "Administrator Access Request Update — Atharv Kamath Hub",
      text: [
        `Hello ${reqDoc.name},`,
        ``,
        `Your administrator access request for Atharv Kamath Hub was not approved.`,
        reason ? `Reason: ${reason}` : ``,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return res.json({
      success: true,
      emailStatus: mailRes.status,
      emailError: mailRes.error,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Rejection failed." });
  }
});

// Expire stale pending requests (callable by Owner and scheduled when Admin SDK is available)
async function expireStaleRequests(idToken?: string, actorUid = "system", actorEmail = "scheduler") {
  const requests = await fsListDocs("adminRequests", idToken);
  const now = Date.now();
  let expiredCount = 0;
  for (const r of requests) {
    if (r.status === "pending" && r.expiresAt && new Date(r.expiresAt).getTime() <= now) {
      await fsCommitWrite(
        "adminRequests",
        r.requestId,
        {
          status: "expired",
          reviewedBy: "system_expiration",
        },
        ["reviewedAt"],
        ["status", "reviewedAt", "reviewedBy"],
        idToken
      );
      expiredCount += 1;
      await writeAuditLog(
        actorUid,
        actorEmail,
        "EXPIRE_ADMIN_REQUEST",
        r.uid || r.requestId,
        `Request ${r.requestId} (${r.email}) expired after review deadline.`,
        idToken
      );
    }
  }
  return expiredCount;
}

app.post("/api/admin/requests/expire-stale", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const expiredCount = await expireStaleRequests(req.idToken, req.user!.uid, req.user!.email);
    return res.json({ success: true, expiredCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to expire stale requests." });
  }
});

// Owner updates admin permissions / role
app.post("/api/admin/users/:uid/permissions", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { uid } = req.params;
    const { role, permissions } = req.body;
    const target = await fsGetDoc("adminUsers", uid, req.idToken);
    if (!target) {
      return res.status(404).json({ success: false, message: "Administrator not found." });
    }
    if (target.role === "owner" || target.email === OWNER_EMAIL) {
      return res.status(403).json({ success: false, message: "Owner permissions cannot be altered or demoted." });
    }
    if (!["full_admin", "limited_admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    const finalPerms = role === "full_admin" ? createFullPermissionsServer() : permissions;
    await fsCommitWrite(
      "adminUsers",
      uid,
      { role, permissions: finalPerms },
      [],
      ["role", "permissions"],
      req.idToken
    );
    await writeAuditLog(
      req.user!.uid,
      req.user!.email,
      "UPDATE_ADMIN_PERMISSIONS",
      uid,
      `Updated ${target.email} role=${role}.`,
      req.idToken
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to update permissions." });
  }
});

// Owner suspends / activates / revokes an admin
app.post("/api/admin/users/:uid/status", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { uid } = req.params;
    const { status } = req.body;
    if (!["active", "suspended", "revoked"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    const target = await fsGetDoc("adminUsers", uid, req.idToken);
    if (!target) {
      return res.status(404).json({ success: false, message: "Administrator not found." });
    }
    if (target.role === "owner" || target.email === OWNER_EMAIL) {
      return res.status(403).json({ success: false, message: "Owner status cannot be suspended or revoked." });
    }
    await fsCommitWrite("adminUsers", uid, { status }, [], ["status"], req.idToken);
    await writeAuditLog(
      req.user!.uid,
      req.user!.email,
      "UPDATE_ADMIN_STATUS",
      uid,
      `Set ${target.email} status to ${status}.`,
      req.idToken
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to update status." });
  }
});

// Owner removes an admin
app.delete("/api/admin/users/:uid", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { uid } = req.params;
    const target = await fsGetDoc("adminUsers", uid, req.idToken);
    if (!target) {
      return res.status(404).json({ success: false, message: "Administrator not found." });
    }
    if (target.role === "owner" || target.email === OWNER_EMAIL) {
      return res.status(403).json({ success: false, message: "Owner account cannot be removed." });
    }
    await fsDeleteDoc("adminUsers", uid, req.idToken);
    await writeAuditLog(
      req.user!.uid,
      req.user!.email,
      "REMOVE_ADMIN",
      uid,
      `Removed administrator ${target.email}.`,
      req.idToken
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to remove administrator." });
  }
});

// === PART 6: GAMING ZONE CHUNKED RESUMABLE UPLOAD & SECURE DOWNLOAD ===
interface UploadSession {
  uploadId: string;
  gameId: string;
  uid: string;
  email: string;
  originalName: string;
  safeFileName: string;
  ext: string;
  declaredSize: number;
  receivedBytes: number;
  quarantinePath: string;
  cancelled: boolean;
  createdAt: number;
}

const uploadSessions = new Map<string, UploadSession>();

app.get("/api/games/storage-stats", requireSectionPermission("gamingZone", "view"), (_req, res) => {
  const usedBytes = getTotalVaultUsageBytes();
  res.json({
    usedBytes,
    quotaBytes: STORAGE_QUOTA_BYTES,
    maxFileSizeBytes: MAX_GAME_FILE_SIZE_BYTES,
    allowedExtensions: ALLOWED_GAME_EXTENSIONS,
  });
});

app.post("/api/games/upload/init", requireSectionPermission("gamingZone", "create"), (req: AuthenticatedRequest, res) => {
  try {
    const { fileName, fileSize, gameId } = req.body;
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ success: false, message: "File name is required." });
    }
    if (typeof fileSize !== "number" || fileSize <= 0) {
      return res.status(400).json({ success: false, message: "Valid file size is required." });
    }
    if (!isAllowedGameExtension(fileName)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type. Allowed formats: ${ALLOWED_GAME_EXTENSIONS.join(", ").toUpperCase()}`,
      });
    }
    if (fileSize > MAX_GAME_FILE_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        message: `File exceeds maximum allowed limit (${Math.round(MAX_GAME_FILE_SIZE_BYTES / (1024 * 1024))} MB).`,
      });
    }

    const currentUsage = getTotalVaultUsageBytes();
    if (currentUsage + fileSize > STORAGE_QUOTA_BYTES) {
      return res.status(507).json({
        success: false,
        message: "Storage quota exceeded. Please delete unused game files before uploading.",
      });
    }

    const uploadId = `upl_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const cleanGameId =
      typeof gameId === "string" && /^[a-zA-Z0-9_\-]+$/.test(gameId)
        ? gameId
        : `game_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const safeFileName = sanitizeFileName(fileName);
    const ext = getFileExtension(safeFileName);
    const quarantinePath = getQuarantinePath(uploadId, safeFileName);

    fs.writeFileSync(quarantinePath, Buffer.alloc(0));

    uploadSessions.set(uploadId, {
      uploadId,
      gameId: cleanGameId,
      uid: req.user!.uid,
      email: req.user!.email,
      originalName: fileName,
      safeFileName,
      ext,
      declaredSize: fileSize,
      receivedBytes: 0,
      quarantinePath,
      cancelled: false,
      createdAt: Date.now(),
    });

    return res.json({
      success: true,
      uploadId,
      gameId: cleanGameId,
      safeFileName,
      chunkSizeBytes: 2 * 1024 * 1024, // 2MB chunks
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to initialize upload." });
  }
});

app.put(
  "/api/games/upload/chunk/:uploadId",
  requireSectionPermission("gamingZone", "create"),
  express.raw({ type: "application/octet-stream", limit: "5mb" }),
  (req: AuthenticatedRequest, res) => {
    const { uploadId } = req.params;
    const session = uploadSessions.get(uploadId);
    if (!session || session.cancelled) {
      return res.status(404).json({ success: false, message: "Upload session not found or cancelled." });
    }
    if (session.uid !== req.user!.uid && req.user!.email !== OWNER_EMAIL) {
      return res.status(403).json({ success: false, message: "Unauthorized upload session." });
    }

    const chunk = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (session.receivedBytes + chunk.length > MAX_GAME_FILE_SIZE_BYTES) {
      if (fs.existsSync(session.quarantinePath)) fs.unlinkSync(session.quarantinePath);
      uploadSessions.delete(uploadId);
      return res.status(413).json({ success: false, message: "Uploaded bytes exceeded maximum allowed size." });
    }

    fs.appendFileSync(session.quarantinePath, chunk);
    session.receivedBytes += chunk.length;

    return res.json({
      success: true,
      receivedBytes: session.receivedBytes,
      declaredSize: session.declaredSize,
    });
  }
);

app.delete("/api/games/upload/:uploadId", requireSectionPermission("gamingZone", "create"), (req: AuthenticatedRequest, res) => {
  const { uploadId } = req.params;
  const session = uploadSessions.get(uploadId);
  if (session) {
    if (session.uid !== req.user!.uid && req.user!.email !== OWNER_EMAIL) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }
    session.cancelled = true;
    if (fs.existsSync(session.quarantinePath)) {
      fs.unlinkSync(session.quarantinePath);
    }
    uploadSessions.delete(uploadId);
  }
  return res.json({ success: true });
});

app.post(
  "/api/games/upload/complete/:uploadId",
  requireSectionPermission("gamingZone", "create"),
  async (req: AuthenticatedRequest, res) => {
    const { uploadId } = req.params;
    const session = uploadSessions.get(uploadId);
    if (!session || session.cancelled) {
      return res.status(404).json({ success: false, message: "Upload session not found or cancelled." });
    }
    if (session.uid !== req.user!.uid && req.user!.email !== OWNER_EMAIL) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    try {
      const scanResult = await runFileSecurityScan(session.quarantinePath, session.ext);
      if (!scanResult.passed) {
        // Keep quarantined / remove unsafe file and log security event
        if (fs.existsSync(session.quarantinePath)) {
          fs.unlinkSync(session.quarantinePath);
        }
        uploadSessions.delete(uploadId);
        await writeAuditLog(
          req.user!.uid,
          req.user!.email,
          "GAME_UPLOAD_QUARANTINED",
          session.gameId,
          `Blocked ${session.safeFileName}: ${scanResult.details}`,
          req.idToken
        );
        return res.status(400).json({
          success: false,
          securityScanStatus: "failed",
          message: scanResult.details,
        });
      }

      const stored = await moveQuarantinedToVault(
        session.quarantinePath,
        session.gameId,
        session.safeFileName
      );
      const actualSize = session.receivedBytes || session.declaredSize;
      uploadSessions.delete(uploadId);

      await writeAuditLog(
        req.user!.uid,
        req.user!.email,
        "GAME_FILE_UPLOADED",
        session.gameId,
        `Uploaded & verified ${session.safeFileName} (${actualSize} bytes, SHA256: ${scanResult.sha256.slice(0, 16)}...) to ${stored.storageProvider}.`,
        req.idToken
      );

      return res.json({
        success: true,
        gameId: session.gameId,
        filePath: stored.filePath,
        storageProvider: stored.storageProvider,
        fileSize: actualSize,
        fileType: session.ext.replace(".", "").toUpperCase(),
        sha256: scanResult.sha256,
        securityScanStatus: "passed",
        securityScanDetails: scanResult.details,
      });
    } catch (err: any) {
      if (fs.existsSync(session.quarantinePath)) {
        fs.unlinkSync(session.quarantinePath);
      }
      uploadSessions.delete(uploadId);
      return res.status(500).json({ success: false, message: err?.message || "Security scan or storage failed." });
    }
  }
);

app.post("/api/games/:gameId/download-url", async (req, res) => {
  try {
    const { gameId } = req.params;
    if (!/^[a-zA-Z0-9_\-]+$/.test(gameId)) {
      return res.status(400).json({ success: false, message: "Invalid gameId." });
    }

    const game = await fsGetDoc("games", gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found." });
    }
    if (game.publicationStatus !== "published" || game.securityScanStatus !== "passed") {
      return res.status(403).json({
        success: false,
        message: "This game is not currently cleared or published for public download.",
      });
    }

    // Update download count
    const newCount = incrementLocalDownloadCount(gameId);
    recordAnalyticsEvent({
      eventType: "game_download",
      targetId: gameId,
      visitorId: typeof req.query.vid === "string" ? req.query.vid : undefined,
      sessionId: typeof req.query.sid === "string" ? req.query.sid : undefined,
      pagePath: "/#gaming-zone",
      userAgent: req.headers["user-agent"],
      host: req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]) : req.headers.host,
      origin: req.headers.origin,
      forcePreviewHeader: req.headers["x-analytics-test"] ? String(req.headers["x-analytics-test"]) : undefined,
    });
    if (isAdminSdkAvailable()) {
      try {
        await fsCommitWrite(
          "games",
          gameId,
          { downloadCount: (game.downloadCount || 0) + 1 },
          [],
          ["downloadCount"]
        );
      } catch (err) {
        console.warn("[DownloadCount] Firestore update warning:", err);
      }
    }

    if (game.storageProvider === "external_only" && game.externalDownloadUrl) {
      return res.json({
        success: true,
        downloadUrl: game.externalDownloadUrl,
        downloadCount: newCount,
        external: true,
      });
    }

    if (game.storageProvider === "firebase_storage") {
      const bucket = getAdminStorageBucket();
      if (bucket) {
        const [signedUrl] = await bucket.file(game.filePath).getSignedUrl({
          action: "read",
          expires: Date.now() + 5 * 60 * 1000,
          responseDisposition: `attachment; filename="${sanitizeFileName(game.downloadFileName || game.title)}"`,
        });
        return res.json({
          success: true,
          downloadUrl: signedUrl,
          downloadCount: newCount,
          external: false,
        });
      }
    }

    const token = createSignedDownloadToken({
      gameId,
      filePath: game.filePath,
      downloadFileName: sanitizeFileName(game.downloadFileName || `${game.title}.${(game.fileType || "zip").toLowerCase()}`),
      storageProvider: game.storageProvider || "server_vault",
    });

    return res.json({
      success: true,
      downloadUrl: `/api/games/download?token=${encodeURIComponent(token)}`,
      downloadCount: newCount,
      external: false,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Could not generate download link." });
  }
});

app.get("/api/games/download", (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const verified = verifySignedDownloadToken(token);
  if (!verified) {
    return res.status(403).send("Download token is invalid or has expired.");
  }

  const absPath = getVaultFileAbsolutePath(verified.filePath);
  if (!absPath) {
    return res.status(404).send("Game file is unavailable.");
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename="${verified.downloadFileName}"`);
  res.setHeader("Content-Type", "application/octet-stream");
  const stream = fs.createReadStream(absPath);
  stream.pipe(res);
});

app.get("/api/games/download-counts", (_req, res) => {
  res.json({ counts: getLocalDownloadCounts() });
});

app.delete(
  "/api/games/:gameId/file",
  requireSectionPermission("gamingZone", "delete"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { gameId } = req.params;
      const { filePath, storageProvider } = req.body || {};
      if (filePath && typeof filePath === "string") {
        await deleteStoredGameBinary(storageProvider, filePath);
      }
      await writeAuditLog(
        req.user!.uid,
        req.user!.email,
        "DELETE_GAME_FILE",
        gameId,
        `Deleted binary ${filePath || gameId}.`,
        req.idToken
      );
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to delete stored game file." });
    }
  }
);

// === PART 7: DIRECT INQUIRY SUBMISSION & EMAIL NOTIFICATION ===
const recentInquiryHashes = new Map<string, number>();

function buildInquiryEmailContent(params: {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  submittedAt: string;
}) {
  const formattedDate = new Date(params.submittedAt).toUTCString();
  const text = [
    `New contact inquiry received through Atharv Kamath Hub.`,
    ``,
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    `Subject: ${params.subject}`,
    `Category: ${params.category}`,
    `Date: ${formattedDate} (${params.submittedAt})`,
    ``,
    `Message:`,
    `${params.message}`,
  ].join("\n");

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0b0f19;color:#e5e7eb;border-radius:12px;border:1px solid #1f2937;">
      <h2 style="color:#22d3ee;margin-top:0;">New Contact Inquiry — Atharv Kamath Hub</h2>
      <p><strong>Name:</strong> ${escapeHtml(params.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(params.subject)}</p>
      <p><strong>Category:</strong> ${escapeHtml(params.category)}</p>
      <p><strong>Date:</strong> ${escapeHtml(formattedDate)}</p>
      <hr style="border:0;border-top:1px solid #1f2937;margin:16px 0;" />
      <p style="margin-bottom:6px;"><strong>Message:</strong></p>
      <div style="white-space:pre-wrap;background:#070a11;padding:12px;border-radius:8px;border:1px solid #1f2937;">${escapeHtml(params.message)}</div>
    </div>
  `.trim();

  return { text, html };
}

function getInquiryRecipientEmail(): string {
  const support = (process.env.SUPPORT_EMAIL || "").trim();
  if (support && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support)) {
    return support;
  }
  return OWNER_EMAIL;
}

app.post("/api/inquiries", async (req, res) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (!checkRateLimit(`inquiry_${clientIp}`, 5, 15 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: "Too many inquiry submissions from your connection. Please try again in a few minutes.",
      });
    }

    const { name, email, subject, category, message, website_url } = req.body || {};

    // Honeypot spam protection
    if (website_url && String(website_url).trim().length > 0) {
      return res.status(400).json({ success: false, message: "Spam submission rejected." });
    }

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    const cleanSubject = typeof subject === "string" ? subject.trim() : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    const validCategories = [
      "General Inquiry",
      "Business Collaboration",
      "Project Discussion",
      "Technical Support",
      "Other",
    ];
    const cleanCategory = validCategories.includes(category) ? category : "General Inquiry";

    if (cleanName.length < 2 || cleanName.length > 120) {
      return res.status(400).json({ success: false, message: "Please provide a valid full name (2–120 characters)." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }
    if (cleanSubject.length < 2 || cleanSubject.length > 200) {
      return res.status(400).json({ success: false, message: "Please provide a subject (2–200 characters)." });
    }
    if (cleanMessage.length < 5 || cleanMessage.length > 5000) {
      return res.status(400).json({ success: false, message: "Please enter a message (5–5000 characters)." });
    }

    // Duplicate submission protection (2-minute cooldown for identical content)
    const now = Date.now();
    for (const [k, ts] of recentInquiryHashes.entries()) {
      if (now - ts > 120_000) recentInquiryHashes.delete(k);
    }
    const dedupHash = crypto
      .createHash("sha256")
      .update(`${cleanEmail.toLowerCase()}|${cleanSubject}|${cleanMessage}`)
      .digest("hex");
    if (recentInquiryHashes.has(dedupHash)) {
      return res.status(409).json({
        success: false,
        message: "This exact inquiry was already submitted moments ago. Please wait before resending.",
      });
    }

    const inquiryId = `inq_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const submittedAt = new Date().toISOString();

    const { text: emailBody, html: emailHtml } = buildInquiryEmailContent({
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      category: cleanCategory,
      message: cleanMessage,
      submittedAt,
    });

    const recipientEmail = getInquiryRecipientEmail();

    // Attempt email delivery to SUPPORT_EMAIL (fallback OWNER_EMAIL) with Reply-To set to visitor's validated email
    const mailResult = await sendOrQueueEmail({
      to: recipientEmail,
      subject: "New Contact Inquiry — Atharv Kamath Hub",
      text: emailBody,
      html: emailHtml,
      replyTo: cleanEmail,
      inquiryId,
    });

    await fsCommitWrite(
      "inquiries",
      inquiryId,
      {
        inquiryId,
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        category: cleanCategory,
        message: cleanMessage,
        status: "unread",
        notificationStatus: mailResult.status,
        notificationError: (mailResult.error || "").slice(0, 490),
      },
      ["createdAt"]
    );

    recentInquiryHashes.set(dedupHash, now);

    const providerId =
      mailResult.providerResponse &&
      typeof mailResult.providerResponse === "object" &&
      "id" in mailResult.providerResponse
        ? String((mailResult.providerResponse as { id?: unknown }).id || "")
        : undefined;

    const responseMessage =
      mailResult.status === "sent"
        ? "Thank you for contacting Atharv Kamath Hub! Your inquiry has been saved and emailed successfully."
        : mailResult.status === "queued_retry"
        ? "Your inquiry has been saved in our database and email delivery has been queued for automatic retry."
        : isEmailServiceConfigured()
        ? "Your inquiry was saved in the Direct Inquiries dashboard, but the email notification was rejected by the email provider."
        : "Your inquiry was saved in the Direct Inquiries dashboard, but email delivery failed because no email provider is configured yet.";

    return res.json({
      success: true,
      inquiryId,
      notificationStatus: mailResult.status,
      notificationError: mailResult.error,
      emailId: providerId || undefined,
      message: responseMessage,
    });
  } catch (err: any) {
    console.error("[DirectInquiry] Error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to submit your inquiry. Please try again.",
    });
  }
});

// Admin retry email delivery for failed/queued direct inquiry
app.post(
  "/api/admin/inquiries/:inquiryId/retry-email",
  requireSectionPermission("directInquiry", "edit"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { inquiryId } = req.params;
      if (!/^[a-zA-Z0-9_\-]+$/.test(inquiryId)) {
        return res.status(400).json({ success: false, message: "Invalid inquiryId." });
      }
      const inq = await fsGetDoc("inquiries", inquiryId, req.idToken);
      if (!inq) {
        return res.status(404).json({ success: false, message: "Inquiry not found." });
      }
      const { text: emailBody, html: emailHtml } = buildInquiryEmailContent({
        name: String(inq.name || ""),
        email: String(inq.email || ""),
        subject: String(inq.subject || ""),
        category: String(inq.category || "General Inquiry"),
        message: String(inq.message || ""),
        submittedAt: String(inq.createdAt || new Date().toISOString()),
      });
      const mailResult = await sendOrQueueEmail({
        to: getInquiryRecipientEmail(),
        subject: "New Contact Inquiry — Atharv Kamath Hub",
        text: emailBody,
        html: emailHtml,
        replyTo: String(inq.email || ""),
        inquiryId,
      });
      await fsCommitWrite(
        "inquiries",
        inquiryId,
        {
          notificationStatus: mailResult.status,
          notificationError: (mailResult.error || "").slice(0, 490),
        },
        [],
        ["notificationStatus", "notificationError"],
        req.idToken
      );
      await writeAuditLog(
        req.user!.uid,
        req.user!.email,
        "RETRY_INQUIRY_EMAIL",
        inquiryId,
        `Retried inquiry email: status=${mailResult.status}`,
        req.idToken
      );
      return res.json({
        success: mailResult.status === "sent",
        notificationStatus: mailResult.status,
        notificationError: mailResult.error,
        message:
          mailResult.status === "sent"
            ? "Inquiry email delivered successfully."
            : mailResult.error || "Email retry queued or failed.",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || "Failed to retry inquiry email.",
      });
    }
  }
);

// === PART 8: REAL-TIME PRIVACY-CONSCIOUS ANALYTICS ROUTES ===
app.get("/api/analytics/config", (req, res) => {
  const host = req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]) : req.headers.host;
  const origin = req.headers.origin;
  const clientHostname = typeof req.query.host === "string" ? req.query.host : undefined;
  const forcePreviewHeader = req.headers["x-analytics-test"] ? String(req.headers["x-analytics-test"]) : undefined;
  const detectedEnvironment = detectTrafficEnvironment({
    host,
    origin,
    clientHostname,
    forcePreviewHeader,
  });
  const data = getPublicInteractionCounts(detectedEnvironment);
  return res.json({
    launchMode: data.config.launchMode,
    launchedAt: data.config.launchedAt,
    showPublicVisitors: data.config.showPublicVisitors,
    detectedEnvironment,
    interactionCounts: data.interactionCounts,
    publicSummary: data.publicSummary,
  });
});

const ALLOWED_ANALYTICS_EVENTS = new Set<AnalyticsEventType>([
  "page_view",
  "session_start",
  "heartbeat",
  "link_click",
  "download_request",
  "download_completed",
  "blog_read",
  "contact_click",
  "game_download",
]);

app.post("/api/analytics/collect", (req, res) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    if (!checkRateLimit(`analytics_${clientIp}`, 120, 60 * 1000)) {
      return res.status(429).json({ success: false, message: "Analytics rate limit exceeded." });
    }

    const body = req.body || {};
    const eventType = String(body.eventType || "") as AnalyticsEventType;
    if (!ALLOWED_ANALYTICS_EVENTS.has(eventType)) {
      return res.status(400).json({ success: false, message: "Invalid analytics event type." });
    }

    const result = recordAnalyticsEvent({
      eventType,
      visitorId: typeof body.visitorId === "string" ? body.visitorId : undefined,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      pagePath: typeof body.pagePath === "string" ? body.pagePath : "/",
      targetId: typeof body.targetId === "string" ? body.targetId : undefined,
      dedupKey: typeof body.dedupKey === "string" ? body.dedupKey : undefined,
      isAdmin: Boolean(body.isAdmin),
      userAgent: req.headers["user-agent"],
      host: req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]) : req.headers.host,
      origin: req.headers.origin,
      clientHostname: typeof body.clientHostname === "string" ? body.clientHostname : undefined,
      forcePreviewHeader: req.headers["x-analytics-test"] ? String(req.headers["x-analytics-test"]) : undefined,
    });

    return res.json({
      success: true,
      recorded: result.recorded,
      environment: result.environment,
      reason: result.reason,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to record analytics event.",
    });
  }
});

app.get("/api/admin/analytics", requireAuthorizedAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const rawScope = String(req.query.scope || "production");
    const scope: AnalyticsEnvironment = rawScope === "preview" ? "preview" : "production";
    const rawRange = String(req.query.range || "30d");
    const range: AnalyticsTimeRange =
      rawRange === "today" || rawRange === "7d" || rawRange === "30d" || rawRange === "all"
        ? rawRange
        : "30d";

    const data = getAdminAnalyticsReport(scope, range);

    let serverInquiryCount = 0;
    let serverGameDownloadsCount = 0;
    try {
      const inquiries = await fsListDocs("inquiries", req.idToken);
      serverInquiryCount = inquiries.length;
    } catch {
      serverInquiryCount = 0;
    }

    const localCounts = getLocalDownloadCounts();
    serverGameDownloadsCount = Object.values(localCounts).reduce((sum, v) => sum + (Number(v) || 0), 0);

    return res.json({
      success: true,
      config: data.config,
      report: data.report,
      serverInquiryCount,
      serverGameDownloadsCount,
      firebaseMeasurementId: "G-4RQ9N2YTWX",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to fetch analytics report.",
    });
  }
});

app.post("/api/admin/analytics/config", requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const { launchMode, showPublicVisitors } = req.body || {};
    if (
      launchMode !== undefined &&
      launchMode !== "development" &&
      launchMode !== "production_launched"
    ) {
      return res.status(400).json({ success: false, message: "Invalid analytics launchMode." });
    }
    if (showPublicVisitors !== undefined && typeof showPublicVisitors !== "boolean") {
      return res.status(400).json({ success: false, message: "showPublicVisitors must be boolean." });
    }

    const updated = updateAnalyticsConfig({
      launchMode,
      showPublicVisitors,
      updatedBy: req.user!.email,
    });

    try {
      await fsCommitWrite(
        "adminConfig",
        "analytics",
        {
          launchMode: updated.launchMode,
          launchedAt: updated.launchedAt || "",
          showPublicVisitors: updated.showPublicVisitors,
          updatedBy: req.user!.email,
        },
        ["updatedAt"],
        undefined,
        req.idToken
      );
    } catch {
      // Non-fatal if Firestore rules haven't been re-published yet
    }

    await writeAuditLog(
      req.user!.uid,
      req.user!.email,
      "UPDATE_ANALYTICS_CONFIG",
      "analytics",
      `launchMode=${updated.launchMode}, showPublicVisitors=${updated.showPublicVisitors}`,
      req.idToken
    );

    return res.json({ success: true, config: updated });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to update analytics configuration.",
    });
  }
});

// === ATHARV'S AI GUIDE (GEMINI-4-HYDROGEN + REAL HEALTH & LIVE CONTEXT) ===
const GEMINI_CHAT_MODEL = "gemini-4-hydrogen";
const GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
let chatHealthCache: {
  online: boolean;
  activeModel: string;
  reason?: string;
  checkedAt: number;
} | null = null;
const CHAT_HEALTH_CACHE_TTL_MS = 60 * 1000;

function classifyGeminiError(err: any): {
  status: number;
  code: string;
  reply: string;
  invalidateHealth?: boolean;
  isTransient?: boolean;
} {
  const msg = String(err?.message || err || "");
  const lower = msg.toLowerCase();
  const statusCode = Number(err?.status || err?.statusCode || 0);

  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("aborted")) {
    return {
      status: 504,
      code: "TIMEOUT",
      reply: "The AI assistant took too long to respond. Please try again in a moment.",
      isTransient: true,
    };
  }
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthenticated")
  ) {
    return {
      status: 503,
      code: "INVALID_API_KEY",
      reply: "AI service credentials could not be verified on the server. Please check GEMINI_API_KEY configuration.",
      invalidateHealth: true,
    };
  }
  if (
    statusCode === 503 ||
    lower.includes("high demand") ||
    lower.includes("status\":\"unavailable") ||
    lower.includes("temporarily unavailable")
  ) {
    return {
      status: 503,
      code: "HIGH_DEMAND",
      reply: "The AI model is experiencing temporary high demand. Please retry in a few seconds.",
      isTransient: true,
    };
  }
  if (
    statusCode === 404 ||
    (lower.includes("model") && (lower.includes("not found") || lower.includes("not supported")))
  ) {
    return {
      status: 503,
      code: "MODEL_UNAVAILABLE",
      reply: `The configured AI model (${GEMINI_CHAT_MODEL}) is currently unavailable.`,
      invalidateHealth: true,
    };
  }
  if (
    statusCode === 429 ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  ) {
    return {
      status: 429,
      code: "QUOTA_EXCEEDED",
      reply: "The AI assistant has temporarily reached its usage limit. Please try again shortly.",
    };
  }
  if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("network")) {
    return {
      status: 502,
      code: "NETWORK_ERROR",
      reply: "Could not reach the Gemini AI service due to a network error. Please try again.",
      isTransient: true,
    };
  }

  return {
    status: 500,
    code: "AI_SERVICE_ERROR",
    reply: "Unable to generate a response right now. Please try again shortly.",
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function delayMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get("/api/chat/health", async (_req, res) => {
  if (!ai || !geminiApiKey) {
    return res.json({
      online: false,
      status: "unavailable",
      model: GEMINI_CHAT_MODEL,
      reason: "Server GEMINI_API_KEY is not configured.",
    });
  }

  const now = Date.now();
  if (chatHealthCache && now - chatHealthCache.checkedAt < CHAT_HEALTH_CACHE_TTL_MS) {
    return res.json({
      online: chatHealthCache.online,
      status: chatHealthCache.online ? "online" : "unavailable",
      model: chatHealthCache.activeModel,
      reason: chatHealthCache.reason,
    });
  }

  try {
    await withTimeout(ai.models.get({ model: GEMINI_CHAT_MODEL }), 8000, "Gemini health check");
    chatHealthCache = { online: true, activeModel: GEMINI_CHAT_MODEL, checkedAt: now };
    return res.json({
      online: true,
      status: "online",
      model: GEMINI_CHAT_MODEL,
    });
  } catch (err: any) {
    const classified = classifyGeminiError(err);
    if (!classified.invalidateHealth) {
      try {
        await withTimeout(ai.models.get({ model: GEMINI_FALLBACK_MODEL }), 8000, "Gemini fallback health check");
        chatHealthCache = { online: true, activeModel: GEMINI_FALLBACK_MODEL, checkedAt: now };
        return res.json({
          online: true,
          status: "online",
          model: GEMINI_FALLBACK_MODEL,
        });
      } catch {
        // fall through to unavailable
      }
    }
    chatHealthCache = {
      online: false,
      activeModel: GEMINI_CHAT_MODEL,
      reason: classified.reply,
      checkedAt: now,
    };
    return res.json({
      online: false,
      status: "unavailable",
      model: GEMINI_CHAT_MODEL,
      reason: classified.reply,
    });
  }
});

app.post("/api/chat", async (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  if (!checkRateLimit(`chat_${clientIp}`, 25, 60 * 1000)) {
    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      reply: "Too many messages sent in a short time. Please wait a minute and try again.",
    });
  }

  if (!ai || !geminiApiKey) {
    return res.status(503).json({
      success: false,
      code: "MISSING_API_KEY",
      reply: "AI Assistant Temporarily Unavailable: server API key is not configured.",
    });
  }

  const rawMessage = req.body?.message;
  const rawHistory = req.body?.history;

  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return res.status(400).json({
      success: false,
      code: "INVALID_INPUT",
      reply: "Please enter a non-empty question before sending.",
    });
  }

  const message = rawMessage.trim();
  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      code: "MESSAGE_TOO_LONG",
      reply: "Please keep your question under 1,000 characters.",
    });
  }

  try {
    const formattedHistory = Array.isArray(rawHistory)
      ? rawHistory
          .filter(
            (msg: any) =>
              msg &&
              (msg.sender === "user" || msg.sender === "bot") &&
              typeof msg.text === "string" &&
              msg.text.trim().length > 0
          )
          .slice(-10)
          .map((msg: { sender: string; text: string }) => ({
            role: msg.sender === "user" ? "user" : "model",
            parts: [{ text: msg.text.trim().slice(0, 2000) }],
          }))
      : [];

    const websiteKnowledge = await buildWebsiteKnowledgeContext();
    const systemInstruction = `You are Atharv's AI Guide, the official personal assistant on Atharv Kamath Hub.
Answer visitor questions accurately using ONLY the verified live website data below.
Rules:
1. Be helpful, concise, polite, and format cleanly in Markdown when listing items.
2. Never invent, guess, or fabricate statistics, follower counts, project links, downloadable files, pricing, or personal facts that are not in the verified data.
3. If something asked by the visitor is not listed in the verified data, clearly state that it is not listed or not currently available on the site.
4. Keep focus on Atharv Kamath's work, portfolio projects, content channels, digital library, Gaming Zone, blogs, and contact options.

${websiteKnowledge}`;

    const contentsPayload = [...formattedHistory, { role: "user", parts: [{ text: message }] }];

    const preferFallback =
      chatHealthCache !== null &&
      Date.now() - chatHealthCache.checkedAt < CHAT_HEALTH_CACHE_TTL_MS &&
      chatHealthCache.online &&
      chatHealthCache.activeModel === GEMINI_FALLBACK_MODEL;

    const attempts: Array<{ model: string; useLowThinking: boolean; backoffMs: number; timeoutMs: number }> = preferFallback
      ? [
          { model: GEMINI_FALLBACK_MODEL, useLowThinking: false, backoffMs: 0, timeoutMs: 18000 },
          { model: GEMINI_CHAT_MODEL, useLowThinking: true, backoffMs: 250, timeoutMs: 7000 },
        ]
      : [
          { model: GEMINI_CHAT_MODEL, useLowThinking: true, backoffMs: 0, timeoutMs: 7000 },
          { model: GEMINI_FALLBACK_MODEL, useLowThinking: false, backoffMs: 250, timeoutMs: 18000 },
        ];

    let lastError: any = null;
    for (const attempt of attempts) {
      if (attempt.backoffMs > 0) {
        await delayMs(attempt.backoffMs);
      }
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: attempt.model,
            contents: contentsPayload,
            config: attempt.useLowThinking
              ? {
                  systemInstruction,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                }
              : { systemInstruction },
          }),
          attempt.timeoutMs,
          `Gemini ${attempt.model}`
        );

        const reply = response.text?.trim();
        if (reply) {
          chatHealthCache = {
            online: true,
            activeModel: attempt.model,
            checkedAt: Date.now(),
          };
          return res.json({ success: true, model: attempt.model, reply });
        }
      } catch (err: any) {
        lastError = err;
        const classified = classifyGeminiError(err);
        console.warn(`[ChatAttempt:${attempt.model}:${classified.code}]`, err?.message || err);
        if (classified.code === "INVALID_API_KEY") {
          throw err;
        }
      }
    }

    throw lastError || new Error("All Gemini chat attempts failed.");
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    console.error(`[ChatError:${classified.code}]`, error?.message || error);
    if (classified.invalidateHealth) {
      chatHealthCache = {
        online: false,
        activeModel: GEMINI_CHAT_MODEL,
        reason: classified.reply,
        checkedAt: Date.now(),
      };
    }
    return res.status(classified.status).json({
      success: false,
      code: classified.code,
      reply: classified.reply,
    });
  }
});

// === BACKGROUND WORKERS ===
startEmailRetryWorker();
if (isAdminSdkAvailable()) {
  setInterval(() => {
    expireStaleRequests().catch((err) => console.warn("[ExpireWorker] Error:", err));
  }, 15 * 60 * 1000);
}

// === MAIN SERVE & VITE CONFIGURATION ===
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
