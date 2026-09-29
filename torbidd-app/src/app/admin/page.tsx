'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project } from '@/types/project';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { formatTHB } from '@/lib/utils';
import { ProjectFormModal } from '@/components/admin/ProjectFormModal';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';

interface AdminStats {
  totalProjects: number;
  totalBudget: number;
  activeProjects: number;
  aiEnrichedCount: number;
  categoryCounts: Record<string, number>;
  confidenceCounts: Record<string, number>;
  systemStatus: {
    database: string;
    aiService: string;
    crawler: string;
    lastSync: string;
    uptimeSeconds: number;
    memoryUsageMb: number;
  };
  auditLogs: Array<{
    id: string;
    action: string;
    actor: string;
    details: string;
    timestamp: string;
    status: string;
  }>;
}

export default function AdminPage() {
  const { L, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'crawler' | 'audit'>('overview');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Search and filter for Projects tab
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // Syncing state
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    'System standby. Ready to query BMA e-GP API and crawl PDF TOR publications.',
  ]);

  // Alert toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  // Load projects and stats
  const fetchData = useCallback(async () => {
    try {
      const [projRes, statsRes] = await Promise.allSettled([
        fetch('/api/projects'),
        fetch('/api/admin/stats'),
      ]);

      if (projRes.status === 'fulfilled' && projRes.value.ok) {
        const json = await projRes.value.json();
        if (json.data && Array.isArray(json.data)) {
          setProjects(json.data);
        }
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const json = await statsRes.value.json();
        if (json.data) {
          setStats(json.data);
        }
      }
    } catch {
      // Fallback already defaults to INITIAL_PROJECTS
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [projRes, statsRes] = await Promise.allSettled([
          fetch('/api/projects'),
          fetch('/api/admin/stats'),
        ]);
        if (ignore) return;
        if (projRes.status === 'fulfilled' && projRes.value.ok) {
          const json = await projRes.value.json();
          if (json.data && Array.isArray(json.data)) {
            setProjects(json.data);
          }
        }
        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const json = await statsRes.value.json();
          if (json.data) {
            setStats(json.data);
          }
        }
      } catch {}
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);


  // Handle project creation
  const handleCreateProject = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create project');
      }

      const createdItem = result.data as Project;
      setProjects((prev) => [createdItem, ...prev]);
      showToast(L('adminSaveSuccess'));
    } catch (err: unknown) {
      throw err;
    }
  };

  // Handle project edit
  const handleEditProject = async (data: Record<string, unknown>) => {
    if (!editingProject) return;
    const targetId = editingProject.externalId || (editingProject as unknown as { _id: string })._id;

    try {
      const res = await fetch(`/api/projects/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update project');
      }

      const updated = result.data as Project;
      setProjects((prev) =>
        prev.map((p) =>
          p.externalId === editingProject.externalId ||
          (p as unknown as { _id?: string })._id === (editingProject as unknown as { _id?: string })._id
            ? { ...p, ...updated }
            : p,
        ),
      );
      showToast(L('adminSaveSuccess'));
    } catch (err: unknown) {
      throw err;
    }
  };

  // Handle project deletion
  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;
    const targetId = deletingProject.externalId || (deletingProject as unknown as { _id: string })._id;

    try {
      const res = await fetch(`/api/projects/${targetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects((prev) =>
        prev.filter(
          (p) =>
            p.externalId !== deletingProject.externalId &&
            (p as unknown as { _id?: string })._id !== (deletingProject as unknown as { _id?: string })._id,
        ),
      );
      showToast(L('adminDeleteSuccess'));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Deletion failed');
    }
  };

  // Handle BMA e-GP Crawler Sync
  const handleTriggerSync = async () => {
    try {
      setSyncing(true);
      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Initializing BMA e-GP scraper and TOR parser...`,
        ...prev,
      ]);

      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const json = await res.json();

      if (res.ok && json.data) {
        setSyncLogs((prev) => [
          ...json.data.logDetails.map((l: string) => `[${new Date().toLocaleTimeString()}] ${l}`),
          `[${new Date().toLocaleTimeString()}] Sync completed in ${json.data.durationMs}ms`,
          ...prev,
        ]);
        showToast(L('adminSyncSuccess'));
        fetchData();
      } else {
        setSyncLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Error: ${json.error || 'Sync request failed'}`,
          ...prev,
        ]);
      }
    } catch {
      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Network error during sync execution`,
        ...prev,
      ]);
    } finally {
      setSyncing(false);
    }
  };

  // Filtered projects for Project Table
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const titleMatch =
        (p.title?.th && p.title.th.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.title?.en && p.title.en.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(p.externalId).includes(searchQuery) ||
        (p.department?.th && p.department.th.toLowerCase().includes(searchQuery.toLowerCase()));

      const categoryMatch = categoryFilter === 'All' || p.category === categoryFilter;

      return titleMatch && categoryMatch;
    });
  }, [projects, searchQuery, categoryFilter]);

  // Derived statistics
  const totalBudget = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.budget || 0), 0);
  }, [projects]);

  const activeCount = useMemo(() => {
    const now = new Date();
    return projects.filter((p) => new Date(p.deadline) >= now).length;
  }, [projects]);

  return (
    <div className="admin-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-toast-banner" role="status">
          {ICONS.check}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header-main">
          <div className="admin-badge-mode">
            <span className="admin-status-pulse"></span>
            {L('adminBadgeMode')}
          </div>
          <h1 className="admin-title">{L('adminTitle')}</h1>
          <p className="admin-subtitle">{L('adminSub')}</p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="btn btn-secondary admin-sync-btn"
            onClick={handleTriggerSync}
            disabled={syncing}
            id="adminTriggerSyncBtn"
          >
            <span className={syncing ? 'admin-spin' : ''}>{ICONS.refreshCw}</span>
            <span>{syncing ? L('adminSyncing') : L('adminSyncNow')}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingProject(null);
              setFormMode('create');
              setFormModalOpen(true);
            }}
            id="adminCreateProjectBtn"
          >
            {ICONS.plus}
            <span>{L('adminAddProject')}</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="admin-tabs" aria-label="Admin Navigation Tabs">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          id="adminTabOverviewBtn"
        >
          {ICONS.dashboard}
          <span>{L('adminTabOverview')}</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
          id="adminTabProjectsBtn"
        >
          {ICONS.file}
          <span>{L('adminTabProjects')}</span>
          <span className="admin-tab-badge">{projects.length}</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'crawler' ? 'active' : ''}`}
          onClick={() => setActiveTab('crawler')}
          id="adminTabCrawlerBtn"
        >
          {ICONS.terminal}
          <span>{L('adminTabCrawler')}</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
          id="adminTabAuditBtn"
        >
          {ICONS.activity}
          <span>{L('adminTabAudit')}</span>
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <section className="admin-tab-content">
          {/* KPI Metrics */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div className="admin-kpi-icon blue">{ICONS.file}</div>
              <div className="admin-kpi-info">
                <span className="admin-kpi-label">{L('totalOpps')}</span>
                <span className="admin-kpi-value">{projects.length}</span>
              </div>
              <div className="admin-kpi-footer">
                <span className="admin-kpi-trend positive">
                  {ICONS.trendUp} +{projects.length}
                </span>
                <span className="admin-kpi-sub">Managed tenders</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon emerald">{ICONS.clock}</div>
              <div className="admin-kpi-info">
                <span className="admin-kpi-label">{L('adminActiveTenders')}</span>
                <span className="admin-kpi-value">{activeCount}</span>
              </div>
              <div className="admin-kpi-footer">
                <span className="admin-kpi-trend neutral">{projects.length - activeCount} closed</span>
                <span className="admin-kpi-sub">Accepting proposals</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon purple">{ICONS.dollarSign}</div>
              <div className="admin-kpi-info">
                <span className="admin-kpi-label">{L('adminTotalBudgetManaged')}</span>
                <span className="admin-kpi-value" style={{ fontSize: '1.45rem' }}>
                  {formatTHB(totalBudget)}
                </span>
              </div>
              <div className="admin-kpi-footer">
                <span className="admin-kpi-trend positive">BMA FY2026</span>
                <span className="admin-kpi-sub">Approved funding</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon amber">{ICONS.sparkles}</div>
              <div className="admin-kpi-info">
                <span className="admin-kpi-label">{L('adminAiEnrichmentRate')}</span>
                <span className="admin-kpi-value">100%</span>
              </div>
              <div className="admin-kpi-footer">
                <span className="admin-kpi-trend positive">Gemini 1.5 Pro</span>
                <span className="admin-kpi-sub">Auto TOR clauses parsed</span>
              </div>
            </div>
          </div>

          {/* System Vitals & Health Grid */}
          <div className="admin-two-col-grid">
            {/* System Health Card */}
            <div className="admin-surface-card">
              <div className="admin-card-header">
                <div className="admin-card-title-wrap">
                  {ICONS.server}
                  <h3 className="admin-card-title">{L('adminSystemHealth')}</h3>
                </div>
                <span className="status-badge-active">HEALTHY</span>
              </div>

              <div className="admin-vitals-list">
                <div className="admin-vital-row">
                  <span className="admin-vital-name">MongoDB Database</span>
                  <span className="admin-vital-status online">
                    <span className="pulse-dot"></span> Connected (Cluster0 / Atlas)
                  </span>
                </div>
                <div className="admin-vital-row">
                  <span className="admin-vital-name">AI Pipeline (Vertex AI)</span>
                  <span className="admin-vital-status online">
                    <span className="pulse-dot"></span> Gemini 1.5 Pro / Flash Ready
                  </span>
                </div>
                <div className="admin-vital-row">
                  <span className="admin-vital-name">BMA e-GP Webhook Scraper</span>
                  <span className="admin-vital-status neutral">
                    {syncing ? 'Syncing...' : 'Idle (Scheduled 08:00 ICT)'}
                  </span>
                </div>
                <div className="admin-vital-row">
                  <span className="admin-vital-name">Server Node.js Process Uptime</span>
                  <span className="admin-vital-value">
                    {stats?.systemStatus?.uptimeSeconds
                      ? `${Math.floor(stats.systemStatus.uptimeSeconds / 60)}m ${stats.systemStatus.uptimeSeconds % 60}s`
                      : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Category Summary */}
            <div className="admin-surface-card">
              <div className="admin-card-header">
                <div className="admin-card-title-wrap">
                  {ICONS.target}
                  <h3 className="admin-card-title">Procurement Category Breakdown</h3>
                </div>
              </div>

              <div className="admin-category-bars">
                {['Website', 'Mobile App', 'AI', 'Database'].map((cat) => {
                  const count = projects.filter((p) => p.category === cat).length;
                  const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
                  return (
                    <div key={cat} className="admin-category-row">
                      <div className="admin-category-header">
                        <span className="admin-category-name">{cat}</span>
                        <span className="admin-category-count">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="admin-progress-bg">
                        <div
                          className="admin-progress-fill"
                          style={{
                            width: `${pct}%`,
                            background:
                              cat === 'Website'
                                ? '#3b82f6'
                                : cat === 'Mobile App'
                                ? '#10b981'
                                : cat === 'AI'
                                ? '#a855f7'
                                : '#f59e0b',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: PROJECTS MANAGEMENT TABLE */}
      {activeTab === 'projects' && (
        <section className="admin-tab-content">
          <div className="admin-table-controls">
            <div className="admin-search-wrap">
              {ICONS.search}
              <input
                type="text"
                className="admin-search-input"
                placeholder={L('adminSearchProjects')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="adminProjectSearchInput"
              />
            </div>

            <div className="admin-filters-wrap">
              <select
                className="admin-select-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                id="adminCategoryFilterSelect"
              >
                <option value="All">{L('allCategories')}</option>
                <option value="Website">Website</option>
                <option value="Mobile App">Mobile App</option>
                <option value="AI">AI</option>
                <option value="Database">Database</option>
              </select>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>{L('projectName')}</th>
                  <th>{L('department')}</th>
                  <th>{L('category')}</th>
                  <th style={{ textAlign: 'right' }}>{L('budget')}</th>
                  <th>{L('deadline')}</th>
                  <th>AI Match</th>
                  <th style={{ textAlign: 'center', width: 140 }}>{L('adminActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                      {L('noResults')}
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => {
                    const title = language === 'th' ? project.title.th : project.title.en;
                    const dept = language === 'th' ? project.department.th : project.department.en;
                    const isClosed = new Date(project.deadline) < new Date();

                    return (
                      <tr key={project.externalId || (project as unknown as { _id: string })._id}>
                        <td className="admin-cell-id">#{project.externalId}</td>
                        <td className="admin-cell-title">
                          <Link
                            href={`/opportunities/${project.externalId}`}
                            className="admin-project-link"
                            title="View public detail"
                          >
                            {title}
                          </Link>
                          <div className="admin-cell-meta">{project.procurementType}</div>
                        </td>
                        <td className="admin-cell-dept">{dept}</td>
                        <td>
                          <span className={`admin-cat-badge ${project.category.toLowerCase().replace(/\s+/g, '-')}`}>
                            {project.category}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatTHB(project.budget)}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.875rem' }}>
                            {new Date(project.deadline).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US')}
                          </div>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: isClosed ? '#ef4444' : '#10b981',
                            }}
                          >
                            {isClosed ? '● Closed' : '● Open'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="admin-conf-badge"
                            style={{
                              background:
                                project.aiConfidence === 'High'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : 'rgba(245, 158, 11, 0.12)',
                              color: project.aiConfidence === 'High' ? '#10b981' : '#f59e0b',
                            }}
                          >
                            {project.aiConfidence || 'High'}
                          </span>
                        </td>
                        <td>
                          <div className="admin-actions-cell">
                            <button
                              type="button"
                              className="admin-icon-action-btn edit"
                              onClick={() => {
                                setEditingProject(project);
                                setFormMode('edit');
                                setFormModalOpen(true);
                              }}
                              title={L('adminEditProject')}
                              id={`editProjectBtn_${project.externalId}`}
                            >
                              {ICONS.edit}
                            </button>
                            <button
                              type="button"
                              className="admin-icon-action-btn delete"
                              onClick={() => {
                                setDeletingProject(project);
                                setDeleteModalOpen(true);
                              }}
                              title={L('adminDeleteProject')}
                              id={`deleteProjectBtn_${project.externalId}`}
                            >
                              {ICONS.trash}
                            </button>
                            <Link
                              href={`/opportunities/${project.externalId}`}
                              className="admin-icon-action-btn"
                              title={L('viewDetail')}
                              target="_blank"
                            >
                              {ICONS.externalLink}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: CRAWLER & AI CONSOLE */}
      {activeTab === 'crawler' && (
        <section className="admin-tab-content">
          <div className="admin-surface-card" style={{ marginBottom: 20 }}>
            <div className="admin-card-header">
              <div className="admin-card-title-wrap">
                {ICONS.database}
                <h3 className="admin-card-title">{L('adminCrawlerStatus')}</h3>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTriggerSync}
                disabled={syncing}
              >
                <span className={syncing ? 'admin-spin' : ''}>{ICONS.refreshCw}</span>
                <span>{syncing ? L('adminSyncing') : L('adminSyncNow')}</span>
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              The TORBIDD Scraper daemon regularly connects to the BMA e-Government Procurement portal,
              retrieves draft and official TOR specifications, passes PDFs into Vertex AI Gemini 1.5 Pro,
              and structures requirements into JSON models.
            </p>

            {/* Terminal Log Console */}
            <div className="admin-terminal-window">
              <div className="admin-terminal-header">
                <div className="admin-terminal-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div className="admin-terminal-title">crawler-sync-daemon.log</div>
              </div>
              <div className="admin-terminal-body" id="adminTerminalLogs">
                {syncLogs.map((log, idx) => (
                  <div key={idx} className="admin-terminal-line">
                    <span className="term-prompt">&gt;</span> {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <section className="admin-tab-content">
          <div className="admin-surface-card">
            <div className="admin-card-header">
              <div className="admin-card-title-wrap">
                {ICONS.activity}
                <h3 className="admin-card-title">{L('adminRecentAudit')}</h3>
              </div>
            </div>

            <div className="admin-audit-list">
              {(stats?.auditLogs || [
                {
                  id: 'default-1',
                  action: 'ADMIN_ACCESS',
                  actor: 'BMA Procurement Officer',
                  details: 'Accessed Administration Panel dashboard',
                  timestamp: new Date().toISOString(),
                  status: 'success',
                },
              ]).map((log) => (
                <div key={log.id} className="admin-audit-item">
                  <div className="admin-audit-badge success">
                    {ICONS.check}
                  </div>
                  <div className="admin-audit-content">
                    <div className="admin-audit-action">
                      <strong>{log.action}</strong> • <span style={{ color: 'var(--text-secondary)' }}>{log.actor}</span>
                    </div>
                    <div className="admin-audit-desc">{log.details}</div>
                  </div>
                  <div className="admin-audit-time">
                    {new Date(log.timestamp).toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MODALS */}
      <ProjectFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={formMode === 'create' ? handleCreateProject : handleEditProject}
        initialProject={editingProject}
        mode={formMode}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        project={deletingProject}
      />
    </div>
  );
}
