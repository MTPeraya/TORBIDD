'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project, ProjectCategory } from '@/types/project';
import { formatTHB } from '@/lib/utils';
import { translateProcurementType } from '@/services/translation/dictionary';

export interface ProjectInspectorDrawerProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveQuickEdit: (id: string | number, updates: Partial<Project>) => Promise<void>;
  onConfirmSoftware: (project: Project) => Promise<void>;
  onRequestNonSoftwareModal: (project: Project) => void;
  onOpenFullEditModal: (project: Project) => void;
  availableDepartments?: string[];
}

export function ProjectInspectorDrawer({
  project,
  isOpen,
  onClose,
  onSaveQuickEdit,
  onConfirmSoftware,
  onRequestNonSoftwareModal,
  onOpenFullEditModal,
  availableDepartments = [],
}: ProjectInspectorDrawerProps) {
  const { L, language } = useLanguage();

  // Form field state
  const [titleTh, setTitleTh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [departmentTh, setDepartmentTh] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('Website');
  const [budget, setBudget] = useState<number>(0);
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state whenever the inspected project changes
  useEffect(() => {
    if (project) {
      setTitleTh(project.title?.th || '');
      setTitleEn(project.title?.en || '');
      setDepartmentTh(project.department?.th || '');
      setCategory(project.category || 'Website');
      setBudget(project.budget || 0);
      setDeadline(
        project.deadline
          ? new Date(project.deadline).toISOString().split('T')[0]
          : '',
      );
      setSaveSuccess(false);
    }
  }, [project]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const targetId = project.externalId || (project as unknown as { _id: string })._id;
  const isSoftware = project.isSoftwareRelated !== false;
  const isPendingReview =
    project.classificationReviewStatus === 'PENDING_REVIEW' ||
    !project.classificationReviewStatus;

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveSuccess(false);
    try {
      await onSaveQuickEdit(targetId, {
        title: {
          th: titleTh,
          en: titleEn || titleTh,
        },
        department: {
          th: departmentTh,
          en: project.department?.en || departmentTh,
        },
        category,
        budget,
        deadline: deadline ? new Date(deadline).toISOString() : project.deadline,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-inspector-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <aside
        className="admin-inspector-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Project Inspector and Quick Editor"
      >
        {/* Drawer Header */}
        <div className="admin-inspector-header">
          <div className="admin-inspector-header-info">
            <div className="admin-inspector-badge-row">
              <span className="admin-inspector-id">#{project.externalId}</span>
              <span className="admin-inspector-source-tag">
                {language === 'en'
                  ? translateProcurementType(project.procurementType)
                  : project.procurementType}
              </span>
              {project.fiscalYear && (
                <span className="admin-inspector-fiscal">ปี {project.fiscalYear}</span>
              )}
            </div>
            <h3 className="admin-inspector-title">
              {language === 'th' ? project.title.th : (project.title.en || project.title.th)}
            </h3>
          </div>
          <button
            type="button"
            className="admin-inspector-close-btn"
            onClick={onClose}
            aria-label="Close inspector drawer"
          >
            {ICONS.x}
          </button>
        </div>

        {/* Drawer Body */}
        <div className="admin-inspector-body">
          {/* Section 1: AI Classification & Triage Banner */}
          <div className="admin-inspector-card">
            <div className="admin-card-header">
              <div className="admin-card-title-wrap">
                {ICONS.sparkles}
                <span className="admin-inspector-section-label">
                  {language === 'th' ? 'การประเมินและจำแนกโดย AI' : 'AI Analysis & Classification'}
                </span>
              </div>
              <span
                className={`admin-conf-badge ${project.aiConfidence?.toLowerCase() || 'high'}`}
                style={{
                  background:
                    project.aiConfidence === 'High'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(245, 158, 11, 0.12)',
                  color: project.aiConfidence === 'High' ? '#10b981' : '#f59e0b',
                }}
              >
                {project.aiConfidence || 'High'} Confidence
              </span>
            </div>

            <div className="admin-triage-status-display">
              <div className="admin-triage-status-indicator">
                {isSoftware ? (
                  <span className="admin-sw-badge software">
                    ✓ {language === 'th' ? 'ซอฟต์แวร์ (แสดงบนแดชบอร์ด)' : 'Software Related'}
                  </span>
                ) : (
                  <span className="admin-sw-badge non-software">
                    ✗ {language === 'th' ? 'ไม่ใช่ซอฟต์แวร์ (คัดแยกออกตาม UC-4)' : 'Non-Software (UC-4)'}
                  </span>
                )}
                {isPendingReview && (
                  <span className="admin-review-pill pending">
                    {language === 'th' ? 'รอตรวจสอบ (Pending Review)' : 'Pending Review'}
                  </span>
                )}
              </div>

              {/* Technologies Pills */}
              {project.requiredTechnologies && project.requiredTechnologies.length > 0 && (
                <div className="admin-tech-pill-group">
                  <span className="admin-tech-label">
                    {language === 'th' ? 'เทคโนโลยีที่ตรวจพบ:' : 'Detected Tech:'}
                  </span>
                  <div className="admin-tech-tags">
                    {project.requiredTechnologies.map((tech, idx) => (
                      <span key={idx} className="admin-tech-tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope excerpt if available */}
              {project.scope && (
                <div className="admin-scope-snippet">
                  <span className="admin-scope-label">
                    {language === 'th' ? 'ขอบเขตงาน (Scope):' : 'Scope Summary:'}
                  </span>
                  <p className="admin-scope-text">{project.scope}</p>
                </div>
              )}

              {/* Triage Action Buttons */}
              <div className="admin-triage-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onConfirmSoftware(project)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {ICONS.check}
                  <span>{language === 'th' ? 'ยืนยันเป็นซอฟต์แวร์' : 'Confirm Software'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => onRequestNonSoftwareModal(project)}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <span>✗</span>
                  <span>{language === 'th' ? 'ไม่ใช่ซอฟต์แวร์ (UC-4)' : 'Non-Software'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Inline Quick Edit Form */}
          <form className="admin-inspector-card" onSubmit={handleQuickSave}>
            <div className="admin-card-header">
              <div className="admin-card-title-wrap">
                {ICONS.edit}
                <span className="admin-inspector-section-label">
                  {language === 'th' ? 'แก้ไขข้อมูลโครงการอย่างรวดเร็ว' : 'Quick Metadata Editor'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => onOpenFullEditModal(project)}
                title="Open comprehensive edit modal"
              >
                {ICONS.externalLink}
                <span>{language === 'th' ? 'ฟอร์มแบบเต็ม' : 'Full Form'}</span>
              </button>
            </div>

            <div className="admin-drawer-form-grid">
              {/* Thai Title */}
              <div className="admin-drawer-field">
                <label htmlFor="inspectorTitleTh" className="admin-drawer-label">
                  {language === 'th' ? 'ชื่อโครงการ (ไทย)' : 'Project Title (TH)'} *
                </label>
                <textarea
                  id="inspectorTitleTh"
                  rows={2}
                  className="admin-drawer-textarea"
                  value={titleTh}
                  onChange={(e) => setTitleTh(e.target.value)}
                  required
                />
              </div>

              {/* Department */}
              <div className="admin-drawer-field">
                <label htmlFor="inspectorDepartment" className="admin-drawer-label">
                  {language === 'th' ? 'หน่วยงานเจ้าของโครงการ' : 'Department'}
                </label>
                <input
                  id="inspectorDepartment"
                  type="text"
                  list="inspectorDeptList"
                  className="admin-drawer-input"
                  value={departmentTh}
                  onChange={(e) => setDepartmentTh(e.target.value)}
                />
                <datalist id="inspectorDeptList">
                  {availableDepartments.map((dept, i) => (
                    <option key={i} value={dept} />
                  ))}
                </datalist>
              </div>

              {/* Category & Budget Two-Column Row */}
              <div className="admin-drawer-two-col">
                <div className="admin-drawer-field">
                  <label htmlFor="inspectorCategory" className="admin-drawer-label">
                    {language === 'th' ? 'หมวดหมู่โครงการ' : 'Category'}
                  </label>
                  <select
                    id="inspectorCategory"
                    className="admin-drawer-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                  >
                    <option value="Website">Website</option>
                    <option value="Mobile App">Mobile App</option>
                    <option value="AI">AI</option>
                    <option value="Database">Database</option>
                    <option value="ERP">ERP</option>
                    <option value="Cloud">Cloud</option>
                    <option value="Data Analytics">Data Analytics</option>
                    <option value="Information System">Information System</option>
                  </select>
                </div>

                <div className="admin-drawer-field">
                  <label htmlFor="inspectorBudget" className="admin-drawer-label">
                    {language === 'th' ? 'วงเงินงบประมาณ (บาท)' : 'Budget (THB)'}
                  </label>
                  <input
                    id="inspectorBudget"
                    type="number"
                    min="0"
                    step="1000"
                    className="admin-drawer-input"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                  />
                  <div className="admin-budget-hint">{formatTHB(budget)}</div>
                </div>
              </div>

              {/* Deadline */}
              <div className="admin-drawer-field">
                <label htmlFor="inspectorDeadline" className="admin-drawer-label">
                  {language === 'th' ? 'กำหนดการสิ้นสุดยื่นข้อเสนอ' : 'Deadline'}
                </label>
                <input
                  id="inspectorDeadline"
                  type="date"
                  className="admin-drawer-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Save Feedback & Submit Button */}
            <div className="admin-drawer-actions">
              {saveSuccess && (
                <span className="admin-save-indicator positive">
                  {ICONS.check} {language === 'th' ? 'บันทึกสำเร็จ' : 'Saved'}
                </span>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ minWidth: 140, justifyContent: 'center' }}
              >
                {isSubmitting ? (
                  <span className="admin-spin">{ICONS.refreshCw}</span>
                ) : (
                  ICONS.check
                )}
                <span>{language === 'th' ? 'บันทึกข้อมูลด่วน' : 'Save Quick Edits'}</span>
              </button>
            </div>
          </form>

          {/* Section 3: View Public Project Link */}
          <div className="admin-drawer-footer-link">
            <Link
              href={`/opportunities/${project.externalId}`}
              target="_blank"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {ICONS.externalLink}
              <span>{language === 'th' ? 'ดูหน้ารายละเอียดสาธารณะ (เปิดแท็บใหม่)' : 'View Public Detail'}</span>
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
