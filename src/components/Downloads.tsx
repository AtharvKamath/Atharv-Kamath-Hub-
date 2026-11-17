/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Download, FileText, Folder, Image, FileCode, CheckCircle, Database } from 'lucide-react';
import { DownloadItem } from '../types';

interface DownloadsProps {
  downloads: DownloadItem[];
  onDownloadClick: (id: string, isRealDownloadUrl: boolean) => void;
}

export default function Downloads({ downloads, onDownloadClick }: DownloadsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  const categories = ['All', 'Notes', 'Templates', 'Wallpapers', 'Software', 'Other'];

  const filteredItems = downloads.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getFileIcon = (fileType: string) => {
    switch (fileType.toUpperCase()) {
      case 'PDF':
        return <FileText className="text-red-500" size={24} />;
      case 'ZIP':
      case 'RAR':
        return <Folder className="text-orange-400" size={24} />;
      case 'PNG':
      case 'JPG':
      case 'JPEG':
        return <Image className="text-blue-400" size={24} />;
      default:
        return <FileCode className="text-emerald-400" size={24} />;
    }
  };

  const hasValidAssetUrl = (url?: string) => {
    if (!url) return false;
    const trimmed = url.trim();
    return Boolean(trimmed && trimmed !== '#');
  };

  const handleDownload = (item: DownloadItem) => {
    const isRealAsset = hasValidAssetUrl(item.downloadUrl);
    onDownloadClick(item.id, isRealAsset);
    setDownloadSuccessId(item.id);
    if (isRealAsset) {
      setNoticeText(null);
      const anchor = document.createElement('a');
      anchor.href = item.downloadUrl;
      anchor.download = item.title;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } else {
      setNoticeText(`"${item.title}" file upload has not been attached yet — your request has been recorded.`);
    }

    setTimeout(() => {
      setDownloadSuccessId(null);
    }, 2500);
  };

  return (
    <section id="downloads" className="py-24 bg-[#070a11] border-b border-white/5 relative">
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Resource Library</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Digital Library & Downloads
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Search and Category Filters Panel */}
        <div className="bg-[#0b1220]/80 border border-white/5 rounded-2xl p-6 mb-12 shadow-md backdrop-blur-md">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-500">
                <Search size={16} />
              </span>
              <input
                id="downloads-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, templates, software, setups..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs md:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 justify-center md:justify-end">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-cyan-500 text-black font-bold shadow-md'
                      : 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {noticeText && (
            <p className="mt-4 text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
              {noticeText}
            </p>
          )}
        </div>

        {/* Resources Grid */}
        <div id="downloads-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredItems.map((item) => {
            const isRealAsset = hasValidAssetUrl(item.downloadUrl);
            return (
              <div
                key={item.id}
                id={`download-item-${item.id}`}
                className="group bg-[#0c1220]/60 border border-white/5 hover:border-white/10 rounded-2xl p-6 flex gap-5 transition-all duration-300 shadow-md hover:shadow-cyan-500/5 hover:scale-[1.01] backdrop-blur-md"
              >
                {/* File Icon column */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex-shrink-0 self-start">
                  {getFileIcon(item.fileType)}
                </div>

                {/* Metadata details */}
                <div className="flex-grow min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-gray-400 font-mono text-[9px] font-bold rounded uppercase">
                        {item.fileType}
                      </span>
                      <span className="text-gray-500 text-[10px] font-mono">{item.fileSize}</span>
                    </div>
                    <h3 className="text-white font-sans font-bold text-base leading-tight group-hover:text-cyan-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-gray-400 text-xs mt-1.5 leading-relaxed font-light line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Counter & Action */}
                  <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-gray-500 font-mono text-[10px] flex items-center gap-1.5">
                      <Database size={11} className="text-cyan-400" />{' '}
                      {isRealAsset ? 'Downloads' : 'Download Requests'}: <strong>{item.downloadsCount}</strong>
                    </span>

                    {downloadSuccessId === item.id ? (
                      <span
                        id={`dl-success-msg-${item.id}`}
                        className="flex items-center gap-1 text-[11px] font-mono text-green-400 font-bold bg-green-500/10 py-1.5 px-3 border border-green-500/20 rounded-lg"
                      >
                        <CheckCircle size={12} /> {isRealAsset ? 'Downloading...' : 'Recorded'}
                      </span>
                    ) : (
                      <button
                        id={`dl-action-btn-${item.id}`}
                        onClick={() => handleDownload(item)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 text-cyan-400 hover:text-black rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Download size={12} /> {isRealAsset ? 'Download' : 'Request'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 font-mono text-sm">
              No downloadable resources matched your query.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
