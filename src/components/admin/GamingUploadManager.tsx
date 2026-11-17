/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  Gamepad2,
  Plus,
  Trash2,
  Upload,
  X,
  Edit2,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Globe,
  EyeOff,
  HardDrive,
  RefreshCw,
  FileArchive,
  BarChart3,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Game,
  GameSystemRequirements,
  UploadedGame,
} from '../../types';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';

interface GamingUploadManagerProps {
  arcadeGames: Game[];
  onUpdateArcadeGames: (g: Game[]) => void;
  onNotice: (msg: string) => void;
  onCompressImage: (e: React.ChangeEvent<HTMLInputElement>, cb: (base64: string) => void) => void;
}

const DEFAULT_REQUIREMENTS: GameSystemRequirements = {
  supportedOS: ['Windows 10/11'],
  minProcessor: 'Intel Core i3 / AMD Ryzen 3',
  recProcessor: 'Intel Core i5 / AMD Ryzen 5',
  minRam: '4 GB RAM',
  recRam: '8 GB RAM',
  minStorage: '500 MB available space',
  recStorage: '1 GB available space',
  minGraphics: 'Integrated Graphics (DirectX 11)',
  recGraphics: 'NVIDIA GTX 1050 / AMD RX 560 or better',
  additionalRequirements: '',
};

