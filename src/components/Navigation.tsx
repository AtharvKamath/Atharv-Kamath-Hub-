/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, X, Shield, Settings } from 'lucide-react';
import { Profile } from '../types';

interface NavigationProps {
  profile?: Profile;
  onAdminClick: () => void;
  isAdmin: boolean;
  onLogout: () => void;
  showAdminTrigger: boolean;
}

export default function Navigation({ profile, onAdminClick, isAdmin, onLogout, showAdminTrigger }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Simple active section detection
      const sections = ['home', 'about', 'links', 'gallery', 'projects', 'downloads', 'gaming', 'blogs', 'timeline', 'contact'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom >= 120) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'links', label: 'Links' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'projects', label: 'Projects' },
    { id: 'downloads', label: 'Library' },
    { id: 'gaming', label: 'Gaming Zone' },
    { id: 'blogs', label: 'Blogs' },
    { id: 'timeline', label: 'Journey' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleScrollTo = (id: string) => {
    setIsOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav
      id="nav-bar"
      className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5 py-3 shadow-lg'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          id="brand-logo-btn"
          onClick={() => handleScrollTo('home')}
          className="text-white font-sans text-xl font-bold tracking-tight cursor-pointer hover:opacity-95 flex items-center gap-2.5 group"
        >
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)] group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <svg
              id="nav-logo-svg"
              className="w-10 h-10 md:w-11 md:h-11 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] group-hover:scale-105 group-hover:rotate-3 transition-all duration-300"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="logo-border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="30%" stopColor="#818cf8" />
                  <stop offset="60%" stopColor="#ec4899" />
                  <stop offset="85%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
                <linearGradient id="k-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="sun-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#fca5a5" />
                </linearGradient>
                <filter id="glow-effect" x="-15%" y="-15%" width="130%" height="130%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Black Badge Background */}
              <circle cx="100" cy="100" r="95" fill="#060913" />
              
              {/* Outer Ring with multi-stop neon gradient */}
              <circle
                cx="100"
                cy="100"
                r="92"
                stroke="url(#logo-border-gradient)"
                strokeWidth="2.5"
                strokeDasharray="1000"
                className="opacity-95"
              />
              <circle
                cx="100"
                cy="100"
                r="88"
                stroke="url(#logo-border-gradient)"
                strokeWidth="1"
                className="opacity-30"
              />

              {/* Mountains & Sun at top */}
              <circle cx="118" cy="46" r="11" fill="url(#sun-gradient)" />
              <path
                d="M 52 68 L 74 52 L 90 61 L 116 42 L 138 64 L 152 53 L 164 68"
                stroke="rgba(255, 255, 255, 0.8)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path d="M 74 52 L 82 68 M 116 42 L 124 64" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1.5" />
              
              {/* Flying Birds */}
              <path d="M 136 34 Q 139 31 142 34 Q 145 31 148 34" stroke="rgba(255,255,255,0.7)" strokeWidth="1" strokeLinecap="round" fill="none" />
              <path d="M 148 38 Q 150 36 152 38 Q 154 36 156 38" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round" fill="none" />

              {/* Minimalist Camera Icon at Top Center */}
              <rect x="92" y="22" width="16" height="11" rx="2" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.2" fill="none" />
              <circle cx="100" cy="27.5" r="3" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1" fill="none" />
              <rect x="98.5" y="19" width="3" height="3" fill="rgba(255, 255, 255, 0.85)" rx="0.5" />

              {/* Central Monogram AK */}
              <g id="logo-monogram-group">
                {/* Letter A (Sleek White) */}
                <polygon points="46,118 73,72 82,72 55,118" fill="#ffffff" />
                <polygon points="73,72 82,72 93,95 84,95" fill="#ffffff" />
                <polygon points="56,102 85,102 83,106 58,106" fill="#ffffff" />

                {/* Letter K (Vibrant Orange-to-Purple Gradient) */}
                <polygon points="91,72 100,72 100,118 91,118" fill="url(#k-gradient)" />
                <polygon points="100,92 124,72 133,72 106,96" fill="url(#k-gradient)" />
                <polygon points="102,94 133,118 124,118 97,97" fill="url(#k-gradient)" />

                {/* Glowing Blue Swoosh cutting through */}
                <path
                  d="M 38 100 C 75 92, 115 92, 162 100 C 125 96, 75 96, 38 100"
                  fill="#22d3ee"
                  filter="url(#glow-effect)"
                />
              </g>

              {/* Left Side Luminescent Icons */}
              {/* YouTube Play Button */}
              <g filter="drop-shadow(0 0 3px rgba(239, 68, 68, 0.5))">
                <rect x="25" y="70" width="14" height="10" rx="2.5" fill="#ef4444" />
                <polygon points="31,73 31,77 35,75" fill="#ffffff" />
              </g>
              {/* Content Camera */}
              <g filter="drop-shadow(0 0 3px rgba(34, 211, 238, 0.5))">
                <rect x="23" y="88" width="13" height="9" rx="1.5" stroke="#22d3ee" strokeWidth="1" fill="none" />
                <circle cx="29.5" cy="92.5" r="2" stroke="#22d3ee" strokeWidth="1" fill="none" />
                <rect x="28" y="86" width="3" height="2" fill="#22d3ee" rx="0.5" />
              </g>
              {/* Gamer Controller */}
              <g filter="drop-shadow(0 0 3px rgba(132, 204, 22, 0.5))">
                <rect x="21" y="106" width="14" height="9" rx="3.5" stroke="#84cc16" strokeWidth="1" fill="none" />
                <path d="M 24 110.5 H 28 M 26 108.5 V 112.5" stroke="#84cc16" strokeWidth="0.8" />
                <circle cx="31" cy="109.5" r="0.6" fill="#84cc16" />
                <circle cx="32.5" cy="111" r="0.6" fill="#84cc16" />
              </g>

              {/* Right Side Luminescent Icons */}
              {/* Music Note */}
              <g filter="drop-shadow(0 0 3px rgba(236, 72, 153, 0.5))">
                <path d="M 160 74 V 65 H 168 V 69 M 160 67 H 168" stroke="#ec4899" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="158" cy="74" r="1.8" fill="#ec4899" />
                <circle cx="166" cy="72" r="1.8" fill="#ec4899" />
              </g>
              {/* Developer Laptop with Code Tag */}
              <g filter="drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))">
                <rect x="162" y="86" width="13" height="9" rx="1" stroke="#3b82f6" strokeWidth="1" fill="none" />
                <line x1="159" y1="96" x2="178" y2="96" stroke="#3b82f6" strokeWidth="1" strokeLinecap="round" />
                <path d="M 166.5 89.5 L 164.5 91 L 166.5 92.5 M 170.5 92.5 L 172.5 91 L 170.5 89.5" stroke="#22d3ee" strokeWidth="0.8" strokeLinecap="round" fill="none" />
              </g>
              {/* Music Recording Microphone */}
              <g filter="drop-shadow(0 0 3px rgba(168, 85, 247, 0.5))">
                <rect x="163" y="104" width="4" height="7" rx="2" stroke="#a855f7" strokeWidth="1" fill="none" />
                <path d="M 161 107.5 C 161 111, 169 111, 169 107.5 M 165 111 V 114 M 162 114 H 168" stroke="#a855f7" strokeWidth="1" strokeLinecap="round" fill="none" />
              </g>

              {/* Bottom Typography & Tagline */}
              {/* Bold Name */}
              <text x="100" y="146" fill="#ffffff" fontFamily="'Space Grotesk', 'Inter', sans-serif" fontWeight="900" fontSize="13.5" letterSpacing="0.4" textAnchor="middle">ATHARV KAMATH</text>
              
              {/* Subtitle */}
              <text x="100" y="159" fill="#22d3ee" fontFamily="'Space Grotesk', 'Inter', sans-serif" fontWeight="700" fontSize="6.5" letterSpacing="1.2" textAnchor="middle">CONTENT CREATOR</text>
              <line x1="42" y1="157" x2="65" y2="157" stroke="rgba(34, 211, 238, 0.3)" strokeWidth="0.8" />
              <line x1="135" y1="157" x2="158" y2="157" stroke="rgba(34, 211, 238, 0.3)" strokeWidth="0.8" />

              {/* Tagline script */}
              <text x="100" y="174" fill="#e2e8f0" fontFamily="cursive, Georgia, serif" fontWeight="500" fontStyle="italic" fontSize="7.5" letterSpacing="0.2" textAnchor="middle">Create. Inspire. Explore.</text>
              <path d="M 52 179 Q 100 176, 148 179" stroke="url(#k-gradient)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5" />
            </svg>
          )}
          <span className="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent font-sans text-lg md:text-xl font-bold tracking-tight">
            ATHARV KAMATH
          </span>
        </button>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => handleScrollTo(item.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all cursor-pointer ${
                activeSection === item.id
                  ? 'text-cyan-400 bg-white/5 font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* Admin Control Switch */}
          <div className="h-4 w-px bg-white/10 mx-2"></div>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                id="nav-dashboard-btn"
                onClick={onAdminClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-full text-xs font-semibold hover:bg-cyan-500/20 transition-all cursor-pointer"
                title="Open Admin Dashboard"
              >
                <Settings size={13} />
                Dashboard
              </button>
              <button
                id="nav-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full text-xs font-semibold hover:bg-red-500 hover:text-white transition-all cursor-pointer"
              >
                <Shield size={13} />
                Exit Admin
              </button>
            </div>
          ) : (
            <button
              id="nav-admin-btn"
              onClick={onAdminClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-full text-xs font-semibold hover:bg-cyan-500 hover:text-white transition-all cursor-pointer"
            >
              <Settings size={13} className="animate-spin-slow" />
              Admin
            </button>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          {isAdmin && (
            <button
              id="mobile-nav-logout-btn"
              onClick={onLogout}
              className="px-2.5 py-1 text-red-400 bg-red-500/15 border border-red-500/20 rounded-md text-xs font-bold cursor-pointer"
            >
              Exit Admin
            </button>
          )}
          <button
            id="mobile-menu-toggle"
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div
          id="mobile-drawer"
          className="lg:hidden absolute top-full left-0 w-full bg-[#0b0f19]/95 border-b border-white/10 backdrop-blur-lg px-6 py-4 flex flex-col gap-2 shadow-2xl animate-fade-in"
        >
          {menuItems.map((item) => (
            <button
              key={item.id}
              id={`mobile-nav-item-${item.id}`}
              onClick={() => handleScrollTo(item.id)}
              className={`w-full text-left py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeSection === item.id
                  ? 'text-cyan-400 bg-white/5 font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="h-px bg-white/5 my-2"></div>
           {!isAdmin ? (
            <button
              id="mobile-nav-admin-btn"
              onClick={() => {
                setIsOpen(false);
                onAdminClick();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-bold cursor-pointer"
            >
              <Settings size={14} />
              Admin
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                id="mobile-nav-dashboard-btn"
                onClick={() => {
                  setIsOpen(false);
                  onAdminClick();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                <Settings size={14} />
                Open Admin Dashboard
              </button>
              <button
                id="mobile-nav-logout-action"
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold cursor-pointer"
              >
                <Shield size={14} />
                Exit Admin
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
