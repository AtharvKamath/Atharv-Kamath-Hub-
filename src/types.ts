/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Profile {
  name: string;
  titles: string[];
  bio: string;
  mission: string;
  location: string;
  email: string;
  profilePhoto: string;
  logoUrl?: string;
  contentCreationStartDate?: string;
  banners: string[];
  socialLinks: {
    youtube?: string;
    instagram?: string;
    facebook?: string;
    github?: string;
    linkedin?: string;
    email?: string;
  };
}

export interface Stat {
  id: string;
  label: string;
  value: number;
  suffix: string;
  iconName: string;
}

export type PlatformType =
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'github'
  | 'linkedin'
  | 'drive'
  | 'spotify'
  | 'website'
  | 'generic';

export interface ContentLink {
  id: string;
  title: string;
  description: string;
  url: string;
  platform: PlatformType;
  category: string;
  clicks: number;
}

export interface Photo {
  id: string;
  url: string;
  title: string;
  category: 'Travel' | 'Nature' | 'Tech' | 'Gaming Setup' | 'College Life' | 'Events' | 'Photography';
  date: string;
  description?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  tags: string[];
  demoUrl?: string;
  githubUrl?: string;
  featured: boolean;
  status?: 'completed' | 'published' | 'draft';
}

export interface Video {
  id: string;
  title: string;
  description: string;
  youtubeId: string; // Embed code, ID or Full URL
  category: 'Vlogs' | 'Tech' | 'Gaming' | 'Music';
  thumbnailUrl?: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  description: string;
  fileSize: string;
  fileType: string; // PDF, ZIP, PPT, etc.
  category: 'Notes' | 'Templates' | 'Wallpapers' | 'Software' | 'Other';
  downloadUrl: string;
  downloadsCount: number;
}

export interface FavoriteItem {
  id: string;
  title: string;
  category: 'Gadget' | 'YouTuber' | 'Game' | 'Software' | 'Music';
  rating: number; // 1 to 5
  description: string;
  image: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string; // Markdown supported
  coverImage: string;
  category: 'Technology' | 'Travel' | 'Gaming' | 'Music' | 'Personal';
  date: string;
  reads: number;
  status?: 'published' | 'draft';
}

export interface TimelineItem {
  id: string;
  year: string;
  title: string;
  subtitle: string;
  description: string;
}

export type InquiryCategory =
  | 'General Inquiry'
  | 'Business Collaboration'
  | 'Project Discussion'
  | 'Technical Support'
  | 'Other';

export type InquiryStatus = 'unread' | 'read' | 'replied';

export type NotificationDeliveryStatus = 'pending' | 'sent' | 'queued_retry' | 'failed';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  category?: InquiryCategory;
  message: string;
  date: string;
  read: boolean;
  status?: InquiryStatus;
  notificationStatus?: NotificationDeliveryStatus;
  notificationError?: string;
  createdAt?: string;
}

export interface WebsiteConfig {
  themeColor: string;
  enableDarkMode: boolean;
  enableBackgroundVideo: boolean;
  visitorCount: number;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  playUrl: string;
  genre: string;
  rating?: number;
}

// === RBAC & ADMIN SYSTEM TYPES ===

export type AdminRole = 'owner' | 'full_admin' | 'limited_admin';

export type AdminAccountStatus = 'active' | 'suspended' | 'revoked';

export type AdminRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type PermissionSection =
  | 'home'
  | 'about'
  | 'links'
  | 'gallery'
  | 'projects'
  | 'videos'
  | 'library'
  | 'gamingZone'
  | 'blogs'
  | 'journey'
  | 'contact'
  | 'directInquiry';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'publish';

export type SectionPermissions = Record<PermissionAction, boolean>;

export type AdminPermissionsMap = Record<PermissionSection, SectionPermissions>;

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminAccountStatus;
  permissions: AdminPermissionsMap;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  lastLoginAt?: string;
}

export interface AdminRequest {
  requestId: string;
  uid: string;
  name: string;
  email: string;
  verified: boolean;
  status: AdminRequestStatus;
  requestedRole: AdminRole;
  assignedRole?: AdminRole;
  assignedPermissions?: AdminPermissionsMap;
  requestedAt: string;
  expiresAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  notificationStatus?: NotificationDeliveryStatus;
}

export interface AdminAuditLog {
  logId: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetId: string;
  timestamp: string;
  details: string;
}

// === GAMING ZONE UPLOADED GAMES TYPES ===