const OS_OPTIONS = ['Windows 10/11', 'Windows 7/8', 'macOS', 'Linux', 'Android', 'Web Browser'];
const ALLOWED_EXTS = ['.zip', '.rar', '.7z', '.exe', '.apk', '.msi'];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function GamingUploadManager({
  arcadeGames,
  onUpdateArcadeGames,
  onNotice,
  onCompressImage,
}: GamingUploadManagerProps) {
  const { user, idToken, hasPermission } = useAuth();
  const canCreate = hasPermission('gamingZone', 'create');
  const canEdit = hasPermission('gamingZone', 'edit');
  const canDelete = hasPermission('gamingZone', 'delete');
  const canPublish = hasPermission('gamingZone', 'publish');

  const [subTab, setSubTab] = useState<'uploaded' | 'arcade'>('uploaded');
  const [uploadedGames, setUploadedGames] = useState<UploadedGame[]>([]);
  const [downloadCounts, setDownloadCounts] = useState<Record<string, number>>({});
  const [storageStats, setStorageStats] = useState<{
    usedBytes: number;
    quotaBytes: number;
    maxFileSizeBytes: number;
  } | null>(null);

  // Upload / Edit Game Form State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [viewingGame, setViewingGame] = useState<UploadedGame | null>(null);

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('PC Action');
  const [version, setVersion] = useState('1.0.0');
  const [developer, setDeveloper] = useState('Atharv Kamath');
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [coverImage, setCoverImage] = useState('');
  const [screenshotsInput, setScreenshotsInput] = useState('');

  // File fields
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [fileVersion, setFileVersion] = useState('1.0.0');
  const [externalDownloadUrl, setExternalDownloadUrl] = useState('');

  // System Requirements
  const [requirements, setRequirements] = useState<GameSystemRequirements>({ ...DEFAULT_REQUIREMENTS });

  // Other info
  const [genre, setGenre] = useState('Action Adventure');
  const [playerMode, setPlayerMode] = useState<'Single Player' | 'Multiplayer' | 'Both'>('Single Player');
  const [connectivity, setConnectivity] = useState<'Offline' | 'Online' | 'Both'>('Offline');
  const [ageRating, setAgeRating] = useState('Everyone');
  const [installationInstructions, setInstallationInstructions] = useState(
    '1. Download and extract the archive.\n2. Run the setup or executable.\n3. Enjoy the game!'
  );
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);

  // Upload progress & cancellation
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [formError, setFormError] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUploadIdRef = useRef<string | null>(null);

  // Existing Arcade Game Form
  const [showAddArcadeForm, setShowAddArcadeForm] = useState(false);
  const [editingArcadeId, setEditingArcadeId] = useState<string | null>(null);
  const [arcadeForm, setArcadeForm] = useState<Omit<Game, 'id'>>({
    title: '',
    description: '',
    imageUrl: '',
    playUrl: 'play_local',
    genre: 'Retro Arcade',
    rating: 5,
  });
  const [gamesError, setGamesError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UploadedGame[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : String(data.updatedAt || ''),
          };
        });
        setUploadedGames(list);
        setGamesError(null);
      },
      (err) => {
        console.warn('Games listener:', err.message);
        setGamesError(
          err?.message?.toLowerCase().includes('permission')
            ? 'Firestore permission denied reading games collection. Deploy firestore.rules to Firebase project atharv-kamath.'
            : `Failed to sync uploaded games: ${err?.message}`
        );
      }
    );
    return () => unsub();
  }, []);

  const refreshServerStats = async () => {
    if (!idToken) return;
    try {
      const [statsResp, countsResp] = await Promise.all([
        fetch('/api/games/storage-stats', { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch('/api/games/download-counts'),
      ]);
      if (statsResp.ok) setStorageStats(await statsResp.json());
      if (countsResp.ok) {
        const cData = await countsResp.json();
        setDownloadCounts(cData.counts || {});
      }
    } catch {
      // Ignore transient
    }
  };

  useEffect(() => {
    refreshServerStats();
  }, [idToken]);

  const resetForm = () => {
    setEditingGameId(null);
    setTitle('');
    setDescription('');
    setCategory('PC Action');
    setVersion('1.0.0');
    setDeveloper('Atharv Kamath');
    setReleaseDate(new Date().toISOString().split('T')[0]);
    setCoverImage('');
    setScreenshotsInput('');
    setSelectedFile(null);
    setDownloadFileName('');
    setFileVersion('1.0.0');
    setExternalDownloadUrl('');
    setRequirements({ ...DEFAULT_REQUIREMENTS });
    setGenre('Action Adventure');
    setPlayerMode('Single Player');
    setConnectivity('Offline');
    setAgeRating('Everyone');
    setInstallationInstructions('1. Download and extract the archive.\n2. Run the setup or executable.\n3. Enjoy the game!');
    setAdditionalNotes('');
    setPublishImmediately(true);
    setFormError('');
    setUploadProgress(0);
    setUploadStage('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setFormError(`Unsupported file format (${ext}). Allowed: ${ALLOWED_EXTS.join(', ').toUpperCase()}`);
      e.target.value = '';
      return;
    }
    const maxBytes = storageStats?.maxFileSizeBytes || 500 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFormError(`File exceeds maximum size limit (${formatBytes(maxBytes)}).`);
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (!downloadFileName) setDownloadFileName(file.name);
  };

  const handleCancelUpload = async () => {
    abortControllerRef.current?.abort();
    if (activeUploadIdRef.current && idToken) {
      await fetch(`/api/games/upload/${activeUploadIdRef.current}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      }).catch(() => {});
      activeUploadIdRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStage('Upload cancelled');
  };

  const handleSubmitGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !description.trim()) {
      setFormError('Game Name and Game Description are required.');
      return;
    }
    if (!editingGameId && !selectedFile && !externalDownloadUrl.trim()) {
      setFormError('Please upload a game file from your computer or provide an external download URL.');
      return;
    }
    if (!user || !idToken) {
      setFormError('Authenticated session required.');
      return;
    }

    const existingGame = editingGameId
      ? uploadedGames.find((g) => g.gameId === editingGameId)
      : undefined;

    const targetGameId = editingGameId || `game_${Date.now()}`;
    const screenshots = screenshotsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    let filePath = existingGame?.filePath || '';
    let storageProvider: UploadedGame['storageProvider'] = existingGame?.storageProvider || 'external_only';
    let fileSize = existingGame?.fileSize || 0;
    let fileType = existingGame?.fileType || 'URL';
    let sha256 = existingGame?.sha256 || '';
    let securityScanStatus: UploadedGame['securityScanStatus'] =
      existingGame?.securityScanStatus || (externalDownloadUrl.trim() ? 'passed' : 'pending');
    let securityScanDetails = existingGame?.securityScanDetails || '';
    let uploadStatus: UploadedGame['uploadStatus'] = existingGame?.uploadStatus || 'completed';

    setUploading(true);
    try {
      if (selectedFile) {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setUploadStage('Initializing secure upload...');
        setUploadProgress(2);

        const initResp = await fetch('/api/games/upload/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            gameId: targetGameId,
          }),
          signal: controller.signal,
        });
        const initData = await initResp.json();
        if (!initResp.ok) {
          throw new Error(initData.message || 'Failed to initialize upload.');
        }

        const { uploadId, chunkSizeBytes } = initData;
        activeUploadIdRef.current = uploadId;

        const chunkSize = chunkSizeBytes || 2 * 1024 * 1024;
        let offset = 0;

        while (offset < selectedFile.size) {
          if (controller.signal.aborted) {
            throw new Error('Upload cancelled by administrator.');
          }
          const slice = selectedFile.slice(offset, offset + chunkSize);
          const buf = await slice.arrayBuffer();

          setUploadStage(`Uploading ${selectedFile.name}...`);
          const chunkResp = await fetch(`/api/games/upload/chunk/${uploadId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/octet-stream',
              Authorization: `Bearer ${idToken}`,
            },
            body: buf,
            signal: controller.signal,
          });
          if (!chunkResp.ok) {
            const cErr = await chunkResp.json().catch(() => ({}));
            throw new Error(cErr.message || 'Chunk upload failed.');
          }

          offset += slice.size;
          const pct = Math.min(92, Math.round((offset / selectedFile.size) * 90));
          setUploadProgress(pct);
        }

        setUploadStage('Running security & signature verification...');
        setUploadProgress(95);

        const completeResp = await fetch(`/api/games/upload/complete/${uploadId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        });
        const completeData = await completeResp.json();
        activeUploadIdRef.current = null;

        if (!completeResp.ok) {
          throw new Error(completeData.message || 'Security check failed.');
        }

        filePath = completeData.filePath;
        storageProvider = completeData.storageProvider;
        fileSize = completeData.fileSize;
        fileType = completeData.fileType;
        sha256 = completeData.sha256;
        securityScanStatus = 'passed';
        securityScanDetails = completeData.securityScanDetails;
        uploadStatus = 'completed';
        setUploadProgress(100);
      }

      const finalPubStatus: UploadedGame['publicationStatus'] =
        publishImmediately && canPublish && securityScanStatus === 'passed'
          ? 'published'
          : existingGame?.publicationStatus === 'published' && securityScanStatus === 'passed'
          ? 'published'
          : 'draft';

      const gamePayload: any = {
        gameId: targetGameId,
        title: title.trim().slice(0, 150),
        description: description.trim().slice(0, 5000),
        category: category.trim().slice(0, 80),
        version: version.trim().slice(0, 40),
        developer: developer.trim().slice(0, 120),
        releaseDate: releaseDate.slice(0, 40),
        coverImage:
          coverImage.trim() ||
          'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
        screenshots,
        filePath,
        downloadFileName: (downloadFileName.trim() || selectedFile?.name || title.trim()).slice(0, 200),
        fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        fileType,
        fileVersion: fileVersion.trim().slice(0, 40),
        externalDownloadUrl: externalDownloadUrl.trim().slice(0, 2000),
        sha256,
        storageProvider,
        requirements,
        genre: genre.trim().slice(0, 80),
        playerMode,
        connectivity,
        ageRating: ageRating.trim().slice(0, 30),
        installationInstructions: installationInstructions.trim().slice(0, 4000),
        additionalNotes: additionalNotes.trim().slice(0, 2000),
        downloadCount: existingGame?.downloadCount || 0,
        uploadStatus,
        securityScanStatus,
        securityScanDetails,
        publicationStatus: finalPubStatus,
        uploadedBy: existingGame?.uploadedBy || user.uid,
        updatedAt: serverTimestamp(),
      };

      if (editingGameId) {
        try {
          await updateDoc(doc(db, 'games', targetGameId), gamePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `games/${targetGameId}`);
        }
        onNotice(`Updated "${title}" successfully.`);
      } else {
        gamePayload.createdAt = serverTimestamp();
        try {
          await setDoc(doc(db, 'games', targetGameId), gamePayload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `games/${targetGameId}`);
        }
        onNotice(`Uploaded & saved "${title}" (${finalPubStatus}).`);
      }

      resetForm();
      setShowUploadForm(false);
      refreshServerStats();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setFormError('Upload was cancelled.');
      } else {
        setFormError(err?.message || 'Failed to upload or save game.');
      }
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  const openEditGame = (g: UploadedGame) => {
    setEditingGameId(g.gameId);
    setTitle(g.title);
    setDescription(g.description);
    setCategory(g.category || 'PC Action');
    setVersion(g.version || '1.0.0');
    setDeveloper(g.developer || 'Atharv Kamath');
    setReleaseDate(g.releaseDate || '');
    setCoverImage(g.coverImage || '');
    setScreenshotsInput((g.screenshots || []).join('\n'));
    setSelectedFile(null);
    setDownloadFileName(g.downloadFileName || '');
    setFileVersion(g.fileVersion || g.version || '1.0.0');
    setExternalDownloadUrl(g.externalDownloadUrl || '');
    setRequirements(g.requirements || { ...DEFAULT_REQUIREMENTS });
    setGenre(g.genre || 'Action');
    setPlayerMode(g.playerMode || 'Single Player');
    setConnectivity(g.connectivity || 'Offline');
    setAgeRating(g.ageRating || 'Everyone');
    setInstallationInstructions(g.installationInstructions || '');
    setAdditionalNotes(g.additionalNotes || '');
    setPublishImmediately(g.publicationStatus === 'published');
    setFormError('');
    setShowUploadForm(true);
  };

  const handleTogglePublish = async (g: UploadedGame) => {
    if (!canPublish) return;
    if (g.securityScanStatus !== 'passed' && g.publicationStatus !== 'published') {
      onNotice('Cannot publish game until security checks pass.');
      return;
    }
    const nextStatus = g.publicationStatus === 'published' ? 'unpublished' : 'published';
    try {
      await updateDoc(doc(db, 'games', g.gameId), {
        publicationStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      onNotice(`"${g.title}" is now ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `games/${g.gameId}`);
    }
  };

  const handleDeleteUploadedGame = async (g: UploadedGame) => {
    if (!canDelete || !idToken) return;
    try {
      if (g.filePath && g.storageProvider !== 'external_only') {
        await fetch(`/api/games/${g.gameId}/file`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ filePath: g.filePath, storageProvider: g.storageProvider }),
        });
      }
      await deleteDoc(doc(db, 'games', g.gameId));
      onNotice(`Deleted "${g.title}" and its stored package.`);
      refreshServerStats();
    } catch (err: any) {
      onNotice(err?.message || 'Failed to delete game.');
    }
  };

  // Existing Arcade CRUD
  const handleAddArcade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!arcadeForm.title) return;
    const normalizedImage =
      arcadeForm.imageUrl ||
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=500&q=80';
    if (editingArcadeId) {
      onUpdateArcadeGames(
        arcadeGames.map((g) =>
          g.id === editingArcadeId ? { ...g, ...arcadeForm, imageUrl: normalizedImage } : g
        )
      );
      setEditingArcadeId(null);
      onNotice('Arcade game updated.');
    } else {
      const newGame: Game = {
        id: `game-${Date.now()}`,
        ...arcadeForm,
        imageUrl: normalizedImage,
      };
      onUpdateArcadeGames([newGame, ...arcadeGames]);
      onNotice('New arcade link added.');
    }
    setArcadeForm({ title: '', description: '', imageUrl: '', playUrl: 'play_local', genre: 'Retro Arcade', rating: 5 });
    setShowAddArcadeForm(false);
  };

  const openEditArcade = (game: Game) => {
    setEditingArcadeId(game.id);
    setArcadeForm({
      title: game.title,
      description: game.description,
      imageUrl: game.imageUrl,
      playUrl: game.playUrl,
      genre: game.genre,
      rating: game.rating ?? 5,
    });
    setShowAddArcadeForm(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {gamesError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <span>{gamesError}</span>
        </div>
      )}

      {/* Sub-navigation + Storage Quota */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('uploaded')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
              subTab === 'uploaded'
                ? 'bg-cyan-500 text-black'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <FileArchive size={14} /> Uploaded Games ({uploadedGames.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('arcade')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
              subTab === 'arcade'
                ? 'bg-cyan-500 text-black'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Gamepad2 size={14} /> Curated Web Arcade ({arcadeGames.length})
          </button>
        </div>

        {storageStats && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[11px] font-mono text-gray-300">
            <HardDrive size={13} className="text-cyan-400" />
            <span>
              Vault: {formatBytes(storageStats.usedBytes)} / {formatBytes(storageStats.quotaBytes)}
            </span>
          </div>
        )}
      </div>

      {subTab === 'uploaded' && (
        <div className="space-y-6">
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                if (showUploadForm) {
                  resetForm();
                  setShowUploadForm(false);
                } else {
                  resetForm();
                  setShowUploadForm(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
            >
              <Upload size={14} /> {showUploadForm ? 'Close Upload Form' : 'Upload New Game'}
            </button>
          )}

          {showUploadForm && (
            <form
              onSubmit={handleSubmitGame}
              className="p-6 bg-[#0b1220]/90 border border-cyan-500/20 rounded-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-white font-bold text-base">
                  {editingGameId ? `Edit / Replace Game: ${title}` : 'Upload New Game'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowUploadForm(false);
                  }}
                  className="p-1.5 bg-white/5 rounded-lg text-gray-400 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} /> {formError}
                </div>
              )}

              {/* 1. Basic Information */}
              <div className="space-y-4">
                <h4 className="text-cyan-400 font-mono text-xs uppercase font-bold">1. Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Game Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Cyber Drift Arena"
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Game Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="PC Game / Indie / Mobile APK"
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Game Version
                    </label>
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Developer / Publisher
                    </label>
                    <input
                      type="text"
                      value={developer}
                      onChange={(e) => setDeveloper(e.target.value)}
                      placeholder="Atharv Kamath"
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Release Date
                    </label>
                    <input
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Game Cover Image (URL or Device)
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onCompressImage(e, (b64) => setCoverImage(b64))}
                        className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                    Game Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed gameplay overview, features, and storyline..."
                    className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                    Additional Screenshots (One URL per line)
                  </label>
                  <textarea
                    rows={2}
                    value={screenshotsInput}
                    onChange={(e) => setScreenshotsInput(e.target.value)}
                    placeholder="https://example.com/screenshot1.jpg"
                    className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* 2. Game Files */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-cyan-400 font-mono text-xs uppercase font-bold">2. Game Files &amp; Security</h4>
                <div className="p-4 bg-[#070a11] border border-dashed border-cyan-500/30 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-white font-semibold">
                      {editingGameId ? 'Replace Game Binary (Optional)' : 'Select Game Package from Computer'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      Supported: ZIP, RAR, 7Z, EXE, APK, MSI • Max {formatBytes(storageStats?.maxFileSizeBytes || 500 * 1024 * 1024)}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".zip,.rar,.7z,.exe,.apk,.msi"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/15 file:text-cyan-300 hover:file:bg-cyan-500/25 file:cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl text-xs font-mono">
                      <span className="text-cyan-300 truncate">{selectedFile.name}</span>
                      <span className="text-gray-300 flex-shrink-0 ml-2">{formatBytes(selectedFile.size)}</span>
                    </div>
                  )}

                  {uploading && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-300 flex items-center gap-1.5">
                          <RefreshCw size={12} className="animate-spin" /> {uploadStage}
                        </span>
                        <span className="text-white font-bold">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Cancel Upload
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Download File Name
                    </label>
                    <input
                      type="text"
                      value={downloadFileName}
                      onChange={(e) => setDownloadFileName(e.target.value)}
                      placeholder="CyberDrift_v1.0.zip"
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      File Version
                    </label>
                    <input
                      type="text"
                      value={fileVersion}
                      onChange={(e) => setFileVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                      Optional External Download URL
                    </label>
                    <input
                      type="url"
                      value={externalDownloadUrl}
                      onChange={(e) => setExternalDownloadUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. System Requirements */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-cyan-400 font-mono text-xs uppercase font-bold">3. System Requirements</h4>
                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-2">
                    Supported Operating Systems
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {OS_OPTIONS.map((os) => {
                      const active = requirements.supportedOS.includes(os);
                      return (
                        <button
                          key={os}
                          type="button"
                          onClick={() =>
                            setRequirements((prev) => ({
                              ...prev,
                              supportedOS: active
                                ? prev.supportedOS.filter((x) => x !== os)
                                : [...prev.supportedOS, os],
                            }))
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-mono cursor-pointer border ${
                            active
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          {os}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={requirements.minProcessor}
                    onChange={(e) => setRequirements({ ...requirements, minProcessor: e.target.value })}
                    placeholder="Minimum Processor"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.recProcessor}
                    onChange={(e) => setRequirements({ ...requirements, recProcessor: e.target.value })}
                    placeholder="Recommended Processor"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.minRam}
                    onChange={(e) => setRequirements({ ...requirements, minRam: e.target.value })}
                    placeholder="Minimum RAM"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.recRam}
                    onChange={(e) => setRequirements({ ...requirements, recRam: e.target.value })}
                    placeholder="Recommended RAM"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.minStorage}
                    onChange={(e) => setRequirements({ ...requirements, minStorage: e.target.value })}
                    placeholder="Minimum Storage"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.recStorage}
                    onChange={(e) => setRequirements({ ...requirements, recStorage: e.target.value })}
                    placeholder="Recommended Storage"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.minGraphics}
                    onChange={(e) => setRequirements({ ...requirements, minGraphics: e.target.value })}
                    placeholder="Minimum Graphics"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    value={requirements.recGraphics}
                    onChange={(e) => setRequirements({ ...requirements, recGraphics: e.target.value })}
                    placeholder="Recommended Graphics"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
                <input
                  type="text"
                  value={requirements.additionalRequirements}
                  onChange={(e) =>
                    setRequirements({ ...requirements, additionalRequirements: e.target.value })
                  }
                  placeholder="Additional Requirements (DirectX, Visual C++ Redistributable, etc.)"
                  className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                />
              </div>

              {/* 4. Other Information */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-cyan-400 font-mono text-xs uppercase font-bold">4. Other Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Genre"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                  <select
                    value={playerMode}
                    onChange={(e) => setPlayerMode(e.target.value as any)}
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="Single Player">Single Player</option>
                    <option value="Multiplayer">Multiplayer</option>
                    <option value="Both">Both</option>
                  </select>
                  <select
                    value={connectivity}
                    onChange={(e) => setConnectivity(e.target.value as any)}
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                    <option value="Both">Both</option>
                  </select>
                  <input
                    type="text"
                    value={ageRating}
                    onChange={(e) => setAgeRating(e.target.value)}
                    placeholder="Age Rating (e.g. Everyone, 12+)"
                    className="px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
                <textarea
                  rows={3}
                  value={installationInstructions}
                  onChange={(e) => setInstallationInstructions(e.target.value)}
                  placeholder="Installation Instructions"
                  className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                />
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Additional Notes"
                  className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white"
                />

                {canPublish && (
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publishImmediately}
                      onChange={(e) => setPublishImmediately(e.target.checked)}
                      className="rounded border-white/20 bg-[#070a11] text-cyan-500"
                    />
                    Publish publicly to Gaming Zone once security checks pass
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    resetForm();
                    setShowUploadForm(false);
                  }}
                  className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Uploading & Scanning...' : editingGameId ? 'Save Changes' : 'Upload & Register Game'}
                </button>
              </div>
            </form>
          )}

          {/* Uploaded Games Management Table */}
          <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl overflow-x-auto">
            {uploadedGames.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-xs font-mono">
                No uploaded game packages yet. Click &ldquo;Upload New Game&rdquo; to upload your first game build!
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-mono text-[10px] uppercase bg-white/[0.02]">
                    <th className="p-4">Game Name</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Version</th>
                    <th className="p-4">Upload Date</th>
                    <th className="p-4">Security / Upload</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Downloads</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {uploadedGames.map((g) => {
                    const dlCount = Math.max(g.downloadCount || 0, downloadCounts[g.gameId] || 0);
                    return (
                      <tr key={g.gameId} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-bold text-white">{g.title}</td>
                        <td className="p-4 font-mono text-gray-300">
                          {g.fileSizeFormatted || formatBytes(g.fileSize)}
                        </td>
                        <td className="p-4 font-mono text-cyan-300">v{g.version}</td>
                        <td className="p-4 font-mono text-gray-400">
                          {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] ${
                              g.securityScanStatus === 'passed'
                                ? 'bg-green-500/15 text-green-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            <ShieldCheck size={11} /> {g.securityScanStatus} ({g.uploadStatus})
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${
                              g.publicationStatus === 'published'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-white/10 text-gray-400'
                            }`}
                          >
                            {g.publicationStatus}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-white font-bold flex items-center gap-1.5">
                          <BarChart3 size={12} className="text-cyan-400" /> {dlCount}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingGame(g)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg cursor-pointer"
                              title="View Details & Stats"
                            >
                              <Eye size={12} />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditGame(g)}
                                className="p-1.5 bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-lg cursor-pointer"
                                title="Edit Details / Replace File"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            {canPublish && (
                              <button
                                type="button"
                                onClick={() => handleTogglePublish(g)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                  g.publicationStatus === 'published'
                                    ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500 hover:text-black'
                                    : 'bg-green-500/15 text-green-300 hover:bg-green-500 hover:text-black'
                                }`}
                              >
                                {g.publicationStatus === 'published' ? (
                                  <>
                                    <EyeOff size={11} /> Unpublish
                                  </>
                                ) : (
                                  <>
                                    <Globe size={11} /> Publish
                                  </>
                                )}
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUploadedGame(g)}
                                className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg cursor-pointer"
                                title="Delete Game & Binary"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Existing Web Arcade Tab (Preserved + Edit Added) */}
      {subTab === 'arcade' && (
        <div className="space-y-6">
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingArcadeId(null);
                setArcadeForm({ title: '', description: '', imageUrl: '', playUrl: 'play_local', genre: 'Retro Arcade', rating: 5 });
                setShowAddArcadeForm(!showAddArcadeForm);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
            >
              <Plus size={14} /> {showAddArcadeForm && !editingArcadeId ? 'Close Form' : 'Register New Arcade Link'}
            </button>
          )}

          {showAddArcadeForm && (
            <form onSubmit={handleAddArcade} className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                  {editingArcadeId ? 'Edit Arcade Game' : 'New Curated Arcade Game'}
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Game Title"
                  value={arcadeForm.title}
                  onChange={(e) => setArcadeForm({ ...arcadeForm, title: e.target.value })}
                  className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                />
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Cover Image URL"
                    value={arcadeForm.imageUrl}
                    onChange={(e) => setArcadeForm({ ...arcadeForm, imageUrl: e.target.value })}
                    className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onCompressImage(e, (b64) => setArcadeForm({ ...arcadeForm, imageUrl: b64 }))}
                    className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-cyan-500/10 file:text-cyan-400"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Genre"
                  value={arcadeForm.genre}
                  onChange={(e) => setArcadeForm({ ...arcadeForm, genre: e.target.value })}
                  className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Play URL or play_local"
                  value={arcadeForm.playUrl}
                  onChange={(e) => setArcadeForm({ ...arcadeForm, playUrl: e.target.value })}
                  className="px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Description"
                value={arcadeForm.description}
                onChange={(e) => setArcadeForm({ ...arcadeForm, description: e.target.value })}
                className="w-full px-4 py-2 bg-[#070a11] border border-white/10 rounded-lg text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingArcadeId(null);
                    setShowAddArcadeForm(false);
                  }}
                  className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg text-xs cursor-pointer">
                  {editingArcadeId ? 'Save Changes' : 'Register Game'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            {arcadeGames.map((game) => (
              <div key={game.id} className="p-4 flex items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-3 min-w-0">
                  {game.imageUrl && (
                    <img src={game.imageUrl} alt={game.title} className="h-10 w-10 object-cover rounded-lg" />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-white font-bold truncate">{game.title}</h4>
                    <span className="text-[10px] text-cyan-400/80">
                      {game.genre} • {game.playUrl}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEditArcade(game)}
                      className="p-2 hover:bg-cyan-500/15 text-cyan-400 rounded-lg cursor-pointer"
                      title="Edit Arcade Game"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateArcadeGames(arcadeGames.filter((g) => g.id !== game.id));
                        onNotice('Arcade item removed.');
                      }}
                      className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg cursor-pointer"
                      title="Delete Arcade Game"
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

      {/* View Game Details & Stats Modal */}
      {viewingGame && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0c1220] border border-white/15 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-white font-bold text-base">{viewingGame.title} — Package &amp; Stats</h4>
              <button
                onClick={() => setViewingGame(null)}
                className="p-1 bg-white/5 rounded-lg text-gray-400 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="text-white">{viewingGame.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">File Name</span>
                <span className="text-cyan-300">{viewingGame.downloadFileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">File Type / Size</span>
                <span className="text-white">
                  {viewingGame.fileType} • {viewingGame.fileSizeFormatted || formatBytes(viewingGame.fileSize)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Storage Provider</span>
                <span className="text-gray-300">{viewingGame.storageProvider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Security Check</span>
                <span className="text-green-400">{viewingGame.securityScanStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Downloads</span>
                <span className="text-cyan-400 font-bold">
                  {Math.max(viewingGame.downloadCount || 0, downloadCounts[viewingGame.gameId] || 0)}
                </span>
              </div>
              {viewingGame.sha256 && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-gray-500 block">SHA-256 Checksum</span>
                  <span className="text-[10px] text-gray-300 break-all">{viewingGame.sha256}</span>
                </div>
              )}
              {viewingGame.securityScanDetails && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-gray-500 block">Scan Details</span>
                  <span className="text-gray-300">{viewingGame.securityScanDetails}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
