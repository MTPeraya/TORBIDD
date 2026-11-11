'use client';

// =============================================================================
// components/ui/AuthPromptModal.tsx - Sign-in Prompt Modal for Protected Actions
// =============================================================================

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

export type AuthFeatureType = 'bookmark' | 'comparison' | 'alert' | 'general';

export interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: AuthFeatureType;
  returnUrl?: string;
}

export function AuthPromptModal({
  isOpen,
  onClose,
  feature = 'general',
  returnUrl,
}: AuthPromptModalProps) {
  const currentPathname = usePathname();
  const pathname = currentPathname || '/';
  const { language } = useLanguage();

  const targetUrl = returnUrl || pathname || '/';

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getFeatureContent = () => {
    switch (feature) {
      case 'bookmark':
        return {
          title: language === 'th' ? 'เข้าสู่ระบบเพื่อบันทึกรายการ' : 'Sign In to Bookmark',
          desc:
            language === 'th'
              ? 'กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อบันทึกโครงการที่คุณสนใจและติดตามได้อย่างสะดวกจากทุกอุปกรณ์'
              : 'Please sign in with Google to save your favorite procurement opportunities and access them across all your devices.',
          icon: ICONS.bookmark,
        };
      case 'comparison':
        return {
          title: language === 'th' ? 'เข้าสู่ระบบเพื่อเปรียบเทียบโครงการ' : 'Sign In to Compare Projects',
          desc:
            language === 'th'
              ? 'กรุณาเข้าสู่ระบบเพื่อใช้งานเครื่องมือเปรียบเทียบข้อมูลย้อนหลัง และวิเคราะห์ความสมเหตุสมผลของงบประมาณ'
              : 'Please sign in to access historical comparison tools and analyze budget reasonableness across agencies.',
          icon: ICONS.chart,
        };
      case 'alert':
        return {
          title: language === 'th' ? 'เข้าสู่ระบบเพื่อตั้งค่าการแจ้งเตือน' : 'Sign In to Set Alerts',
          desc:
            language === 'th'
              ? 'กรุณาเข้าสู่ระบบเพื่อรับการแจ้งเตือนเมื่อ กทม. มีการแก้ไขเอกสาร TOR หรือเตือนก่อนถึงกำหนดการยื่นข้อเสนอ'
              : 'Please sign in to configure automated deadline reminders and real-time TOR amendment notifications.',
          icon: ICONS.bell,
        };
      default:
        return {
          title: language === 'th' ? 'เข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้' : 'Sign In Required',
          desc:
            language === 'th'
              ? 'ฟังก์ชันนี้สงวนไว้สำหรับผู้ใช้ที่ลงชื่อเข้าสู่ระบบ กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อดำเนินการต่อ'
              : 'This feature requires authentication. Please sign in with your Google account to proceed.',
          icon: ICONS.shield,
        };
    }
  };

  const content = getFeatureContent();
  const loginUrl = `/login?from=${encodeURIComponent(targetUrl)}&returnUrl=${encodeURIComponent(targetUrl)}`;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      data-testid="auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="modal-dialog auth-prompt-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
              {content.icon}
            </div>
            <div>
              <h3 className="modal-title" id="auth-modal-title" data-testid="auth-modal-title">
                {content.title}
              </h3>
              <p className="modal-subtitle" data-testid="auth-modal-desc">
                {content.desc}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            data-testid="auth-modal-close-btn"
          >
            {ICONS.x}
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <Link
              href={loginUrl}
              className="btn btn-primary"
              id="authModalSignInBtn"
              data-testid="auth-modal-signin-btn"
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'inline-flex', width: 20, height: 20 }}>{ICONS.google}</span>
              <span>{language === 'th' ? 'เข้าสู่ระบบด้วย Google' : 'Sign In with Google'}</span>
            </Link>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              data-testid="auth-modal-cancel-btn"
              style={{ padding: '10px 16px', fontSize: 14 }}
            >
              {language === 'th' ? 'ไว้คราวหลัง' : 'Maybe Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