export interface GameSystemRequirements {
  supportedOS: string[];
  minProcessor: string;
  recProcessor: string;
  minRam: string;
  recRam: string;
  minStorage: string;
  recStorage: string;
  minGraphics: string;
  recGraphics: string;
  additionalRequirements: string;
}

export type GameUploadStatus = 'uploading' | 'scanning' | 'completed' | 'failed';
export type GameSecurityStatus = 'pending' | 'quarantined' | 'passed' | 'failed';
export type GamePublicationStatus = 'draft' | 'published' | 'unpublished';

export interface UploadedGame {
  gameId: string;
  title: string;
  description: string;
  category: string;
  version: string;
  developer: string;
  releaseDate: string;
  coverImage: string;
  screenshots: string[];
  filePath: string;
  downloadFileName: string;
  fileSize: number;
  fileSizeFormatted: string;
  fileType: string;
  fileVersion: string;
  externalDownloadUrl?: string;
  sha256?: string;
  storageProvider: 'firebase_storage' | 'server_vault' | 'external_only';
  requirements: GameSystemRequirements;
  genre: string;
  playerMode: 'Single Player' | 'Multiplayer' | 'Both';
  connectivity: 'Offline' | 'Online' | 'Both';
  ageRating: string;
  installationInstructions: string;
  additionalNotes: string;
  downloadCount: number;
  uploadStatus: GameUploadStatus;
  securityScanStatus: GameSecurityStatus;
  securityScanDetails?: string;
  publicationStatus: GamePublicationStatus;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewPeriodOption = '24h' | '3d' | '7d';

// === AI GUIDE & REAL-TIME ANALYTICS TYPES ===

export interface ChatHealthResponse {
  online: boolean;
  status: 'online' | 'unavailable';
  model: string;
  reason?: string;
}

export type AnalyticsLaunchMode = 'development' | 'production_launched';
export type AnalyticsEnvironment = 'production' | 'preview';
export type AnalyticsTimeRange = 'today' | '7d' | '30d' | 'all';

export interface AnalyticsPublicConfig {
  launchMode: AnalyticsLaunchMode;
  launchedAt: string | null;
  showPublicVisitors: boolean;
  detectedEnvironment: AnalyticsEnvironment;
  interactionCounts: {
    links: Record<string, number>;
    downloadRequests: Record<string, number>;
    downloadsCompleted: Record<string, number>;
    blogs: Record<string, number>;
  };
  publicSummary?: {
    totalSessions: number;
    visitorsToday: number;
    note: string;
  };
}

export interface AnalyticsVisitSeriesPoint {
  key: string;
  label: string;
  visits: number;
  pageViews: number;
  uniqueVisitors: number;
}

export interface AnalyticsPageVisitItem {
  path: string;
  label: string;
  views: number;
}

export interface AnalyticsDownloadActivityPoint {
  key: string;
  label: string;
  libraryRequests: number;
  completedDownloads: number;
  gameDownloads: number;
  total: number;
}

export interface AnalyticsReportMetrics {
  scope: AnalyticsEnvironment;
  range: AnalyticsTimeRange;
  totalPageViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  currentlyActiveVisitors: number;
  totalLinkClicks: number;
  totalDownloadRequests: number;
  totalDownloadsCompleted: number;
  totalBlogReads: number;
  totalContactClicks: number;
  totalGameDownloads: number;
  linkClicksById: Record<string, number>;
  downloadRequestsById: Record<string, number>;
  downloadsCompletedById: Record<string, number>;
  blogReadsById: Record<string, number>;
  contactClicksBySource: Record<string, number>;
  gameDownloadsById: Record<string, number>;
  dailyVisits: AnalyticsVisitSeriesPoint[];
  weeklyVisits: AnalyticsVisitSeriesPoint[];
  monthlyVisits: AnalyticsVisitSeriesPoint[];
  mostVisitedPages: AnalyticsPageVisitItem[];
  downloadActivity: AnalyticsDownloadActivityPoint[];
}

export interface AnalyticsDashboardResponse {
  success: boolean;
  config: {
    launchMode: AnalyticsLaunchMode;
    launchedAt: string | null;
    showPublicVisitors: boolean;
    updatedAt: string;
    updatedBy?: string;
  };
  report: AnalyticsReportMetrics;
  serverInquiryCount: number;
  serverGameDownloadsCount: number;
  firebaseMeasurementId?: string;
}

