/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import About from './components/About';
import ContentHub from './components/ContentHub';
import Gallery from './components/Gallery';
import Projects from './components/Projects';
import Videos from './components/Videos';
import Downloads from './components/Downloads';
import Favorites from './components/Favorites';
import GamingZone from './components/GamingZone';
import Blogs from './components/Blogs';
import Timeline from './components/Timeline';
import Contact from './components/Contact';
import AdminPanel from './components/AdminPanel';
import AdminAuthModal from './components/AdminAuthModal';
import Chatbot from './components/Chatbot';
import { Youtube, Instagram, Facebook, Github, Linkedin, Mail } from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './context/AuthContext';
import {
  fetchPublicAnalyticsConfig,
  setAnalyticsLaunchModeCache,
  trackAnalyticsEvent,
} from './utils/analytics';

import {
  Profile,
  Stat,
  ContentLink,
  Photo,
  Project,
  Video,
  DownloadItem,
  FavoriteItem,
  BlogPost,
  TimelineItem,
  Game,
} from './types';

import {
  initialProfile,
  initialStats,
  initialContentLinks,
  initialPhotos,
  initialProjects,
  initialVideos,
  initialDownloads,
  initialFavorites,
  initialBlogs,
  initialTimeline,
  initialGames,
} from './data';

type SiteContentSectionId =
  | 'profile'
  | 'stats'
  | 'links'
  | 'photos'
  | 'projects'
  | 'videos'
  | 'downloads'
  | 'favorites'
  | 'blogs'
  | 'timeline'
  | 'arcadeGames';

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const LEGACY_FAKE_LINK_CLICKS: Record<string, number> = {
  'link-1': 1240,
  'link-2': 980,
  'link-3': 1540,
  'link-4': 742,
  'link-5': 890,
  'link-6': 430,
  'link-7': 310,
  'link-8': 220,
};

const LEGACY_FAKE_DOWNLOAD_COUNTS: Record<string, number> = {
  'dl-1': 1420,
  'dl-2': 890,
  'dl-3': 2040,
  'dl-4': 610,
};

const LEGACY_FAKE_BLOG_READS: Record<string, number> = {
  'blog-1': 480,
  'blog-2': 320,
};

function cleanLegacyLinkClicks(items: ContentLink[]): ContentLink[] {
  return items.map((item) =>
    LEGACY_FAKE_LINK_CLICKS[item.id] === item.clicks ? { ...item, clicks: 0 } : item
  );
}

function cleanLegacyDownloads(items: DownloadItem[]): DownloadItem[] {
  return items.map((item) =>
    LEGACY_FAKE_DOWNLOAD_COUNTS[item.id] === item.downloadsCount
      ? { ...item, downloadsCount: 0 }
      : item
  );
}

function cleanLegacyBlogs(items: BlogPost[]): BlogPost[] {
  return items.map((item) =>
    LEGACY_FAKE_BLOG_READS[item.id] === item.reads ? { ...item, reads: 0 } : item
  );
}

