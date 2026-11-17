/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logEvent } from 'firebase/analytics';
import { getFirebaseAnalyticsInstance } from '../firebase';
import { AnalyticsLaunchMode, AnalyticsPublicConfig } from '../types';

const VISITOR_STORAGE_KEY = 'atharv_analytics_visitor_id';
const SESSION_ID_KEY = 'atharv_analytics_session_id';
const SESSION_LAST_ACTIVE_KEY = 'atharv_analytics_session_last_active';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

let cachedLaunchMode: AnalyticsLaunchMode = 'development';
const recentClientDedups = new Map<string, number>();

function generateRandomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let vid = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!vid || vid.length < 6) {
      vid = generateRandomId('v');
      localStorage.setItem(VISITOR_STORAGE_KEY, vid);
    }
    return vid;
  } catch {
    return generateRandomId('v');
  }
}

export function getOrRefreshSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    const now = Date.now();
    const existingId = sessionStorage.getItem(SESSION_ID_KEY);
    const lastActiveRaw = sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY);
    const lastActive = lastActiveRaw ? parseInt(lastActiveRaw, 10) : 0;

    if (!existingId || !lastActive || Number.isNaN(lastActive) || now - lastActive > SESSION_TIMEOUT_MS) {
      const nextId = generateRandomId('s');
      sessionStorage.setItem(SESSION_ID_KEY, nextId);
      sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
      return nextId;
    }

    sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
    return existingId;
  } catch {
    return generateRandomId('s');
  }
}

export function isPreviewOrLocalHostname(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.startsWith('ais-dev-') ||
    host.startsWith('ais-pre-')
  );
}

export function setAnalyticsLaunchModeCache(mode: AnalyticsLaunchMode) {
  cachedLaunchMode = mode;
}

export async function fetchPublicAnalyticsConfig(): Promise<AnalyticsPublicConfig | null> {
  try {
    const hostParam = typeof window !== 'undefined' ? encodeURIComponent(window.location.hostname) : '';
    const res = await fetch(`/api/analytics/config?host=${hostParam}`);
    if (!res.ok) return null;
    const data = (await res.json()) as AnalyticsPublicConfig;
    if (data?.launchMode) {
      cachedLaunchMode = data.launchMode;
    }
    return data;
  } catch {
    return null;
  }
}

export type ClientAnalyticsEventType =
  | 'page_view'
  | 'session_start'
  | 'heartbeat'
  | 'link_click'
  | 'download_request'
  | 'download_completed'
  | 'blog_read'
  | 'contact_click'
  | 'game_download';

export async function trackAnalyticsEvent(params: {
  eventType: ClientAnalyticsEventType;
  pagePath?: string;
  targetId?: string;
  dedupKey?: string;
  isAdmin?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (params.isAdmin) return;

  const now = Date.now();
  if (params.eventType === 'page_view') {
    const key = `${params.pagePath || '/'}::${params.dedupKey || ''}`;
    const lastTs = recentClientDedups.get(key);
    if (lastTs && now - lastTs < 8000) {
      return;
    }
    recentClientDedups.set(key, now);
  }

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrRefreshSessionId();

  try {
    await fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventType: params.eventType,
        visitorId,
        sessionId,
        pagePath: params.pagePath || `${window.location.pathname}${window.location.hash || ''}` || '/',
        targetId: params.targetId,
        dedupKey: params.dedupKey,
        isAdmin: Boolean(params.isAdmin),
        clientHostname: window.location.hostname,
      }),
    });
  } catch {
    // Non-blocking telemetry
  }

  // Forward to Firebase Analytics (GA4) only when production is launched and non-preview
  if (cachedLaunchMode === 'production_launched' && !isPreviewOrLocalHostname()) {
    try {
      const ga = await getFirebaseAnalyticsInstance();
      if (ga) {
        if (params.eventType === 'page_view') {
          logEvent(ga, 'page_view', {
            page_path: params.pagePath || window.location.pathname,
          });
        } else if (params.eventType !== 'heartbeat') {
          logEvent(ga, params.eventType, {
            item_id: params.targetId || 'site',
          });
        }
      }
    } catch {
      // Ignore GA errors in restricted browsers/ad-blockers
    }
  }
}

export function computeContentCreationYears(startDateStr?: string): {
  years: number | null;
  display: string;
  suffix: string;
  valid: boolean;
} {
  if (!startDateStr || !startDateStr.trim()) {
    return { years: null, display: 'Not available', suffix: '', valid: false };
  }
  const parsed = new Date(startDateStr.trim());
  if (Number.isNaN(parsed.getTime())) {
    return { years: null, display: 'Not available', suffix: '', valid: false };
  }
  const now = new Date();
  if (parsed.getTime() > now.getTime()) {
    return { years: 0, display: '0', suffix: '', valid: true };
  }
  const diffMs = now.getTime() - parsed.getTime();
  const exactYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  const completedYears = Math.max(0, Math.floor(exactYears));
  return {
    years: completedYears,
    display: completedYears.toLocaleString(),
    suffix: completedYears > 0 ? '+' : '',
    valid: true,
  };
}
