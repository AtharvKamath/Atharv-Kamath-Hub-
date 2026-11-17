import fs from "fs";
import path from "path";

export type AnalyticsLaunchMode = "development" | "production_launched";
export type AnalyticsEnvironment = "production" | "preview";
export type AnalyticsTimeRange = "today" | "7d" | "30d" | "all";
export type AnalyticsEventType =
  | "page_view"
  | "session_start"
  | "heartbeat"
  | "link_click"
  | "download_request"
  | "download_completed"
  | "blog_read"
  | "contact_click"
  | "game_download";

interface DailyBucket {
  pageViews: number;
  sessions: number;
  visitors: string[];
  pages: Record<string, number>;
  linkClicks: Record<string, number>;
  downloadRequests: Record<string, number>;
  downloadsCompleted: Record<string, number>;
  blogReads: Record<string, number>;
  contactClicks: Record<string, number>;
  gameDownloads: Record<string, number>;
}

interface SessionRecord {
  visitorId: string;
  startedAt: number;
  lastActiveAt: number;
}

interface EnvironmentStore {
  daily: Record<string, DailyBucket>;
  sessions: Record<string, SessionRecord>;
  visitorLastSeen: Record<string, number>;
}

interface AnalyticsConfigState {
  launchMode: AnalyticsLaunchMode;
  launchedAt: string | null;
  showPublicVisitors: boolean;
  updatedAt: string;
  updatedBy?: string;
}

interface AnalyticsStoreFile {
  version: number;
  config: AnalyticsConfigState;
  production: EnvironmentStore;
  preview: EnvironmentStore;
}

const ANALYTICS_DIR = path.resolve(process.cwd(), "storage");
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, "analytics_store.json");

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const PAGE_VIEW_DEDUP_MS = 10 * 1000;

const BOT_UA_REGEX =
  /bot|crawler|spider|slurp|bingpreview|mediapartners|adsbot|googleweblight|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|curl\/|wget\/|python-requests|python-urllib|axios\/|node-fetch|postmanruntime|insomnia|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|discordbot/i;

const PREVIEW_HOST_REGEX = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$|\.local$|^ais-(dev|pre)-/i;

const recentPageDedup = new Map<string, number>();

function createEmptyEnvStore(): EnvironmentStore {
  return {
    daily: {},
    sessions: {},
    visitorLastSeen: {},
  };
}

function createEmptyDailyBucket(): DailyBucket {
  return {
    pageViews: 0,
    sessions: 0,
    visitors: [],
    pages: {},
    linkClicks: {},
    downloadRequests: {},
    downloadsCompleted: {},
    blogReads: {},
    contactClicks: {},
    gameDownloads: {},
  };
}

function createDefaultStore(): AnalyticsStoreFile {
  return {
    version: 1,
    config: {
      launchMode: "development",
      launchedAt: null,
      showPublicVisitors: false,
      updatedAt: new Date().toISOString(),
    },
    production: createEmptyEnvStore(),
    preview: createEmptyEnvStore(),
  };
}

