/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  Cpu,
  Download,
  Eye,
  FileDown,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  Mail,
  MousePointerClick,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Users,
  Video as VideoIcon,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  AnalyticsDashboardResponse,
  AnalyticsEnvironment,
  AnalyticsTimeRange,
  BlogPost,
  ContentLink,
  DownloadItem,
  Photo,
  Profile,
  Project,
  UploadedGame,
  Video,
} from '../../types';
import { computeContentCreationYears } from '../../utils/analytics';

interface OwnerAnalyticsPanelProps {
  profile: Profile;
  links: ContentLink[];
  projects: Project[];
  photos: Photo[];
  videos: Video[];
  downloads: DownloadItem[];
  blogs: BlogPost[];
  currentRoleLabel: string;
}

interface SimpleBarDatum {
  key: string;
  label: string;
  primary: number;
  secondary?: number;
}

function ResponsiveBarChart({
  title,
  subtitle,
  data,
  primaryLabel,
  secondaryLabel,
  accentClass = 'from-cyan-400 to-indigo-500',
}: {
  title: string;
  subtitle: string;
  data: SimpleBarDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  accentClass?: string;
}) {
  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.primary, d.secondary || 0))
  );

  return (
    <div className="bg-[#0b1220]/70 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h4 className="text-white font-bold text-sm flex items-center gap-2">
            <BarChart3 size={15} className="text-cyan-400" />
            {title}
          </h4>
          <p className="text-gray-400 text-[11px] font-mono mt-0.5">{subtitle}</p>
        </div>
        {data.length > 0 && (
          <div className="text-right text-[10px] font-mono text-gray-400">
            <span className="text-cyan-300 font-bold">
              {data.reduce((s, d) => s + d.primary, 0).toLocaleString()}
            </span>{' '}
            {primaryLabel}
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-44 rounded-xl border border-dashed border-white/10 bg-[#070a11]/60 flex flex-col items-center justify-center text-center px-4">
          <BarChart3 size={22} className="text-gray-600 mb-2" />
          <p className="text-gray-400 font-mono text-xs font-semibold">No data yet</p>
          <p className="text-gray-600 font-mono text-[10px] mt-1">
            Real activity will render here automatically once recorded.
          </p>
        </div>
      ) : (
        <div className="h-44 flex items-end gap-2 pt-4 pb-1 px-1 overflow-x-auto">
          {data.slice(-14).map((point) => {
            const pct = Math.max(6, Math.round((point.primary / maxVal) * 100));
            return (
              <div
                key={point.key}
                className="flex-1 min-w-[28px] h-full flex flex-col items-center justify-end group"
                title={`${point.label}: ${point.primary} ${primaryLabel}${
                  point.secondary !== undefined && secondaryLabel
                    ? ` | ${point.secondary} ${secondaryLabel}`
                    : ''
                }`}
              >
                <span className="text-[9px] font-mono text-cyan-300 mb-1 opacity-80 group-hover:opacity-100">
                  {point.primary}
                </span>
                <div className="w-full max-w-[32px] h-[75%] flex items-end justify-center bg-white/[0.03] rounded-t-md overflow-hidden">
                  <div
                    className={`w-full bg-gradient-to-t ${accentClass} rounded-t-md transition-all duration-500`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-gray-400 mt-1.5 truncate max-w-full">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OwnerAnalyticsPanel({
  profile,
  links,
  projects,
  photos,
  videos,
  downloads,
  blogs,
  currentRoleLabel,
}: OwnerAnalyticsPanelProps) {
  const { user, isOwner } = useAuth();
  const [scope, setScope] = useState<AnalyticsEnvironment>('production');
  const [range, setRange] = useState<AnalyticsTimeRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Firestore collection metrics (Inquiries + Gaming Zone Downloads)
  const [liveInquiriesCount, setLiveInquiriesCount] = useState<number | null>(null);
  const [liveGamesList, setLiveGamesList] = useState<UploadedGame[]>([]);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setErrorMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/analytics?scope=${scope}&range=${range}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to load analytics.');
      }
      setAnalytics(data as AnalyticsDashboardResponse);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not load analytics report.');
    } finally {
      setLoading(false);
    }
  }, [user, scope, range]);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 15000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  // Real-time Firestore listener for Inquiries & Games
  useEffect(() => {
    const unsubInq = onSnapshot(
      collection(db, 'inquiries'),
      (snap) => {
        setLiveInquiriesCount(snap.size);
      },
      () => {
        // Fallback smoothly to serverInquiryCount if client rules prevent read
      }
    );

    const unsubGames = onSnapshot(
      collection(db, 'games'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UploadedGame);
        setLiveGamesList(list);
      },
      () => {
        // Non-fatal fallback
      }
    );

    return () => {
      unsubInq();
      unsubGames();
    };
  }, []);

  const handleUpdateAnalyticsConfig = async (patch: {
    launchMode?: 'development' | 'production_launched';
    showPublicVisitors?: boolean;
  }) => {
    if (!user || !isOwner) return;
    setSavingConfig(true);
    setErrorMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/analytics/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update analytics setting.');
      }
      await fetchAnalytics();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save analytics setting.');
    } finally {
      setSavingConfig(false);
    }
  };

  const report = analytics?.report;
  const config = analytics?.config;
  const isLaunched = config?.launchMode === 'production_launched';

  // Live content counts
  const publishedProjectsCount = projects.filter((p) => p.status !== 'draft').length;
  const publishedBlogsCount = blogs.filter((b) => b.status !== 'draft').length;
  const yearsInfo = computeContentCreationYears(profile.contentCreationStartDate);
  const contactSubmissionsCount =
    liveInquiriesCount !== null ? liveInquiriesCount : analytics?.serverInquiryCount || 0;

  const firestoreGamesDownloadsTotal = liveGamesList.reduce(
    (sum, g) => sum + (Number(g.downloadCount) || 0),
    0
  );
  const gamingDownloadsTotal = Math.max(
    firestoreGamesDownloadsTotal,
    analytics?.serverGameDownloadsCount || 0,
    report?.totalGameDownloads || 0
  );

  const pageMaxViews = Math.max(1, ...(report?.mostVisitedPages.map((p) => p.views) || [1]));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Launch Control & Environment Banner */}
      <div className="bg-[#0b1220]/80 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border ${
                  isLaunched
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isLaunched ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {isLaunched ? 'Production Analytics Launched' : 'Development Mode (Production Visitors Paused)'}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-white/5 border border-white/10 text-gray-300">
                Role: {currentRoleLabel}
              </span>
              {analytics?.firebaseMeasurementId && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                  GA4: {analytics.firebaseMeasurementId}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {isLaunched
                ? `Production analytics are actively recording real non-admin, non-bot public traffic${
                    config?.launchedAt ? ` (started ${new Date(config.launchedAt).toLocaleString()})` : ''
                  }. Preview/localhost test traffic is isolated separately.`
                : 'Production visitor metrics stay cleanly at 0 until you launch. Localhost and AI Studio preview test traffic can still be inspected under the "Preview / Test" scope.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isOwner && (
              <>
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() =>
                    handleUpdateAnalyticsConfig({
                      launchMode: isLaunched ? 'development' : 'production_launched',
                    })
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                    isLaunched
                      ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200'
                      : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg'
                  }`}
                >
                  <Rocket size={13} />
                  {isLaunched ? 'Pause to Development Mode' : 'Launch Production Analytics'}
                </button>

                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() =>
                    handleUpdateAnalyticsConfig({
                      showPublicVisitors: !config?.showPublicVisitors,
                    })
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono border transition-all cursor-pointer disabled:opacity-50 ${
                    config?.showPublicVisitors
                      ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  Public Visitor Count: {config?.showPublicVisitors ? 'Shown on About' : 'Hidden'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={loading}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-xl text-xs font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Scope & Timeframe Controls */}
        <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-[#070a11] p-1 rounded-xl border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setScope('production')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                scope === 'production'
                  ? 'bg-cyan-500 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Production Traffic
            </button>
            <button
              type="button"
              onClick={() => setScope('preview')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                scope === 'preview'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Preview / Dev Test Traffic
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'all', label: 'All Time' },
              ] as { id: AnalyticsTimeRange; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                  range === opt.id
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold'
                    : 'bg-white/5 border border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-300 font-mono">
            {errorMsg}
          </div>
        )}
      </div>

      {/* 2. Visitor & Engagement KPIs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" />
            Real-Time Traffic Metrics ({scope === 'production' ? 'Production' : 'Preview / Dev'})
          </h3>
          {loading && !report && (
            <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin text-cyan-400" /> Loading metrics...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Eye size={11} className="text-cyan-400" /> Total Page Views
            </span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.totalPageViews ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">Deduplicated views</p>
          </div>

          <div
            className="p-4 bg-white/5 border border-white/5 rounded-2xl"
            title="Approximate count based on browser visitor UUIDs (not verified unique individuals)"
          >
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Users size={11} className="text-indigo-400" /> Unique Visitors*
            </span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.uniqueVisitors ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">Approx. browser UUIDs</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Globe size={11} className="text-cyan-400" /> Website Visits
            </span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.totalSessions ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">30-min session window</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase">Visitors Today</span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.visitorsToday ?? 0).toLocaleString()}
            </h4>
            <p className="text-cyan-400 text-[10px] mt-1">UTC daily UUIDs</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase">Visitors This Week</span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.visitorsThisWeek ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">Rolling 7 days</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase">Visitors This Month</span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.visitorsThisMonth ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">Rolling 30 days</p>
          </div>

          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
            <span className="text-emerald-300 font-mono text-[10px] uppercase flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> Active Now
            </span>
            <h4 className="text-2xl font-black text-white mt-1.5">
              {(report?.currentlyActiveVisitors ?? 0).toLocaleString()}
            </h4>
            <p className="text-emerald-400/80 text-[10px] mt-1">Active in last 5 mins</p>
          </div>
        </div>
      </div>

      {/* 3. Verified Portfolio & Interaction KPIs */}
      <div>
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-cyan-400" />
          Verified Content, Inquiries &amp; Asset Activity
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <VideoIcon size={11} className="text-cyan-400" /> Videos Uploaded
            </span>
            <h4 className="text-xl font-black text-white mt-1">{videos.length}</h4>
            <p className="text-gray-500 text-[10px] mt-1">Live Videos collection</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Cpu size={11} className="text-indigo-400" /> Projects Published
            </span>
            <h4 className="text-xl font-black text-white mt-1">{publishedProjectsCount}</h4>
            <p className="text-gray-500 text-[10px] mt-1">Published portfolio builds</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Calendar size={11} className="text-green-400" /> Content Creation Years
            </span>
            <h4 className="text-xl font-black text-white mt-1">
              {yearsInfo.display}
              {yearsInfo.suffix}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">
              {profile.contentCreationStartDate
                ? `Since ${profile.contentCreationStartDate}`
                : 'Start date not set'}
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <ImageIcon size={11} className="text-cyan-400" /> Gallery Photos
            </span>
            <h4 className="text-xl font-black text-white mt-1">{photos.length}</h4>
            <p className="text-gray-500 text-[10px] mt-1">Published photos</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Link2 size={11} className="text-cyan-400" /> Registered Links
            </span>
            <h4 className="text-xl font-black text-white mt-1">{links.length}</h4>
            <p className="text-gray-500 text-[10px] mt-1">
              {(report?.totalLinkClicks ?? 0).toLocaleString()} real clicks
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <BookOpen size={11} className="text-cyan-400" /> Published Articles
            </span>
            <h4 className="text-xl font-black text-white mt-1">{publishedBlogsCount}</h4>
            <p className="text-gray-500 text-[10px] mt-1">
              {(report?.totalBlogReads ?? 0).toLocaleString()} real reads
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <FileDown size={11} className="text-cyan-400" /> Library Requests
            </span>
            <h4 className="text-xl font-black text-white mt-1">
              {(report?.totalDownloadRequests ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">
              {(report?.totalDownloadsCompleted ?? 0).toLocaleString()} verified asset files
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Mail size={11} className="text-indigo-400" /> Contact Inquiries
            </span>
            <h4 className="text-xl font-black text-white mt-1">{contactSubmissionsCount}</h4>
            <p className="text-gray-500 text-[10px] mt-1">Saved Firestore submissions</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <MousePointerClick size={11} className="text-cyan-400" /> Contact Link Clicks
            </span>
            <h4 className="text-xl font-black text-white mt-1">
              {(report?.totalContactClicks ?? 0).toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">Direct mailto/contact clicks</p>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-gray-400 font-mono text-[10px] uppercase flex items-center gap-1">
              <Gamepad2 size={11} className="text-purple-400" /> Gaming Zone Downloads
            </span>
            <h4 className="text-xl font-black text-white mt-1">
              {gamingDownloadsTotal.toLocaleString()}
            </h4>
            <p className="text-gray-500 text-[10px] mt-1">Verified game downloads</p>
          </div>
        </div>
      </div>

      {/* 4. Five Interactive Real-Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ResponsiveBarChart
          title="Daily Website Visits"
          subtitle="Sessions recorded per UTC day"
          data={(report?.dailyVisits || []).map((d) => ({
            key: d.key,
            label: d.label,
            primary: d.visits,
            secondary: d.pageViews,
          }))}
          primaryLabel="visits"
          secondaryLabel="page views"
          accentClass="from-cyan-400 to-blue-500"
        />

        <ResponsiveBarChart
          title="Weekly Website Visits"
          subtitle="Aggregated sessions per week"
          data={(report?.weeklyVisits || []).map((w) => ({
            key: w.key,
            label: w.label,
            primary: w.visits,
            secondary: w.pageViews,
          }))}
          primaryLabel="visits"
          secondaryLabel="page views"
          accentClass="from-indigo-400 to-purple-500"
        />

        <ResponsiveBarChart
          title="Monthly Website Visits"
          subtitle="Aggregated sessions per month"
          data={(report?.monthlyVisits || []).map((m) => ({
            key: m.key,
            label: m.label,
            primary: m.visits,
            secondary: m.pageViews,
          }))}
          primaryLabel="visits"
          secondaryLabel="page views"
          accentClass="from-cyan-400 to-indigo-500"
        />

        <ResponsiveBarChart
          title="Download Activity"
          subtitle="Library requests & verified game downloads"
          data={(report?.downloadActivity || []).map((d) => ({
            key: d.key,
            label: d.label,
            primary: d.total,
            secondary: d.gameDownloads,
          }))}
          primaryLabel="requests/downloads"
          secondaryLabel="game downloads"
          accentClass="from-emerald-400 to-cyan-500"
        />

        {/* Most Visited Pages */}
        <div className="lg:col-span-2 bg-[#0b1220]/70 border border-white/10 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-white font-bold text-sm flex items-center gap-2">
                <Globe size={15} className="text-cyan-400" />
                Most Visited Pages
              </h4>
              <p className="text-gray-400 text-[11px] font-mono mt-0.5">
                Top routes &amp; section views in the selected timeframe
              </p>
            </div>
          </div>

          {!report || report.mostVisitedPages.length === 0 ? (
            <div className="h-32 rounded-xl border border-dashed border-white/10 bg-[#070a11]/60 flex flex-col items-center justify-center text-center px-4">
              <p className="text-gray-400 font-mono text-xs font-semibold">No data yet</p>
              <p className="text-gray-600 font-mono text-[10px] mt-1">
                Page view distribution appears here once real sessions occur.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {report.mostVisitedPages.map((page) => {
                const widthPct = Math.max(4, Math.round((page.views / pageMaxViews) * 100));
                return (
                  <div key={page.path} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-200 truncate pr-4">
                        {page.label}{' '}
                        <span className="text-gray-500 text-[10px]">({page.path})</span>
                      </span>
                      <span className="text-cyan-300 font-bold flex-shrink-0">
                        {page.views.toLocaleString()} views
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Content Clicks & Asset Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl">
          <h3 className="text-white font-sans font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-cyan-400" />
            Real Content Link Clicks
          </h3>
          {links.length === 0 ? (
            <p className="text-xs font-mono text-gray-500">No links registered.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {links.map((lnk) => {
                const count = report?.linkClicksById?.[lnk.id] ?? 0;
                return (
                  <div key={lnk.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-300 truncate pr-4">{lnk.title}</span>
                    <span className="text-cyan-400 font-bold flex-shrink-0 bg-white/5 py-1 px-2.5 rounded border border-white/5">
                      {count} clicks
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl">
          <h3 className="text-white font-sans font-bold text-sm mb-3 flex items-center gap-2">
            <Download size={15} className="text-cyan-400" />
            Real Library &amp; Blog Engagement
          </h3>
          <div className="divide-y divide-white/5">
            {downloads.map((dl) => {
              const reqCount = report?.downloadRequestsById?.[dl.id] ?? 0;
              const compCount = report?.downloadsCompletedById?.[dl.id] ?? 0;
              return (
                <div key={dl.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-300 truncate pr-4">{dl.title}</span>
                  <span className="text-cyan-300 font-bold flex-shrink-0 bg-white/5 py-1 px-2.5 rounded border border-white/5">
                    {reqCount} requests{compCount > 0 ? ` / ${compCount} files` : ''}
                  </span>
                </div>
              );
            })}
            {blogs.map((blog) => {
              const readsCount = report?.blogReadsById?.[blog.id] ?? 0;
              return (
                <div key={blog.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400 truncate pr-4">[Blog] {blog.title}</span>
                  <span className="text-indigo-300 font-bold flex-shrink-0 bg-white/5 py-1 px-2.5 rounded border border-white/5">
                    {readsCount} reads
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Methodology, Privacy & Baseline Transparency */}
      <div className="bg-[#080d17] border border-white/10 rounded-2xl p-5 text-xs text-gray-400 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold">
          <ShieldCheck size={15} />
          <span>Analytics Methodology &amp; Privacy Notice</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
          <p className="flex items-start gap-2">
            <Info size={13} className="text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Unique Visitors Definition:</strong> Unique Visitors represents an approximate count of
              privacy-conscious random browser UUIDs, not verified individual people. Raw IP addresses are never
              stored.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Info size={13} className="text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Filtering &amp; Windows:</strong> Known bots/crawlers, signed-in admins, React re-renders,
              and preview/development hostnames are excluded from Production metrics. Sessions use a 30-minute
              inactivity window; Active Now uses a 5-minute activity window.
            </span>
          </p>
        </div>
        <p className="text-[11px] text-gray-500 font-mono pt-1 border-t border-white/5">
          Baseline Note: Previously seeded placeholder counters were removed. Metrics start from 0 and reflect
          verified post-launch activity and live database records only.
        </p>
      </div>
    </div>
  );
}
