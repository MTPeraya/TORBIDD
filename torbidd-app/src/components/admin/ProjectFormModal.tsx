'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project } from '@/types/project';
import { INITIAL_DEPARTMENTS } from '@/lib/initialData';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  initialProject?: Project | null;
  mode: 'create' | 'edit';
}

export function ProjectFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialProject,
  mode,
}: ProjectFormModalProps) {
  const { L, language } = useLanguage();

  const isEdit = mode === 'edit' && !!initialProject;
  const today = new Date();
  const after30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [titleTh, setTitleTh] = useState(isEdit ? initialProject.title?.th || '' : '');
  const [titleEn, setTitleEn] = useState(isEdit ? initialProject.title?.en || '' : '');
  const [deptTh, setDeptTh] = useState(
    isEdit ? initialProject.department?.th || '' : INITIAL_DEPARTMENTS[0].th,
  );
  const [deptEn, setDeptEn] = useState(
    isEdit ? initialProject.department?.en || '' : INITIAL_DEPARTMENTS[0].en,
  );
  const [category, setCategory] = useState<'Website' | 'Mobile App' | 'AI' | 'Database'>(
    isEdit ? initialProject.category || 'Website' : 'Website',
  );
  const [budget, setBudget] = useState<number>(isEdit ? initialProject.budget || 0 : 15000000);
  const [procurementType, setProcurementType] = useState(
    isEdit ? initialProject.procurementType || 'e-Bidding' : 'e-Bidding',
  );
  const [publishDate, setPublishDate] = useState(
    isEdit && initialProject.publishDate
      ? new Date(initialProject.publishDate).toISOString().split('T')[0]
      : today.toISOString().split('T')[0],
  );
  const [deadline, setDeadline] = useState(
    isEdit && initialProject.deadline
      ? new Date(initialProject.deadline).toISOString().split('T')[0]
      : after30.toISOString().split('T')[0],
  );
  const [descTh, setDescTh] = useState(isEdit ? initialProject.description?.th || '' : '');
  const [descEn, setDescEn] = useState(isEdit ? initialProject.description?.en || '' : '');
  const [scopeTh, setScopeTh] = useState(
    isEdit && initialProject.scope?.th ? initialProject.scope.th.join('\n') : '',
  );
  const [scopeEn, setScopeEn] = useState(
    isEdit && initialProject.scope?.en ? initialProject.scope.en.join('\n') : '',
  );
  const [qualTh, setQualTh] = useState(
    isEdit && initialProject.qualifications?.th ? initialProject.qualifications.th.join('\n') : '',
  );
  const [qualEn, setQualEn] = useState(
    isEdit && initialProject.qualifications?.en ? initialProject.qualifications.en.join('\n') : '',
  );
  const [aiConfidence, setAiConfidence] = useState<'High' | 'Medium' | 'Low'>(
    (isEdit && (initialProject.aiConfidence as 'High' | 'Medium' | 'Low')) || 'High',
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;


  const handleDeptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = INITIAL_DEPARTMENTS.find((d) => d.th === e.target.value);
    if (selected) {
      setDeptTh(selected.th);
      setDeptEn(selected.en);
    } else {
      setDeptTh(e.target.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleTh.trim() || !titleEn.trim()) {
      setErrorMsg(
        language === 'th'
          ? 'กรุณาระบุชื่อโครงการทั้งภาษาไทยและอังกฤษ'
          : 'Please provide both Thai and English project titles',
      );
      return;
    }
    if (budget <= 0) {
      setErrorMsg(language === 'th' ? 'กรุณาระบุงบประมาณที่มากกว่า 0' : 'Budget must be greater than 0');
      return;
    }

    const splitLines = (text: string) =>
      text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const payload: Record<string, unknown> = {
      title: { th: titleTh.trim(), en: titleEn.trim() },
      department: { th: deptTh.trim(), en: deptEn.trim() || deptTh.trim() },
      category,
      budget: Number(budget),
      procurementType,
      publishDate,
      deadline,
      description: {
        th: descTh.trim() || titleTh.trim(),
        en: descEn.trim() || titleEn.trim(),
      },
      scope: {
        th: splitLines(scopeTh).length > 0 ? splitLines(scopeTh) : [titleTh.trim()],
        en: splitLines(scopeEn).length > 0 ? splitLines(scopeEn) : [titleEn.trim()],
      },
      qualifications: {
        th:
          splitLines(qualTh).length > 0
            ? splitLines(qualTh)
            : ['เป็นนิติบุคคลจดทะเบียนในประเทศไทย'],
        en:
          splitLines(qualEn).length > 0
            ? splitLines(qualEn)
            : ['Registered legal entity in Thailand'],
      },
      aiConfidence,
    };

    if (mode === 'edit' && initialProject) {
      payload.externalId = initialProject.externalId;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog admin-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              {mode === 'create' ? ICONS.plus : ICONS.edit}
            </div>
            <div>
              <h3 className="modal-title">
                {mode === 'create' ? L('adminAddProject') : L('adminEditProject')}
              </h3>
              <p className="modal-subtitle">
                {mode === 'create'
                  ? 'BMA Electronic Government Procurement (e-GP) Software Notice'
                  : `ID: #${initialProject?.externalId ?? ''} — ${
                      language === 'th' ? initialProject?.title?.th : initialProject?.title?.en
                    }`}
              </p>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  color: '#ef4444',
                  marginBottom: 16,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {ICONS.alertTriangle}
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="admin-form-grid">
              {/* Project Title TH */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">
                  {L('adminFieldTitleTh')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={titleTh}
                  onChange={(e) => setTitleTh(e.target.value)}
                  placeholder="เช่น โครงการพัฒนาระบบคลาวด์ กทม."
                  required
                />
              </div>

              {/* Project Title EN */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">
                  {L('adminFieldTitleEn')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. BMA Cloud Services Management System"
                  required
                />
              </div>

              {/* Department Dropdown / TH */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldDeptTh')}</label>
                <select
                  className="admin-form-input"
                  value={deptTh}
                  onChange={handleDeptSelect}
                >
                  {INITIAL_DEPARTMENTS.map((dept) => (
                    <option key={dept.th} value={dept.th}>
                      {language === 'th' ? dept.th : dept.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department EN */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldDeptEn')}</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={deptEn}
                  onChange={(e) => setDeptEn(e.target.value)}
                  placeholder="Department in English"
                />
              </div>

              {/* Category */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldCategory')}</label>
                <select
                  className="admin-form-input"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as 'Website' | 'Mobile App' | 'AI' | 'Database')
                  }
                >
                  <option value="Website">Website / Portal</option>
                  <option value="Mobile App">Mobile App</option>
                  <option value="AI">AI / GIS Mapping</option>
                  <option value="Database">Database / Data Warehouse</option>
                </select>
              </div>

              {/* Budget */}
              <div className="admin-form-field">
                <label className="admin-form-label">
                  {L('adminFieldBudget')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  min={0}
                  step={10000}
                  required
                />
              </div>

              {/* Procurement Type */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldProcurementType')}</label>
                <select
                  className="admin-form-input"
                  value={procurementType}
                  onChange={(e) => setProcurementType(e.target.value)}
                >
                  <option value="e-Bidding">e-Bidding</option>
                  <option value="e-Market">e-Market</option>
                  <option value="Specific Method">Specific Method (วิธีเฉพาะเจาะจง)</option>
                  <option value="Selection">Selection Method (วิธีคัดเลือก)</option>
                </select>
              </div>

              {/* AI Confidence */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldAiConfidence')}</label>
                <select
                  className="admin-form-input"
                  value={aiConfidence}
                  onChange={(e) =>
                    setAiConfidence(e.target.value as 'High' | 'Medium' | 'Low')
                  }
                >
                  <option value="High">High (95%+ match)</option>
                  <option value="Medium">Medium (80-94%)</option>
                  <option value="Low">Low (Requires Review)</option>
                </select>
              </div>

              {/* Publish Date */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldPublishDate')}</label>
                <input
                  type="date"
                  className="admin-form-input"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  required
                />
              </div>

              {/* Deadline */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldDeadline')}</label>
                <input
                  type="date"
                  className="admin-form-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
              </div>

              {/* Description TH */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">{L('adminFieldDescTh')}</label>
                <textarea
                  className="admin-form-input admin-textarea"
                  rows={3}
                  value={descTh}
                  onChange={(e) => setDescTh(e.target.value)}
                  placeholder="รายละเอียดวัตถุประสงค์และภาพรวมโครงการ..."
                />
              </div>

              {/* Description EN */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">{L('adminFieldDescEn')}</label>
                <textarea
                  className="admin-form-input admin-textarea"
                  rows={3}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  placeholder="Overview and objectives in English..."
                />
              </div>

              {/* Scope TH */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">{L('adminFieldScopeTh')}</label>
                <textarea
                  className="admin-form-input admin-textarea"
                  rows={3}
                  value={scopeTh}
                  onChange={(e) => setScopeTh(e.target.value)}
                  placeholder="1. ออกแบบสถาปัตยกรรมระบบ&#10;2. ติดตั้งและปรับแต่งซอฟต์แวร์..."
                />
              </div>

              {/* Scope EN */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">{L('adminFieldScopeEn')}</label>
                <textarea
                  className="admin-form-input admin-textarea"
                  rows={3}
                  value={scopeEn}
                  onChange={(e) => setScopeEn(e.target.value)}
                  placeholder="1. Design system architecture&#10;2. Install and configure software..."
                />
              </div>

              {/* Qualifications TH */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">{L('adminFieldQualTh')}</label>
                <textarea
                  className="admin-form-input admin-textarea"
                  rows={3}
                  value={qualTh}
                  onChange={(e) => setQualTh(e.target.value)}
                  placeholder="1. ทุนจดทะเบียนไม่น้อยกว่า 5,000,000 บาท&#10;2. มีผลงานประเภทเดียวกันไม่น้อยกว่า..."
                />
              </div>

              {/* Qualifications EN */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">{L('adminFieldQualEn')}</label>
                <textarea
                  className="admin-form-input admin-textarea"
                  rows={3}
                  value={qualEn}
                  onChange={(e) => setQualEn(e.target.value)}
                  placeholder="1. Registered capital not less than 5,000,000 THB&#10;2. Proven past track record in..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {L('adminCancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="adminSaveProjectBtn"
            >
              {submitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  {ICONS.check}
                  <span>{L('adminSave')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