let cachedStore: AnalyticsStoreFile | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function ensureStoreLoaded(): AnalyticsStoreFile {
  if (cachedStore) return cachedStore;
  try {
    if (!fs.existsSync(ANALYTICS_DIR)) {
      fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
    }
    if (fs.existsSync(ANALYTICS_FILE)) {
      const raw = fs.readFileSync(ANALYTICS_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<AnalyticsStoreFile>;
      const def = createDefaultStore();
      cachedStore = {
        version: 1,
        config: {
          launchMode: parsed.config?.launchMode === "production_launched" ? "production_launched" : "development",
          launchedAt: typeof parsed.config?.launchedAt === "string" ? parsed.config.launchedAt : null,
          showPublicVisitors: Boolean(parsed.config?.showPublicVisitors),
          updatedAt: typeof parsed.config?.updatedAt === "string" ? parsed.config.updatedAt : def.config.updatedAt,
          updatedBy: typeof parsed.config?.updatedBy === "string" ? parsed.config.updatedBy : undefined,
        },
        production: {
          daily: parsed.production?.daily || {},
          sessions: parsed.production?.sessions || {},
          visitorLastSeen: parsed.production?.visitorLastSeen || {},
        },
        preview: {
          daily: parsed.preview?.daily || {},
          sessions: parsed.preview?.sessions || {},
          visitorLastSeen: parsed.preview?.visitorLastSeen || {},
        },
      };
      return cachedStore;
    }
  } catch (err) {
    console.warn("[AnalyticsStore] Load warning, creating fresh store:", err);
  }
  cachedStore = createDefaultStore();
  persistStore();
  return cachedStore;
}

function persistStore() {
  const snapshot = cachedStore;
  if (!snapshot) return;
  writeQueue = writeQueue
    .then(async () => {
      if (!fs.existsSync(ANALYTICS_DIR)) {
        fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
      }
      const tmpPath = `${ANALYTICS_FILE}.tmp`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
      await fs.promises.rename(tmpPath, ANALYTICS_FILE);
    })
    .catch((err) => {
      console.error("[AnalyticsStore] Persist error:", err);
    });
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMondayOfDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatDateKey(d);
}

function sanitizeId(raw: unknown, fallback = "unknown"): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.trim().slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizePagePath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const trimmed = raw.trim().slice(0, 120);
  if (!trimmed) return "/";
  return trimmed.startsWith("/") || trimmed.startsWith("#") ? trimmed : `/${trimmed}`;
}

function getPageDisplayLabel(pagePath: string): string {
  const map: Record<string, string> = {
    "/": "Home / Hub Overview",
    "/#home": "Home Hero",
    "/#about": "About & Biography",
    "/#links": "Content Hub Links",
    "/#gallery": "Photo Gallery",
    "/#projects": "Portfolio Projects",
    "/#videos": "Videos Showcase",
    "/#downloads": "Digital Library & Downloads",
    "/#favorites": "Curated Favorites",
    "/#gaming-zone": "Gaming Zone",
    "/#blogs": "Blogs & Articles",
    "/#timeline": "Journey & Timeline",
    "/#contact": "Contact & Direct Inquiry",
  };
  return map[pagePath] || pagePath;
}

export function isBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 8) return true;
  return BOT_UA_REGEX.test(userAgent);
}

export function detectTrafficEnvironment(params: {
  host?: string;
  origin?: string;
  forcePreviewHeader?: string;
  clientHostname?: string;
}): AnalyticsEnvironment {
  if (params.forcePreviewHeader === "1" || params.forcePreviewHeader === "true") {
    return "preview";
  }

  const candidates = [params.host, params.clientHostname];
  if (params.origin) {
    try {
      candidates.push(new URL(params.origin).host);
    } catch {
      // ignore invalid origin
    }
  }

  for (const cand of candidates) {
    if (!cand) continue;
    const hostnameOnly = cand.split(":")[0].toLowerCase().trim();
    if (!hostnameOnly) continue;
    if (
      hostnameOnly === "localhost" ||
      hostnameOnly === "127.0.0.1" ||
      hostnameOnly === "0.0.0.0" ||
      hostnameOnly.endsWith(".local") ||
      hostnameOnly.startsWith("ais-dev-") ||
      hostnameOnly.startsWith("ais-pre-") ||
      PREVIEW_HOST_REGEX.test(cand)
    ) {
      return "preview";
    }
  }

  return "production";
}

export function getAnalyticsConfig() {
  const store = ensureStoreLoaded();
  return { ...store.config };
}

