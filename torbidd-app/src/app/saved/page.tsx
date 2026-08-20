'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { INITIAL_PROJECTS } from '@/lib/initialData';

export default function SavedPage() {
  const router = useRouter();
  const { L } = useLanguage();
  const { isBookmarked } = useBookmarks();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setProjects(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const savedProjects = useMemo(() => {
    return projects.filter((p) => isBookmarked(p.externalId));
  }, [projects, isBookmarked]);

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">{L('savedTitle')}</h1>
        <p className="page-subtitle">{L('savedSub')}</p>
      </div>

      {savedProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{ICONS.bookmark}</div>
          <h3>{L('noSaved')}</h3>
          <p>{L('noSavedDesc')}</p>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/opportunities')}
            style={{ marginTop: 20 }}
          >
            {ICONS.dashboard}
            <span>{L('browseOpps')}</span>
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {savedProjects.map((p) => (
            <ProjectCard key={p.externalId} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
