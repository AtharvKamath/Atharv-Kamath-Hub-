/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Star, Heart, Bookmark, Award } from 'lucide-react';
import { FavoriteItem } from '../types';

interface FavoritesProps {
  favorites: FavoriteItem[];
}

export default function Favorites({ favorites }: FavoritesProps) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, idx) => (
      <Star
        key={idx}
        size={11}
        className={`${idx < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
      />
    ));
  };

  return (
    <section id="favorites" className="py-24 bg-[#090d16] border-b border-white/5 relative">
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Curated Collections</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            My Favorites & Gear
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Curation Bento Grid */}
        <div id="favorites-grid" className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              id={`fav-card-${fav.id}`}
              className="group bg-[#0b1220]/60 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] shadow-md hover:shadow-cyan-500/5"
            >
              <div>
                {/* Photo frame */}
                <div className="relative h-40 overflow-hidden bg-black/40 rounded-xl mb-4">
                  <img
                    src={fav.image}
                    alt={fav.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-transparent to-transparent" />

                  {/* Rating over tag */}
                  <span className="absolute top-3 left-3 px-2 py-0.5 bg-black/70 border border-white/10 text-cyan-400 font-mono text-[9px] font-bold uppercase rounded-md">
                    {fav.category}
                  </span>
                </div>

                {/* Stars */}
                <div className="flex items-center gap-1 mb-2">
                  {renderStars(fav.rating)}
                </div>

                <h3 className="text-white font-sans font-bold text-sm leading-tight group-hover:text-cyan-400 transition-colors mb-2">
                  {fav.title}
                </h3>
                <p className="text-gray-400 text-xs leading-relaxed font-light line-clamp-3">
                  {fav.description}
                </p>
              </div>

              {/* Footer item marker */}
              <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between text-gray-500 font-mono text-[9px]">
                <span className="flex items-center gap-1 uppercase">
                  <Award size={10} className="text-cyan-400" /> Premium Picks
                </span>
                <span className="p-1 rounded-full bg-white/5 text-gray-400">
                  <Bookmark size={10} />
                </span>
              </div>
            </div>
          ))}

          {favorites.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 font-mono text-sm">
              No favorites curated yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