export function updateAnalyticsConfig(params: {
  launchMode?: AnalyticsLaunchMode;
  showPublicVisitors?: boolean;
  updatedBy?: string;
}) {
  const store = ensureStoreLoaded();
  const nextMode =
    params.launchMode === "production_launched" || params.launchMode === "development"
      ? params.launchMode
      : store.config.launchMode;

  const launchedAt =
    nextMode === "production_launched"
      ? store.config.launchedAt || new Date().toISOString()
      : store.config.launchedAt;

  store.config = {
    launchMode: nextMode,
    launchedAt,
    showPublicVisitors:
      typeof params.showPublicVisitors === "boolean"
        ? params.showPublicVisitors
        : store.config.showPublicVisitors,
    updatedAt: new Date().toISOString(),
    updatedBy: params.updatedBy || store.config.updatedBy,
  };
  persistStore();
  return { ...store.config };
}

export interface CollectEventInput {
  eventType: AnalyticsEventType;
  visitorId?: string;
  sessionId?: string;
  pagePath?: string;
  targetId?: string;
  dedupKey?: string;
  isAdmin?: boolean;
  userAgent?: string;
  host?: string;
  origin?: string;
  clientHostname?: string;
  forcePreviewHeader?: string;
}

export interface CollectEventResult {
  recorded: boolean;
  environment: AnalyticsEnvironment;
  reason?: string;
}

export function recordAnalyticsEvent(input: CollectEventInput): CollectEventResult {
  const store = ensureStoreLoaded();
  const environment = detectTrafficEnvironment({
    host: input.host,
    origin: input.origin,
    clientHostname: input.clientHostname,
    forcePreviewHeader: input.forcePreviewHeader,
  });

  if (input.isAdmin) {
    return { recorded: false, environment, reason: "admin_excluded" };
  }

  if (isBotUserAgent(input.userAgent)) {
    return { recorded: false, environment, reason: "bot_excluded" };
  }

  if (environment === "production" && store.config.launchMode !== "production_launched") {
    return { recorded: false, environment, reason: "development_mode_active" };
  }

  const now = Date.now();
  const dateKey = formatDateKey(new Date(now));
  const envStore = environment === "preview" ? store.preview : store.production;

  if (!envStore.daily[dateKey]) {
    envStore.daily[dateKey] = createEmptyDailyBucket();
  }
  const bucket = envStore.daily[dateKey];

  const visitorId = sanitizeId(input.visitorId, `anon_${now}`);
  const sessionId = sanitizeId(input.sessionId, `sess_${visitorId}_${dateKey}`);
  const pagePath = sanitizePagePath(input.pagePath);

  // Prune stale active-visitor & dedup entries periodically
  for (const [k, ts] of recentPageDedup.entries()) {
    if (now - ts > PAGE_VIEW_DEDUP_MS) recentPageDedup.delete(k);
  }
  for (const [vid, lastSeen] of Object.entries(envStore.visitorLastSeen)) {
    if (now - lastSeen > 24 * 60 * 60 * 1000) {
      delete envStore.visitorLastSeen[vid];
    }
  }
  for (const [sid, sess] of Object.entries(envStore.sessions)) {
    if (now - sess.lastActiveAt > 48 * 60 * 60 * 1000) {
      delete envStore.sessions[sid];
    }
  }

  // Track unique visitor UUID for this day (not raw PII/IP)
  if (!bucket.visitors.includes(visitorId) && bucket.visitors.length < 100_000) {
    bucket.visitors.push(visitorId);
  }
  envStore.visitorLastSeen[visitorId] = now;

  // Enforce 30-minute session window
  const existingSession = envStore.sessions[sessionId];
  let sessionCountedNow = false;
  if (!existingSession || now - existingSession.lastActiveAt > SESSION_TIMEOUT_MS) {
    envStore.sessions[sessionId] = {
      visitorId,
      startedAt: now,
      lastActiveAt: now,
    };
    if (input.eventType === "page_view" || input.eventType === "session_start") {
      bucket.sessions += 1;
      sessionCountedNow = true;
    }
  } else {
    existingSession.lastActiveAt = now;
  }

  switch (input.eventType) {
    case "session_start": {
      if (!sessionCountedNow && !existingSession) {
        bucket.sessions += 1;
      }
      break;
    }
    case "page_view": {
      const dedupToken = input.dedupKey
        ? `${environment}:${sessionId}:${pagePath}:${sanitizeId(input.dedupKey, "")}`
        : `${environment}:${sessionId}:${pagePath}`;
      const lastHit = recentPageDedup.get(dedupToken);
      if (lastHit && now - lastHit < PAGE_VIEW_DEDUP_MS) {
        persistStore();
        return { recorded: false, environment, reason: "duplicate_page_view_deduped" };
      }
      recentPageDedup.set(dedupToken, now);
      bucket.pageViews += 1;
      bucket.pages[pagePath] = (bucket.pages[pagePath] || 0) + 1;
      break;
    }
    case "heartbeat": {
      // Only updates visitorLastSeen & session.lastActiveAt for accurate active-user window
      break;
    }
    case "link_click": {
      const id = sanitizeId(input.targetId);
      bucket.linkClicks[id] = (bucket.linkClicks[id] || 0) + 1;
      break;
    }
    case "download_request": {
      const id = sanitizeId(input.targetId);
      bucket.downloadRequests[id] = (bucket.downloadRequests[id] || 0) + 1;
      break;
    }
    case "download_completed": {
      const id = sanitizeId(input.targetId);
      bucket.downloadsCompleted[id] = (bucket.downloadsCompleted[id] || 0) + 1;
      break;
    }
    case "blog_read": {
      const id = sanitizeId(input.targetId);
      bucket.blogReads[id] = (bucket.blogReads[id] || 0) + 1;
      break;
    }
    case "contact_click": {
      const source = sanitizeId(input.targetId, "contact_email");
      bucket.contactClicks[source] = (bucket.contactClicks[source] || 0) + 1;
      break;
    }
    case "game_download": {
      const id = sanitizeId(input.targetId);
      bucket.gameDownloads[id] = (bucket.gameDownloads[id] || 0) + 1;
      break;
    }
    default:
      return { recorded: false, environment, reason: "unsupported_event_type" };
  }

  persistStore();
  return { recorded: true, environment };
}

