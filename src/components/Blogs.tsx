/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Calendar, Clock, X, ArrowLeft, Heart, Share2 } from 'lucide-react';
import { BlogPost } from '../types';

interface BlogsProps {
  blogs: BlogPost[];
  onBlogRead: (id: string) => void;
}

export default function Blogs({ blogs, onBlogRead }: BlogsProps) {
  const [activeBlog, setActiveBlog] = useState<BlogPost | null>(null);

  const handleOpenBlog = (blog: BlogPost) => {
    onBlogRead(blog.id);
    setActiveBlog(blog);
  };

  const closeBlog = () => {
    setActiveBlog(null);
  };

  // Helper to estimate reading time
  const getReadTime = (content: string) => {
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200); // 200 words per minute average
    return `${minutes} min read`;
  };

  // Safe renderer that formats basic markdown markers to styled tags
  const renderBlogContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-xl md:text-2xl font-black text-white mt-8 mb-4">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-lg font-bold text-cyan-400 mt-6 mb-3">
            {trimmed.replace('### ', '')}
          </h4>
        );
      }
      if (trimmed.startsWith('- ')) {
        return (
          <ul key={idx} className="list-disc pl-6 text-gray-300 text-sm md:text-base mb-3 leading-relaxed">
            <li>{trimmed.replace('- ', '')}</li>
          </ul>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-4" />;
      }

      // Handle bold words **text**
      const parts = trimmed.split('**');
      if (parts.length > 1) {
        return (
          <p key={idx} className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
            {parts.map((p, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="text-cyan-400 font-bold">{p}</strong> : p))}
          </p>
        );
      }

      return (
        <p key={idx} className="text-gray-300 text-sm md:text-base leading-relaxed mb-4 font-light">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <section id="blogs" className="py-24 bg-[#090d16] border-b border-white/5 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Thoughts & Tutorials</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Blogs & Articles
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Blogs Grid */}
        <div id="blogs-grid" className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {blogs.map((blog) => (
            <div
              key={blog.id}
              id={`blog-card-${blog.id}`}
              onClick={() => handleOpenBlog(blog)}
              className="group bg-[#0c1220]/60 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden shadow-lg hover:shadow-cyan-500/5 transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between cursor-pointer"
            >
              <div>
                {/* Cover Image */}
                <div className="h-48 overflow-hidden relative">
                  <img
                    src={blog.coverImage}
                    alt={blog.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c1220] via-transparent to-transparent opacity-65" />
                  <span className="absolute top-4 left-4 px-2 py-0.5 bg-cyan-500 text-black font-mono text-[9px] font-bold uppercase rounded-md">
                    {blog.category}
                  </span>
                </div>

                {/* Info */}
                <div className="p-6">
                  <div className="flex items-center gap-4 text-gray-500 font-mono text-[10px] mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {blog.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {getReadTime(blog.content)}
                    </span>
                  </div>

                  <h3 className="text-white font-sans font-bold text-lg group-hover:text-cyan-400 transition-colors mb-2 line-clamp-2">
                    {blog.title}
                  </h3>
                  <p className="text-gray-400 text-xs md:text-sm mt-1.5 leading-relaxed font-light line-clamp-2">
                    {blog.excerpt}
                  </p>
                </div>
              </div>

              {/* Action column footer */}
              <div className="p-6 pt-0 mt-3 flex items-center justify-between border-t border-white/5 text-[10px] font-mono text-gray-500">
                <span className="flex items-center gap-1 text-cyan-400">
                  <BookOpen size={12} /> Read Story →
                </span>
                <span>Reads: <strong>{blog.reads}</strong></span>
              </div>
            </div>
          ))}

          {blogs.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 font-mono text-sm">
              No articles posted yet.
            </div>
          )}
        </div>
      </div>

      {/* Expanded Blog Reader Full-Screen Modal */}
      {activeBlog && (
        <div
          id="blog-reader-modal"
          className="fixed inset-0 z-50 bg-[#090d16] overflow-y-auto animate-fade-in flex flex-col"
        >
          {/* Header Bar */}
          <div className="sticky top-0 bg-[#090d16]/95 border-b border-white/10 p-5 backdrop-blur-md z-20">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <button
                id="blog-reader-back-btn"
                onClick={closeBlog}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-full text-xs font-semibold border border-white/10 transition-all cursor-pointer"
              >
                <ArrowLeft size={13} /> Back to Hub
              </button>
              <div className="flex items-center gap-2">
                <button
                  id="blog-reader-share-btn"
                  onClick={() => alert('Article link copied to clipboard!')}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer"
                  title="Copy link"
                >
                  <Share2 size={13} />
                </button>
                <button
                  id="blog-reader-close-btn"
                  onClick={closeBlog}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Article Page Content Container */}
          <article className="flex-grow py-12 px-6">
            <div className="max-w-3xl mx-auto">
              {/* Category, Date, read time */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-gray-500 mb-4">
                <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-400 font-bold rounded uppercase tracking-wider">
                  {activeBlog.category}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {activeBlog.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {getReadTime(activeBlog.content)}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight mb-8">
                {activeBlog.title}
              </h1>

              {/* Cover Image Banner */}
              <div className="h-64 md:h-96 rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-12">
                <img
                  src={activeBlog.coverImage}
                  alt={activeBlog.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Body Content */}
              <div className="prose prose-invert prose-cyan max-w-none">
                {renderBlogContent(activeBlog.content)}
              </div>
            </div>
          </article>

          {/* Footer Bar */}
          <footer className="border-t border-white/5 bg-[#070a11] py-8 text-center text-xs text-gray-500 font-mono">
            <p>© {new Date().getFullYear()} Atharv Kamath. Thank you for reading.</p>
          </footer>
        </div>
      )}
    </section>
  );
}
