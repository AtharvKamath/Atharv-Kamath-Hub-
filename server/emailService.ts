import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fsCommitWrite } from './firebaseAdmin';

export interface EmailPayload {
  id: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inquiryId?: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const QUEUE_FILE = path.join(STORAGE_DIR, 'email_queue.json');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function loadQueue(): EmailPayload[] {
  try {
    ensureStorageDir();
    if (!fs.existsSync(QUEUE_FILE)) return [];
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    return JSON.parse(raw) as EmailPayload[];
  } catch {
    return [];
  }
}

function saveQueue(queue: EmailPayload[]) {
  try {
    ensureStorageDir();
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
  } catch (err) {
    console.error('[EmailQueue] Failed to persist queue:', err);
  }
}

export function isEmailServiceConfigured(): boolean {
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  return hasSmtp || hasResend;
}

export function getEmailProviderSummary(): {
  configured: boolean;
  provider: 'resend' | 'smtp' | 'none';
} {
  if (process.env.RESEND_API_KEY?.trim()) {
    return { configured: true, provider: 'resend' };
  }
  if (
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  ) {
    return { configured: true, provider: 'smtp' };
  }
  return { configured: false, provider: 'none' };
}

export interface TransactionalEmailResult {
  delivered: boolean;
  rejected?: boolean;
  statusCode?: number;
  error?: string;
  providerResponse?: Record<string, unknown> | string;
}

export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<TransactionalEmailResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (resendKey) {
    try {
      const fromAddr = (
        process.env.RESEND_FROM_EMAIL ||
        process.env.RESEND_FROM ||
        process.env.SMTP_FROM ||
        'Atharv Kamath Hub <onboarding@resend.dev>'
      ).trim();

      const resendBody: Record<string, unknown> = {
        from: fromAddr,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      };
      if (opts.html) resendBody.html = opts.html;
      if (opts.replyTo) resendBody.reply_to = opts.replyTo;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendBody),
      });

      const rawText = await response.text();
      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const detail =
          (parsed && typeof parsed.message === 'string' && parsed.message) ||
          rawText ||
          response.statusText;
        const rejected =
          response.status >= 400 && response.status < 500 && response.status !== 429;
        return {
          delivered: false,
          rejected,
          statusCode: response.status,
          error: `Resend API error (${response.status}): ${detail}`,
          providerResponse: parsed ?? rawText,
        };
      }

      if (!parsed || typeof parsed.id !== 'string' || !parsed.id) {
        return {
          delivered: false,
          rejected: false,
          statusCode: response.status,
          error: `Unexpected Resend response without message id: ${rawText || 'empty response'}`,
          providerResponse: parsed ?? rawText,
        };
      }

      return {
        delivered: true,
        statusCode: response.status,
        providerResponse: parsed,
      };
    } catch (err: any) {
      return {
        delivered: false,
        rejected: false,
        error: err?.message || 'Resend delivery exception',
      };
    }
  }

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = parseInt(process.env.SMTP_PORT || '465', 10);
      const secure = process.env.SMTP_SECURE !== 'false' && port === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      const fromAddr = process.env.SMTP_FROM || `Atharv Kamath Hub <${smtpUser}>`;
      await transporter.sendMail({
        from: fromAddr,
        to: opts.to,
        replyTo: opts.replyTo,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return { delivered: true };
    } catch (err: any) {
      return { delivered: false, error: err?.message || 'SMTP delivery failed' };
    }
  }

  return {
    delivered: false,
    rejected: false,
    error: 'Transactional email provider not configured. Set RESEND_API_KEY or SMTP credentials in environment secrets.',
  };
}

export async function sendOrQueueEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inquiryId?: string;
}): Promise<{
  status: 'sent' | 'queued_retry' | 'failed';
  error?: string;
  statusCode?: number;
  providerResponse?: Record<string, unknown> | string;
}> {
  const result = await sendTransactionalEmail(opts);
  if (result.delivered) {
    return {
      status: 'sent',
      statusCode: result.statusCode,
      providerResponse: result.providerResponse,
    };
  }

  // If Resend explicitly rejected the request (e.g. 400/401/403/422), do not queue or pretend it may succeed later
  if (result.rejected) {
    return {
      status: 'failed',
      error: result.error,
      statusCode: result.statusCode,
      providerResponse: result.providerResponse,
    };
  }

  // Queue for background retry only on transient failures (network, 429, 5xx) when configured
  if (isEmailServiceConfigured()) {
    const queue = loadQueue();
    queue.push({
      id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
      inquiryId: opts.inquiryId,
      attempts: 1,
      nextAttemptAt: Date.now() + 30_000,
      lastError: result.error,
    });
    saveQueue(queue);
    return {
      status: 'queued_retry',
      error: result.error,
      statusCode: result.statusCode,
      providerResponse: result.providerResponse,
    };
  }

  return {
    status: 'failed',
    error: result.error,
    statusCode: result.statusCode,
    providerResponse: result.providerResponse,
  };
}

export async function processEmailRetryQueue() {
  if (!isEmailServiceConfigured()) return;
  const queue = loadQueue();
  if (queue.length === 0) return;

  const now = Date.now();
  const remaining: EmailPayload[] = [];

  for (const job of queue) {
    if (job.nextAttemptAt > now) {
      remaining.push(job);
      continue;
    }

    const res = await sendTransactionalEmail({
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
      replyTo: job.replyTo,
    });

    if (res.delivered) {
      if (job.inquiryId) {
        try {
          await fsCommitWrite(
            'inquiries',
            job.inquiryId,
            { notificationStatus: 'sent', notificationError: '' },
            [],
            ['notificationStatus', 'notificationError']
          );
        } catch (err) {
          console.warn('[EmailQueue] Could not update inquiry status after retry:', err);
        }
      }
      continue;
    }

    const nextAttempts = job.attempts + 1;
    if (nextAttempts < 5) {
      const backoffMs = Math.min(300_000, 30_000 * Math.pow(2, nextAttempts - 1));
      remaining.push({
        ...job,
        attempts: nextAttempts,
        nextAttemptAt: now + backoffMs,
        lastError: res.error,
      });
    } else if (job.inquiryId) {
      try {
        await fsCommitWrite(
          'inquiries',
          job.inquiryId,
          { notificationStatus: 'failed', notificationError: res.error || 'Max retry attempts reached' },
          [],
          ['notificationStatus', 'notificationError']
        );
      } catch (err) {
        console.warn('[EmailQueue] Could not update inquiry failure status:', err);
      }
    }
  }

  saveQueue(remaining);
}

let queueInterval: NodeJS.Timeout | null = null;
export function startEmailRetryWorker() {
  if (queueInterval) return;
  queueInterval = setInterval(() => {
    processEmailRetryQueue().catch((err) => console.error('[EmailQueue] Worker error:', err));
  }, 30_000);
}
