/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Layout,
  Link2,
  Image,
  Cpu,
  Video,
  FileDown,
  BookOpen,
  Mail,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle,
  TrendingUp,
  Sliders,
  Download,
  Upload,
  Gamepad2,
  Heart,
  Star,
  UserCheck,
  Users,
  Activity,
  Settings,
  LogOut,
  Calendar,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Globe,
  Sparkles,
} from 'lucide-react';
import {
  Profile,
  Stat,
  ContentLink,
  Photo,
  Project,
  Video as VideoType,
  DownloadItem,
  BlogPost,
  TimelineItem,
  PlatformType,
  Game,
  FavoriteItem,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabel, hasAnyContentPermission } from '../utils/permissions';
import OwnerRequestsTab from './admin/OwnerRequestsTab';
import AdminManagementTab from './admin/AdminManagementTab';
import ActivityLogsTab from './admin/ActivityLogsTab';
import GamingUploadManager from './admin/GamingUploadManager';
import DirectInquiriesTab from './admin/DirectInquiriesTab';
import OwnerAnalyticsPanel from './admin/OwnerAnalyticsPanel';

interface AdminPanelProps {
  onClose: () => void;
  onExitAdmin: () => Promise<void>;
  profile: Profile;
  onUpdateProfile: (p: Profile) => void;
  stats: Stat[];
  onUpdateStats: (s: Stat[]) => void;
  links: ContentLink[];
  onUpdateLinks: (l: ContentLink[]) => void;
  photos: Photo[];
  onUpdatePhotos: (ph: Photo[]) => void;
  projects: Project[];
  onUpdateProjects: (pr: Project[]) => void;
  videos: VideoType[];
  onUpdateVideos: (v: VideoType[]) => void;
  downloads: DownloadItem[];
  onUpdateDownloads: (d: DownloadItem[]) => void;
  blogs: BlogPost[];
  onUpdateBlogs: (b: BlogPost[]) => void;
  timeline: TimelineItem[];
  onUpdateTimeline: (t: TimelineItem[]) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonStr: string) => void;
  games: Game[];
  onUpdateGames: (g: Game[]) => void;
  favorites: FavoriteItem[];
  onUpdateFavorites: (f: FavoriteItem[]) => void;
  firestoreSyncError?: string | null;
}

type MainTab =
  | 'dashboard'
  | 'content'
  | 'gaming'
  | 'messages'
  | 'requests'
  | 'admins'
  | 'logs'
  | 'settings';

type ContentSubTab =
  | 'profile'
  | 'links'
  | 'gallery'
  | 'projects'
  | 'videos'
  | 'downloads'
  | 'blogs'
  | 'journey';

