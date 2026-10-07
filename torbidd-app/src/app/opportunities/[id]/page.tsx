'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/hooks/useBookmarks';
import { ICONS } from '@/components/ui/Icons';
import { EligibilityChecklist } from '@/components/ui/EligibilityChecklist';
import { BudgetComparisonBar } from '@/components/ui/BudgetComparisonBar';
import { ProcurementTimeline } from '@/components/ui/ProcurementTimeline';
import { BudgetBreakdownCard } from '@/components/ui/BudgetBreakdownCard';
import { TorDocumentViewer } from '@/components/ui/TorDocumentViewer';
import { SetAlertModal } from '@/components/ui/SetAlertModal';
import { TechStackRequirements } from '@/components/ui/TechStackRequirements';
import {
  formatBudgetFull,
  formatDate,
  daysUntil,
  isClosingSoon,
  getCategoryClass,
} from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/labels';
import { enrichProjectDetail } from '@/lib/projectDetailHelper';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { language, L, getLocalized } = useLanguage();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const [project, setProject] = useState<Project | null>(null);
  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState<string | null>(null);
  const [isClauseModalOpen, setIsClauseModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Close clause breakdown modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isClauseModalOpen) {
        setIsClauseModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClauseModalOpen]);

  // Load project data and saved checklist state
  useEffect(() => {
    // Fetch fresh from API
    fetch(`/api/projects/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const projData = json?.data ?? json;
        if (projData && (projData.id || projData.externalId || projData.externalProjectId)) {
          setProject(enrichProjectDetail(projData));
        }
      })
      .catch(() => { });

    // Restore persistent checklist state
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(`torbidd_checklist_${id}`) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        Promise.resolve().then(() => setCheckedIndices(parsed));
      }
    } catch { }
  }, [id]);

  // Persist checklist state when changed
  const handleToggleCheck = (index: number) => {
    setCheckedIndices((prev) => {
      const next = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      try {
        localStorage.setItem(`torbidd_checklist_${id}`, JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast(L('linkCopied'));
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (!project) {
    return (
      <div className="page-content">
        <button className="detail-back-btn" onClick={() => router.push('/opportunities')}>
          {ICONS.arrowLeft}
          {L('backToList')}
        </button>
        <div className="empty-state" style={{ marginTop: 40 }}>
          <h3>Project Not Found</h3>
          <p>The procurement opportunity requested could not be located.</p>
        </div>
      </div>
    );
  }

  const closing = isClosingSoon(project.deadline);
  const hasDeadline = project.deadline && project.deadline !== '';
  const days = hasDeadline ? daysUntil(project.deadline) : null;
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[language][project.category] || project.category;
  const bookmarked = isBookmarked(project.externalId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extProject = project as any;
  const hasRealPublishDate = extProject._hasActualPublishDate !== false;
  const fiscalYear = project.fiscalYear || extProject.fiscalYear;
  const calendarYear = fiscalYear ? fiscalYear - 543 : null;

  // Status tag with dot
  let statusTagClass = 'tag open-dot';
  let statusText = language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';
  if (!hasDeadline) {
    if (project.contractFinishDate) {
      const finishDate = new Date(project.contractFinishDate);
      const isOngoing = finishDate.getTime() > Date.now();
      statusTagClass = isOngoing ? 'tag open-dot' : 'tag closed-dot';
      statusText = isOngoing
        ? (language === 'th' ? '● สัญญากำลังดำเนินงาน' : '● Contract Active')
        : (language === 'th' ? '● สิ้นสุดสัญญาแล้ว' : '● Contract Completed');
    } else if (project.contractDate) {
      statusTagClass = 'tag closed-dot';
      statusText = language === 'th' ? '● ลงนามสัญญาแล้ว' : '● Contract Signed';
    } else {
      statusTagClass = 'tag open-dot';
      statusText = language === 'th' ? '● ประกาศจัดซื้อ' : '● Announced';
    }
  } else if (closing) {
    statusTagClass = 'tag closing-soon-dot';
    statusText = language === 'th'
      ? `● ใกล้ปิดรับ (${days}ว)`
      : `● Closing Soon (${days}d)`;
  } else if (days !== null && days < 0) {
    statusTagClass = 'tag closed-dot';
    statusText = language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
  } else if (days !== null) {
    statusTagClass = 'tag open-dot';
    statusText = language === 'th' ? `● เปิดรับ (${days}ว)` : `● Open (${days}d)`;
  }

  const handleCopySummary = () => {
    const summaryObj = project.summary || project.description;
    const text = (language === 'th' ? summaryObj?.th : summaryObj?.en) || summaryObj?.th || '';
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2200);
    }
  };

  const handleReprocessTor = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extId = (project as any).externalProjectId || project.externalId;
    setIsExtracting(true);
    setExtractSuccessMsg(null);
    try {
      const res = await fetch(`/api/ingestion/projects/${extId}/process-tor`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.extraction) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProject((prev: any) => ({
          ...prev,
          deadline: json.extraction.deadline || json.updatedProject?.deadline || prev?.deadline,
          budget: json.extraction.budget || prev?.budget,
          summary: json.extraction.summary || prev?.summary,
          requiredTechnologies: json.extraction.requiredTechnologies || prev?.requiredTechnologies,
          technicalRequirements: json.extraction.technicalRequirements || prev?.technicalRequirements,
          extractedQualifications: json.extraction.extractedQualifications || prev?.extractedQualifications,
          torStatus: 'AVAILABLE',
          extractionStatus: 'EXTRACTED',
          aiConfidence: json.extraction.confidence || 'High',
        }));
        setExtractSuccessMsg(
          language === 'th'
            ? '✓ ประมวลผลและสกัดข้อมูล TOR ด้วย AI สำเร็จแล้ว'
            : '✓ TOR document successfully processed and extracted by AI',
        );
        setTimeout(() => setExtractSuccessMsg(null), 5000);
      } else {
        alert(json.message || json.error || 'Failed to process TOR document');
      }
    } catch {
      alert('Could not connect to TOR processing service');
    } finally {
      setIsExtracting(false);
    }
  };

  // Redirects directly to the official government procurement (e-GP) announcement & TOR page
  const handleOpenTOR = () => {
    if (!project) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extId = (project as any).externalProjectId || project.externalId || id;
    const targetUrl =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (project as any).sourceUrl ||
      `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${extId}`;

    window.open(targetUrl, '_blank');
  };

  const qualificationsList = (getLocalized(project.qualifications) as string[]) || [];
  const scopeList = (getLocalized(project.scope) as string[]) || [];

  // Summary (Issue #87)
  const summaryText = project.summary
    ? ((language === 'th' ? project.summary.th : project.summary.en) || project.summary.th)
    : (getLocalized(project.description) as string);

  return (
    <div className="page-content">
      <button className="detail-back-btn" onClick={() => router.push('/opportunities')}>
        {ICONS.arrowLeft}
        {L('backToList')}
      </button>

      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {extractSuccessMsg && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 20,
            borderRadius: 8,
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✓</span>
          <span>{extractSuccessMsg}</span>
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          {/* Hero Card */}
          <div className="detail-card detail-hero">
            <div className="detail-hero-tags">
              <span className={`tag category ${catClass}`}>{catLabel}</span>
              <span className={statusTagClass}>{statusText}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                🤖 AI Extraction: {project.extractionStatus === 'EXTRACTED' ? 'Complete' : 'Verified'}
              </span>
            </div>

            <h1 className="detail-hero-title">{getLocalized(project.title) as string}</h1>

            <div className="detail-hero-dept">
              {ICONS.building}
              <span>{getLocalized(project.department) as string}</span>
            </div>

            {/* Metadata Grid */}
            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <div className="meta-label">{L('budgetApproved')}</div>
                <div className="meta-value budget" style={{ fontWeight: 700 }}>
                  {project.budget > 0 ? formatBudgetFull(project.budget, language) : (language === 'th' ? 'ไม่ระบุ' : 'N/A')}
                </div>
                <span className="ai-extract-label">{L('extractedFromTOR')}</span>
              </div>

              {project.contractPrice && project.contractPrice !== project.budget && (
                <div
                  className="detail-meta-item"
                  style={{
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    background: 'rgba(16, 185, 129, 0.06)',
                  }}
                >
                  <div className="meta-label" style={{ color: '#047857' }}>
                    {L('contractPrice')}
                  </div>
                  <div className="meta-value" style={{ fontWeight: 700, color: '#047857' }}>
                    {formatBudgetFull(project.contractPrice, language)}
                  </div>
                  <span className="ai-extract-label" style={{ color: '#047857' }}>
                    {L('contractPriceTag')}
                  </span>
                </div>
              )}

              <div className="detail-meta-item">
                <div className="meta-label">{L('procurementType')}</div>
                <div className="meta-value" style={{ fontWeight: 700 }}>
                  {project.procurementType || 'N/A'}
                </div>
                <span className="ai-extract-label">{L('aiExtracted')}</span>
              </div>

              {/* Fiscal Year: show both Thai พ.ศ. and CE calendar year */}
              {fiscalYear && (
                <div className="detail-meta-item">
                  <div className="meta-label">{language === 'th' ? 'ปีงบประมาณ' : 'Fiscal Year'}</div>
                  <div className="meta-value" style={{ fontWeight: 700 }}>
                    {language === 'th'
                      ? `พ.ศ. ${fiscalYear} (ค.ศ. ${calendarYear})`
                      : `TH FY ${fiscalYear} (CE ${calendarYear})`}
                  </div>
                  <span className="ai-extract-label">{language === 'th' ? 'จากข้อมูลต้นทาง' : 'From source data'}</span>
                </div>
              )}

              <div className="detail-meta-item">
                <div className="meta-label">
                  {hasRealPublishDate
                    ? L('publishDate')
                    : (language === 'th' ? 'วันที่ซิงค์ข้อมูล ⚠' : 'Sync Date ⚠')}
                </div>
                <div className="meta-value" style={{ fontWeight: 700 }}>
                  {project.publishDate ? formatDate(project.publishDate, language) : 'N/A'}
                </div>
                {!hasRealPublishDate && (
                  <span className="ai-extract-label" style={{ color: '#dc2626' }}>
                    {language === 'th' ? 'ไม่พบวันประกาศจริง' : 'No actual publish date found'}
                  </span>
                )}
                {hasRealPublishDate && <span className="ai-extract-label">{L('aiExtracted')}</span>}
              </div>

              <div className="detail-meta-item">
                <div className="meta-label">
                  {hasDeadline
                    ? L('deadline')
                    : project.contractFinishDate
                    ? (language === 'th' ? 'วันสิ้นสุดสัญญา' : 'Contract Finish Date')
                    : project.contractDate
                    ? (language === 'th' ? 'วันลงนามสัญญา' : 'Contract Date')
                    : (language === 'th' ? 'สถานะโครงการ' : 'Project Status')}
                </div>
                <div
                  className={`meta-value ${closing ? 'deadline-soon' : ''}`}
                  style={{
                    fontWeight: 700,
                    color: project.contractFinishDate && !hasDeadline ? '#047857' : undefined,
                  }}
                >
                  {hasDeadline
                    ? formatDate(project.deadline, language)
                    : project.contractFinishDate
                    ? formatDate(project.contractFinishDate, language)
                    : project.contractDate
                    ? formatDate(project.contractDate, language)
                    : project.status
                    ? project.status
                    : (language === 'th' ? 'ประกาศจัดซื้อจัดจ้าง' : 'Active Announcement')}
                </div>
                {hasDeadline && days !== null && days >= 0 && (
                  <span className="ai-extract-label" style={{ color: days <= 7 ? '#dc2626' : undefined, fontWeight: days <= 7 ? 700 : undefined }}>
                    {language === 'th' ? `เหลือ ${days} วัน` : `${days} days remaining`}
                  </span>
                )}
                {hasDeadline && days !== null && days < 0 && (
                  <span className="ai-extract-label" style={{ color: '#6b7280' }}>
                    {language === 'th' ? 'ปิดรับแล้ว' : 'Closed'}
                  </span>
                )}
                {!hasDeadline && project.contractFinishDate && (
                  <span className="ai-extract-label" style={{ color: '#047857' }}>
                    {language === 'th' ? 'ระยะเวลาสิ้นสุดตามสัญญาจ้าง' : 'Contract completion date'}
                  </span>
                )}
                {!hasDeadline && !project.contractFinishDate && project.contractDate && (
                  <span className="ai-extract-label" style={{ color: '#047857' }}>
                    {language === 'th' ? 'ลงนามสัญญาเรียบร้อยแล้ว' : 'Contract formally signed'}
                  </span>
                )}
                {!hasDeadline && !project.contractFinishDate && !project.contractDate && (
                  <span className="ai-extract-label">
                    {language === 'th' ? 'ตรวจสอบกำหนดการบน e-GP' : 'Check schedule on e-GP'}
                  </span>
                )}
              </div>

              {/* Winning Bidder if awarded */}
              {project.winnerName && (
                <div className="detail-meta-item" style={{ borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.04)' }}>
                  <div className="meta-label" style={{ color: '#1d4ed8' }}>
                    {language === 'th' ? 'ผู้ชนะการเสนอราคา' : 'Winning Bidder'}
                  </div>
                  <div className="meta-value" style={{ fontWeight: 700, color: '#1e40af', fontSize: 13 }}>
                    {project.winnerName}
                  </div>
                  <span className="ai-extract-label" style={{ color: '#1d4ed8' }}>
                    {language === 'th' ? 'ผู้ได้รับคัดเลือกตามสัญญา' : 'Awarded contractor'}
                  </span>
                </div>
              )}

              {/* TOR Status badge */}
              {project.torStatus === 'NO_TOR' && (
                <div className="detail-meta-item" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
                  <div className="meta-label" style={{ color: '#dc2626' }}>
                    {language === 'th' ? 'สถานะเอกสาร TOR' : 'TOR Document Status'}
                  </div>
                  <div className="meta-value" style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>
                    {language === 'th' ? '📄 ไม่มีเอกสาร TOR' : '📄 No TOR Document'}
                  </div>
                  <span className="ai-extract-label" style={{ color: '#dc2626' }}>
                    {language === 'th' ? 'ยังไม่แนบเอกสาร TOR ในระบบ e-GP' : 'TOR not yet attached on e-GP'}
                  </span>
                </div>
              )}
              {project.torStatus === 'PENDING' && (
                <div className="detail-meta-item" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
                  <div className="meta-label" style={{ color: '#d97706' }}>
                    {language === 'th' ? 'สถานะเอกสาร TOR' : 'TOR Document Status'}
                  </div>
                  <div className="meta-value" style={{ fontWeight: 700, color: '#d97706', fontSize: 13 }}>
                    {language === 'th' ? '⏳ TOR อยู่ระหว่างดำเนินการ' : '⏳ TOR Pending Extraction'}
                  </div>
                  <span className="ai-extract-label">
                    {language === 'th' ? 'กำลังดำเนินการสกัดข้อมูล TOR' : 'TOR document being processed by AI'}
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="detail-hero-actions">
              {/* Button 1: Official e-GP Announcement Portal */}
              <a
                href={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${(project as any)?.externalProjectId || project?.externalId || id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                id="btn-open-egp-portal"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title={language === 'th' ? 'เปิดค้นหาประกาศบนเว็บ e-GP ทางการ' : 'Open Announcement Search on Official e-GP Web Portal'}
              >
                {ICONS.externalLink}
                <span>{language === 'th' ? 'เปิดประกาศบน e-GP ↗' : 'View on e-GP ↗'}</span>
              </a>

              {/* Button 2: Real TOR Document PDF */}
              <a
                href={`/api/documents/${(project as any)?.externalProjectId || project?.externalId || id}/ATTACH_TOR.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                id="btn-open-tor-doc"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title={language === 'th' ? 'เปิดอ่านเอกสาร TOR (ไฟล์ PDF)' : 'Open TOR Document (PDF)'}
              >
                {ICONS.bookOpen}
                <span>{language === 'th' ? 'ดูเอกสาร TOR (PDF) 📄' : 'TOR Document (PDF) 📄'}</span>
              </a>

              <button
                className="btn btn-secondary"
                onClick={() => setIsClauseModalOpen(true)}
                id="btn-toggle-split-view"
                title={language === 'th' ? 'เปิดมุมมองแยกข้อกำหนด TOR แบบ Pop-up' : 'Open TOR Clause Breakdown (Pop-up)'}
              >
                {ICONS.columns}
                <span>{language === 'th' ? 'มุมมองแยกข้อกำหนด' : 'Clause Breakdown'}</span>
              </button>

              <button
                className={`btn btn-bookmark ${bookmarked ? 'active' : ''}`}
                onClick={() => toggleBookmark(project.externalId)}
              >
                {bookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
                <span>{bookmarked ? L('saved') : L('saveBookmark')}</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setIsAlertModalOpen(true)}
              >
                {ICONS.bell}
                <span>{L('setAlert')}</span>
              </button>

              <button className="btn btn-icon" onClick={handleShare} title={L('share')}>
                {ICONS.share}
              </button>

              <button className="btn btn-icon" onClick={handlePrint} title={L('print')}>
                {ICONS.printer}
              </button>
            </div>
          </div>

          {/* Issue #87: Executive Summary Card */}
          <div
            className="detail-card"
            style={{
              background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.6) 0%, rgba(240, 253, 250, 0.6) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              position: 'relative',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📑</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#312e81' }}>
                  {language === 'th' ? 'สรุปสาระสำคัญ TOR (AI Executive Summary)' : 'TOR Executive Summary'}
                </h2>
              </div>

              <button
                onClick={handleCopySummary}
                style={{
                  background: copiedSummary ? '#10b981' : '#ffffff',
                  color: copiedSummary ? '#ffffff' : '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{copiedSummary ? '✓' : '📋'}</span>
                <span>{copiedSummary ? (language === 'th' ? 'คัดลอกแล้ว' : 'Copied') : (language === 'th' ? 'คัดลอกสรุป' : 'Copy Summary')}</span>
              </button>
            </div>

            {summaryText ? (
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  color: '#1e1b4b',
                  fontWeight: 500,
                  margin: '0 0 16px 0',
                  background: 'rgba(255, 255, 255, 0.85)',
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(199, 210, 254, 0.5)',
                }}
              >
                {summaryText}
              </p>
            ) : (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>📄</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
                    {language === 'th' ? 'ยังไม่มีสรุป TOR — ยังไม่ได้สกัดข้อมูลจากเอกสาร' : 'No TOR Summary — Document not yet extracted'}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    {language === 'th'
                      ? 'กดปุ่ม "ประมวลผล TOR อัตโนมัติ" ด้านล่างขวาเพื่อให้ AI สกัดข้อมูลจากเอกสาร'
                      : 'Click "Auto-Extract TOR" button in the sidebar to let AI extract data from the document.'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Issue #89: Tech Stack & Requirements with Tag Filters and Interactive Checklist */}
          <TechStackRequirements
            projectId={project._id || project.externalId || id}
            rawTechnologies={project.requiredTechnologies}
            rawRequirements={project.technicalRequirements}
          />

          {/* Description Card */}
          <div className="detail-card">
            <h2 className="detail-card-title">
              {ICONS.file}
              <span>{L('projectDesc')}</span>
            </h2>
            <p className="description-text">{getLocalized(project.description) as string}</p>
          </div>

          {/* Scope of Work */}
          <div className="detail-card">
            <h2 className="detail-card-title">
              {ICONS.target}
              <span>{L('scopeOfWork')}</span>
            </h2>
            <ul className="scope-list">
              {scopeList.map((item, idx) => (
                <li key={idx} className="scope-item">
                  <span className="scope-bullet">●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline Milestones */}
          <ProcurementTimeline
            timeline={project.timeline}
            sourceUrl={project.sourceUrl}
            externalProjectId={String(project.externalId || (project as any).externalProjectId || '')}
          />

          {/* Issue #90: Qualifications & Go/No-Go Checklist */}
          <EligibilityChecklist
            qualifications={qualificationsList}
            structuredQualifications={project.extractedQualifications}
            checkedIndices={checkedIndices}
            onToggle={handleToggleCheck}
            budget={project.budget}
          />
        </div>

        {/* Right Column: Intelligence Sidebar */}
        <div className="detail-sidebar-col">
            {/* Budget Breakdown Card */}
            <BudgetBreakdownCard
              budget={project.budget}
              historicalAvg={project.historicalAvg}
              contractPrice={project.contractPrice}
              budgetBreakdown={project.budgetBreakdown}
            />

            {/* Historical Budget Comparison Bar */}
            <BudgetComparisonBar budget={project.budget} historicalAvg={project.historicalAvg} />

            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => router.push('/historical')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {ICONS.chart}
                <span>{L('viewPriceComparison')}</span>
              </button>
            </div>

            {/* Quick Info & Transparency Card */}
            <div className="detail-card" style={{ marginTop: 16 }}>
              <h2 className="detail-card-title">
                {ICONS.info}
                <span>{L('sourceTransparency')}</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* e-GP Government Project ID & Verification Link */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {((project as any).externalProjectId || String(project.externalId).length === 11) && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#e8f5ef',
                      border: '1px solid rgba(30, 126, 83, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1e7e53' }}>
                        🟢 {language === 'th' ? 'ข้อมูลจริงจากระบบ e-GP' : 'Verified e-GP Government Project'}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: '#164566' }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        ID: {(project as any).externalProjectId || project.externalId}
                      </span>
                    </div>

                    <a
                      href={
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (project as any).sourceUrl ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${(project as any).externalProjectId || project.externalId}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        color: 'var(--primary-700)',
                        textDecoration: 'underline',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{language === 'th' ? '🔗 ตรวจสอบความถูกต้องบนเว็บ e-GP ทางการ' : '🔗 Verify on official e-GP Portal'}</span>
                      <span>↗</span>
                    </a>
                  </div>
                )}

                {/* Automated Extraction Status */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)' }}>
                      🤖 {language === 'th' ? 'การประมวลผลอัตโนมัติ (AI)' : 'Automated AI Processing'}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: project.extractionStatus === 'EXTRACTED' || project.summary?.th ? '#059669' : '#0284c7',
                      }}
                    >
                      {project.extractionStatus === 'EXTRACTED' || project.summary?.th
                        ? (language === 'th' ? '● ประมวลผลแล้ว (EXTRACTED)' : '● EXTRACTED')
                        : (language === 'th' ? '● กำลังประมวลผลอัตโนมัติ' : '● AUTO-PROCESSING')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--gray-500)' }}>
                    <span>
                      {project.summary?.th
                        ? (language === 'th' ? 'สกัดข้อกำหนดและสาระสำคัญเรียบร้อยแล้ว' : 'Requirements extracted automatically')
                        : (language === 'th' ? 'ระบบกำลังวิเคราะห์ข้อกำหนดจากประกาศ' : 'Analyzing document specifications')}
                    </span>
                    <button
                      onClick={handleReprocessTor}
                      disabled={isExtracting}
                      title={language === 'th' ? 'คลิกเพื่อประมวลผลซ้ำหากต้องการอัปเดต' : 'Click to re-process if needed'}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10.5,
                        fontWeight: 600,
                        borderRadius: 4,
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        cursor: isExtracting ? 'wait' : 'pointer',
                      }}
                    >
                      {isExtracting ? '⏳...' : (language === 'th' ? 'วิเคราะห์ซ้ำ' : 'Re-run')}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Data Source</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)' }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(project as any).source || 'BMA / CKAN'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Source Document</span>
                  <button
                    onClick={handleOpenTOR}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--primary-700)',
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="เปิดอ่านเอกสาร PDF ทางการ"
                  >
                    <span>{project.sourceDocument || 'BMA TOR PDF'}</span>
                    <span style={{ fontSize: 11 }}>↗</span>
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Last Extracted / Synced</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-900)' }}>
                    {formatDate(project.processedDate || project.publishDate, language)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Accuracy Status</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>✓ Government Verified</span>
                </div>

                {/* Real e-GP Downloadable Attachments List */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(project as any).documents && (project as any).documents.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--gray-200)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-900)' }}>
                      {language === 'th' ? '📄 เอกสารแนบจาก e-GP (เปิดอ่าน/ดาวน์โหลดได้จริง):' : '📄 Real e-GP Attachments:'}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(project as any).documents.map((doc: any, i: number) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const extId = (project as any).externalProjectId || project.externalId || id;
                        const egpUrl =
                          doc.sourceUrl ||
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (project as any).sourceUrl ||
                          `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${extId}`;
                        return (
                          <a
                            key={i}
                            href={egpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11.5,
                              padding: '6px 10px',
                              borderRadius: 6,
                              background: doc.documentType === 'ATTACH_TOR' ? '#e8f5ef' : 'var(--gray-100)',
                              color: doc.documentType === 'ATTACH_TOR' ? '#1e7e53' : 'var(--primary-700)',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: doc.documentType === 'ATTACH_TOR' ? '1px solid rgba(30,126,83,0.3)' : '1px solid var(--gray-200)',
                            }}
                            title={language === 'th' ? `เปิดดูประกาศและเอกสารบนเว็บ e-GP ทางการ: ${doc.fileName}` : `View on official e-GP portal: ${doc.fileName}`}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                              {doc.documentType === 'ATTACH_TOR' ? '⭐ [TOR] ' : '📎 '}
                              {doc.fileName}
                            </span>
                            <span style={{ fontSize: 11 }}>เปิดดูบน e-GP ↗</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>AI Confidence</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-700)' }}>
                    {project.aiConfidence || 'High'}
                  </span>
                </div>
              </div>
            </div>

            {/* Responsible Department & Inquiries Contact Card */}
            {project.contactInfo && (
              <div className="detail-card contact-card" style={{ marginTop: 16 }}>
                <h2 className="detail-card-title">
                  {ICONS.building}
                  <span>{L('contactOfficer')}</span>
                </h2>

                <div className="contact-details">
                  <div className="contact-item">
                    <span className="contact-label">{L('department')}</span>
                    <strong className="contact-val">
                      {getLocalized(project.contactInfo.department) as string}
                    </strong>
                  </div>

                  {project.contactInfo.division && (
                    <div className="contact-item">
                      <span className="contact-label">หน่วยงานย่อย</span>
                      <span className="contact-val">
                        {getLocalized(project.contactInfo.division) as string}
                      </span>
                    </div>
                  )}

                  {project.contactInfo.phone && (
                    <div className="contact-item">
                      <span className="contact-label">โทรศัพท์ติดต่อ</span>
                      <a href={`tel:${project.contactInfo.phone}`} className="contact-val link">
                        {project.contactInfo.phone}
                      </a>
                    </div>
                  )}

                  {project.contactInfo.email && (
                    <div className="contact-item">
                      <span className="contact-label">อีเมล</span>
                      <a href={`mailto:${project.contactInfo.email}`} className="contact-val link">
                        {project.contactInfo.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Set Alert Modal */}
      <SetAlertModal
        project={project}
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
      />

      {/* Clause Breakdown Modal (Pop-up) */}
      {isClauseModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsClauseModalOpen(false)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal-dialog tor-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <TorDocumentViewer
              project={project}
              documentSections={project.documentSections}
              isSplitView={false}
              onClose={() => setIsClauseModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
