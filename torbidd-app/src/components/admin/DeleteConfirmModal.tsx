'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project } from '@/types/project';
import { formatTHB } from '@/lib/utils';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  project: Project | null;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  project,
}: DeleteConfirmModalProps) {
  const { L, language } = useLanguage();
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !project) return null;

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const title = language === 'th' ? project.title.th : project.title.en;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div
              className="modal-icon-badge"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
            >
              {ICONS.trash}
            </div>
            <div>
              <h3 className="modal-title" style={{ color: '#ef4444' }}>
                {L('adminDeleteConfirm')}
              </h3>
              <p className="modal-subtitle">#{project.externalId} — {project.category}</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            {ICONS.x}
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            {L('adminDeleteDesc')}
          </p>

          <div
            style={{
              padding: '16px',
              borderRadius: 8,
              background: 'var(--surface-subtle, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.95rem' }}>{title}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {language === 'th' ? project.department.th : project.department.en} • {formatTHB(project.budget)}
            </div>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={deleting}
          >
            {L('adminCancel')}
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
            onClick={handleConfirm}
            disabled={deleting}
            id="adminConfirmDeleteBtn"
          >
            {deleting ? (
              <span>Deleting...</span>
            ) : (
              <>
                {ICONS.trash}
                <span>{L('adminConfirmDelete')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
