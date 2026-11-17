/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Calendar, BookOpen } from 'lucide-react';
import { TimelineItem } from '../types';

interface TimelineProps {
  timeline: TimelineItem[];
}

export default function Timeline({ timeline }: TimelineProps) {
  return (
    <section id="timeline" className="py-24 bg-[#070a11] border-b border-white/5 relative">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">History & Path</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            My Creative Journey
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Vertical Timeline Track */}
        <div className="relative max-w-3xl mx-auto">
          {/* Main vertical line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 via-indigo-500 to-transparent transform md:-translate-x-1/2" />

          {timeline.map((item, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <div
                key={item.id}
                id={`timeline-item-${item.id}`}
                className="relative flex flex-col md:flex-row items-start md:items-center justify-between mb-16 group"
              >
                {/* Connector Dot */}
                <div className="absolute left-4 md:left-1/2 p-1 bg-[#070a11] border border-cyan-400 rounded-full transform md:-translate-x-1/2 z-10 group-hover:scale-110 transition-all duration-300">
                  <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping absolute opacity-75" />
                  <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full relative" />
                </div>

                {/* Left block (Even Index has details on desktop, Odd Index has empty padding) */}
                <div className={`w-full md:w-[45%] pl-12 md:pl-0 ${isEven ? 'md:text-right md:order-1' : 'md:order-2 opacity-0 select-none md:block hidden'}`}>
                  {isEven && (
                    <div className="bg-[#0c1220]/70 border border-white/5 hover:border-cyan-500/25 p-6 rounded-2xl transition-all duration-300 backdrop-blur-md">
                      <span className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-bold rounded-full mb-3">
                        {item.year}
                      </span>
                      <h3 className="text-white font-sans font-bold text-lg mb-1">{item.title}</h3>
                      <p className="text-cyan-400/80 font-mono text-xs mb-3">{item.subtitle}</p>
                      <p className="text-gray-400 text-xs md:text-sm leading-relaxed font-light">{item.description}</p>
                    </div>
                  )}
                </div>

                {/* Right block (Odd Index has details on desktop, Even Index has empty padding) */}
                <div className={`w-full md:w-[45%] pl-12 md:pl-0 ${!isEven ? 'md:order-2' : 'md:order-1 opacity-0 select-none md:block hidden'}`}>
                  {!isEven && (
                    <div className="bg-[#0c1220]/70 border border-white/5 hover:border-indigo-500/25 p-6 rounded-2xl transition-all duration-300 backdrop-blur-md">
                      <span className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold rounded-full mb-3">
                        {item.year}
                      </span>
                      <h3 className="text-white font-sans font-bold text-lg mb-1">{item.title}</h3>
                      <p className="text-indigo-400/80 font-mono text-xs mb-3">{item.subtitle}</p>
                      <p className="text-gray-400 text-xs md:text-sm leading-relaxed font-light">{item.description}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