export default function AdminPanel({
  onClose,
  onExitAdmin,
  profile,
  onUpdateProfile,
  stats,
  onUpdateStats,
  links,
  onUpdateLinks,
  photos,
  onUpdatePhotos,
  projects,
  onUpdateProjects,
  videos,
  onUpdateVideos,
  downloads,
  onUpdateDownloads,
  blogs,
  onUpdateBlogs,
  timeline,
  onUpdateTimeline,
  onExportBackup,
  onImportBackup,
  games,
  onUpdateGames,
  favorites,
  onUpdateFavorites,
  firestoreSyncError,
}: AdminPanelProps) {
  const { user, adminProfile, isOwner, isAuthorizedAdmin, hasPermission, firestoreAuthError } = useAuth();

  const canViewContent = hasAnyContentPermission(adminProfile, isOwner);
  const canViewGaming = hasPermission('gamingZone', 'view');
  const canViewInquiries = hasPermission('directInquiry', 'view');
  const canViewSettings = isOwner || adminProfile?.role === 'full_admin';

  const canViewHome = hasPermission('home', 'view');
  const canEditHome = hasPermission('home', 'edit');
  const canViewAbout = hasPermission('about', 'view');
  const canCreateAbout = hasPermission('about', 'create');
  const canEditAbout = hasPermission('about', 'edit');
  const canDeleteAbout = hasPermission('about', 'delete');
  const canViewContact = hasPermission('contact', 'view');
  const canEditContact = hasPermission('contact', 'edit');

  const canViewVideos = hasPermission('videos', 'view') || hasPermission('links', 'view');
  const canCreateVideos = hasPermission('videos', 'create') || hasPermission('links', 'create');
  const canEditVideos = hasPermission('videos', 'edit') || hasPermission('links', 'edit');
  const canDeleteVideos = hasPermission('videos', 'delete') || hasPermission('links', 'delete');

  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [contentSubTab, setContentSubTab] = useState<ContentSubTab>('profile');
  const [librarySubTab, setLibrarySubTab] = useState<'assets' | 'favorites'>('assets');
  const [successNotice, setSuccessNotice] = useState('');
  const [systemStatus, setSystemStatus] = useState<{
    emailConfigured: boolean;
    emailProvider?: string;
    adminSdkConfigured: boolean;
    ownerEmail: string;
    maxGameSizeMb: number;
    storageQuotaMb: number;
  } | null>(null);

  // Sync default allowed content sub-tab
  const allowedContentSubTabs: { id: ContentSubTab; label: string; allowed: boolean }[] = [
    {
      id: 'profile',
      label: 'Home, About & Contact',
      allowed: canViewHome || canViewAbout || canViewContact,
    },
    { id: 'links', label: 'Links', allowed: hasPermission('links', 'view') },
    { id: 'videos', label: 'Videos', allowed: canViewVideos },
    { id: 'gallery', label: 'Gallery', allowed: hasPermission('gallery', 'view') },
    { id: 'projects', label: 'Projects', allowed: hasPermission('projects', 'view') },
    { id: 'downloads', label: 'Library & Favorites', allowed: hasPermission('library', 'view') },
    { id: 'blogs', label: 'Blogs', allowed: hasPermission('blogs', 'view') },
    { id: 'journey', label: 'Journey', allowed: hasPermission('journey', 'view') },
  ];

  useEffect(() => {
    const firstAllowed = allowedContentSubTabs.find((t) => t.allowed);
    if (firstAllowed && !allowedContentSubTabs.find((t) => t.id === contentSubTab && t.allowed)) {
      setContentSubTab(firstAllowed.id);
    }
  }, [adminProfile, isOwner]);

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then(setSystemStatus)
      .catch(() => {});
  }, []);

  // Form States
  const [profileForm, setProfileForm] = useState<Profile>({
    ...profile,
    titles: profile.titles || [],
    banners: profile.banners || [],
    socialLinks: profile.socialLinks || {},
  });
  useEffect(() => {
    setProfileForm({
      ...profile,
      titles: profile.titles || [],
      banners: profile.banners || [],
      socialLinks: profile.socialLinks || {},
    });
  }, [profile]);

  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState<Omit<ContentLink, 'id' | 'clicks'>>({
    title: '',
    description: '',
    url: '',
    platform: 'youtube',
    category: 'Vlogs',
  });

  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [photoForm, setPhotoForm] = useState<Omit<Photo, 'id'>>({
    url: '',
    title: '',
    category: 'Travel',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<Omit<Project, 'id'>>({
    title: '',
    description: '',
    image: '',
    tags: [],
    demoUrl: '',
    githubUrl: '',
    featured: false,
  });
  const [projectTagsInput, setProjectTagsInput] = useState('');

  const [showAddVideoForm, setShowAddVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState<Omit<VideoType, 'id'>>({
    title: '',
    description: '',
    youtubeId: '',
    category: 'Vlogs',
    thumbnailUrl: '',
  });

  const [showAddDownloadForm, setShowAddDownloadForm] = useState(false);
  const [editingDownloadId, setEditingDownloadId] = useState<string | null>(null);
  const [downloadForm, setDownloadForm] = useState<Omit<DownloadItem, 'id' | 'downloadsCount'>>({
    title: '',
    description: '',
    fileSize: '1.0 MB',
    fileType: 'PDF',
    category: 'Notes',
    downloadUrl: '#',
  });

  const [showAddBlogForm, setShowAddBlogForm] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [blogForm, setBlogForm] = useState<Omit<BlogPost, 'id' | 'reads'>>({
    title: '',
    excerpt: '',
    content: '',
    coverImage: '',
    category: 'Technology',
    date: new Date().toISOString().split('T')[0],
  });

  const [showAddFavForm, setShowAddFavForm] = useState(false);
  const [editingFavId, setEditingFavId] = useState<string | null>(null);
  const [favForm, setFavForm] = useState<Omit<FavoriteItem, 'id'>>({
    title: '',
    category: 'Gadget',
    rating: 5,
    description: '',
    image: '',
  });

  const [showAddJourneyForm, setShowAddJourneyForm] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [journeyForm, setJourneyForm] = useState<Omit<TimelineItem, 'id'>>({
    year: String(new Date().getFullYear()),
    title: '',
    subtitle: '',
    description: '',
  });

  if (!isAuthorizedAdmin) {
    return null;
  }

  const triggerNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Base64 Image Compression Helper (preserved from original)
  const handleDeviceFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (base64Url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.75));
          } else {
            callback(reader.result as string);
          }
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase() || 'ZIP';
    const sizeInMB = file.size / (1024 * 1024);
    const sizeStr =
      sizeInMB < 0.1 ? (file.size / 1024).toFixed(1) + ' KB' : sizeInMB.toFixed(1) + ' MB';
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDownloadForm({
          ...downloadForm,
          downloadUrl: reader.result,
          fileType: ext,
          fileSize: sizeStr,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // CRUD Handlers
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedProfile: Profile = {
      ...profileForm,
      titles: (profileForm.titles || []).map((t) => t.trim()).filter(Boolean),
      banners: (profileForm.banners || []).map((b) => b.trim()).filter(Boolean),
    };
    onUpdateProfile(sanitizedProfile);
    triggerNotice('Home, About & Contact specifications saved.');
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.title || !linkForm.url) return;
    if (editingLinkId) {
      onUpdateLinks(
        links.map((l) => (l.id === editingLinkId ? { ...l, ...linkForm } : l))
      );
      setEditingLinkId(null);
      triggerNotice('Content link updated.');
    } else {
      onUpdateLinks([{ id: `link-${Date.now()}`, ...linkForm, clicks: 0 }, ...links]);
      triggerNotice('New content link registered.');
    }
    setLinkForm({ title: '', description: '', url: '', platform: 'youtube', category: 'Vlogs' });
    setShowAddLinkForm(false);
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoForm.url || !photoForm.title) return;
    if (editingPhotoId) {
      onUpdatePhotos(
        photos.map((p) => (p.id === editingPhotoId ? { ...p, ...photoForm } : p))
      );
      setEditingPhotoId(null);
      triggerNotice('Photograph updated.');
    } else {
      onUpdatePhotos([{ id: `photo-${Date.now()}`, ...photoForm }, ...photos]);
      triggerNotice('New photograph added to gallery.');
    }
    setPhotoForm({ url: '', title: '', category: 'Travel', date: new Date().toISOString().split('T')[0], description: '' });
    setShowAddPhotoForm(false);
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title || !projectForm.description) return;
    const tagsArray = projectTagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const resolvedTags = tagsArray.length ? tagsArray : ['React'];
    if (editingProjectId) {
      onUpdateProjects(
        projects.map((p) =>
          p.id === editingProjectId ? { ...p, ...projectForm, tags: resolvedTags } : p
        )
      );
      setEditingProjectId(null);
      triggerNotice('Project portfolio entry updated.');
    } else {
      onUpdateProjects([
        { id: `project-${Date.now()}`, ...projectForm, tags: resolvedTags },
        ...projects,
      ]);
      triggerNotice('Project portfolio entry registered.');
    }
    setProjectForm({ title: '', description: '', image: '', tags: [], demoUrl: '', githubUrl: '', featured: false });
    setProjectTagsInput('');
    setShowAddProjectForm(false);
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoForm.title || !videoForm.youtubeId) return;
    if (editingVideoId) {
      onUpdateVideos(
        videos.map((v) => (v.id === editingVideoId ? { ...v, ...videoForm } : v))
      );
      setEditingVideoId(null);
      triggerNotice('Video entry updated.');
    } else {
      onUpdateVideos([{ id: `video-${Date.now()}`, ...videoForm }, ...videos]);
      triggerNotice('New YouTube video added.');
    }
    setVideoForm({ title: '', description: '', youtubeId: '', category: 'Vlogs', thumbnailUrl: '' });
    setShowAddVideoForm(false);
  };

  const handleAddDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadForm.title) return;
    if (editingDownloadId) {
      onUpdateDownloads(
        downloads.map((d) => (d.id === editingDownloadId ? { ...d, ...downloadForm } : d))
      );
      setEditingDownloadId(null);
      triggerNotice('Resource library file updated.');
    } else {
      onUpdateDownloads([{ id: `dl-${Date.now()}`, ...downloadForm, downloadsCount: 0 }, ...downloads]);
      triggerNotice('Resource library file registered.');
    }
    setDownloadForm({ title: '', description: '', fileSize: '1.0 MB', fileType: 'PDF', category: 'Notes', downloadUrl: '#' });
    setShowAddDownloadForm(false);
  };

  const handleAddBlog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogForm.title || !blogForm.content) return;
    if (editingBlogId) {
      onUpdateBlogs(
        blogs.map((b) => (b.id === editingBlogId ? { ...b, ...blogForm } : b))
      );
      setEditingBlogId(null);
      triggerNotice('Blog article updated.');
    } else {
      onUpdateBlogs([{ id: `blog-${Date.now()}`, ...blogForm, reads: 0 }, ...blogs]);
      triggerNotice('New blog article published.');
    }
    setBlogForm({ title: '', excerpt: '', content: '', coverImage: '', category: 'Technology', date: new Date().toISOString().split('T')[0] });
    setShowAddBlogForm(false);
  };

  const handleAddFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!favForm.title) return;
    if (editingFavId) {
      onUpdateFavorites(favorites.map((f) => (f.id === editingFavId ? { ...f, ...favForm } : f)));
      triggerNotice('Favorite item updated.');
      setEditingFavId(null);
    } else {
      onUpdateFavorites([{ id: `fav-${Date.now()}`, ...favForm }, ...favorites]);
      triggerNotice('New favorite item curated.');
    }
    setFavForm({ title: '', category: 'Gadget', rating: 5, description: '', image: '' });
    setShowAddFavForm(false);
  };

  const handleAddJourney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journeyForm.title || !journeyForm.year) return;
    if (editingJourneyId) {
      onUpdateTimeline(
        timeline.map((t) => (t.id === editingJourneyId ? { ...t, ...journeyForm } : t))
      );
      setEditingJourneyId(null);
      triggerNotice('Timeline milestone updated.');
    } else {
      onUpdateTimeline([{ id: `tl-${Date.now()}`, ...journeyForm }, ...timeline]);
      triggerNotice('Timeline milestone added.');
    }
    setJourneyForm({ year: String(new Date().getFullYear()), title: '', subtitle: '', description: '' });
    setShowAddJourneyForm(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        onImportBackup(evt.target?.result as string);
        triggerNotice('Backup restore applied successfully!');
      } catch {
        triggerNotice('Failed to parse backup JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Sidebar items filtered strictly by RBAC permissions
  const sidebarItems: { id: MainTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: <Sliders size={14} />, visible: true },
    { id: 'content', label: 'Content Management', icon: <Layout size={14} />, visible: canViewContent },
    { id: 'gaming', label: 'Gaming Zone Management', icon: <Gamepad2 size={14} />, visible: canViewGaming },
    { id: 'messages', label: 'Direct Inquiries', icon: <Mail size={14} />, visible: canViewInquiries },
    { id: 'requests', label: 'Admin Requests', icon: <UserCheck size={14} />, visible: isOwner },
    { id: 'admins', label: 'Admin Management', icon: <Users size={14} />, visible: isOwner },
    { id: 'logs', label: 'Activity Logs', icon: <Activity size={14} />, visible: isOwner },
    { id: 'settings', label: 'Settings', icon: <Settings size={14} />, visible: canViewSettings },
  ];

  const currentRoleLabel = isOwner
    ? 'Owner / Super Admin'
    : formatRoleLabel(adminProfile?.role || 'limited_admin');

  return (
    <div
      id="admin-overlay"
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 overflow-y-auto p-3 md:p-6 flex items-center justify-center"
    >
      <div className="bg-[#0b0f19] border border-white/10 rounded-3xl w-full max-w-7xl h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-up">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-[#080b13] border-b md:border-b-0 md:border-r border-white/5 p-5 flex flex-col justify-between overflow-y-auto flex-shrink-0">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  <ShieldCheck size={14} />
                  Admin Room
                </span>
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="mt-2.5 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                <div className="text-xs font-bold text-white truncate">
                  {adminProfile?.name || user?.displayName || 'Administrator'}
                </div>
                <div className="text-[10px] font-mono text-gray-400 truncate">{user?.email}</div>
                <span className="inline-block mt-1 px-2 py-0.5 bg-cyan-500/15 text-cyan-300 rounded font-mono text-[9px] font-bold">
                  {currentRoleLabel}
                </span>
              </div>
            </div>

            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {sidebarItems
                .filter((i) => i.visible)
                .map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-left whitespace-nowrap transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-cyan-500 text-black font-bold shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
            </nav>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-2 hidden md:block">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Minimize to Site
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
            >
              <LogOut size={13} /> Exit Admin
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-grow flex flex-col min-w-0 bg-[#0a0d16]">
          <header className="p-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-[#080b13]/40">
            <h2 className="text-white font-sans font-black text-base md:text-lg tracking-tight uppercase">
              {sidebarItems.find((s) => s.id === activeTab)?.label || 'Dashboard'}
            </h2>

            <div className="flex items-center gap-3">
              {successNotice && (
                <div className="flex items-center gap-1.5 py-1 px-3 bg-green-500/15 border border-green-500/30 text-green-400 font-mono text-[11px] rounded-lg animate-fade-in">
                  <CheckCircle size={12} /> {successNotice}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                View Site
              </button>
              <button
                type="button"
                onClick={onExitAdmin}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
              >
                <LogOut size={13} /> Exit Admin
              </button>
            </div>
          </header>

          <div className="p-5 md:p-6 overflow-y-auto flex-grow space-y-6">
            {(firestoreAuthError || firestoreSyncError) && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-start gap-3">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
                <div className="space-y-1">
                  <div className="font-bold text-red-200">Firestore Sync / Rules Warning</div>
                  <p className="leading-relaxed">{firestoreAuthError || firestoreSyncError}</p>
                </div>
              </div>
            )}

            {/* === 1. DASHBOARD OVERVIEW === */}
            {activeTab === 'dashboard' && (
              <OwnerAnalyticsPanel
                profile={profile}
                links={links}
                projects={projects}
                photos={photos}
                videos={videos}
                downloads={downloads}
                blogs={blogs}
                currentRoleLabel={currentRoleLabel}
              />
            )}

            {/* === 2. CONTENT MANAGEMENT === */}
            {activeTab === 'content' && canViewContent && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
                  {allowedContentSubTabs
                    .filter((t) => t.allowed)
                    .map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setContentSubTab(sub.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          contentSubTab === sub.id
                            ? 'bg-cyan-500 text-black'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                </div>

                {/* PROFILE / HOME / ABOUT / CONTACT */}
                {contentSubTab === 'profile' && (
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    {/* HOME CONTENT (Banners, Rotating Titles, Brand Logo) */}
                    {canViewHome && (
                      <div className="bg-[#0c1220]/60 border border-white/5 p-5 rounded-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Sparkles size={15} className="text-cyan-400" /> Home Hero, Titles &amp; Brand Logo
                          </h3>
                          {!canEditHome && (
                            <span className="text-[10px] font-mono text-gray-500 uppercase">View Only</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                              Brand Logo URL / Device Upload
                            </label>
                            <div className="flex items-start gap-3">
                              {profileForm.logoUrl && (
                                <img
                                  src={profileForm.logoUrl}
                                  alt="Brand logo preview"
                                  className="w-12 h-12 rounded-xl object-contain bg-black/40 border border-white/10 p-1 flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 space-y-2">
                                <input
                                  type="text"
                                  disabled={!canEditHome}
                                  value={profileForm.logoUrl || ''}
                                  onChange={(e) => setProfileForm({ ...profileForm, logoUrl: e.target.value })}
                                  placeholder="https://..."
                                  className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono disabled:opacity-60"
                                />
                                {canEditHome && (
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleDeviceFileUpload(e, (base64) =>
                                        setProfileForm({ ...profileForm, logoUrl: base64 })
                                      )
                                    }
                                    className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-gray-400 text-xs font-semibold uppercase">
                                Hero Rotating Titles
                              </label>
                              {canEditHome && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProfileForm({
                                      ...profileForm,
                                      titles: [...(profileForm.titles || []), ''],
                                    })
                                  }
                                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus size={12} /> Add Title
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {(profileForm.titles || []).map((t, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    disabled={!canEditHome}
                                    value={t}
                                    onChange={(e) => {
                                      const nextTitles = [...(profileForm.titles || [])];
                                      nextTitles[idx] = e.target.value;
                                      setProfileForm({ ...profileForm, titles: nextTitles });
                                    }}
                                    placeholder={`Title #${idx + 1}`}
                                    className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white disabled:opacity-60"
                                  />
                                  {canEditHome && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setProfileForm({
                                          ...profileForm,
                                          titles: (profileForm.titles || []).filter((_, i) => i !== idx),
                                        })
                                      }
                                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg cursor-pointer"
                                      title="Remove title"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Hero Banners */}
                        <div className="space-y-3 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <label className="text-gray-400 text-xs font-semibold uppercase">
                              Hero Background Banners ({(profileForm.banners || []).length})
                            </label>
                            {canEditHome && (
                              <button
                                type="button"
                                onClick={() =>
                                  setProfileForm({
                                    ...profileForm,
                                    banners: [...(profileForm.banners || []), ''],
                                  })
                                }
                                className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} /> Add Banner
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            {(profileForm.banners || []).map((bannerUrl, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-[#070a11] border border-white/10 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3"
                              >
                                {bannerUrl && (
                                  <img
                                    src={bannerUrl}
                                    alt={`Banner ${idx + 1}`}
                                    className="w-24 h-14 rounded-lg object-cover bg-black/40 border border-white/10 flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 w-full space-y-1.5">
                                  <input
                                    type="text"
                                    disabled={!canEditHome}
                                    value={bannerUrl}
                                    onChange={(e) => {
                                      const nextBanners = [...(profileForm.banners || [])];
                                      nextBanners[idx] = e.target.value;
                                      setProfileForm({ ...profileForm, banners: nextBanners });
                                    }}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono disabled:opacity-60"
                                  />
                                  {canEditHome && (
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleDeviceFileUpload(e, (base64) => {
                                          const nextBanners = [...(profileForm.banners || [])];
                                          nextBanners[idx] = base64;
                                          setProfileForm({ ...profileForm, banners: nextBanners });
                                        })
                                      }
                                      className="w-full text-[11px] text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                                    />
                                  )}
                                </div>
                                {canEditHome && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => {
                                        const nextBanners = [...(profileForm.banners || [])];
                                        [nextBanners[idx - 1], nextBanners[idx]] = [
                                          nextBanners[idx],
                                          nextBanners[idx - 1],
                                        ];
                                        setProfileForm({ ...profileForm, banners: nextBanners });
                                      }}
                                      className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg disabled:opacity-30 cursor-pointer"
                                      title="Move up"
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === (profileForm.banners || []).length - 1}
                                      onClick={() => {
                                        const nextBanners = [...(profileForm.banners || [])];
                                        [nextBanners[idx + 1], nextBanners[idx]] = [
                                          nextBanners[idx],
                                          nextBanners[idx + 1],
                                        ];
                                        setProfileForm({ ...profileForm, banners: nextBanners });
                                      }}
                                      className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg disabled:opacity-30 cursor-pointer"
                                      title="Move down"
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setProfileForm({
                                          ...profileForm,
                                          banners: (profileForm.banners || []).filter((_, i) => i !== idx),
                                        })
                                      }
                                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg cursor-pointer"
                                      title="Remove banner"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ABOUT SECTION (Profile, Bio, Mission, Photo, Stats) */}
                    {canViewAbout && (
                      <div className="bg-[#0c1220]/60 border border-white/5 p-5 rounded-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <h3 className="text-white font-bold text-sm">About &amp; Identity Profile</h3>
                          {!canEditAbout && (
                            <span className="text-[10px] font-mono text-gray-500 uppercase">View Only</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                              Creator Name
                            </label>
                            <input
                              type="text"
                              disabled={!canEditAbout}
                              value={profileForm.name}
                              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                              className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white disabled:opacity-60"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                              Profile Photo URL / Device Upload
                            </label>
                            <div className="flex items-start gap-3">
                              {profileForm.profilePhoto && (
                                <img
                                  src={profileForm.profilePhoto}
                                  alt="Profile preview"
                                  className="w-12 h-12 rounded-xl object-cover bg-black/40 border border-white/10 flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 space-y-2">
                                <input
                                  type="text"
                                  disabled={!canEditAbout}
                                  value={profileForm.profilePhoto}
                                  onChange={(e) =>
                                    setProfileForm({ ...profileForm, profilePhoto: e.target.value })
                                  }
                                  className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono disabled:opacity-60"
                                />
                                {canEditAbout && (
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleDeviceFileUpload(e, (base64) =>
                                        setProfileForm({ ...profileForm, profilePhoto: base64 })
                                      )
                                    }
                                    className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                            Biography (About Me)
                          </label>
                          <textarea
                            rows={4}
                            disabled={!canEditAbout}
                            value={profileForm.bio}
                            onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white resize-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                            Mission Statement
                          </label>
                          <textarea
                            rows={3}
                            disabled={!canEditAbout}
                            value={profileForm.mission}
                            onChange={(e) => setProfileForm({ ...profileForm, mission: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white resize-none disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                            Content Creation Start Date (Used to Compute Years of Content Creation Dynamically)
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              type="date"
                              disabled={!canEditAbout}
                              value={profileForm.contentCreationStartDate || ''}
                              onChange={(e) =>
                                setProfileForm({
                                  ...profileForm,
                                  contentCreationStartDate: e.target.value,
                                })
                              }
                              className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono disabled:opacity-60"
                            />
                            {canEditAbout && profileForm.contentCreationStartDate && (
                              <button
                                type="button"
                                onClick={() =>
                                  setProfileForm({
                                    ...profileForm,
                                    contentCreationStartDate: '',
                                  })
                                }
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-mono cursor-pointer"
                              >
                                Clear Date (Shows &quot;Not available&quot;)
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stats Counters Editor */}
                        <div className="pt-3 border-t border-white/5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className="text-gray-300 font-bold text-xs uppercase tracking-wider">
                                About Stats Counters (Legacy Reference)
                              </h4>
                              <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                                Public About page displays live verified counts (Videos, Published Projects, Years from start date).
                              </p>
                            </div>
                            {canCreateAbout && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateStats([
                                    ...stats,
                                    {
                                      id: `stat-${Date.now()}`,
                                      label: 'New Milestone',
                                      value: 1,
                                      suffix: '+',
                                      iconName: 'Award',
                                    },
                                  ])
                                }
                                className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} /> Add Stat Counter
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {stats.map((st, idx) => (
                              <div key={st.id} className="p-3 bg-[#070a11] border border-white/10 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    disabled={!canEditAbout}
                                    value={st.label}
                                    onChange={(e) => {
                                      const next = [...stats];
                                      next[idx] = { ...st, label: e.target.value };
                                      onUpdateStats(next);
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white disabled:opacity-60"
                                  />
                                  {canDeleteAbout && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onUpdateStats(stats.filter((s) => s.id !== st.id));
                                        triggerNotice('Stat counter removed.');
                                      }}
                                      className="p-1.5 hover:bg-red-500/15 text-red-400 rounded-lg cursor-pointer"
                                      title="Delete stat"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    disabled={!canEditAbout}
                                    value={st.value}
                                    onChange={(e) => {
                                      const next = [...stats];
                                      next[idx] = { ...st, value: Number(e.target.value) || 0 };
                                      onUpdateStats(next);
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-cyan-400 font-mono disabled:opacity-60"
                                  />
                                  <input
                                    type="text"
                                    disabled={!canEditAbout}
                                    value={st.suffix}
                                    onChange={(e) => {
                                      const next = [...stats];
                                      next[idx] = { ...st, suffix: e.target.value };
                                      onUpdateStats(next);
                                    }}
                                    placeholder="+"
                                    className="w-16 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CONTACT INFO & SOCIAL LINKS */}
                    {canViewContact && (
                      <div className="bg-[#0c1220]/60 border border-white/5 p-5 rounded-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Globe size={15} className="text-cyan-400" /> Contact Info &amp; Social Profiles
                          </h3>
                          {!canEditContact && (
                            <span className="text-[10px] font-mono text-gray-500 uppercase">View Only</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                              Public Contact Email
                            </label>
                            <input
                              type="email"
                              disabled={!canEditContact}
                              value={profileForm.email}
                              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                              className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 text-xs font-semibold uppercase mb-2">
                              Location
                            </label>
                            <input
                              type="text"
                              disabled={!canEditContact}
                              value={profileForm.location}
                              onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                              className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white disabled:opacity-60"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-white/5">
                          {(
                            [
                              ['youtube', 'YouTube URL'],
                              ['instagram', 'Instagram URL'],
                              ['facebook', 'Facebook URL'],
                              ['github', 'GitHub URL'],
                              ['linkedin', 'LinkedIn URL'],
                              ['email', 'Social Email (mailto:...)'],
                            ] as const
                          ).map(([key, label]) => (
                            <div key={key}>
                              <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1.5">
                                {label}
                              </label>
                              <input
                                type="text"
                                disabled={!canEditContact}
                                value={profileForm.socialLinks?.[key] || ''}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    socialLinks: {
                                      ...(profileForm.socialLinks || {}),
                                      [key]: e.target.value,
                                    },
                                  })
                                }
                                placeholder="https://..."
                                className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono disabled:opacity-60"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(canEditHome || canEditAbout || canEditContact) && (
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl cursor-pointer shadow-lg"
                      >
                        <Save size={14} /> Save Home, About &amp; Contact Changes
                      </button>
                    )}
                  </form>
                )}

                {/* LINKS */}
                {contentSubTab === 'links' && (
                  <div className="space-y-6">
                    {hasPermission('links', 'create') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLinkId(null);
                          setLinkForm({ title: '', description: '', url: '', platform: 'youtube', category: 'Vlogs' });
                          setShowAddLinkForm(!showAddLinkForm);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
                      >
                        <Plus size={14} /> {showAddLinkForm && !editingLinkId ? 'Close Form' : 'Register New Link'}
                      </button>
                    )}
                    {showAddLinkForm && (
                      <form onSubmit={handleAddLink} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {editingLinkId ? 'Edit Content Link' : 'New Content Link'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            required
                            placeholder="Link Title"
                            value={linkForm.title}
                            onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <input
                            type="url"
                            required
                            placeholder="https://..."
                            value={linkForm.url}
                            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                          <select
                            value={linkForm.platform}
                            onChange={(e) => setLinkForm({ ...linkForm, platform: e.target.value as PlatformType })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          >
                            <option value="youtube">YouTube</option>
                            <option value="instagram">Instagram</option>
                            <option value="facebook">Facebook</option>
                            <option value="github">GitHub</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="spotify">Spotify</option>
                            <option value="drive">Drive</option>
                            <option value="website">Website</option>
                            <option value="generic">Generic</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Category"
                            value={linkForm.category}
                            onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Brief description"
                          value={linkForm.description}
                          onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLinkId(null);
                              setShowAddLinkForm(false);
                            }}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                            {editingLinkId ? 'Save Changes' : 'Register Link'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5">
                      {links.map((lnk) => (
                        <div key={lnk.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                          <div className="min-w-0 flex-grow">
                            <h4 className="text-white font-bold truncate">{lnk.title}</h4>
                            <span className="text-[10px] text-cyan-400/80">{lnk.platform} • {lnk.category}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasPermission('links', 'edit') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLinkId(lnk.id);
                                  setLinkForm({
                                    title: lnk.title,
                                    description: lnk.description,
                                    url: lnk.url,
                                    platform: lnk.platform,
                                    category: lnk.category,
                                  });
                                  setShowAddLinkForm(true);
                                }}
                                className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                                title="Edit link"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {hasPermission('links', 'delete') && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateLinks(links.filter((l) => l.id !== lnk.id));
                                  triggerNotice('Link removed.');
                                }}
                                className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                                title="Delete link"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VIDEOS */}
                {contentSubTab === 'videos' && (
                  <div className="space-y-6">
                    {canCreateVideos && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVideoId(null);
                          setVideoForm({ title: '', description: '', youtubeId: '', category: 'Vlogs', thumbnailUrl: '' });
                          setShowAddVideoForm(!showAddVideoForm);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
                      >
                        <Plus size={14} /> {showAddVideoForm && !editingVideoId ? 'Close Form' : 'Register YouTube Video'}
                      </button>
                    )}
                    {showAddVideoForm && (
                      <form onSubmit={handleAddVideo} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {editingVideoId ? 'Edit YouTube Video' : 'Add YouTube Video'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            required
                            placeholder="Video Title"
                            value={videoForm.title}
                            onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <input
                            type="text"
                            required
                            placeholder="YouTube Video ID or URL"
                            value={videoForm.youtubeId}
                            onChange={(e) => setVideoForm({ ...videoForm, youtubeId: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                          <select
                            value={videoForm.category}
                            onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value as any })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          >
                            <option value="Vlogs">Vlogs</option>
                            <option value="Tech">Tech</option>
                            <option value="Gaming">Gaming</option>
                            <option value="Music">Music</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Custom Thumbnail URL (optional)"
                            value={videoForm.thumbnailUrl || ''}
                            onChange={(e) => setVideoForm({ ...videoForm, thumbnailUrl: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Short description"
                          value={videoForm.description}
                          onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVideoId(null);
                              setShowAddVideoForm(false);
                            }}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                            {editingVideoId ? 'Save Changes' : 'Save Video'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5">
                      {videos.map((vd) => (
                        <div key={vd.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                          <div className="min-w-0 flex-grow">
                            <h4 className="text-white font-bold truncate">{vd.title}</h4>
                            <span className="text-[10px] text-cyan-400/80">{vd.category} • {vd.youtubeId}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {canEditVideos && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVideoId(vd.id);
                                  setVideoForm({
                                    title: vd.title,
                                    description: vd.description,
                                    youtubeId: vd.youtubeId,
                                    category: vd.category,
                                    thumbnailUrl: vd.thumbnailUrl || '',
                                  });
                                  setShowAddVideoForm(true);
                                }}
                                className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                                title="Edit video"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {canDeleteVideos && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateVideos(videos.filter((v) => v.id !== vd.id));
                                  triggerNotice('Video removed.');
                                }}
                                className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                                title="Delete video"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GALLERY */}
                {contentSubTab === 'gallery' && (
                  <div className="space-y-6">
                    {hasPermission('gallery', 'create') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPhotoId(null);
                          setPhotoForm({ url: '', title: '', category: 'Travel', date: new Date().toISOString().split('T')[0], description: '' });
                          setShowAddPhotoForm(!showAddPhotoForm);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
                      >
                        <Plus size={14} /> {showAddPhotoForm && !editingPhotoId ? 'Close Form' : 'Upload New Photo'}
                      </button>
                    )}
                    {showAddPhotoForm && (
                      <form onSubmit={handleAddPhoto} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {editingPhotoId ? 'Edit Gallery Photo' : 'Add Gallery Photo'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            required
                            placeholder="Photo Title"
                            value={photoForm.title}
                            onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Image URL"
                            value={photoForm.url}
                            onChange={(e) => setPhotoForm({ ...photoForm, url: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleDeviceFileUpload(e, (b64) => setPhotoForm({ ...photoForm, url: b64 }))}
                          className="w-full text-xs text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:bg-cyan-500/10 file:text-cyan-400"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <select
                            value={photoForm.category}
                            onChange={(e) => setPhotoForm({ ...photoForm, category: e.target.value as any })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          >
                            <option value="Travel">Travel</option>
                            <option value="Nature">Nature</option>
                            <option value="Tech">Tech</option>
                            <option value="Gaming Setup">Gaming Setup</option>
                            <option value="College Life">College Life</option>
                            <option value="Events">Events</option>
                            <option value="Photography">Photography</option>
                          </select>
                          <input
                            type="date"
                            value={photoForm.date}
                            onChange={(e) => setPhotoForm({ ...photoForm, date: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Photo description..."
                          value={photoForm.description || ''}
                          onChange={(e) => setPhotoForm({ ...photoForm, description: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPhotoId(null);
                              setShowAddPhotoForm(false);
                            }}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                            {editingPhotoId ? 'Save Changes' : 'Save Photo'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {photos.map((ph) => (
                        <div key={ph.id} className="relative h-32 rounded-xl overflow-hidden bg-black/40 group border border-white/5">
                          <img src={ph.url} alt={ph.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent text-[10px] font-mono text-white truncate">
                            {ph.title}
                          </div>
                          {(hasPermission('gallery', 'edit') || hasPermission('gallery', 'delete')) && (
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                              {hasPermission('gallery', 'edit') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPhotoId(ph.id);
                                    setPhotoForm({
                                      url: ph.url,
                                      title: ph.title,
                                      category: ph.category,
                                      date: ph.date,
                                      description: ph.description || '',
                                    });
                                    setShowAddPhotoForm(true);
                                  }}
                                  className="p-1.5 bg-cyan-500 text-black rounded-lg cursor-pointer"
                                  title="Edit photo"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                              {hasPermission('gallery', 'delete') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdatePhotos(photos.filter((p) => p.id !== ph.id));
                                    triggerNotice('Photo removed.');
                                  }}
                                  className="p-1.5 bg-red-500 text-white rounded-lg cursor-pointer"
                                  title="Delete photo"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PROJECTS */}
                {contentSubTab === 'projects' && (
                  <div className="space-y-6">
                    {hasPermission('projects', 'create') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProjectId(null);
                          setProjectForm({ title: '', description: '', image: '', tags: [], demoUrl: '', githubUrl: '', featured: false });
                          setProjectTagsInput('');
                          setShowAddProjectForm(!showAddProjectForm);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
                      >
                        <Plus size={14} /> {showAddProjectForm && !editingProjectId ? 'Close Form' : 'Register New Project'}
                      </button>
                    )}
                    {showAddProjectForm && (
                      <form onSubmit={handleAddProject} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {editingProjectId ? 'Edit Project Entry' : 'New Project Entry'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            required
                            placeholder="Project Title"
                            value={projectForm.title}
                            onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              placeholder="Image URL"
                              value={projectForm.image}
                              onChange={(e) => setProjectForm({ ...projectForm, image: e.target.value })}
                              className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleDeviceFileUpload(e, (b64) => setProjectForm({ ...projectForm, image: b64 }))}
                              className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                            />
                          </div>
                          <input
                            type="url"
                            placeholder="Live Demo URL"
                            value={projectForm.demoUrl}
                            onChange={(e) => setProjectForm({ ...projectForm, demoUrl: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                          <input
                            type="url"
                            placeholder="GitHub URL"
                            value={projectForm.githubUrl}
                            onChange={(e) => setProjectForm({ ...projectForm, githubUrl: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Tags (comma separated)"
                            value={projectTagsInput}
                            onChange={(e) => setProjectTagsInput(e.target.value)}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <label className="flex items-center gap-2 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={projectForm.featured}
                              onChange={(e) => setProjectForm({ ...projectForm, featured: e.target.checked })}
                            />
                            Feature on homepage
                          </label>
                        </div>
                        <textarea
                          rows={3}
                          placeholder="Short description..."
                          value={projectForm.description}
                          onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProjectId(null);
                              setShowAddProjectForm(false);
                            }}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                            {editingProjectId ? 'Save Changes' : 'Save Project'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5">
                      {projects.map((pr) => (
                        <div key={pr.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                          <div className="min-w-0 flex-grow">
                            <h4 className="text-white font-bold truncate">{pr.title}</h4>
                            <span className="text-[10px] text-cyan-400/80">
                              {pr.featured ? 'Featured' : 'Standard'} • {pr.tags.join(', ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasPermission('projects', 'edit') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProjectId(pr.id);
                                  setProjectForm({
                                    title: pr.title,
                                    description: pr.description,
                                    image: pr.image,
                                    tags: pr.tags,
                                    demoUrl: pr.demoUrl || '',
                                    githubUrl: pr.githubUrl || '',
                                    featured: pr.featured,
                                  });
                                  setProjectTagsInput(pr.tags.join(', '));
                                  setShowAddProjectForm(true);
                                }}
                                className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                                title="Edit project"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {hasPermission('projects', 'delete') && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateProjects(projects.filter((p) => p.id !== pr.id));
                                  triggerNotice('Project removed.');
                                }}
                                className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                                title="Delete project"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LIBRARY & FAVORITES */}
                {contentSubTab === 'downloads' && (
                  <div className="space-y-6">
                    <div className="flex border-b border-white/5 pb-px gap-2">
                      <button
                        type="button"
                        onClick={() => setLibrarySubTab('assets')}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 cursor-pointer ${
                          librarySubTab === 'assets' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-gray-400'
                        }`}
                      >
                        <FileDown size={13} /> Downloadable Assets
                      </button>
                      <button
                        type="button"
                        onClick={() => setLibrarySubTab('favorites')}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 cursor-pointer ${
                          librarySubTab === 'favorites' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-gray-400'
                        }`}
                      >
                        <Heart size={13} /> My Favorites &amp; Gears
                      </button>
                    </div>

                    {librarySubTab === 'assets' ? (
                      <div className="space-y-4">
                        {hasPermission('library', 'create') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDownloadId(null);
                              setDownloadForm({ title: '', description: '', fileSize: '1.0 MB', fileType: 'PDF', category: 'Notes', downloadUrl: '#' });
                              setShowAddDownloadForm(!showAddDownloadForm);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            <Plus size={14} /> {showAddDownloadForm && !editingDownloadId ? 'Close Form' : 'Add Download Asset'}
                          </button>
                        )}
                        {showAddDownloadForm && (
                          <form onSubmit={handleAddDownload} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                            <div className="text-xs font-bold text-white uppercase tracking-wider">
                              {editingDownloadId ? 'Edit Download Asset' : 'New Download Asset'}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input
                                type="text"
                                required
                                placeholder="Resource Title"
                                value={downloadForm.title}
                                onChange={(e) => setDownloadForm({ ...downloadForm, title: e.target.value })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              />
                              <input
                                type="text"
                                placeholder="Download URL"
                                value={downloadForm.downloadUrl}
                                onChange={(e) => setDownloadForm({ ...downloadForm, downloadUrl: e.target.value })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                              />
                            </div>
                            <input
                              type="file"
                              onChange={handleDownloadFileUpload}
                              className="w-full text-xs text-gray-400 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <select
                                value={downloadForm.category}
                                onChange={(e) => setDownloadForm({ ...downloadForm, category: e.target.value as any })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              >
                                <option value="Notes">Notes</option>
                                <option value="Templates">Templates</option>
                                <option value="Wallpapers">Wallpapers</option>
                                <option value="Software">Software</option>
                                <option value="Other">Other</option>
                              </select>
                              <input
                                type="text"
                                placeholder="File Type"
                                value={downloadForm.fileType}
                                onChange={(e) => setDownloadForm({ ...downloadForm, fileType: e.target.value })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              />
                              <input
                                type="text"
                                placeholder="File Size"
                                value={downloadForm.fileSize}
                                onChange={(e) => setDownloadForm({ ...downloadForm, fileSize: e.target.value })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Resource Description"
                              value={downloadForm.description}
                              onChange={(e) => setDownloadForm({ ...downloadForm, description: e.target.value })}
                              className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDownloadId(null);
                                  setShowAddDownloadForm(false);
                                }}
                                className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                                {editingDownloadId ? 'Save Changes' : 'Save Asset'}
                              </button>
                            </div>
                          </form>
                        )}
                        <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5">
                          {downloads.map((dl) => (
                            <div key={dl.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                              <div className="min-w-0 flex-grow">
                                <h4 className="text-white font-bold truncate">{dl.title}</h4>
                                <span className="text-[10px] text-cyan-400/80">{dl.category} • {dl.fileType} ({dl.fileSize})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {hasPermission('library', 'edit') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDownloadId(dl.id);
                                      setDownloadForm({
                                        title: dl.title,
                                        description: dl.description,
                                        fileSize: dl.fileSize,
                                        fileType: dl.fileType,
                                        category: dl.category,
                                        downloadUrl: dl.downloadUrl,
                                      });
                                      setShowAddDownloadForm(true);
                                    }}
                                    className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                                    title="Edit asset"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {hasPermission('library', 'delete') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateDownloads(downloads.filter((d) => d.id !== dl.id));
                                      triggerNotice('Downloadable resource removed.');
                                    }}
                                    className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                                    title="Delete asset"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {hasPermission('library', 'create') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFavId(null);
                              setFavForm({ title: '', category: 'Gadget', rating: 5, description: '', image: '' });
                              setShowAddFavForm(!showAddFavForm);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            <Plus size={14} /> Add Favorite Item
                          </button>
                        )}
                        {showAddFavForm && (
                          <form onSubmit={handleAddFavorite} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <input
                                type="text"
                                required
                                placeholder="Item Title"
                                value={favForm.title}
                                onChange={(e) => setFavForm({ ...favForm, title: e.target.value })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              />
                              <select
                                value={favForm.category}
                                onChange={(e) => setFavForm({ ...favForm, category: e.target.value as any })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              >
                                <option value="Gadget">Gadget</option>
                                <option value="YouTuber">YouTuber</option>
                                <option value="Game">Game</option>
                                <option value="Software">Software</option>
                                <option value="Music">Music</option>
                              </select>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={favForm.rating}
                                onChange={(e) => setFavForm({ ...favForm, rating: Number(e.target.value) })}
                                className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Image URL"
                              value={favForm.image}
                              onChange={(e) => setFavForm({ ...favForm, image: e.target.value })}
                              className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                            />
                            <textarea
                              rows={2}
                              placeholder="Description..."
                              value={favForm.description}
                              onChange={(e) => setFavForm({ ...favForm, description: e.target.value })}
                              className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                            />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setShowAddFavForm(false)} className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs">
                                Cancel
                              </button>
                              <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                                Save Favorite
                              </button>
                            </div>
                          </form>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {favorites.map((fav) => (
                            <div key={fav.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex gap-4">
                              {fav.image && (
                                <img src={fav.image} alt={fav.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="text-[10px] font-mono text-cyan-400 uppercase">{fav.category} • ★ {fav.rating}</span>
                                    <h4 className="text-white font-bold text-xs truncate">{fav.title}</h4>
                                  </div>
                                  <div className="flex gap-1">
                                    {hasPermission('library', 'edit') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFavForm({
                                            title: fav.title,
                                            category: fav.category,
                                            rating: fav.rating,
                                            description: fav.description,
                                            image: fav.image,
                                          });
                                          setEditingFavId(fav.id);
                                          setShowAddFavForm(true);
                                        }}
                                        className="p-1 text-gray-400 hover:text-white cursor-pointer"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                    )}
                                    {hasPermission('library', 'delete') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateFavorites(favorites.filter((f) => f.id !== fav.id));
                                          triggerNotice('Favorite removed.');
                                        }}
                                        className="p-1 text-red-400 cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-400 text-[11px] line-clamp-2 mt-1">{fav.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BLOGS */}
                {contentSubTab === 'blogs' && (
                  <div className="space-y-6">
                    {(hasPermission('blogs', 'create') || hasPermission('blogs', 'publish')) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBlogId(null);
                          setBlogForm({ title: '', excerpt: '', content: '', coverImage: '', category: 'Technology', date: new Date().toISOString().split('T')[0] });
                          setShowAddBlogForm(!showAddBlogForm);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
                      >
                        <Plus size={14} /> {showAddBlogForm && !editingBlogId ? 'Close Editor' : 'Write New Article'}
                      </button>
                    )}
                    {showAddBlogForm && (
                      <form onSubmit={handleAddBlog} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {editingBlogId ? 'Edit Blog Article' : 'New Blog Article'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            type="text"
                            required
                            placeholder="Article Title"
                            value={blogForm.title}
                            onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              placeholder="Cover Image URL"
                              value={blogForm.coverImage}
                              onChange={(e) => setBlogForm({ ...blogForm, coverImage: e.target.value })}
                              className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleDeviceFileUpload(e, (b64) => setBlogForm({ ...blogForm, coverImage: b64 }))}
                              className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                            />
                          </div>
                          <select
                            value={blogForm.category}
                            onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value as any })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          >
                            <option value="Technology">Technology</option>
                            <option value="Travel">Travel</option>
                            <option value="Gaming">Gaming</option>
                            <option value="Music">Music</option>
                            <option value="Personal">Personal</option>
                          </select>
                          <input
                            type="date"
                            value={blogForm.date}
                            onChange={(e) => setBlogForm({ ...blogForm, date: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Short Excerpt"
                          value={blogForm.excerpt}
                          onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                        />
                        <textarea
                          rows={6}
                          required
                          placeholder="Article Markdown content..."
                          value={blogForm.content}
                          onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBlogId(null);
                              setShowAddBlogForm(false);
                            }}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                            {editingBlogId ? 'Save Changes' : 'Publish Article'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5">
                      {blogs.map((bg) => (
                        <div key={bg.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                          <div className="min-w-0 flex-grow">
                            <h4 className="text-white font-bold truncate">{bg.title}</h4>
                            <span className="text-[10px] text-cyan-400/80">{bg.category} • {bg.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasPermission('blogs', 'edit') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBlogId(bg.id);
                                  setBlogForm({
                                    title: bg.title,
                                    excerpt: bg.excerpt,
                                    content: bg.content,
                                    coverImage: bg.coverImage,
                                    category: bg.category,
                                    date: bg.date,
                                  });
                                  setShowAddBlogForm(true);
                                }}
                                className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                                title="Edit article"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {hasPermission('blogs', 'delete') && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateBlogs(blogs.filter((b) => b.id !== bg.id));
                                  triggerNotice('Article removed.');
                                }}
                                className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                                title="Delete article"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* JOURNEY / TIMELINE */}
                {contentSubTab === 'journey' && (
                  <div className="space-y-6">
                    {hasPermission('journey', 'create') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingJourneyId(null);
                          setJourneyForm({ year: String(new Date().getFullYear()), title: '', subtitle: '', description: '' });
                          setShowAddJourneyForm(!showAddJourneyForm);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Plus size={14} /> {showAddJourneyForm && !editingJourneyId ? 'Close Form' : 'Add Journey Milestone'}
                      </button>
                    )}
                    {showAddJourneyForm && (
                      <form onSubmit={handleAddJourney} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          {editingJourneyId ? 'Edit Journey Milestone' : 'New Journey Milestone'}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <input
                            type="text"
                            required
                            placeholder="Year (e.g. 2026)"
                            value={journeyForm.year}
                            onChange={(e) => setJourneyForm({ ...journeyForm, year: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Milestone Title"
                            value={journeyForm.title}
                            onChange={(e) => setJourneyForm({ ...journeyForm, title: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Subtitle"
                            value={journeyForm.subtitle}
                            onChange={(e) => setJourneyForm({ ...journeyForm, subtitle: e.target.value })}
                            className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Milestone description..."
                          value={journeyForm.description}
                          onChange={(e) => setJourneyForm({ ...journeyForm, description: e.target.value })}
                          className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingJourneyId(null);
                              setShowAddJourneyForm(false);
                            }}
                            className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                            {editingJourneyId ? 'Save Changes' : 'Save Milestone'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5">
                      {timeline.map((item) => (
                        <div key={item.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                          <div className="min-w-0 flex-grow">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-cyan-400" />
                              <span className="text-cyan-400 font-bold">{item.year}</span>
                              <h4 className="text-white font-bold truncate">{item.title}</h4>
                            </div>
                            <p className="text-gray-400 text-[11px] truncate mt-0.5">{item.description}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {hasPermission('journey', 'edit') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingJourneyId(item.id);
                                  setJourneyForm({
                                    year: item.year,
                                    title: item.title,
                                    subtitle: item.subtitle,
                                    description: item.description,
                                  });
                                  setShowAddJourneyForm(true);
                                }}
                                className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                                title="Edit milestone"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            {hasPermission('journey', 'delete') && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateTimeline(timeline.filter((t) => t.id !== item.id));
                                  triggerNotice('Milestone removed.');
                                }}
                                className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                                title="Delete milestone"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === 3. GAMING ZONE MANAGEMENT === */}
            {activeTab === 'gaming' && canViewGaming && (
              <GamingUploadManager
                arcadeGames={games}
                onUpdateArcadeGames={onUpdateGames}
                onNotice={triggerNotice}
                onCompressImage={handleDeviceFileUpload}
              />
            )}

            {/* === 4. DIRECT INQUIRIES === */}
            {activeTab === 'messages' && canViewInquiries && (
              <DirectInquiriesTab onNotice={triggerNotice} />
            )}

            {/* === 5. ADMIN REQUESTS (OWNER ONLY) === */}
            {activeTab === 'requests' && isOwner && (
              <OwnerRequestsTab onNotice={triggerNotice} />
            )}

            {/* === 6. ADMIN MANAGEMENT (OWNER ONLY) === */}
            {activeTab === 'admins' && isOwner && (
              <AdminManagementTab onNotice={triggerNotice} />
            )}

            {/* === 7. ACTIVITY LOGS (OWNER ONLY) === */}
            {activeTab === 'logs' && isOwner && <ActivityLogsTab />}

            {/* === 8. SETTINGS === */}
            {activeTab === 'settings' && canViewSettings && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-[#0b1220]/60 border border-white/5 p-6 rounded-2xl space-y-4">
                  <h3 className="text-white font-bold text-sm">Website Data Backup &amp; Restore</h3>
                  <p className="text-gray-400 text-xs">
                    Export all portfolio sections to JSON or restore from a previous backup.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={onExportBackup}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl text-xs font-bold font-mono cursor-pointer"
                    >
                      <Download size={14} /> EXPORT BACKUP JSON
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold font-mono cursor-pointer">
                      <Upload size={14} /> RESTORE BACKUP JSON
                      <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                  </div>
                </div>

                {systemStatus && (
                  <div className="bg-[#0b1220]/60 border border-white/5 p-6 rounded-2xl space-y-3 text-xs font-mono">
                    <h3 className="text-white font-bold text-sm font-sans">Backend Integration Diagnostics</h3>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400">Primary Owner Identity</span>
                      <span className="text-cyan-400">{systemStatus.ownerEmail}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400">Transactional Email Provider (SMTP / Resend)</span>
                      <span className={systemStatus.emailConfigured ? 'text-green-400' : 'text-amber-400'}>
                        {systemStatus.emailConfigured
                          ? `Configured (${systemStatus.emailProvider || 'SMTP / Resend'})`
                          : 'Not Configured (Set SMTP_* or RESEND_API_KEY)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400">Firebase Admin Service Account</span>
                      <span className={systemStatus.adminSdkConfigured ? 'text-green-400' : 'text-cyan-300'}>
                        {systemStatus.adminSdkConfigured
                          ? 'Active (Firebase Storage Bucket & Scheduler enabled)'
                          : 'JWT + Firestore REST + Server Vault Mode'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-400">Game Upload Limits</span>
                      <span className="text-gray-200">
                        Max {systemStatus.maxGameSizeMb} MB / file • Quota {systemStatus.storageQuotaMb} MB
                      </span>
                    </div>
                    {!systemStatus.emailConfigured && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 flex items-start gap-2 font-sans">
                        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                        <span>
                          Direct Inquiries and Approval Emails are saved in Firestore and queued, but live email delivery requires configuring <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> (or <code>RESEND_API_KEY</code>) in your server secrets.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
