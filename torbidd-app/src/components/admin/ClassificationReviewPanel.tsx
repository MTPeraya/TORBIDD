'use client';

// =============================================================================
// components/admin/ClassificationReviewPanel.tsx
// UC-10: Admin Classification Review Panel
// Allows administrators to review, approve, or correct AI classifications.
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project, ClassificationReviewStatus } from '@/types/project';
import { CATEGORIES } from '@/lib/labels';

type QueueSummary = {
  pendingCount: number;
  approvedCount: number;
  correctedCount: number;
};

type QueueProject = Pick<
  Project,
  | '_id'
  | 'externalId'
  | 'title'
  | 'department'
  | 'category'
  | 'isSoftwareRelated'
  | 'aiConfidence'
  | 'classificationReviewStatus'
  | 'publishDate'
>;

type StatusFilter = 'PENDING_REVIEW' | 'APPROVED' | 'CORRECTED' | 'all';

// ─── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  project: QueueProject | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    projectId: string | number,
    data: {
      category: string;
      isSoftwareRelated: boolean;
      classificationReviewStatus: 'APPROVED' | 'CORRECTED';
      classificationReviewNote?: string;
    },
  ) => Promise<void>;
}

function ReviewModal({ project, isOpen, onClose, onSave }: ReviewModalProps) {
  const { L, language } = useLanguage();

  // State initialized from project prop — modal remounts on each new project via key prop
  const initialCategory = project?.category ?? 'Information System';
  const initialIsSoftware = project?.isSoftwareRelated ?? true;

  const [category, setCategory] = useState(initialCategory);
  const [isSoftwareRelated, setIsSoftwareRelated] = useState(initialIsSoftware);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'CORRECTED'>('APPROVED');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const title = language === 'th' ? project.title?.th : project.title?.en;
  const targetId = project.externalId ?? (project as { _id?: string })._id ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(targetId, { category, isSoftwareRelated, classificationReviewStatus: reviewStatus, classificationReviewNote: note || undefined });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ fontSize: '1.1rem' }}>
            {ICONS.sparkles}
            <span style={{ marginLeft: 8 }}>Review Classification #{project.externalId}</span>
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            {ICONS.close}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ gap: 16 }}>
          {/* Project title */}
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 4 }}>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>{title}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Current AI classification: <strong>{project.category}</strong> · Confidence:{' '}
              <strong style={{ color: project.aiConfidence === 'High' ? '#10b981' : project.aiConfidence === 'Medium' ? '#f59e0b' : '#ef4444' }}>
                {project.aiConfidence}
              </strong>
            </p>
          </div>

          {/* Software flag */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              {L('classificationIsSoftware')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${isSoftwareRelated ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsSoftwareRelated(true)}
                id="reviewIsSoftwareYes"
              >
                ✓ {L('classificationIsSoftware')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${!isSoftwareRelated ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setIsSoftwareRelated(false)}
                id="reviewIsSoftwareNo"
              >
                ✗ {L('classificationIsNotSoftware')}
              </button>
            </div>
          </div>

          {/* Category select */}
          <div>
            <label className="form-label" htmlFor="reviewCategorySelect">
              {L('category')}
            </label>
            <select
              id="reviewCategorySelect"
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!isSoftwareRelated}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Review action */}
          <div>
            <label className="form-label">Review Action</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className={`btn btn-sm ${reviewStatus === 'APPROVED' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReviewStatus('APPROVED')}
                id="reviewStatusApprove"
              >
                {ICONS.check} {L('classificationApprove')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reviewStatus === 'CORRECTED' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setReviewStatus('CORRECTED')}
                id="reviewStatusCorrect"
              >
                {ICONS.edit} {L('classificationCorrect')}
              </button>
            </div>
          </div>

          {/* Review note */}
          <div>
            <label className="form-label" htmlFor="reviewNoteInput">
              {L('classificationNote')} <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>(optional)</span>
            </label>
            <textarea
              id="reviewNoteInput"
              className="form-input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for correction or additional context..."
              style={{ resize: 'vertical' }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{error}</p>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {L('adminCancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} id="reviewSubmitBtn">
              {saving ? 'Saving...' : L('adminSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface ClassificationReviewPanelProps {
  onToast: (msg: string) => void;
}

export function ClassificationReviewPanel({ onToast }: ClassificationReviewPanelProps) {
  const { L, language } = useLanguage();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING_REVIEW');
  const [projects, setProjects] = useState<QueueProject[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({ pendingCount: 0, approvedCount: 0, correctedCount: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<QueueProject | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/classification-queue?status=${statusFilter}&page=${page}&limit=20`,
      );
      if (!res.ok) throw new Error('Failed to fetch queue');
      const json = await res.json();
      setProjects(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
      if (json.summary) setSummary(json.summary);
    } catch {
      // silently degrade
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQueue();
  }, [fetchQueue]);

  const handleBulkReclassify = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/classify-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false, limit: 50 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Bulk classify failed');
      onToast(json.data?.message ?? 'Bulk reclassification complete');
      fetchQueue();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Reclassification failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSaveReview = async (
    projectId: string | number,
    data: {
      category: string;
      isSoftwareRelated: boolean;
      classificationReviewStatus: 'APPROVED' | 'CORRECTED';
      classificationReviewNote?: string;
    },
  ) => {
    const res = await fetch(`/api/projects/${projectId}/classification`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to save');
    onToast('Classification updated successfully');
    fetchQueue();
  };

  const statusBadgeStyle = (status: ClassificationReviewStatus | undefined) => {
    if (status === 'APPROVED') return { background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' };
    if (status === 'CORRECTED') return { background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' };
    return { background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' };
  };

  const statusLabel = (status: ClassificationReviewStatus | undefined) => {
    if (status === 'APPROVED') return L('classificationStatusApproved');
    if (status === 'CORRECTED') return L('classificationStatusCorrected');
    return L('classificationStatusPending');
  };

  return (
    <section className="admin-tab-content">
      {/* Summary KPI row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: L('classificationPendingCount'), count: summary.pendingCount, color: '#f59e0b', filter: 'PENDING_REVIEW' as StatusFilter },
          { label: L('classificationApprovedCount'), count: summary.approvedCount, color: '#10b981', filter: 'APPROVED' as StatusFilter },
          { label: L('classificationCorrectedCount'), count: summary.correctedCount, color: '#a855f7', filter: 'CORRECTED' as StatusFilter },
        ].map(({ label, count, color, filter }) => (
          <button
            key={filter}
            type="button"
            onClick={() => { setStatusFilter(filter); setPage(1); }}
            className="admin-kpi-card"
            style={{
              flex: '1 1 160px',
              cursor: 'pointer',
              border: statusFilter === filter ? `2px solid ${color}` : '2px solid transparent',
              transition: 'border 0.2s',
              textAlign: 'left',
            }}
          >
            <div className="admin-kpi-icon" style={{ background: `${color}22`, color }}>{ICONS.sparkles}</div>
            <div className="admin-kpi-info">
              <span className="admin-kpi-label">{label}</span>
              <span className="admin-kpi-value" style={{ color }}>{count}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="admin-surface-card">
        <div className="admin-card-header">
          <div className="admin-card-title-wrap">
            {ICONS.sparkles}
            <h3 className="admin-card-title">{L('classificationQueue')}</h3>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="admin-select-filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              id="classificationStatusFilter"
            >
              <option value="PENDING_REVIEW">{L('classificationStatusPending')}</option>
              <option value="APPROVED">{L('classificationStatusApproved')}</option>
              <option value="CORRECTED">{L('classificationStatusCorrected')}</option>
              <option value="all">{L('classificationAllStatus')}</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchQueue}
              disabled={loading}
              id="classificationRefreshBtn"
            >
              <span className={loading ? 'admin-spin' : ''}>{ICONS.refreshCw}</span>
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBulkReclassify}
              disabled={bulkLoading}
              id="classificationBulkBtn"
            >
              <span className={bulkLoading ? 'admin-spin' : ''}>{ICONS.sparkles}</span>
              {bulkLoading ? 'Processing...' : L('classificationBulkReclassify')}
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 16 }}>
          {L('classificationQueueSub')} · {total} {total === 1 ? 'project' : 'projects'} found
        </p>

        {/* Table */}
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>{L('projectName')}</th>
                <th>{L('department')}</th>
                <th>{L('category')}</th>
                <th>Software?</th>
                <th>{L('classificationConfidence')}</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: 120 }}>{L('adminActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    No projects found for this filter.
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const title = language === 'th' ? project.title?.th : project.title?.en;
                  const dept = language === 'th' ? project.department?.th : project.department?.en;

                  return (
                    <tr key={project.externalId ?? (project as { _id?: string })._id}>
                      <td className="admin-cell-id">#{project.externalId}</td>
                      <td className="admin-cell-title">{title}</td>
                      <td className="admin-cell-dept" style={{ fontSize: '0.82rem' }}>{dept}</td>
                      <td>
                        <span className={`admin-cat-badge ${(project.category ?? '').toLowerCase().replace(/\s+/g, '-')}`}>
                          {project.category}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 20,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: project.isSoftwareRelated ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
                            color: project.isSoftwareRelated ? '#3b82f6' : '#ef4444',
                          }}
                        >
                          {project.isSoftwareRelated ? 'Software' : 'Non-SW'}
                        </span>
                      </td>
                      <td>
                        <span
                          className="admin-conf-badge"
                          style={{
                            background:
                              project.aiConfidence === 'High'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : project.aiConfidence === 'Medium'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color:
                              project.aiConfidence === 'High'
                                ? '#10b981'
                                : project.aiConfidence === 'Medium'
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          {project.aiConfidence ?? 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span
                          className="admin-conf-badge"
                          style={statusBadgeStyle(project.classificationReviewStatus as ClassificationReviewStatus)}
                        >
                          {statusLabel(project.classificationReviewStatus as ClassificationReviewStatus)}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions-cell">
                          <button
                            type="button"
                            className="admin-icon-action-btn edit"
                            onClick={() => {
                              setReviewTarget(project);
                              setReviewModalOpen(true);
                            }}
                            title="Review Classification"
                            id={`reviewClassificationBtn_${project.externalId}`}
                          >
                            {ICONS.edit}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Prev
            </button>
            <span style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ReviewModal
        key={reviewTarget?.externalId ?? (reviewTarget as { _id?: string } | null)?._id ?? 'none'}
        project={reviewTarget}
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSave={handleSaveReview}
      />
    </section>
  );
}
