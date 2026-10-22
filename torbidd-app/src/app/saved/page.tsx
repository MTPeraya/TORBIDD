'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import { ProjectCard } from '@/components/ui/ProjectCard';

interface ExtendedProjectWithIds extends Project {
  externalProjectId?: string | number;
  id?: string | number;
}

export default function SavedPage() {
  const router = useRouter();
  const { L } = useLanguage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isBookmarked, bookmarkCount, clearBookmarks, bookmarkedIds } = useBookmarks();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Client-side auth guard (middleware is the primary guard)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?from=/saved');
    }
  }, [authLoading, isAuthenticated, router]);

  // Initial load: Fetch all projects with fallback support
  useEffect(() => {
    let isCancelled = false;

    async function fetchAllProjects() {
      setIsLoadingProjects(true);
      try {
        const res = await fetch('/api/projects?limit=all&all=true');
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data && Array.isArray(json.data)) {
            setProjects(json.data);
          }
        } else {
          // Fallback if limit=all encounters any issue
          const fallbackRes = await fetch('/api/projects?limit=1000&all=true');
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            if (!isCancelled && fallbackJson.data && Array.isArray(fallbackJson.data)) {
              setProjects(fallbackJson.data);
            }
          }
        }
      } catch (err) {
        console.error('[SavedPage] Error fetching projects:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingProjects(false);
        }
      }
    }

    fetchAllProjects();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Fetch any bookmarked project that might be missing from the projects list
  useEffect(() => {
    if (isLoadingProjects || bookmarkedIds.size === 0) return;

    const existingIds = new Set<string>();
    for (const p of projects) {
      const ext = p as ExtendedProjectWithIds;
      if (ext.externalId != null) existingIds.add(String(ext.externalId));
      if (ext._id != null) existingIds.add(String(ext._id));
      if (ext.externalProjectId != null) existingIds.add(String(ext.externalProjectId));
      if (ext.id != null) existingIds.add(String(ext.id));
    }

    const missingIds = Array.from(bookmarkedIds).filter((id) => !existingIds.has(String(id)));
    if (missingIds.length === 0) return;

    let isCancelled = false;
    Promise.allSettled(
      missingIds.map((id) =>
        fetch(`/api/projects/${encodeURIComponent(String(id))}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((rj) => rj?.data || null)
          .catch(() => null),
      ),
    ).then((results) => {
      if (isCancelled) return;
      const extraProjects = results
        .filter(
          (r): r is PromiseFulfilledResult<Project | null> =>
            r.status === 'fulfilled' && Boolean(r.value),
        )
        .map((r) => r.value as Project);

      if (extraProjects.length > 0) {
        setProjects((prev) => [...prev, ...extraProjects]);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [bookmarkedIds, projects, isLoadingProjects]);

  const savedProjects = useMemo(() => {
    return projects.filter((p) => {
      const ext = p as ExtendedProjectWithIds;
      return (
        isBookmarked(ext.externalId) ||
        (ext._id && isBookmarked(ext._id)) ||
        (ext.externalProjectId && isBookmarked(ext.externalProjectId)) ||
        (ext.id && isBookmarked(ext.id))
      );
    });
  }, [projects, isBookmarked]);

  // Show nothing while auth is loading to avoid flicker
  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-content">
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 className="page-title">{L('savedTitle')}</h1>
          <p className="page-subtitle">{L('savedSub')}</p>
        </div>
        {!isLoadingProjects && savedProjects.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={clearBookmarks}
            title={L('clearSavedDesc')}
          >
            {ICONS.trash}
            <span>{L('clearSaved')}</span>
          </button>
        )}
      </div>

      {isLoadingProjects ? (
        <div className="projects-grid" aria-busy="true" aria-label="Loading saved items">
          {Array.from({ length: Math.min(bookmarkCount || 3, 6) }).map((_, idx) => (
            <div key={idx} className="project-card-skeleton">
              <div className="skeleton-line skeleton-tag" />
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-subtitle" />
              <div className="skeleton-budget-box">
                <div className="skeleton-line skeleton-budget" />
              </div>
              <div className="skeleton-footer">
                <div className="skeleton-line skeleton-date" />
                <div className="skeleton-line skeleton-btn" />
              </div>
            </div>
          ))}
        </div>
      ) : savedProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{ICONS.bookmark}</div>
          <h3>{L('noSaved')}</h3>
          <p>{L('noSavedDesc')}</p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              marginTop: 20,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="btn btn-primary"
              onClick={() => router.push('/opportunities')}
            >
              {ICONS.dashboard}
              <span>{L('browseOpps')}</span>
            </button>
            {bookmarkCount > 0 && (
              <button
                className="btn btn-secondary"
                onClick={clearBookmarks}
                title={L('clearSavedDesc')}
              >
                {ICONS.trash}
                <span>{L('clearSaved')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {savedProjects.map((p) => {
            const ext = p as ExtendedProjectWithIds;
            const cardKey = ext.externalId ?? ext.externalProjectId ?? ext._id ?? ext.id;
            return <ProjectCard key={cardKey} project={p} />;
          })}
        </div>
      )}
    </div>
  );
}