function mergeCountMap(target: Record<string, number>, source: Record<string, number>) {
  for (const [k, v] of Object.entries(source)) {
    target[k] = (target[k] || 0) + (Number(v) || 0);
  }
}

function sumMapValues(map: Record<string, number>): number {
  return Object.values(map).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

function getStartDateCutoff(range: AnalyticsTimeRange, now: Date): string | null {
  if (range === "all") return null;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "today") {
    return formatDateKey(d);
  }
  if (range === "7d") {
    d.setUTCDate(d.getUTCDate() - 6);
    return formatDateKey(d);
  }
  if (range === "30d") {
    d.setUTCDate(d.getUTCDate() - 29);
    return formatDateKey(d);
  }
  return null;
}

export function getPublicInteractionCounts(environment: AnalyticsEnvironment) {
  const store = ensureStoreLoaded();
  // Always read the store matching the active launch mode & environment for public link/blog/download display
  const targetEnv: AnalyticsEnvironment =
    environment === "preview"
      ? "preview"
      : store.config.launchMode === "production_launched"
      ? "production"
      : "preview";

  const envStore = targetEnv === "preview" ? store.preview : store.production;
  const links: Record<string, number> = {};
  const downloadRequests: Record<string, number> = {};
  const downloadsCompleted: Record<string, number> = {};
  const blogs: Record<string, number> = {};

  const now = new Date();
  const todayKey = formatDateKey(now);
  let totalSessions = 0;

  for (const bucket of Object.values(envStore.daily)) {
    mergeCountMap(links, bucket.linkClicks);
    mergeCountMap(downloadRequests, bucket.downloadRequests);
    mergeCountMap(downloadsCompleted, bucket.downloadsCompleted);
    mergeCountMap(blogs, bucket.blogReads);
    totalSessions += bucket.sessions || 0;
  }

  const todayBucket = envStore.daily[todayKey];
  const visitorsToday = todayBucket ? todayBucket.visitors.length : 0;

  return {
    config: { ...store.config },
    interactionCounts: {
      links: store.config.launchMode === "production_launched" || environment === "preview" ? links : {},
      downloadRequests:
        store.config.launchMode === "production_launched" || environment === "preview" ? downloadRequests : {},
      downloadsCompleted:
        store.config.launchMode === "production_launched" || environment === "preview" ? downloadsCompleted : {},
      blogs: store.config.launchMode === "production_launched" || environment === "preview" ? blogs : {},
    },
    publicSummary:
      store.config.showPublicVisitors && store.config.launchMode === "production_launched"
        ? {
            totalSessions,
            visitorsToday,
            note: "Approximate unique visitor sessions (bot & admin traffic excluded).",
          }
        : undefined,
  };
}

