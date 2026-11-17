/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ExternalLink,
  Youtube,
  Instagram,
  Facebook,
  Github,
  Linkedin,
  FolderDown,
  Globe,
  Disc,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { ContentLink, PlatformType } from '../types';

interface ContentHubProps {
  links: ContentLink[];
  onLinkClick: (id: string) => void;
}

export default function ContentHub({ links, onLinkClick }: ContentHubProps) {
  const [filter, setFilter] = useState('All');

  const categories = ['All', ...Array.from(new Set(links.map((l) => l.category)))];

  const filteredLinks = filter === 'All' ? links : links.filter((l) => l.category === filter);

  // Platform styling lookup mapper
  const getPlatformStyle = (platform: PlatformType) => {
    switch (platform) {
      case 'youtube':
        return {
          icon: <Youtube size={22} />,
          bgColor: 'bg-red-500/10 border-red-500/20 text-red-500',
          hoverBg: 'hover:bg-red-500/15',
        };
      case 'instagram':
        return {
          icon: <Instagram size={22} />,
          bgColor: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
          hoverBg: 'hover:bg-pink-500/15',
        };
      case 'facebook':
        return {
          icon: <Facebook size={22} />,
          bgColor: 'bg-blue-600/10 border-blue-600/20 text-blue-400',
          hoverBg: 'hover:bg-blue-600/15',
        };
      case 'github':
        return {
          icon: <Github size={22} />,
          bgColor: 'bg-slate-400/10 border-slate-400/20 text-slate-300',
          hoverBg: 'hover:bg-slate-400/15',
        };
      case 'linkedin':
        return {
          icon: <Linkedin size={22} />,
          bgColor: 'bg-indigo-600/10 border-indigo-600/20 text-indigo-400',
          hoverBg: 'hover:bg-indigo-600/15',
        };
      case 'spotify':
        return {
          icon: <Disc size={22} />,
          bgColor: 'bg-green-500/10 border-green-500/20 text-green-400',
          hoverBg: 'hover:bg-green-500/15',
        };
      case 'drive':
        return {
          icon: <FolderDown size={22} />,
          bgColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
          hoverBg: 'hover:bg-yellow-500/15',
        };
      default:
        return {
          icon: <Globe size={22} />,
          bgColor: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
          hoverBg: 'hover:bg-cyan-500/15',
        };
    }
  };

  return (
    <section id="links" className="py-24 bg-[#070a11] border-b border-white/5 relative">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Creator Ecosystem</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            My Content Hub
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Categories filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                filter === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content Links Grid */}
        <div id="links-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLinks.map((link) => {
            const style = getPlatformStyle(link.platform);
            return (
              <a
                key={link.id}
                id={`content-link-${link.id}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onLinkClick(link.id)}
                className={`group relative bg-[#0c1220]/80 border border-white/5 hover:border-white/15 p-6 rounded-2xl flex items-start gap-5 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl backdrop-blur-md ${style.hoverBg}`}
              >
                {/* Logo wrapper */}
                <div className={`p-4 rounded-xl border flex-shrink-0 transition-transform group-hover:scale-105 ${style.bgColor}`}>
                  {style.icon}
                </div>

                {/* Details */}
                <div className="flex-grow min-w-0 pr-4">
                  <span className="inline-block text-[10px] font-mono font-bold uppercase text-gray-500 mb-1 tracking-wider">
                    {link.category}
                  </span>
                  <h3 className="text-white font-sans font-bold text-base group-hover:text-cyan-400 transition-colors truncate">
                    {link.title}
                  </h3>
                  <p className="text-gray-400 text-xs md:text-sm mt-1 leading-relaxed font-light">
                    {link.description}
                  </p>

                  {/* Hot popularity counter */}
                  <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-gray-500">
                    <TrendingUp size={12} className="text-cyan-400" />
                    <span>Clicks: <strong>{link.clicks}</strong></span>
                  </div>
                </div>

                {/* Action Arrow */}
                <div className="self-center p-2 rounded-full bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all flex-shrink-0">
                  <ArrowRight size={14} className="transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
