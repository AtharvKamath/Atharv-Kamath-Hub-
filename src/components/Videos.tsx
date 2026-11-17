/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Video, X, Heart, ExternalLink } from 'lucide-react';
import { Video as VideoType } from '../types';

interface VideosProps {
  videos: VideoType[];
}

export function extractYoutubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('?')) {
    return trimmed;
  }
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    if (match && match[2] && match[2].length === 11) {
      return match[2];
    }
  } catch (e) {
    // ignore
  }
  return trimmed;
}

export default function Videos({ videos }: VideosProps) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const getYoutubeThumb = (vid: VideoType) => {
    if (vid.thumbnailUrl && vid.thumbnailUrl.trim() !== '') {
      return vid.thumbnailUrl;
    }
    const cleanId = extractYoutubeId(vid.youtubeId);
    return `https://img.youtube.com/vi/${cleanId}/mqdefault.jpg`;
  };

  const handlePlayVideo = (youtubeId: string) => {
    const cleanId = extractYoutubeId(youtubeId);
    setActiveVideo(cleanId);
  };

  const closeVideo = () => setActiveVideo(null);

  return (
    <section id="videos" className="py-24 bg-[#090d16] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">My Latest Uploads</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            YouTube & Video Streams
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Videos Grid */}
        <div id="videos-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map((vid) => (
            <div
              key={vid.id}
              id={`video-item-${vid.id}`}
              className="group bg-[#0b1220]/60 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-1"
            >
              {/* Thumbnail Container with Play Icon */}
              <div
                onClick={() => handlePlayVideo(vid.youtubeId)}
                className="relative aspect-video bg-black cursor-pointer overflow-hidden"
              >
                <img
                  src={getYoutubeThumb(vid)}
                  alt={vid.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to high quality unsplash image if youtube fails
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=500&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-black/20" />

                {/* Glass Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-4 rounded-full bg-cyan-500/90 text-black group-hover:bg-cyan-400 group-hover:scale-110 shadow-lg transition-all duration-300 transform scale-100">
                    <Play fill="currentColor" size={18} />
                  </div>
                </div>

                {/* Category label */}
                <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/70 border border-white/10 text-cyan-400 font-mono text-[9px] font-semibold uppercase rounded">
                  {vid.category}
                </span>
              </div>

              {/* Title & Excerpt */}
              <div className="p-5">
                <h3 className="text-white font-bold font-sans text-sm group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
                  {vid.title}
                </h3>
                <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed font-light">
                  {vid.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart size={10} className="text-red-500 animate-pulse" /> Free Stream
                  </span>
                  <a
                    id={`video-external-${vid.id}`}
                    href={vid.youtubeId.includes('http') ? vid.youtubeId : `https://youtube.com/watch?v=${vid.youtubeId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                  >
                    Open YouTube <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          ))}

          {videos.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 font-mono text-sm">
              No videos uploaded yet.
            </div>
          )}
        </div>
      </div>

      {/* Cinematic Theater Video Modal */}
      {activeVideo && (
        <div
          id="video-player-modal"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
        >
          <div className="relative w-full max-w-4xl bg-[#090d16] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0e1424]">
              <div className="flex items-center gap-2 text-cyan-400">
                <Video size={16} />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Cinematic Stream</span>
              </div>
              <button
                id="modal-close-video-btn"
                onClick={closeVideo}
                className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Player Frame */}
            <div className="aspect-video w-full bg-black">
              <iframe
                id="video-player-iframe"
                src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