export function getAdminAnalyticsReport(
  scope: AnalyticsEnvironment = "production",
  range: AnalyticsTimeRange = "30d"
) {
  const store = ensureStoreLoaded();
  const envStore = scope === "preview" ? store.preview : store.production;
  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = formatDateKey(now);
  const weekCutoff = getStartDateCutoff("7d", now)!;
  const monthCutoff = getStartDateCutoff("30d", now)!;
  const rangeCutoff = getStartDateCutoff(range, now);

  const sortedDateKeys = Object.keys(envStore.daily).sort();

  const visitorsRangeSet = new Set<string>();
  const visitorsWeekSet = new Set<string>();
  const visitorsMonthSet = new Set<string>();

  let totalPageViews = 0;
  let totalSessions = 0;
  const pageTotals: Record<string, number> = {};
  const linkClicksById: Record<string, number> = {};
  const downloadRequestsById: Record<string, number> = {};
  const downloadsCompletedById: Record<string, number> = {};
  const blogReadsById: Record<string, number> = {};
  const contactClicksBySource: Record<string, number> = {};
  const gameDownloadsById: Record<string, number> = {};

  const dailyVisits: Array<{
    key: string;
    label: string;
    visits: number;
    pageViews: number;
    uniqueVisitors: number;
  }> = [];

  const weeklyMap = new Map<string, { label: string; visits: number; pageViews: number; visitors: Set<string> }>();
  const monthlyMap = new Map<string, { label: string; visits: number; pageViews: number; visitors: Set<string> }>();
  const downloadActivity: Array<{
    key: string;
    label: string;
    libraryRequests: number;
    completedDownloads: number;
    gameDownloads: number;
    total: number;
  }> = [];

  for (const dateKey of sortedDateKeys) {
    const bucket = envStore.daily[dateKey];

    // Week & month rolling unique visitor sets (independent of chosen range)
    if (dateKey >= weekCutoff) {
      for (const vid of bucket.visitors) visitorsWeekSet.add(vid);
    }
    if (dateKey >= monthCutoff) {
      for (const vid of bucket.visitors) visitorsMonthSet.add(vid);
    }

    if (rangeCutoff && dateKey < rangeCutoff) {
      continue;
    }

    totalPageViews += bucket.pageViews || 0;
    totalSessions += bucket.sessions || 0;
    for (const vid of bucket.visitors) visitorsRangeSet.add(vid);

    mergeCountMap(pageTotals, bucket.pages);
    mergeCountMap(linkClicksById, bucket.linkClicks);
    mergeCountMap(downloadRequestsById, bucket.downloadRequests);
    mergeCountMap(downloadsCompletedById, bucket.downloadsCompleted);
    mergeCountMap(blogReadsById, bucket.blogReads);
    mergeCountMap(contactClicksBySource, bucket.contactClicks);
    mergeCountMap(gameDownloadsById, bucket.gameDownloads);

    const shortLabel = dateKey.slice(5); // MM-DD
    if (bucket.sessions > 0 || bucket.pageViews > 0) {
      dailyVisits.push({
        key: dateKey,
        label: shortLabel,
        visits: bucket.sessions || 0,
        pageViews: bucket.pageViews || 0,
        uniqueVisitors: bucket.visitors.length,
      });
    }

    const weekKey = formatWeekKey(dateKey);
    const weekLabel = `Wk ${getMondayOfDate(dateKey).slice(5)}`;
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, { label: weekLabel, visits: 0, pageViews: 0, visitors: new Set() });
    }
    const w = weeklyMap.get(weekKey)!;
    w.visits += bucket.sessions || 0;
    w.pageViews += bucket.pageViews || 0;
    for (const vid of bucket.visitors) w.visitors.add(vid);

    const monthKey = dateKey.slice(0, 7); // YYYY-MM
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { label: monthKey, visits: 0, pageViews: 0, visitors: new Set() });
    }
    const m = monthlyMap.get(monthKey)!;
    m.visits += bucket.sessions || 0;
    m.pageViews += bucket.pageViews || 0;
    for (const vid of bucket.visitors) m.visitors.add(vid);

    const libReq = sumMapValues(bucket.downloadRequests);
    const compDl = sumMapValues(bucket.downloadsCompleted);
    const gameDl = sumMapValues(bucket.gameDownloads);
    if (libReq + compDl + gameDl > 0) {
      downloadActivity.push({
        key: dateKey,
        label: shortLabel,
        libraryRequests: libReq,
        completedDownloads: compDl,
        gameDownloads: gameDl,
        total: libReq + gameDl,
      });
    }
  }

  const todayBucket = envStore.daily[todayKey];
  const visitorsToday = todayBucket ? todayBucket.visitors.length : 0;

  let currentlyActiveVisitors = 0;
  for (const lastSeen of Object.values(envStore.visitorLastSeen)) {
    if (nowMs - lastSeen <= ACTIVE_WINDOW_MS) {
      currentlyActiveVisitors += 1;
    }
  }

  const mostVisitedPages = Object.entries(pageTotals)
    .map(([pathKey, views]) => ({
      path: pathKey,
      label: getPageDisplayLabel(pathKey),
      views,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const weeklyVisits = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.visits > 0 || v.pageViews > 0)
    .map(([key, v]) => ({
      key,
      label: v.label,
      visits: v.visits,
      pageViews: v.pageViews,
      uniqueVisitors: v.visitors.size,
    }));

  const monthlyVisits = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.visits > 0 || v.pageViews > 0)
    .map(([key, v]) => ({
      key,
      label: v.label,
      visits: v.visits,
      pageViews: v.pageViews,
      uniqueVisitors: v.visitors.size,
    }));

  return {
    config: { ...store.config },
    report: {
      scope,
      range,
      totalPageViews,
      uniqueVisitors: visitorsRangeSet.size,
      totalSessions,
      visitorsToday,
      visitorsThisWeek: visitorsWeekSet.size,
      visitorsThisMonth: visitorsMonthSet.size,
      currentlyActiveVisitors,
      totalLinkClicks: sumMapValues(linkClicksById),
      totalDownloadRequests: sumMapValues(downloadRequestsById),
      totalDownloadsCompleted: sumMapValues(downloadsCompletedById),
      totalBlogReads: sumMapValues(blogReadsById),
      totalContactClicks: sumMapValues(contactClicksBySource),
      totalGameDownloads: sumMapValues(gameDownloadsById),
      linkClicksById,
      downloadRequestsById,
      downloadsCompletedById,
      blogReadsById,
      contactClicksBySource,
      gameDownloadsById,
      dailyVisits,
      weeklyVisits,
      monthlyVisits,
      mostVisitedPages,
      downloadActivity,
    },
  };
}
