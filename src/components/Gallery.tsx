/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight, Calendar, Focus } from 'lucide-react';
import { Photo } from '../types';

interface GalleryProps {
  photos: Photo[];
}

export default function Gallery({ photos }: GalleryProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const categories = ['All', 'Travel', 'Nature', 'Tech', 'Gaming Setup', 'College Life', 'Events', 'Photography'];

  const filteredPhotos =
    activeCategory === 'All' ? photos : photos.filter((p) => p.category === activeCategory);

  const openLightbox = (photoId: string) => {
    // Find the index in the CURRENT filtered list to make slide navigation continuous
    const idx = filteredPhotos.findIndex((p) => p.id === photoId);
    if (idx !== -1) {
      setLightboxIdx(idx);
    }
  };

  const closeLightbox = () => setLightboxIdx(null);

  const navigateLightbox = (dir: 'prev' | 'next') => {
    if (lightboxIdx === null) return;
    let nextIdx = dir === 'next' ? lightboxIdx + 1 : lightboxIdx - 1;
    if (nextIdx >= filteredPhotos.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = filteredPhotos.length - 1;
    setLightboxIdx(nextIdx);
  };

  return (
    <section id="gallery" className="py-24 bg-[#090d16] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Visual Journeys</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Photography & Gallery
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Categories selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div id="gallery-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              id={`gallery-item-${photo.id}`}
              onClick={() => openLightbox(photo.id)}
              className="group relative h-64 overflow-hidden rounded-2xl bg-[#0a0f1d] border border-white/5 cursor-pointer shadow-md hover:shadow-cyan-500/10 transition-all duration-500 hover:-translate-y-1"
            >
              <img
                src={photo.url}
                alt={photo.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              {/* Glass overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5" />

              {/* Title & category on hover */}
              <div className="absolute bottom-0 left-0 w-full p-5 z-10 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-mono font-bold rounded uppercase tracking-wider">
                  {photo.category}
                </span>
                <h3 className="text-white font-semibold font-sans text-sm mt-1.5 truncate">
                  {photo.title}
                </h3>
                <p className="text-gray-400 text-[10px] font-mono mt-0.5 flex items-center gap-1">
                  <Calendar size={10} /> {photo.date}
                </p>
              </div>

              {/* Centered hover icon */}
              <div className="absolute top-4 right-4 p-2.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-10">
                <Focus size={14} />
              </div>
            </div>
          ))}

          {filteredPhotos.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 font-mono text-sm">
              No photos found in this category yet.
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIdx !== null && (
        <div
          id="gallery-lightbox"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-fade-in"
        >
          {/* Close button */}
          <button
            id="lightbox-close-btn"
            onClick={closeLightbox}
            className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-all cursor-pointer z-10"
          >
            <X size={20} />
          </button>

          {/* Previous selector */}
          <button
            id="lightbox-prev-btn"
            onClick={() => navigateLightbox('prev')}
            className="absolute left-6 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-all cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Active Image and Meta info */}
          <div className="max-w-4xl w-full flex flex-col items-center">
            <img
              src={filteredPhotos[lightboxIdx].url}
              alt={filteredPhotos[lightboxIdx].title}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] max-w-full object-contain rounded-xl border border-white/10 shadow-2xl animate-scale-up"
            />
            {/* Meta details */}
            <div className="text-center mt-5 max-w-xl">
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-mono font-bold rounded uppercase tracking-wider">
                {filteredPhotos[lightboxIdx].category}
              </span>
              <h3 className="text-white text-lg font-bold mt-2 leading-tight">
                {filteredPhotos[lightboxIdx].title}
              </h3>
              {filteredPhotos[lightboxIdx].description && (
                <p className="text-gray-300 text-xs mt-2 max-w-lg leading-relaxed mx-auto font-light">
                  {filteredPhotos[lightboxIdx].description}
                </p>
              )}
              <p className="text-gray-400 text-xs font-mono mt-2.5 flex items-center justify-center gap-1">
                <Calendar size={12} /> {filteredPhotos[lightboxIdx].date}
              </p>
            </div>
          </div>

          {/* Next selector */}
          <button
            id="lightbox-next-btn"
            onClick={() => navigateLightbox('next')}
            className="absolute right-6 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-all cursor-pointer"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </section>
  );
}