export default function App() {
  const { user, isAuthorizedAdmin, authLoading, redirectAuthError, signOutAdmin } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdminTrigger, setShowAdminTrigger] = useState(false);
  const [firestoreSyncError, setFirestoreSyncError] = useState<string | null>(null);
  const [publicVisitorSummary, setPublicVisitorSummary] = useState<{
    totalSessions: number;
    visitorsToday: number;
    note: string;
  } | null>(null);

  // Route & Back-button protection + Google redirect return handling
  useEffect(() => {
    if (window.location.search.includes('admin=true')) {
      setShowAdminTrigger(true);
    }

    const hadPendingRedirect = sessionStorage.getItem('pending_admin_auth_modal') === '1';
    if (hadPendingRedirect || redirectAuthError) {
      sessionStorage.removeItem('pending_admin_auth_modal');
      setShowAdmin(true);
    }

    const wantsAdminRoute =
      window.location.search.includes('page=admin') || window.location.hash === '#admin';

    if (wantsAdminRoute) {
      if (isAuthorizedAdmin) {
        setShowAdmin(true);
      } else if (!authLoading) {
        // Unauthorized / logged out visitors must never access protected admin route
        setShowAdmin(false);
        window.history.replaceState(null, '', '/');
      }
    }
  }, [isAuthorizedAdmin, authLoading, redirectAuthError]);

  useEffect(() => {
    if (showAdmin && isAuthorizedAdmin && !window.location.search.includes('page=admin')) {
      window.history.replaceState({ admin: true }, '', '?page=admin');
    }
  }, [showAdmin, isAuthorizedAdmin]);

  useEffect(() => {
    const handlePopState = () => {
      const onAdminRoute =
        window.location.search.includes('page=admin') || window.location.hash === '#admin';
      if (!onAdminRoute) {
        setShowAdmin(false);
        return;
      }
      if (!isAuthorizedAdmin) {
        setShowAdmin(false);
        window.history.replaceState(null, '', '/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthorizedAdmin]);

  // Core synchronized database states
  const [profile, setProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem('atharv_profile');
    let loaded: Profile = saved ? JSON.parse(saved) : initialProfile;

    // Auto-migrate old dry canyon banners to nature backgrounds
    if (loaded && loaded.banners) {
      let migrated = false;
      const updatedBanners = loaded.banners.map((url) => {
        if (url && (url.includes('photo-1469854523086-cc02fe5d8800') || url.includes('photo-1469854523086'))) {
          migrated = true;
          return 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80';
        }
        return url;
      });
      if (migrated) {
        loaded = { ...loaded, banners: updatedBanners };
      }
    }
    if (
      loaded &&
      (!loaded.profilePhoto ||
        loaded.profilePhoto.includes('photo-1539571696357-5a69c17a67c6') ||
        loaded.profilePhoto.includes('profile.svg') ||
        loaded.profilePhoto.includes('github.com/atharvkamath.png') ||
        loaded.profilePhoto.includes('googleusercontent.com'))
    ) {
      loaded = { ...loaded, profilePhoto: initialProfile.profilePhoto };
    }
    if (loaded && loaded.contentCreationStartDate === undefined) {
      loaded = { ...loaded, contentCreationStartDate: initialProfile.contentCreationStartDate };
    }
    return loaded;
  });

  const [stats, setStats] = useState<Stat[]>(() => {
    try {
      localStorage.removeItem('visitor_count');
    } catch {
      // ignore
    }
    const saved = localStorage.getItem('atharv_stats');
    if (!saved) return initialStats;
    const parsed = JSON.parse(saved) as Stat[];
    if (
      Array.isArray(parsed) &&
      parsed.some(
        (s) =>
          (s.id === 'stat-1' && s.value === 12400) ||
          (s.id === 'stat-2' && s.value === 184) ||
          (s.id === 'stat-3' && s.value === 4800) ||
          (s.id === 'stat-4' && s.value === 12)
      )
    ) {
      return initialStats;
    }
    return parsed;
  });

  const [links, setLinks] = useState<ContentLink[]>(() => {
    const saved = localStorage.getItem('atharv_links');
    return saved ? cleanLegacyLinkClicks(JSON.parse(saved)) : initialContentLinks;
  });

  const [photos, setPhotos] = useState<Photo[]>(() => {
    const saved = localStorage.getItem('atharv_photos');
    return saved ? JSON.parse(saved) : initialPhotos;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('atharv_projects');
    return saved ? JSON.parse(saved) : initialProjects;
  });

  const [videos, setVideos] = useState<Video[]>(() => {
    const saved = localStorage.getItem('atharv_videos');
    return saved ? JSON.parse(saved) : initialVideos;
  });

  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    const saved = localStorage.getItem('atharv_downloads');
    return saved ? cleanLegacyDownloads(JSON.parse(saved)) : initialDownloads;
  });

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    const saved = localStorage.getItem('atharv_favorites');
    return saved ? JSON.parse(saved) : initialFavorites;
  });

  const [blogs, setBlogs] = useState<BlogPost[]>(() => {
    const saved = localStorage.getItem('atharv_blogs');
    return saved ? cleanLegacyBlogs(JSON.parse(saved)) : initialBlogs;
  });

  const [timeline, setTimeline] = useState<TimelineItem[]>(() => {
    const saved = localStorage.getItem('atharv_timeline');
    return saved ? JSON.parse(saved) : initialTimeline;
  });

  const [games, setGames] = useState<Game[]>(() => {
    const saved = localStorage.getItem('atharv_games');
    return saved ? JSON.parse(saved) : initialGames;
  });

  // Subscribe to public Firestore siteContent collection for real-time cross-device sync
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'siteContent'),
      (snap) => {
        snap.forEach((d) => {
          const docData = d.data() as any;
          switch (d.id as SiteContentSectionId) {
            case 'profile':
              if (docData?.data) setProfile(docData.data as Profile);
              break;
            case 'stats':
              if (Array.isArray(docData?.items)) setStats(docData.items as Stat[]);
              break;
            case 'links':
              if (Array.isArray(docData?.items)) {
                setLinks(cleanLegacyLinkClicks(docData.items as ContentLink[]));
              }
              break;
            case 'photos':
              if (Array.isArray(docData?.items)) setPhotos(docData.items as Photo[]);
              break;
            case 'projects':
              if (Array.isArray(docData?.items)) setProjects(docData.items as Project[]);
              break;
            case 'videos':
              if (Array.isArray(docData?.items)) setVideos(docData.items as Video[]);
              break;
            case 'downloads':
              if (Array.isArray(docData?.items)) {
                setDownloads(cleanLegacyDownloads(docData.items as DownloadItem[]));
              }
              break;
            case 'favorites':
              if (Array.isArray(docData?.items)) setFavorites(docData.items as FavoriteItem[]);
              break;
            case 'blogs':
              if (Array.isArray(docData?.items)) {
                setBlogs(cleanLegacyBlogs(docData.items as BlogPost[]));
              }
              break;
            case 'timeline':
              if (Array.isArray(docData?.items)) setTimeline(docData.items as TimelineItem[]);
              break;
            case 'arcadeGames':
              if (Array.isArray(docData?.items)) setGames(docData.items as Game[]);
              break;
            default:
              break;
          }
        });
      },
      (err) => {
        console.warn('siteContent sync listener:', err.message);
      }
    );

    return () => unsub();
  }, []);

  // Real-time privacy-conscious analytics bootstrap, page_view dedup, hash nav tracking & heartbeat
  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const syncConfigAndTrack = async () => {
      const cfg = await fetchPublicAnalyticsConfig();
      if (!active) return;

      if (cfg) {
        setAnalyticsLaunchModeCache(cfg.launchMode);
        setPublicVisitorSummary(cfg.publicSummary || null);

        if (cfg.interactionCounts) {
          setLinks((prev) =>
            prev.map((l) => ({
              ...l,
              clicks: cfg.interactionCounts.links?.[l.id] ?? 0,
            }))
          );
          setDownloads((prev) =>
            prev.map((d) => ({
              ...d,
              downloadsCount:
                cfg.interactionCounts.downloadsCompleted?.[d.id] ||
                cfg.interactionCounts.downloadRequests?.[d.id] ||
                0,
            }))
          );
          setBlogs((prev) =>
            prev.map((b) => ({
              ...b,
              reads: cfg.interactionCounts.blogs?.[b.id] ?? 0,
            }))
          );
        }
      }

      if (!isAuthorizedAdmin && !showAdmin) {
        await trackAnalyticsEvent({
          eventType: 'page_view',
          pagePath: `${window.location.pathname}${window.location.hash || ''}` || '/',
          dedupKey: 'initial_load',
          isAdmin: isAuthorizedAdmin,
        });
      }
    };

    syncConfigAndTrack();

    const handleHashChange = () => {
      if (isAuthorizedAdmin || showAdmin) return;
      trackAnalyticsEvent({
        eventType: 'page_view',
        pagePath: `${window.location.pathname}${window.location.hash || ''}` || '/',
        isAdmin: isAuthorizedAdmin,
      });
    };

    window.addEventListener('hashchange', handleHashChange);

    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !isAuthorizedAdmin && !showAdmin) {
        trackAnalyticsEvent({
          eventType: 'heartbeat',
          pagePath: `${window.location.pathname}${window.location.hash || ''}` || '/',
          isAdmin: isAuthorizedAdmin,
        });
      }
    }, 60 * 1000);

    return () => {
      active = false;
      window.removeEventListener('hashchange', handleHashChange);
      window.clearInterval(heartbeatId);
    };
  }, [authLoading, isAuthorizedAdmin, showAdmin]);

  // Persist local cache whenever state modifies
  useEffect(() => {
    try {
      localStorage.setItem('atharv_profile', JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile to localStorage:', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_stats', JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save stats to localStorage:', e);
    }
  }, [stats]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_links', JSON.stringify(links));
    } catch (e) {
      console.error('Failed to save links to localStorage:', e);
    }
  }, [links]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_photos', JSON.stringify(photos));
    } catch (e) {
      console.error('Failed to save photos to localStorage:', e);
    }
  }, [photos]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_projects', JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects to localStorage:', e);
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_videos', JSON.stringify(videos));
    } catch (e) {
      console.error('Failed to save videos to localStorage:', e);
    }
  }, [videos]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_downloads', JSON.stringify(downloads));
    } catch (e) {
      console.error('Failed to save downloads to localStorage:', e);
    }
  }, [downloads]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites to localStorage:', e);
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_blogs', JSON.stringify(blogs));
    } catch (e) {
      console.error('Failed to save blogs to localStorage:', e);
    }
  }, [blogs]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_timeline', JSON.stringify(timeline));
    } catch (e) {
      console.error('Failed to save timeline to localStorage:', e);
    }
  }, [timeline]);

  useEffect(() => {
    try {
      localStorage.setItem('atharv_games', JSON.stringify(games));
    } catch (e) {
      console.error('Failed to save games to localStorage:', e);
    }
  }, [games]);

  // Helper for authorized admins saving site content to Firestore
  const saveSectionToFirestore = useCallback(
    (sectionId: SiteContentSectionId, payload: { data?: any; items?: any[] }) => {
      if (!isAuthorizedAdmin || !user?.uid) return;
      const docPayload: Record<string, any> = {
        sectionId,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      if (payload.data !== undefined) {
        docPayload.data = sanitizeForFirestore(payload.data);
      }
      if (payload.items !== undefined) {
        docPayload.items = sanitizeForFirestore(payload.items);
      }
      setDoc(doc(db, 'siteContent', sectionId), docPayload)
        .then(() => {
          setFirestoreSyncError(null);
        })
        .catch((err) => {
          const msg = `Firestore sync failed for "${sectionId}": ${err?.message || 'Permission denied'}. Changes are cached locally in this browser until Firestore rules are deployed.`;
          console.warn(msg);
          setFirestoreSyncError(msg);
        });
    },
    [isAuthorizedAdmin, user?.uid]
  );

  // Admin wrapped updaters
  const handleUpdateProfile = (next: Profile) => {
    setProfile(next);
    saveSectionToFirestore('profile', { data: next });
  };
  const handleUpdateStats = (next: Stat[]) => {
    setStats(next);
    saveSectionToFirestore('stats', { items: next });
  };
  const handleUpdateLinks = (next: ContentLink[]) => {
    setLinks(next);
    saveSectionToFirestore('links', { items: next });
  };
  const handleUpdatePhotos = (next: Photo[]) => {
    setPhotos(next);
    saveSectionToFirestore('photos', { items: next });
  };
  const handleUpdateProjects = (next: Project[]) => {
    setProjects(next);
    saveSectionToFirestore('projects', { items: next });
  };
  const handleUpdateVideos = (next: Video[]) => {
    setVideos(next);
    saveSectionToFirestore('videos', { items: next });
  };
  const handleUpdateDownloads = (next: DownloadItem[]) => {
    setDownloads(next);
    saveSectionToFirestore('downloads', { items: next });
  };
  const handleUpdateFavorites = (next: FavoriteItem[]) => {
    setFavorites(next);
    saveSectionToFirestore('favorites', { items: next });
  };
  const handleUpdateBlogs = (next: BlogPost[]) => {
    setBlogs(next);
    saveSectionToFirestore('blogs', { items: next });
  };
  const handleUpdateTimeline = (next: TimelineItem[]) => {
    setTimeline(next);
    saveSectionToFirestore('timeline', { items: next });
  };
  const handleUpdateGames = (next: Game[]) => {
    setGames(next);
    saveSectionToFirestore('arcadeGames', { items: next });
  };

  // Public interaction trackers (backed by real analytics collection, admin-excluded)
  const handleLinkClick = (id: string) => {
    if (!isAuthorizedAdmin) {
      setLinks((prev) =>
        prev.map((lnk) => (lnk.id === id ? { ...lnk, clicks: lnk.clicks + 1 } : lnk))
      );
      trackAnalyticsEvent({
        eventType: 'link_click',
        pagePath: '/#links',
        targetId: id,
        isAdmin: isAuthorizedAdmin,
      });
    }
  };

  const handleDownloadClick = (id: string, isRealDownloadUrl: boolean) => {
    if (!isAuthorizedAdmin) {
      setDownloads((prev) =>
        prev.map((dl) => (dl.id === id ? { ...dl, downloadsCount: dl.downloadsCount + 1 } : dl))
      );
      trackAnalyticsEvent({
        eventType: 'download_request',
        pagePath: '/#downloads',
        targetId: id,
        isAdmin: isAuthorizedAdmin,
      });
      if (isRealDownloadUrl) {
        trackAnalyticsEvent({
          eventType: 'download_completed',
          pagePath: '/#downloads',
          targetId: id,
          isAdmin: isAuthorizedAdmin,
        });
      }
    }
  };

  const handleBlogReadClick = (id: string) => {
    if (!isAuthorizedAdmin) {
      setBlogs((prev) =>
        prev.map((bg) => (bg.id === id ? { ...bg, reads: bg.reads + 1 } : bg))
      );
      trackAnalyticsEvent({
        eventType: 'blog_read',
        pagePath: '/#blogs',
        targetId: id,
        isAdmin: isAuthorizedAdmin,
      });
    }
  };

  const handleContactClick = (source: string) => {
    if (!isAuthorizedAdmin) {
      trackAnalyticsEvent({
        eventType: 'contact_click',
        pagePath: '/#contact',
        targetId: source,
        isAdmin: isAuthorizedAdmin,
      });
    }
  };

  // Backups export/import handlers
  const handleExportBackup = () => {
    const backupData = {
      profile,
      stats,
      links,
      photos,
      projects,
      videos,
      downloads,
      favorites,
      blogs,
      timeline,
      games,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(backupData, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'atharv_kamath_hub_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (jsonStr: string) => {
    const data = JSON.parse(jsonStr);
    if (data.profile) handleUpdateProfile(data.profile);
    if (data.stats) handleUpdateStats(data.stats);
    if (data.links) handleUpdateLinks(data.links);
    if (data.photos) handleUpdatePhotos(data.photos);
    if (data.projects) handleUpdateProjects(data.projects);
    if (data.videos) handleUpdateVideos(data.videos);
    if (data.downloads) handleUpdateDownloads(data.downloads);
    if (data.favorites) handleUpdateFavorites(data.favorites);
    if (data.blogs) handleUpdateBlogs(data.blogs);
    if (data.timeline) handleUpdateTimeline(data.timeline);
    if (data.games) handleUpdateGames(data.games);
  };

  const handleOpenAdmin = () => {
    setShowAdmin(true);
    if (isAuthorizedAdmin && !window.location.search.includes('page=admin')) {
      window.history.pushState({ admin: true }, '', '?page=admin');
    }
  };

  const handleCloseAdmin = () => {
    setShowAdmin(false);
    if (window.location.search.includes('page=admin') || window.location.hash === '#admin') {
      window.history.replaceState(null, '', '/');
    }
  };

  // Centralized Exit Admin workflow (Part 1)
  const handleExitAdmin = async () => {
    try {
      await signOutAdmin();
    } finally {
      setShowAdmin(false);
      window.history.replaceState(null, '', '/');
      const homeEl = document.getElementById('home');
      if (homeEl) {
        homeEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="bg-[#050811] text-gray-100 min-h-screen selection:bg-cyan-500 selection:text-black antialiased">
      {/* Dynamic top bar navigation driven exclusively by verified AuthContext */}
      <Navigation
        profile={profile}
        onAdminClick={handleOpenAdmin}
        isAdmin={isAuthorizedAdmin}
        onLogout={handleExitAdmin}
        showAdminTrigger={showAdminTrigger}
      />

      {/* Hero presentation screen */}
      <Hero profile={profile} />

      {/* Main flow of sections */}
      <main className="relative">
        <About
          profile={profile}
          stats={stats}
          videos={videos}
          projects={projects}
          publicVisitorSummary={publicVisitorSummary}
        />
        <ContentHub links={links} onLinkClick={handleLinkClick} />
        <Gallery photos={photos} />
        <Projects projects={projects} />
        <Videos videos={videos} />
        <Downloads downloads={downloads} onDownloadClick={handleDownloadClick} />
        <Favorites favorites={favorites} />
        <GamingZone games={games} />
        <Blogs blogs={blogs} onBlogRead={handleBlogReadClick} />
        <Timeline timeline={timeline} />
        <Contact profile={profile} onContactClick={handleContactClick} />
      </main>

      {/* Global modern styled footer bar */}
      <footer className="bg-[#04060b] py-12 border-t border-white/5 text-center text-xs text-gray-500 font-mono flex flex-col items-center gap-6">
        <div className="max-w-7xl mx-auto px-6 w-full flex flex-col items-center gap-6">
          {/* Social Links Bar */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-gray-400 font-mono text-[10px] uppercase tracking-widest">
              Connect with us on
            </span>
            <div
              id="footer-socials"
              className="flex items-center gap-4 py-2 px-5 bg-white/5 border border-white/10 rounded-full backdrop-blur-md"
            >
              {Object.entries(profile.socialLinks).map(([key, url]) => {
                if (!url) return null;
                const getSocialIcon = (k: string) => {
                  switch (k) {
                    case 'youtube':
                      return <Youtube size={18} />;
                    case 'instagram':
                      return <Instagram size={18} />;
                    case 'facebook':
                      return <Facebook size={18} />;
                    case 'github':
                      return <Github size={18} />;
                    case 'linkedin':
                      return <Linkedin size={18} />;
                    default:
                      return <Mail size={18} />;
                  }
                };
                return (
                  <a
                    key={key}
                    id={`footer-social-${key}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      if (key === 'email') {
                        handleContactClick('footer_email');
                      }
                    }}
                    className="text-gray-300 hover:text-cyan-400 transition-colors p-1.5 rounded-full hover:bg-white/5"
                    title={`Follow on ${key}`}
                  >
                    {getSocialIcon(key)}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="w-full h-px bg-white/5"></div>

          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <p
              onDoubleClick={() => {
                setShowAdminTrigger(true);
                handleOpenAdmin();
              }}
              className="cursor-pointer select-none text-gray-400 hover:text-cyan-400/75 transition-colors"
              title="Double click to open Admin portal"
            >
              © 2026.Atharv Kamath.All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const el = document.getElementById('home');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Back to Top
              </button>
              <span className="text-white/10">•</span>
              {isAuthorizedAdmin ? (
                <button
                  onClick={handleExitAdmin}
                  className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Exit Admin
                </button>
              ) : (
                <button
                  onClick={handleOpenAdmin}
                  className="hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  Admin Control Room
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Route-guarded Admin Console vs Authentication Portal */}
      {showAdmin &&
        (isAuthorizedAdmin ? (
          <AdminPanel
            onClose={handleCloseAdmin}
            onExitAdmin={handleExitAdmin}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            stats={stats}
            onUpdateStats={handleUpdateStats}
            links={links}
            onUpdateLinks={handleUpdateLinks}
            photos={photos}
            onUpdatePhotos={handleUpdatePhotos}
            projects={projects}
            onUpdateProjects={handleUpdateProjects}
            videos={videos}
            onUpdateVideos={handleUpdateVideos}
            downloads={downloads}
            onUpdateDownloads={handleUpdateDownloads}
            blogs={blogs}
            onUpdateBlogs={handleUpdateBlogs}
            timeline={timeline}
            onUpdateTimeline={handleUpdateTimeline}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            games={games}
            onUpdateGames={handleUpdateGames}
            favorites={favorites}
            onUpdateFavorites={handleUpdateFavorites}
            firestoreSyncError={firestoreSyncError}
          />
        ) : (
          <AdminAuthModal onClose={handleCloseAdmin} />
        ))}

      {/* Interactive AI Chatbot */}
      <Chatbot />
    </div>
  );
}
