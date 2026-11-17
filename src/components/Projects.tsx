/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink, Github, Cpu, Sparkles } from 'lucide-react';
import { Project } from '../types';

interface ProjectsProps {
  projects: Project[];
}

export default function Projects({ projects }: ProjectsProps) {
  return (
    <section id="projects" className="py-24 bg-[#070a11] border-b border-white/5 relative">
      <div className="absolute top-1/3 right-1/10 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Build & Innovation</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Featured Projects
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Projects Grid */}
        <div id="projects-grid" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {projects.map((project) => (
            <div
              key={project.id}
              id={`project-card-${project.id}`}
              className="group relative bg-[#0c1220]/80 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden shadow-lg hover:shadow-cyan-500/5 transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between backdrop-blur-md"
            >
              {/* Project Image */}
              <div className="relative h-48 overflow-hidden bg-black/40">
                <img
                  src={project.image}
                  alt={project.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1220] to-transparent opacity-60" />

                {/* Featured Badge */}
                {project.featured && (
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-cyan-500 text-black font-sans font-bold text-[10px] uppercase rounded-full shadow-md">
                    <Sparkles size={10} />
                    Featured
                  </div>
                )}
              </div>

              {/* Card Details */}
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-white font-bold font-sans text-lg group-hover:text-cyan-400 transition-colors mb-2">
                    {project.title}
                  </h3>
                  <p className="text-gray-400 text-xs md:text-sm leading-relaxed font-light mb-4">
                    {project.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-white/5 border border-white/5 text-gray-300 text-[10px] font-mono rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Link Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  {project.demoUrl && (
                    <a
                      id={`project-demo-${project.id}`}
                      href={project.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-grow flex items-center justify-center gap-1.5 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500 hover:text-black border border-cyan-500/30 text-cyan-400 hover:border-transparent text-xs font-bold rounded-lg transition-all"
                    >
                      <ExternalLink size={12} />
                      Live Demo
                    </a>
                  )}
                  {project.githubUrl && (
                    <a
                      id={`project-github-${project.id}`}
                      href={project.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-grow flex items-center justify-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-all"
                    >
                      <Github size={12} />
                      Source Code
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 font-mono text-sm">
              No projects showcased yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
