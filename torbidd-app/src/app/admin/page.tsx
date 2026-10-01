'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ICONS } from '@/components/ui/Icons';
import { Project } from '@/types/project';
import { formatTHB } from '@/lib/utils';
import { ProjectFormModal } from '@/components/admin/ProjectFormModal';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';
import { ClassificationReviewPanel } from '@/components/admin/ClassificationReviewPanel';
import { ConfirmNonSoftwareModal } from '@/components/admin/ConfirmNonSoftwareModal';

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
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'classification' | 'crawler' | 'audit'>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Search, filter and pagination for Projects tab
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Software' | 'Non-Software'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection state (UC-4)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  // UC-4 Non-Software Confirmation Modal state
  const [nonSoftwareModalOpen, setNonSoftwareModalOpen] = useState(false);
  const [nonSoftwareProject, setNonSoftwareProject] = useState<Project | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

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
        fetch('/api/projects?limit=1000&all=true'),
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
        } else if (json.totalProjects !== undefined) {
          setStats(json);
        }
      }
    } catch {
      // Offline fallback: keep current state
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    async function loadData() {
      try {
        const [projRes, statsRes] = await Promise.allSettled([
          fetch('/api/projects?limit=1000&all=true'),
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
  }, [isAdmin]);


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

    // UC-4 A5: If administrator confirmed non-software with immediate permanent deletion
    if (data.deleteOnConfirmNonSoftware) {
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
              p.externalId !== editingProject.externalId &&
              (p as unknown as { _id?: string })._id !== (editingProject as unknown as { _id?: string })._id,
          ),
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        showToast(
          language === 'th'
            ? 'ลบโครงการออกจากฐานข้อมูลเรียบร้อยแล้ว (ตามนโยบาย UC-4 A5)'
            : 'Project permanently removed per UC-4 A5 retention policy',
        );
        setFormModalOpen(false);
        return;
      } catch (err) {
        throw err;
      }
    }

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
            ? { ...p, ...updated, isSoftwareRelated: Boolean(data.isSoftwareRelated ?? p.isSoftwareRelated) }
            : p,
        ),
      );
      showToast(L('adminSaveSuccess'));
    } catch (err: unknown) {
      throw err;
    }
  };

  // Handle UC-4 Confirmation for Non-Software Classification & Dashboard Exclusion
  const handleConfirmNonSoftware = async ({ permanentlyDelete }: { permanentlyDelete: boolean }) => {
    if (!nonSoftwareProject) return;
    const targetId = nonSoftwareProject.externalId || (nonSoftwareProject as unknown as { _id: string })._id;

    if (permanentlyDelete) {
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
              p.externalId !== nonSoftwareProject.externalId &&
              (p as unknown as { _id?: string })._id !== (nonSoftwareProject as unknown as { _id?: string })._id,
          ),
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        showToast(
          language === 'th'
            ? 'ลบโครงการออกจากฐานข้อมูลเรียบร้อยแล้ว (ตามนโยบาย UC-4 A5)'
            : 'Project permanently removed per UC-4 A5 retention policy',
        );
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Deletion failed');
      }
    } else {
      try {
        const res = await fetch(`/api/projects/${targetId}/classification`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isSoftwareRelated: false,
            category: nonSoftwareProject.category || 'Information System',
            classificationReviewStatus: 'APPROVED',
            classificationReviewNote: 'Admin confirmed non-software (UC-4)',
          }),
        });

        if (!res.ok) {
          // Fallback to PUT
          await fetch(`/api/projects/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isSoftwareRelated: false }),
          });
        }

        setProjects((prev) =>
          prev.map((p) =>
            p.externalId === nonSoftwareProject.externalId ||
            (p as unknown as { _id?: string })._id === (nonSoftwareProject as unknown as { _id?: string })._id
              ? { ...p, isSoftwareRelated: false, classificationReviewStatus: 'APPROVED' }
              : p,
          ),
        );
        showToast(
          language === 'th'
            ? 'ยืนยันจำแนกเป็นไม่ใช่ซอฟต์แวร์ และนำออกจากแดชบอร์ดสาธารณะแล้ว (UC-4)'
            : 'Confirmed non-software & excluded from public dashboard (UC-4)',
        );
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Classification update failed');
      }
    }
  };

  // Bulk Classify as Non-Software (UC-4)
  const handleBulkClassifyNonSoftware = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const count = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const res = await fetch(`/api/projects/${id}/classification`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isSoftwareRelated: false,
              classificationReviewStatus: 'APPROVED',
              classificationReviewNote: 'Admin bulk confirmed non-software (UC-4)',
            }),
          });
          if (!res.ok) {
            await fetch(`/api/projects/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isSoftwareRelated: false }),
            });
          }
        }),
      );

      setProjects((prev) =>
        prev.map((p) => {
          const pid = p.externalId || (p as unknown as { _id: string })._id;
          if (selectedIds.has(pid)) {
            return { ...p, isSoftwareRelated: false, classificationReviewStatus: 'APPROVED' };
          }
          return p;
        }),
      );

      setSelectedIds(new Set());
      showToast(
        language === 'th'
          ? `จำแนก ${count} โครงการเป็นไม่ใช่ซอฟต์แวร์ และนำออกจากแดชบอร์ดแล้ว (UC-4)`
          : `Classified ${count} projects as non-software and excluded from public dashboard (UC-4)`,
      );
    } catch {
      showToast('Error updating selected projects');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Classify as Software (UC-4)
  const handleBulkClassifySoftware = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const count = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const res = await fetch(`/api/projects/${id}/classification`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isSoftwareRelated: true,
              classificationReviewStatus: 'APPROVED',
              classificationReviewNote: 'Admin bulk confirmed software-related (UC-4)',
            }),
          });
          if (!res.ok) {
            await fetch(`/api/projects/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isSoftwareRelated: true }),
            });
          }
        }),
      );

      setProjects((prev) =>
        prev.map((p) => {
          const pid = p.externalId || (p as unknown as { _id: string })._id;
          if (selectedIds.has(pid)) {
            return { ...p, isSoftwareRelated: true, classificationReviewStatus: 'APPROVED' };
          }
          return p;
        }),
      );

      setSelectedIds(new Set());
      showToast(
        language === 'th'
          ? `ยืนยัน ${count} โครงการเป็นด้านซอฟต์แวร์เรียบร้อยแล้ว`
          : `Confirmed ${count} projects as software-related`,
      );
    } catch {
      showToast('Error updating selected projects');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = window.confirm(
      language === 'th'
        ? `คุณแน่ใจหรือไม่ว่าต้องการลบ ${count} โครงการที่เลือกออกจากฐานข้อมูลอย่างถาวร? (UC-4 A5)`
        : `Are you sure you want to permanently delete ${count} selected projects from the database? (UC-4 A5)`,
    );
    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/projects/${id}`, { method: 'DELETE' }),
        ),
      );

      setProjects((prev) =>
        prev.filter((p) => {
          const pid = p.externalId || (p as unknown as { _id: string })._id;
          return !selectedIds.has(pid);
        }),
      );

      setSelectedIds(new Set());
      showToast(
        language === 'th'
          ? `ลบ ${count} โครงการออกจากฐานข้อมูลเรียบร้อยแล้ว (UC-4 A5)`
          : `Permanently deleted ${count} projects from database (UC-4 A5)`,
      );
    } catch {
      showToast('Error deleting selected projects');
    } finally {
      setBulkActionLoading(false);
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
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
      const q = searchQuery.toLowerCase();
      const titleMatch =
        !searchQuery ||
        (p.title?.th && p.title.th.toLowerCase().includes(q)) ||
        (p.title?.en && p.title.en.toLowerCase().includes(q)) ||
        String(p.externalId).includes(searchQuery) ||
        (p.department?.th && p.department.th.toLowerCase().includes(q)) ||
        (p.department?.en && p.department.en.toLowerCase().includes(q)) ||
        (p.procurementType && p.procurementType.toLowerCase().includes(q));

      const categoryMatch = categoryFilter === 'All' || p.category === categoryFilter;

      const statusMatch =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Software'
            ? p.isSoftwareRelated !== false
            : p.isSoftwareRelated === false;

      return titleMatch && categoryMatch && statusMatch;
    });
  }, [projects, searchQuery, categoryFilter, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProjects = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, safeCurrentPage, pageSize]);

  // Selection helpers
  const visibleIds = useMemo(() => {
    return paginatedProjects.map((p) => p.externalId || (p as unknown as { _id: string })._id);
  }, [paginatedProjects]);

  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isSomeVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleSelectRow = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Derived statistics
  const totalBudget = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.budget || 0), 0);
  }, [projects]);

  const activeCount = useMemo(() => {
    const now = new Date();
    return projects.filter((p) => new Date(p.deadline) >= now).length;
  }, [projects]);

  if (isLoading) {
    return (
      <div className="admin-page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            width: 36,
            height: 36,
            border: '3px solid var(--gray-300)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: 16, color: 'var(--gray-500)', fontSize: '0.95rem' }}>
          {language === 'th' ? 'กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...' : 'Verifying admin authorization...'}
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-page-container" style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px' }}>
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid var(--gray-200)',
            borderRadius: 16,
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
            }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
            {language === 'th' ? 'กรุณาเข้าสู่ระบบ' : 'Authentication Required'}
          </h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
            {language === 'th'
              ? 'คุณต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบเพื่อเข้าถึงแผงควบคุมระบบ'
              : 'You must sign in with an administrator account to access the BMA admin console.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/login?from=/admin" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 600 }}>
              {language === 'th' ? 'เข้าสู่ระบบ (Sign In)' : 'Sign In'}
            </Link>
            <Link href="/" className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              {language === 'th' ? 'กลับหน้าหลัก' : 'Home'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page-container" style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px' }}>
        <div
          style={{
            background: 'var(--white)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 16,
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
            }}
          >
            🛡️
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
            {language === 'th' ? 'ไม่มีสิทธิ์เข้าถึง (Access Denied)' : 'Admin Privileges Required'}
          </h2>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 8 }}>
            {language === 'th'
              ? 'บัญชีของคุณไม่มีสิทธิ์ผู้ดูแลระบบ (Administrator) ในการเข้าถึงหน้านี้'
              : 'Your current account does not have administrator privileges to access this console.'}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 24 }}>
            {language === 'th'
              ? `เข้าสู่ระบบในฐานะ: ${user?.email || user?.name} (${user?.role || 'Normal User'})`
              : `Signed in as: ${user?.email || user?.name} (${user?.role || 'Normal User'})`}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 600 }}>
              {language === 'th' ? 'กลับสู่หน้าหลัก' : 'Back to Home'}
            </Link>
            <Link href="/opportunities" className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              {language === 'th' ? 'ดูโครงการจัดซื้อจัดจ้าง' : 'Browse Opportunities'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          className={`admin-tab-btn ${activeTab === 'classification' ? 'active' : ''}`}
          onClick={() => setActiveTab('classification')}
          id="adminTabClassificationBtn"
        >
          {ICONS.sparkles}
          <span>{L('adminTabClassification')}</span>
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
                {[
                  { cat: 'Website', color: '#3b82f6' },
                  { cat: 'Mobile App', color: '#10b981' },
                  { cat: 'AI', color: '#a855f7' },
                  { cat: 'Database', color: '#f59e0b' },
                  { cat: 'ERP', color: '#06b6d4' },
                  { cat: 'Cloud', color: '#8b5cf6' },
                  { cat: 'Data Analytics', color: '#f97316' },
                  { cat: 'Information System', color: '#64748b' },
                ].map(({ cat, color }) => {
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
                          style={{ width: `${pct}%`, background: color }}
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
          {/* Bulk Selection Bar (UC-4) */}
          {selectedIds.size > 0 && (
            <div className="admin-bulk-bar" role="toolbar" aria-label="Bulk actions">
              <div className="admin-bulk-info">
                <span className="admin-bulk-count-badge">
                  {selectedIds.size}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {language === 'th'
                    ? `เลือกอยู่ ${selectedIds.size} รายการ`
                    : `${selectedIds.size} items selected`}
                </span>
              </div>
              <div className="admin-bulk-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleBulkClassifyNonSoftware}
                  disabled={bulkActionLoading}
                  id="bulkClassifyNonSoftwareBtn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                >
                  <span>✗</span>
                  <span>{language === 'th' ? 'จำแนกเป็นไม่ใช่ซอฟต์แวร์ (UC-4)' : 'Mark Non-Software (UC-4)'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleBulkClassifySoftware}
                  disabled={bulkActionLoading}
                  id="bulkClassifySoftwareBtn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>✓</span>
                  <span>{language === 'th' ? 'จำแนกเป็นด้านซอฟต์แวร์' : 'Mark Software'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  id="bulkDeleteBtn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {ICONS.trash}
                  <span>{language === 'th' ? 'ลบรายการที่เลือก' : 'Delete Selected'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  id="bulkDeselectBtn"
                >
                  {language === 'th' ? 'ยกเลิกการเลือก' : 'Deselect All'}
                </button>
              </div>
            </div>
          )}

          <div className="admin-table-controls">
            <div className="admin-search-wrap">
              {ICONS.search}
              <input
                type="text"
                className="admin-search-input"
                placeholder={L('adminSearchProjects')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                id="adminProjectSearchInput"
              />
            </div>

            <div className="admin-filters-wrap" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* Category Filter */}
              <select
                className="admin-select-filter"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                id="adminCategoryFilterSelect"
              >
                <option value="All">{L('allCategories')}</option>
                <option value="Website">Website</option>
                <option value="Mobile App">Mobile App</option>
                <option value="AI">AI</option>
                <option value="Database">Database</option>
                <option value="ERP">ERP</option>
                <option value="Cloud">Cloud</option>
                <option value="Data Analytics">Data Analytics</option>
                <option value="Information System">Information System</option>
              </select>

              {/* Status Filter for Software/Non-Software (UC-4) */}
              <select
                className="admin-select-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'All' | 'Software' | 'Non-Software');
                  setCurrentPage(1);
                }}
                id="adminStatusFilterSelect"
                style={{
                  fontWeight: 600,
                  color:
                    statusFilter === 'Non-Software'
                      ? '#ef4444'
                      : statusFilter === 'Software'
                        ? '#10b981'
                        : undefined,
                }}
              >
                <option value="All">{language === 'th' ? 'ทุกสถานะ (All)' : 'All Status (UC-4)'}</option>
                <option value="Software">{language === 'th' ? '✓ ซอฟต์แวร์เท่านั้น' : '✓ Software Only'}</option>
                <option value="Non-Software">{language === 'th' ? '✗ ไม่ใช่ซอฟต์แวร์ (UC-4)' : '✗ Non-Software (UC-4)'}</option>
              </select>

              {/* Page size selector */}
              <select
                className="admin-select-filter"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                id="adminPageSizeSelect"
                aria-label="Rows per page"
              >
                <option value={15}>15 {language === 'th' ? 'รายการ/หน้า' : 'per page'}</option>
                <option value={25}>25 {language === 'th' ? 'รายการ/หน้า' : 'per page'}</option>
                <option value={50}>50 {language === 'th' ? 'รายการ/หน้า' : 'per page'}</option>
                <option value={100}>100 {language === 'th' ? 'รายการ/หน้า' : 'per page'}</option>
              </select>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !isAllVisibleSelected && isSomeVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible projects"
                      id="selectAllProjectsCheckbox"
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </th>
                  <th style={{ width: 75 }}>ID</th>
                  <th>{L('projectName')}</th>
                  <th>{L('department')}</th>
                  <th>{L('category')}</th>
                  <th style={{ width: 130 }}>{language === 'th' ? 'สถานะ UC-4' : 'UC-4 Status'}</th>
                  <th style={{ textAlign: 'right' }}>{L('budget')}</th>
                  <th>{L('deadline')}</th>
                  <th>AI Match</th>
                  <th style={{ textAlign: 'center', width: 160 }}>{L('adminActions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                      {L('noResults')}
                    </td>
                  </tr>
                ) : (
                  paginatedProjects.map((project) => {
                    const pid = project.externalId || (project as unknown as { _id: string })._id;
                    const isSelected = selectedIds.has(pid);
                    const title = language === 'th' ? project.title.th : project.title.en;
                    const dept = language === 'th' ? project.department.th : project.department.en;
                    const isClosed = new Date(project.deadline) < new Date();
                    const isSw = project.isSoftwareRelated !== false;

                    return (
                      <tr
                        key={pid}
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.05)' : undefined,
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(pid)}
                            aria-label={`Select project ${pid}`}
                            id={`selectProject_${pid}`}
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                        </td>
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
                        <td>
                          {isSw ? (
                            <span className="admin-sw-badge software">
                              ✓ {language === 'th' ? 'ซอฟต์แวร์' : 'Software'}
                            </span>
                          ) : (
                            <span
                              className="admin-sw-badge non-software"
                              title={
                                language === 'th'
                                  ? 'ไม่ใช่ซอฟต์แวร์ — คัดแยกออกจากแดชบอร์ดค้นหาตาม UC-4'
                                  : 'Non-Software — Excluded from dashboard per UC-4'
                              }
                            >
                              ✗ {language === 'th' ? 'ไม่ใช่ซอฟต์แวร์' : 'Non-SW'}
                            </span>
                          )}
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
                              className="admin-icon-action-btn classify-non-sw"
                              onClick={() => {
                                setNonSoftwareProject(project);
                                setNonSoftwareModalOpen(true);
                              }}
                              title={
                                language === 'th'
                                  ? 'จำแนกเป็นไม่ใช่ซอฟต์แวร์ (UC-4)'
                                  : 'Classify as Non-Software (UC-4)'
                              }
                              id={`classifyNonSwBtn_${project.externalId}`}
                              style={{
                                color: !isSw ? '#dc2626' : undefined,
                                borderColor: !isSw ? '#ef4444' : undefined,
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>✗</span>
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

          {/* Pagination Controls */}
          <div className="admin-pagination-container">
            <div className="admin-pagination-summary">
              {filteredProjects.length === 0
                ? (language === 'th' ? 'ไม่พบข้อมูลโครงการ' : 'No projects found')
                : (language === 'th'
                    ? `แสดง ${(safeCurrentPage - 1) * pageSize + 1} - ${Math.min(safeCurrentPage * pageSize, filteredProjects.length)} จากทั้งหมด ${filteredProjects.length} โครงการ`
                    : `Showing ${(safeCurrentPage - 1) * pageSize + 1} - ${Math.min(safeCurrentPage * pageSize, filteredProjects.length)} of ${filteredProjects.length} projects`)}
            </div>

            {totalPages > 1 && (
              <div className="admin-pagination-nav">
                <button
                  type="button"
                  className="admin-page-number-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  id="adminPrevPageBtn"
                  aria-label="Previous page"
                >
                  ←
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5) {
                    if (safeCurrentPage <= 3) {
                      pageNum = i + 1;
                    } else if (safeCurrentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = safeCurrentPage - 2 + i;
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      className={`admin-page-number-btn ${safeCurrentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                      id={`adminPageBtn_${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="admin-page-number-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  id="adminNextPageBtn"
                  aria-label="Next page"
                >
                  →
                </button>
              </div>
            )}
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

      {/* TAB 5: CLASSIFICATION REVIEW (UC-10) */}
      {activeTab === 'classification' && (
        <ClassificationReviewPanel onToast={showToast} />
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

      {/* Non-Software Confirmation Modal (UC-4) */}
      <ConfirmNonSoftwareModal
        isOpen={nonSoftwareModalOpen}
        onClose={() => {
          setNonSoftwareModalOpen(false);
          setNonSoftwareProject(null);
        }}
        onConfirm={handleConfirmNonSoftware}
        project={nonSoftwareProject}
      />
    </div>
  );
}
