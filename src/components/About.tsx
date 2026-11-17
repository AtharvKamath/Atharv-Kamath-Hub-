/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin, Mail, Sparkles, Calendar, Cpu, Video } from 'lucide-react';
import { Profile, Project, Stat, Video as VideoItem } from '../types';
import { computeContentCreationYears } from '../utils/analytics';

// @ts-ignore
import defaultProfilePhoto from '../profile.svg';

interface AboutProps {
  profile: Profile;
  stats: Stat[];
  videos: VideoItem[];
  projects: Project[];
  publicVisitorSummary?: {
    totalSessions: number;
    visitorsToday: number;
    note: string;
  } | null;
}

export default function About({
  profile,
  videos,
  projects,
  publicVisitorSummary,
}: AboutProps) {
  const videosCount = videos.length;
  const completedProjectsCount = projects.filter((p) => p.status !== 'draft').length;
  const yearsData = computeContentCreationYears(profile.contentCreationStartDate);

  const verifiedCards = [
    {
      id: 'stat-videos',
      label: 'Videos Uploaded',
      displayValue: videosCount.toLocaleString(),
      suffix: '',
      icon: <Video className="text-cyan-400" size={24} />,
    },
    {
      id: 'stat-projects',
      label: 'Projects Completed',
      displayValue: completedProjectsCount.toLocaleString(),
      suffix: '',
      icon: <Cpu className="text-indigo-400" size={24} />,
    },
    {
      id: 'stat-years',
      label: 'Years of Content Creation',
      displayValue: yearsData.display,
      suffix: yearsData.suffix,
      icon: <Calendar className="text-green-400" size={24} />,
    },
  ];

  return (
    <section id="about" className="py-24 bg-[#090d16] border-b border-white/5 relative overflow-hidden">
      {/* Decorative neon background blobs */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Introduction</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Welcome to My Digital World
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Biography & Portrait Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-20">
          {/* Portrait */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
              <div className="relative bg-[#0d1527] border border-white/10 p-2.5 rounded-2xl overflow-hidden shadow-2xl max-w-sm">
                <img
                  id="about-profile-img"
                  src={profile.profilePhoto}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const attempt = parseInt(target.getAttribute('data-attempt') || '0', 10);
                    const fallbacks = [
                      "https://yt3.ggpht.com/Vw9gBHSP3fK6el6UPAXXAVsINIywLFwGo26AKb4C_KQfJy8yaMmxS6QY306OyiJS6mY_2_bw=s600-c-k-c0x00ffffff-no-rj-rp-mo",
                      "https://unavatar.io/youtube/@atharvkamath",
                      "https://unavatar.io/instagram/atharvk.yt",
                      defaultProfilePhoto
                    ];
                    if (attempt < fallbacks.length) {
                      let nextUrl = fallbacks[attempt];
                      if (nextUrl === target.src) {
                        nextUrl = fallbacks[attempt + 1] || defaultProfilePhoto;
                        target.setAttribute('data-attempt', (attempt + 2).toString());
                      } else {
                        target.setAttribute('data-attempt', (attempt + 1).toString());
                      }
                      target.src = nextUrl;
                    } else {
                      target.src = defaultProfilePhoto;
                    }
                  }}
                  className="w-full h-[400px] object-cover rounded-xl grayscale group-hover:grayscale-0 transition-all duration-700 ease-in-out"
                />
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-[#0d1527]/90 backdrop-blur-md rounded-xl border border-white/10">
                  <h3 className="text-white font-bold font-sans text-lg">{profile.name}</h3>
                  <div className="flex flex-col gap-1.5 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <MapPin size={12} /> {profile.location}
                    </span>
                    <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                      <Mail size={12} /> {profile.email}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details / Mission */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <h3 className="text-2xl font-bold text-white mb-4">
              Hi, I'm <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">{profile.name}</span>
            </h3>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-6 font-light">
              {profile.bio}
            </p>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-8 font-light">
              {profile.mission}
            </p>

            {/* Quick badges */}
            <div className="flex flex-wrap gap-2.5 mb-8">
              {profile.titles.map((title) => (
                <span
                  key={title}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold rounded-full"
                >
                  {title}
                </span>
              ))}
            </div>

            {/* Real-time Visitor Badge (Shown publicly ONLY when explicitly enabled by Owner & launched) */}
            {publicVisitorSummary && (
              <div
                className="flex items-center gap-2.5 self-start py-2.5 px-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-xs font-mono"
                title={publicVisitorSummary.note}
              >
                <Sparkles size={14} className="animate-pulse" />
                <span>
                  Visitors Today: <strong>{publicVisitorSummary.visitorsToday.toLocaleString()}</strong>
                  <span className="text-gray-400 ml-2">
                    ({publicVisitorSummary.totalSessions.toLocaleString()} visits)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stat Counter Grid (Verified Live Data Only) */}
        <div id="about-stats-grid" className="grid grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto gap-6">
          {verifiedCards.map((card) => (
            <div
              key={card.id}
              id={card.id}
              className="bg-[#0b1220]/60 border border-white/5 hover:border-white/10 rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-lg backdrop-blur-md"
            >
              <div className="p-3 bg-white/5 rounded-full mb-4">{card.icon}</div>
              <h4 className="text-2xl md:text-3xl font-black text-white font-sans tracking-tight mb-1">
                {card.displayValue}
                {card.suffix && <span className="text-cyan-400">{card.suffix}</span>}
              </h4>
              <p className="text-gray-400 text-xs font-medium tracking-wide">{card.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
