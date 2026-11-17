/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowDown, Youtube, Instagram, Facebook, Github, Linkedin, Mail, ExternalLink } from 'lucide-react';
import { Profile } from '../types';

interface HeroProps {
  profile: Profile;
}

export default function Hero({ profile }: HeroProps) {
  const [currentBg, setCurrentBg] = useState(0);

  const banners = profile.banners && profile.banners.length > 0 ? profile.banners : [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80"
  ];

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % banners.length);
    }, 6000); // Fluid slide transition every 6 seconds
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getSocialIcon = (key: string) => {
    switch (key) {
      case 'youtube':
        return <Youtube size={20} />;
      case 'instagram':
        return <Instagram size={20} />;
      case 'facebook':
        return <Facebook size={20} />;
      case 'github':
        return <Github size={20} />;
      case 'linkedin':
        return <Linkedin size={20} />;
      default:
        return <Mail size={20} />;
    }
  };

  return (
    <section id="home" className="relative h-screen w-full overflow-hidden bg-black flex items-center justify-center">
      {/* Dynamic hardware-accelerated individual slide layers */}
      <div className="absolute inset-0 h-full w-full">
        {banners.map((url, idx) => {
          const isActive = idx === currentBg;
          return (
            <div
              key={`${url}-${idx}`}
              id={`hero-bg-slide-${idx}`}
              className={`absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-[1600ms] select-none pointer-events-none will-change-[opacity,transform] ${
                isActive 
                  ? 'opacity-45 scale-100 z-1' 
                  : 'opacity-0 scale-105 z-0'
              }`}
              style={{ 
                backgroundImage: `url('${url}')`,
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          );
        })}
      </div>

      {/* Slide Navigator Dots */}
      {banners.length > 1 && (
        <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-10">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBg(idx)}
              className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
                idx === currentBg 
                  ? 'bg-cyan-400 border-cyan-400 h-6' 
                  : 'bg-white/20 border-white/10 hover:bg-white/40'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Dark vignette layers */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-transparent to-black/70" />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center animate-fade-in">
        {/* Animated Accent Bar */}
        <div className="h-1.5 w-24 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 rounded-full mb-8 animate-pulse" />

        {/* Creative Subtitle / Tagline */}
        <p
          id="hero-subtitle"
          className="text-cyan-400 font-mono text-sm md:text-base tracking-wider uppercase mb-6"
        >
          {profile.titles.join('  •  ')}
        </p>

        {/* Introduction Phrase */}
        <p
          id="hero-tagline"
          className="text-gray-300 text-base md:text-lg max-w-2xl font-light mb-10 leading-relaxed drop-shadow"
        >
          "Creating content, building ideas, and sharing experiences—one story at a time."
        </p>

        {/* Dual Call to Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-12">
          <button
            id="hero-explore-btn"
            onClick={() => handleScrollTo('about')}
            className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-full font-semibold text-sm tracking-wide shadow-lg hover:shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            Explore My World
          </button>
          <button
            id="hero-videos-btn"
            onClick={() => handleScrollTo('links')}
            className="px-8 py-3.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-full font-semibold text-sm tracking-wide transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5"
          >
            Latest Content <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Floating vertical scrolling indicators */}
      <div
        id="scroll-down-indicator"
        onClick={() => handleScrollTo('about')}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer z-10 group"
      >
        <span className="text-gray-400 text-[10px] font-mono uppercase tracking-widest group-hover:text-cyan-400 transition-colors">
          Scroll Down
        </span>
        <div className="p-1 rounded-full border border-gray-500/40 group-hover:border-cyan-400/80 transition-colors animate-bounce">
          <ArrowDown size={14} className="text-gray-400 group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>
    </section>
  );
}
