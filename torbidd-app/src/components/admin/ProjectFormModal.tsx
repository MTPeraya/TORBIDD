'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { Project, ProjectCategory } from '@/types/project';
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
  const [deptTh, setDeptTh] = useState(
    isEdit ? initialProject.department?.th || '' : INITIAL_DEPARTMENTS[0].th,
  );
  const [category, setCategory] = useState<ProjectCategory>(
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
  const [scopeTh, setScopeTh] = useState(
    isEdit && initialProject.scope?.th ? initialProject.scope.th.join('\n') : '',
  );
  const [qualTh, setQualTh] = useState(
    isEdit && initialProject.qualifications?.th ? initialProject.qualifications.th.join('\n') : '',
  );
  const [aiConfidence, setAiConfidence] = useState<'High' | 'Medium' | 'Low'>(
    (isEdit && (initialProject.aiConfidence as 'High' | 'Medium' | 'Low')) || 'High',
  );
  const [fiscalYear, setFiscalYear] = useState<number>(
    isEdit && initialProject.fiscalYear
      ? initialProject.fiscalYear
      : today.getMonth() >= 9
        ? today.getFullYear() + 544
        : today.getFullYear() + 543,
  );
  const [isSoftwareRelated, setIsSoftwareRelated] = useState<boolean>(
    isEdit && initialProject.isSoftwareRelated !== undefined
      ? initialProject.isSoftwareRelated
      : true,
  );
  const [deleteOnConfirmNonSoftware, setDeleteOnConfirmNonSoftware] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleTh.trim()) {
      setErrorMsg(
        language === 'th'
          ? 'กรุณาระบุชื่อโครงการ'
          : 'Please provide the project title',
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
      title: { th: titleTh.trim(), en: titleTh.trim() },
      department: { th: deptTh.trim(), en: deptTh.trim() },
      category,
      budget: Number(budget),
      fiscalYear: Number(fiscalYear) || undefined,
      procurementType,
      publishDate,
      deadline,
      description: {
        th: descTh.trim() || titleTh.trim(),
        en: descTh.trim() || titleTh.trim(),
      },
      scope: {
        th: splitLines(scopeTh).length > 0 ? splitLines(scopeTh) : [titleTh.trim()],
        en: splitLines(scopeTh).length > 0 ? splitLines(scopeTh) : [titleTh.trim()],
      },
      qualifications: {
        th:
          splitLines(qualTh).length > 0
            ? splitLines(qualTh)
            : ['เป็นนิติบุคคลจดทะเบียนในประเทศไทย'],
        en:
          splitLines(qualTh).length > 0
            ? splitLines(qualTh)
            : ['Registered legal entity in Thailand'],
      },
      aiConfidence,
      isSoftwareRelated,
      deleteOnConfirmNonSoftware,
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
              {/* UC-4: Software vs Non-Software Classification */}
              <div
                className="admin-form-field full-width"
                style={{
                  background: isSoftwareRelated ? 'rgba(59, 130, 246, 0.05)' : 'rgba(239, 68, 68, 0.06)',
                  border: `1px solid ${isSoftwareRelated ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.35)'}`,
                  borderRadius: 10,
                  padding: '16px 18px',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <label className="admin-form-label" style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
                      {language === 'th' ? 'การจัดหมวดหมู่โครงการ (UC-4: ซอฟต์แวร์ / ไม่ใช่ซอฟต์แวร์)' : 'Project Classification (UC-4: Software vs Non-Software)'}
                    </label>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      {isSoftwareRelated
                        ? (language === 'th'
                          ? '✓ โครงการนี้เกี่ยวกับซอฟต์แวร์ และจะแสดงบนแดชบอร์ดโอกาสงานสำหรับผู้เสนอราคา'
                          : '✓ This project is software-related and visible on the public opportunity dashboard.')
                        : (language === 'th'
                          ? '✗ โครงการนี้ไม่ใช่ซอฟต์แวร์ (Non-Software) จะถูกคัดแยกออกจากแดชบอร์ดสาธารณะตามข้อกำหนด UC-4'
                          : '✗ Confirmed Non-Software listing. Excluded from public opportunities dashboard per UC-4.')}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${isSoftwareRelated ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setIsSoftwareRelated(true);
                        setDeleteOnConfirmNonSoftware(false);
                      }}
                      id="projectFormIsSoftwareYes"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                    >
                      {ICONS.check} {language === 'th' ? 'ซอฟต์แวร์ (Software)' : 'Software-Related'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${!isSoftwareRelated ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => setIsSoftwareRelated(false)}
                      id="projectFormIsSoftwareNo"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                    >
                      {ICONS.x} {language === 'th' ? 'ไม่ใช่ซอฟต์แวร์ (Non-Software)' : 'Non-Software'}
                    </button>
                  </div>
                </div>

                {!isSoftwareRelated && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(239, 68, 68, 0.3)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={deleteOnConfirmNonSoftware}
                        onChange={(e) => setDeleteOnConfirmNonSoftware(e.target.checked)}
                        id="deleteOnConfirmNonSoftwareCheckbox"
                      />
                      <span>
                        {language === 'th'
                          ? 'ลบ/ตัดรายการนี้ออกจากฐานข้อมูลอย่างถาวรทันที (ตามนโยบายการจัดเก็บข้อมูล UC-4 A5)'
                          : 'Permanently remove/delete record from database upon saving (UC-4 A5 retention policy)'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Project Title */}
              <div className="admin-form-field full-width">
                <label className="admin-form-label">
                  {L('adminFieldTitleTh')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={titleTh}
                  onChange={(e) => setTitleTh(e.target.value)}
                  placeholder="เช่น ประกวดราคาจ้างพัฒนาระบบเทคโนโลยีสารสนเทศ..."
                  required
                />
              </div>

              {/* Department Dropdown */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldDeptTh')}</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={deptTh}
                  onChange={(e) => setDeptTh(e.target.value)}
                  placeholder="ระบุหน่วยงานเจ้าของโครงการ..."
                  list="departmentList"
                  required
                />
                <datalist id="departmentList">
                  {INITIAL_DEPARTMENTS.map((dept) => (
                    <option key={dept.th} value={dept.th} />
                  ))}
                </datalist>
              </div>

              {/* Category */}
              <div className="admin-form-field">
                <label className="admin-form-label">{L('adminFieldCategory')}</label>
                <select
                  className="admin-form-input"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ProjectCategory)
                  }
                >
                  <option value="Information System">Information System (ระบบสารสนเทศ)</option>
                  <option value="AI">AI / GIS Mapping (ปัญญาประดิษฐ์และแผนที่)</option>
                  <option value="Cloud">Cloud (คลาวด์และโครงสร้างพื้นฐาน)</option>
                  <option value="ERP">ERP (ระบบบริหารจัดการทรัพยากรองค์กร)</option>
                  <option value="Database">Database (ฐานข้อมูลและคลังข้อมูล)</option>
                  <option value="Data Analytics">Data Analytics (การวิเคราะห์ข้อมูล)</option>
                  <option value="Website">Website / Portal (เว็บไซต์และพอร์ทัล)</option>
                  <option value="Mobile App">Mobile App (แอปพลิเคชันมือถือ)</option>
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

              {/* Fiscal Year (ปีงบประมาณ พ.ศ.) */}
              <div className="admin-form-field">
                <label className="admin-form-label">
                  {language === 'th' ? 'ปีงบประมาณ (พ.ศ.)' : 'Fiscal Year (B.E.)'}
                </label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(Number(e.target.value))}
                  min={2500}
                  max={2600}
                  step={1}
                  placeholder="เช่น 2568, 2569"
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
                  <option value="e-Bidding">e-Bidding (ประกวดราคาอิเล็กทรอนิกส์)</option>
                  <option value="e-Market">e-Market (ตลาดอิเล็กทรอนิกส์)</option>
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
                  <option value="High">High (ความเชื่อมั่นสูง)</option>
                  <option value="Medium">Medium (ความเชื่อมั่นปานกลาง)</option>
                  <option value="Low">Low (รอตรวจสอบ)</option>
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

              {/* Description */}
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

              {/* Scope of Work */}
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

              {/* Qualifications */}
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
