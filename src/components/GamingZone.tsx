/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Gamepad2,
  Play,
  RotateCcw,
  Award,
  Pause,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Download,
  Info,
  X,
  HardDrive,
  Monitor,
  ShieldCheck,
  Wifi,
  Users,
  Terminal,
  Calendar,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Game, UploadedGame } from '../types';

interface GamingZoneProps {
  games: Game[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function GamingZone({ games }: GamingZoneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('snake_highscore') || '0', 10);
  });
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');

  // Published downloadable games from Firestore
  const [uploadedGames, setUploadedGames] = useState<UploadedGame[]>([]);
  const [downloadCounts, setDownloadCounts] = useState<Record<string, number>>({});
  const [selectedGame, setSelectedGame] = useState<UploadedGame | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Snake coordinates & movement
  const snakeRef = useRef<{ x: number; y: number }[]>([{ x: 10, y: 10 }]);
  const directionRef = useRef<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>('RIGHT');
  const foodRef = useRef<{ x: number; y: number }>({ x: 15, y: 15 });
  const speedRef = useRef<number>(120); // MS interval

  const gridCount = 20; // 20x20 grid

  // Subscribe to published & security-passed games in Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('publicationStatus', '==', 'published'),
      where('securityScanStatus', '==', 'passed')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UploadedGame[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdIso = data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : String(data.createdAt || '');
          const updatedIso = data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : String(data.updatedAt || '');
          return {
            ...data,
            gameId: data.gameId || d.id,
            createdAt: createdIso,
            updatedAt: updatedIso,
          } as UploadedGame;
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setUploadedGames(list);
      },
      (err) => {
        console.warn('GamingZone Firestore listener warning:', err.message);
      }
    );

    return () => unsub();
  }, []);

  // Fetch live server download counts
  useEffect(() => {
    fetch('/api/games/download-counts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.counts) setDownloadCounts(data.counts);
      })
      .catch(() => {});
  }, [uploadedGames.length]);

  const handleDownloadGame = async (game: UploadedGame) => {
    setDownloadError(null);
    setDownloadingId(game.gameId);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(game.gameId)}/download-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.downloadUrl) {
        throw new Error(data.message || 'Unable to prepare download link.');
      }

      if (typeof data.downloadCount === 'number') {
        setDownloadCounts((prev) => ({ ...prev, [game.gameId]: data.downloadCount }));
      } else {
        setDownloadCounts((prev) => ({
          ...prev,
          [game.gameId]: Math.max(prev[game.gameId] || 0, game.downloadCount || 0) + 1,
        }));
      }

      const anchor = document.createElement('a');
      anchor.href = data.downloadUrl;
      if (data.external) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      } else {
        anchor.download = game.downloadFileName || `${game.title}.zip`;
      }
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err: any) {
      setDownloadError(err?.message || 'Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (directionRef.current !== 'DOWN') directionRef.current = 'UP';
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (directionRef.current !== 'UP') directionRef.current = 'DOWN';
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (directionRef.current !== 'RIGHT') directionRef.current = 'LEFT';
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (directionRef.current !== 'LEFT') directionRef.current = 'RIGHT';
          e.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Game ticks
  useEffect(() => {
    if (gameState !== 'playing') return;

    let timer: NodeJS.Timeout;

    const gameLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Move Snake
      const head = { ...snakeRef.current[0] };
      switch (directionRef.current) {
        case 'UP':
          head.y -= 1;
          break;
        case 'DOWN':
          head.y += 1;
          break;
        case 'LEFT':
          head.x -= 1;
          break;
        case 'RIGHT':
          head.x += 1;
          break;
      }

      // 2. Wall Collisions / Self Collisions
      const hitWall = head.x < 0 || head.x >= gridCount || head.y < 0 || head.y >= gridCount;
      const hitSelf = snakeRef.current.some((part) => part.x === head.x && part.y === head.y);

      if (hitWall || hitSelf) {
        setGameState('gameover');
        if (score > highScore) {
          setHighScore(score);
          localStorage.setItem('snake_highscore', score.toString());
        }
        return;
      }

      // Add new head
      const newSnake = [head, ...snakeRef.current];

      // 3. Food Collision
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore((prev) => prev + 10);
        // Respawn food
        let newFood;
        do {
          newFood = {
            x: Math.floor(Math.random() * gridCount),
            y: Math.floor(Math.random() * gridCount),
          };
        } while (newSnake.some((part) => part.x === newFood.x && part.y === newFood.y));
        foodRef.current = newFood;
      } else {
        // Remove tail
        newSnake.pop();
      }

      snakeRef.current = newSnake;

      // 4. Render Frame
      const size = canvas.width / gridCount;
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid subtle lines
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      for (let i = 0; i <= gridCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * size, 0);
        ctx.lineTo(i * size, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * size);
        ctx.lineTo(canvas.width, i * size);
        ctx.stroke();
      }

      // Draw Food (neon red)
      ctx.fillStyle = '#f43f5e';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#f43f5e';
      ctx.beginPath();
      ctx.arc(foodRef.current.x * size + size / 2, foodRef.current.y * size + size / 2, size / 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw Snake (neon cyan)
      snakeRef.current.forEach((part, idx) => {
        ctx.fillStyle = idx === 0 ? '#22d3ee' : '#0891b2';
        ctx.shadowBlur = idx === 0 ? 12 : 0;
        ctx.shadowColor = '#22d3ee';
        ctx.fillRect(part.x * size + 1, part.y * size + 1, size - 2, size - 2);
      });

      // Clear shadows
      ctx.shadowBlur = 0;

      // Queue next frame
      timer = setTimeout(gameLoop, speedRef.current);
    };

    timer = setTimeout(gameLoop, speedRef.current);
    return () => clearTimeout(timer);
  }, [gameState, score, highScore]);

  // Redraw state if idle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    const size = canvas.width / gridCount;
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    for (let i = 0; i <= gridCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * size, 0);
      ctx.lineTo(i * size, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * size);
      ctx.lineTo(canvas.width, i * size);
      ctx.stroke();
    }
  }, []);

  const handleStartGame = () => {
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = 'RIGHT';
    foodRef.current = { x: 15, y: 15 };
    setScore(0);
    setGameState('playing');
  };

  const togglePause = () => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  };

  const handleMobileDir = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (gameState !== 'playing') return;
    if (dir === 'UP' && directionRef.current !== 'DOWN') directionRef.current = 'UP';
    if (dir === 'DOWN' && directionRef.current !== 'UP') directionRef.current = 'DOWN';
    if (dir === 'LEFT' && directionRef.current !== 'RIGHT') directionRef.current = 'LEFT';
    if (dir === 'RIGHT' && directionRef.current !== 'LEFT') directionRef.current = 'RIGHT';
  };

  return (
    <section id="gaming" className="py-24 bg-[#070a11] border-b border-white/5 relative">
      <div className="absolute top-1/2 left-1/10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Interactive Play</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Gamer's Zone & Retro Arcade
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Arcade Game Box */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="relative p-6 bg-[#0c1220]/90 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md max-w-full">
              {/* Arcade Header screen */}
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 tracking-wider">
                  <Gamepad2 size={14} className="animate-pulse" />
                  CYBER-SNAKE V1.0
                </span>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                  <span>Score: <strong className="text-white font-bold">{score}</strong></span>
                  <span className="flex items-center gap-1">
                    <Award size={12} className="text-yellow-400" /> High: <strong className="text-white font-bold">{highScore}</strong>
                  </span>
                </div>
              </div>

              {/* HTML5 Canvas Stage */}
              <div id="cyber-snake-container" className="relative border border-cyan-500/20 rounded-2xl overflow-hidden aspect-square w-full max-w-[400px] mx-auto bg-[#0b0f19]">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={400}
                  className="w-full h-full block"
                />

                {/* Overlays states */}
                {gameState === 'idle' && (
                  <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-4 bg-cyan-500/10 rounded-full text-cyan-400 border border-cyan-500/30 mb-4 animate-bounce">
                      <Gamepad2 size={36} />
                    </div>
                    <h3 className="text-white font-bold font-sans text-lg">Wanna Play a Game?</h3>
                    <p className="text-gray-400 text-xs mt-1.5 max-w-xs font-light mb-6">
                      Use Arrow Keys or WASD to navigate snake and eat glowing cubes. Enjoy Atharv's custom arcade!
                    </p>
                    <button
                      id="game-start-btn"
                      onClick={handleStartGame}
                      className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-black font-sans font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
                    >
                      <Play fill="currentColor" size={12} /> INSERT COIN / START
                    </button>
                  </div>
                )}

                {gameState === 'paused' && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-center">
                    <h3 className="text-white font-bold font-sans text-xl tracking-wider">GAME PAUSED</h3>
                    <p className="text-gray-400 text-xs mt-1 mb-6">Take a breath, resume when ready</p>
                    <button
                      id="game-resume-btn"
                      onClick={togglePause}
                      className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-black font-sans font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Play fill="currentColor" size={10} /> RESUME
                    </button>
                  </div>
                )}

                {gameState === 'gameover' && (
                  <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                    <h3 className="text-red-500 font-black font-sans text-2xl tracking-widest">GAME OVER</h3>
                    <p className="text-white text-xs mt-1.5">You crashed! Final Score: <strong className="text-cyan-400">{score}</strong></p>
                    {score === highScore && score > 0 && (
                      <p className="text-yellow-400 text-[10px] font-mono mt-1 flex items-center gap-1.5">
                        <Award size={12} /> NEW HIGH SCORE RECORD!
                      </p>
                    )}
                    <button
                      id="game-restart-btn"
                      onClick={handleStartGame}
                      className="mt-6 px-5 py-2.5 bg-white text-black font-sans font-bold text-xs rounded-xl cursor-pointer flex items-center gap-2 shadow-lg"
                    >
                      <RotateCcw size={12} /> TRY AGAIN
                    </button>
                  </div>
                )}
              </div>

              {/* Game Control triggers bar */}
              <div className="flex items-center justify-between mt-4 px-2 pt-2 border-t border-white/5">
                <span className="text-[10px] font-mono text-gray-500">Keyboard: Arrows / WASD</span>
                {gameState === 'playing' && (
                  <button
                    id="game-pause-btn"
                    onClick={togglePause}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-mono"
                  >
                    <Pause size={10} /> Pause
                  </button>
                )}
              </div>

              {/* Mobile D-Pad Control Box */}
              <div className="mt-6 flex flex-col items-center gap-1 lg:hidden">
                <button
                  onClick={() => handleMobileDir('UP')}
                  className="p-3 bg-white/5 active:bg-white/15 border border-white/10 rounded-lg text-white"
                >
                  <ArrowUp size={16} />
                </button>
                <div className="flex gap-8">
                  <button
                    onClick={() => handleMobileDir('LEFT')}
                    className="p-3 bg-white/5 active:bg-white/15 border border-white/10 rounded-lg text-white"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    onClick={() => handleMobileDir('RIGHT')}
                    className="p-3 bg-white/5 active:bg-white/15 border border-white/10 rounded-lg text-white"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                <button
                  onClick={() => handleMobileDir('DOWN')}
                  className="p-3 bg-white/5 active:bg-white/15 border border-white/10 rounded-lg text-white"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Gaming reviews/clips detail side */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider mb-2">Live Gameplay Streams</span>
            <h3 className="text-2xl font-black text-white tracking-tight mb-4">
              My Gaming Ecosystem
            </h3>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed font-light mb-6">
              Gaming isn't just a hobby for me; it's a huge part of my digital life and creative storytelling. On my gaming streams, I play tactical competitive FPS games, open-world sandbox simulators, and retro classics.
            </p>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed font-light mb-6">
              I love analyzing game mechanics, exploring coding scripts for custom modding tools, and reviewing setups. Beyond streaming, I write short walkthrough guides, share map layouts, and provide custom stream assets in my downloads hub.
            </p>

            <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                <Gamepad2 size={20} />
              </div>
              <div>
                <h4 className="text-white font-sans font-bold text-sm">Join My Custom Rooms</h4>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed font-light">
                  I host weekly custom community tournament games with subscribers. Head over to my content links to follow my gaming channel and get direct notification ping cards when we go live!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Published Downloadable Games Vault */}
        {uploadedGames.length > 0 && (
          <div className="mt-20 border-t border-white/5 pt-16">
            <div className="text-center mb-10">
              <p className="text-cyan-400 font-mono text-[11px] uppercase tracking-widest mb-1.5">
                Verified & Malware-Scanned Builds
              </p>
              <h3 className="text-xl md:text-2xl font-black text-white flex items-center justify-center gap-2">
                <FileArchive className="text-cyan-400" /> Downloadable Game Releases
              </h3>
              <p className="text-gray-400 text-xs mt-1.5 font-light">
                Download custom games, builds, and packages directly with full system specs & SHA-256 verification.
              </p>
            </div>

            {downloadError && (
              <div className="mb-6 max-w-2xl mx-auto p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-mono flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <AlertCircle size={14} /> {downloadError}
                </span>
                <button
                  type="button"
                  onClick={() => setDownloadError(null)}
                  className="text-red-300 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uploadedGames.map((ug) => {
                const count = Math.max(downloadCounts[ug.gameId] || 0, ug.downloadCount || 0);
                const sizeText = ug.fileSizeFormatted || formatBytes(ug.fileSize);
                const osList = ug.requirements?.supportedOS?.length ? ug.requirements.supportedOS : ['Windows'];
                return (
                  <div
                    key={ug.gameId}
                    className="bg-[#0c1220]/90 border border-white/10 hover:border-cyan-500/30 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl"
                  >
                    <div>
                      <div className="h-44 overflow-hidden relative bg-[#070a11]">
                        {ug.coverImage ? (
                          <img
                            src={ug.coverImage}
                            alt={ug.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/10 to-indigo-600/10 text-cyan-400">
                            <Gamepad2 size={42} />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          <span className="px-2.5 py-1 bg-black/80 backdrop-blur-md text-[10px] font-mono text-cyan-400 rounded-md border border-white/10 uppercase">
                            {ug.genre || ug.category || 'Game'}
                          </span>
                          <span className="px-2 py-1 bg-black/80 backdrop-blur-md text-[10px] font-mono text-purple-300 rounded-md border border-white/10">
                            v{ug.version || ug.fileVersion || '1.0'}
                          </span>
                        </div>
                        <span className="absolute top-3 right-3 px-2 py-1 bg-green-500/20 backdrop-blur-md text-[10px] font-mono text-green-300 rounded-md border border-green-500/30 flex items-center gap-1">
                          <ShieldCheck size={10} /> Verified
                        </span>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-white font-sans font-bold text-base group-hover:text-cyan-400 transition-colors">
                            {ug.title}
                          </h4>
                          <span className="text-[10px] font-mono text-gray-400 shrink-0">
                            {ug.fileType || 'ZIP'}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-2 leading-relaxed font-light line-clamp-3">
                          {ug.description}
                        </p>

                        <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono text-gray-400">
                          <span className="flex items-center gap-1">
                            <HardDrive size={11} className="text-cyan-400" /> {sizeText}
                          </span>
                          <span className="flex items-center gap-1">
                            <Monitor size={11} className="text-indigo-400" /> {osList.join(', ')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download size={11} className="text-purple-400" /> {count}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0 flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGame(ug);
                          setActiveScreenshot(ug.coverImage || ug.screenshots?.[0] || null);
                        }}
                        className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-sans font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Info size={13} /> View Details
                      </button>
                      <button
                        type="button"
                        disabled={downloadingId === ug.gameId}
                        onClick={() => handleDownloadGame(ug)}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-sans font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === ug.gameId ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Preparing...
                          </>
                        ) : (
                          <>
                            <Download size={13} /> Download Game
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Curated Games List */}
        <div className="mt-20 border-t border-white/5 pt-16">
          <div className="text-center mb-10">
            <h3 className="text-xl md:text-2xl font-black text-white flex items-center justify-center gap-2">
              <Gamepad2 className="text-cyan-400" /> Curated Gamer's Lounge
            </h3>
            <p className="text-gray-400 text-xs mt-1.5 font-light">
              Add and manage your favorite web games directly from the admin dashboard!
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {games && games.map((game) => (
              <div
                key={game.id}
                className="bg-[#0c1220]/80 border border-white/5 hover:border-cyan-500/20 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between group"
              >
                <div>
                  <div className="h-44 overflow-hidden relative">
                    <img
                      src={game.imageUrl}
                      alt={game.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-md text-[10px] font-mono text-cyan-400 rounded-full border border-white/5 uppercase">
                      {game.genre}
                    </span>
                  </div>
                  <div className="p-6">
                    <h4 className="text-white font-sans font-bold text-base group-hover:text-cyan-400 transition-colors">
                      {game.title}
                    </h4>
                    <p className="text-gray-400 text-xs mt-2 leading-relaxed font-light line-clamp-3">
                      {game.description}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  {game.playUrl === 'play_local' ? (
                    <button
                      onClick={() => {
                        const el = document.getElementById('cyber-snake-container');
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth' });
                          handleStartGame();
                        }
                      }}
                      className="w-full py-2.5 bg-white/5 hover:bg-cyan-500 hover:text-black border border-white/10 hover:border-cyan-400 text-white font-sans font-black text-xs rounded-xl tracking-wider uppercase transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Play fill="currentColor" size={10} /> Play Game
                    </button>
                  ) : (
                    <a
                      href={game.playUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 bg-white/5 hover:bg-cyan-500 hover:text-black border border-white/10 hover:border-cyan-400 text-white font-sans font-black text-xs rounded-xl tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5"
                    >
                      <Play fill="currentColor" size={10} /> Play Game
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Uploaded Game Details Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0c1220] border border-white/15 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0c1220]/95 backdrop-blur-md px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-white font-sans font-black text-lg md:text-xl">
                    {selectedGame.title}
                  </h3>
                  <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono rounded">
                    v{selectedGame.version || selectedGame.fileVersion || '1.0'}
                  </span>
                  <span className="px-2 py-0.5 bg-green-500/15 border border-green-500/30 text-green-300 text-[10px] font-mono rounded flex items-center gap-1">
                    <CheckCircle2 size={10} /> Scan Passed
                  </span>
                </div>
                <p className="text-gray-400 text-xs font-mono mt-0.5">
                  By {selectedGame.developer || 'Atharv Kamath'} • {selectedGame.genre || selectedGame.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Media gallery */}
              {(activeScreenshot || selectedGame.coverImage || selectedGame.screenshots?.length > 0) && (
                <div className="space-y-3">
                  <div className="h-64 md:h-80 rounded-2xl overflow-hidden bg-[#070a11] border border-white/10">
                    <img
                      src={activeScreenshot || selectedGame.coverImage || selectedGame.screenshots?.[0]}
                      alt={selectedGame.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {(selectedGame.coverImage || (selectedGame.screenshots && selectedGame.screenshots.length > 0)) && (
                    <div className="flex flex-wrap gap-2">
                      {[selectedGame.coverImage, ...(selectedGame.screenshots || [])]
                        .filter(Boolean)
                        .map((imgUrl, idx) => (
                          <button
                            key={`${imgUrl}-${idx}`}
                            type="button"
                            onClick={() => setActiveScreenshot(imgUrl)}
                            className={`w-20 h-14 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                              activeScreenshot === imgUrl
                                ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                                : 'border-white/10 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={imgUrl}
                              alt={`Preview ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-[#070a11] border border-white/5 rounded-xl">
                  <span className="text-gray-500 block text-[10px]">FILE SIZE</span>
                  <span className="text-white font-bold">
                    {selectedGame.fileSizeFormatted || formatBytes(selectedGame.fileSize)}
                  </span>
                </div>
                <div className="p-3 bg-[#070a11] border border-white/5 rounded-xl">
                  <span className="text-gray-500 block text-[10px]">PLAYER MODE</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Users size={11} className="text-cyan-400" /> {selectedGame.playerMode || 'Single Player'}
                  </span>
                </div>
                <div className="p-3 bg-[#070a11] border border-white/5 rounded-xl">
                  <span className="text-gray-500 block text-[10px]">CONNECTIVITY</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Wifi size={11} className="text-indigo-400" /> {selectedGame.connectivity || 'Offline'}
                  </span>
                </div>
                <div className="p-3 bg-[#070a11] border border-white/5 rounded-xl">
                  <span className="text-gray-500 block text-[10px]">AGE / RELEASE</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Calendar size={11} className="text-purple-400" />{' '}
                    {selectedGame.ageRating || 'Everyone'} {selectedGame.releaseDate ? `• ${selectedGame.releaseDate}` : ''}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-mono uppercase text-cyan-400 font-bold mb-2">About This Game</h4>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-light">
                  {selectedGame.description}
                </p>
              </div>

              {/* System Requirements */}
              {selectedGame.requirements && (
                <div className="bg-[#070a11] border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-mono uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                      <Monitor size={14} /> System Requirements
                    </h4>
                    <span className="text-[11px] font-mono text-gray-300">
                      OS: {(selectedGame.requirements.supportedOS || []).join(', ') || 'Windows'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-[#0c1220] border border-white/5 rounded-xl space-y-2">
                      <h5 className="text-gray-200 font-mono font-bold uppercase text-[11px]">Minimum</h5>
                      <p className="text-gray-400"><strong className="text-gray-200">Processor:</strong> {selectedGame.requirements.minProcessor || 'Not specified'}</p>
                      <p className="text-gray-400"><strong className="text-gray-200">RAM:</strong> {selectedGame.requirements.minRam || 'Not specified'}</p>
                      <p className="text-gray-400"><strong className="text-gray-200">Storage:</strong> {selectedGame.requirements.minStorage || 'Not specified'}</p>
                      <p className="text-gray-400"><strong className="text-gray-200">Graphics:</strong> {selectedGame.requirements.minGraphics || 'Integrated'}</p>
                    </div>
                    <div className="p-4 bg-[#0c1220] border border-white/5 rounded-xl space-y-2">
                      <h5 className="text-cyan-300 font-mono font-bold uppercase text-[11px]">Recommended</h5>
                      <p className="text-gray-400"><strong className="text-gray-200">Processor:</strong> {selectedGame.requirements.recProcessor || 'Not specified'}</p>
                      <p className="text-gray-400"><strong className="text-gray-200">RAM:</strong> {selectedGame.requirements.recRam || 'Not specified'}</p>
                      <p className="text-gray-400"><strong className="text-gray-200">Storage:</strong> {selectedGame.requirements.recStorage || 'Not specified'}</p>
                      <p className="text-gray-400"><strong className="text-gray-200">Graphics:</strong> {selectedGame.requirements.recGraphics || 'Dedicated GPU'}</p>
                    </div>
                  </div>
                  {selectedGame.requirements.additionalRequirements && (
                    <p className="text-xs text-gray-400 font-light">
                      <strong className="text-gray-200">Additional Requirements:</strong> {selectedGame.requirements.additionalRequirements}
                    </p>
                  )}
                </div>
              )}

              {/* Installation Instructions & Notes */}
              {(selectedGame.installationInstructions || selectedGame.additionalNotes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedGame.installationInstructions && (
                    <div className="p-4 bg-[#070a11] border border-white/10 rounded-2xl">
                      <h4 className="text-xs font-mono uppercase text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                        <Terminal size={13} /> Installation Instructions
                      </h4>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-light">
                        {selectedGame.installationInstructions}
                      </p>
                    </div>
                  )}
                  {selectedGame.additionalNotes && (
                    <div className="p-4 bg-[#070a11] border border-white/10 rounded-2xl">
                      <h4 className="text-xs font-mono uppercase text-purple-400 font-bold mb-2">
                        Additional Notes
                      </h4>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-light">
                        {selectedGame.additionalNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Integrity & Download Footer */}
              <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-[11px] font-mono space-y-1">
                  <div className="text-gray-300">
                    Package: <strong className="text-white">{selectedGame.downloadFileName || selectedGame.title}</strong> ({selectedGame.fileType || 'ZIP'})
                  </div>
                  {selectedGame.sha256 && (
                    <div className="text-gray-400 break-all">
                      SHA-256: <span className="text-cyan-300">{selectedGame.sha256}</span>
                    </div>
                  )}
                  <div className="text-gray-400">
                    Total Downloads:{' '}
                    <strong className="text-white">
                      {Math.max(downloadCounts[selectedGame.gameId] || 0, selectedGame.downloadCount || 0)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={downloadingId === selectedGame.gameId}
                  onClick={() => handleDownloadGame(selectedGame)}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {downloadingId === selectedGame.gameId ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Generating Link...
                    </>
                  ) : selectedGame.storageProvider === 'external_only' ? (
                    <>
                      <ExternalLink size={14} /> Download External
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Download Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
