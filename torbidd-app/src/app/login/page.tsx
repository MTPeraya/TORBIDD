'use client';

// =============================================================================
// app/login/page.tsx - Google Authentication Page
// =============================================================================

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';

function LoginContent() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { L } = useLanguage();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const returnUrl = searchParams.get('returnUrl') || '/';

  const getErrorMessage = (code: string | null) => {
    switch (code) {
      case 'invalid_state':
      case 'state_mismatch':
        return 'การยืนยันตัวตนหมดอายุหรือเกิดข้อผิดพลาดด้านความปลอดภัย กรุณาลองใหม่อีกครั้ง';
      case 'token_exchange_failed':
        return 'ไม่สามารถแลกเปลี่ยนโทเคนกับ Google ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
      case 'userinfo_failed':
        return 'ไม่สามารถดึงข้อมูลบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง';
      case 'auth_failed':
        return 'การยืนยันตัวตนกับเซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง';
      case 'access_denied':
        return 'คุณได้ยกเลิกการเข้าสู่ระบบผ่าน Google';
      case 'missing_code':
        return 'ไม่พบรหัสยืนยันตัวตนจาก Google กรุณาลองใหม่อีกครั้ง';
      default:
        return code ? `เกิดข้อผิดพลาดในการเข้าสู่ระบบ (${code})` : null;
    }
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Header Branding */}
        <div className="login-header">
          <div className="login-emblem">
            <span className="login-emblem-text">กทม</span>
          </div>
          <h1 className="login-title">{L('loginTitle')}</h1>
          <p className="login-subtitle">{L('loginSub')}</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="login-error-box">
            <span className="login-error-icon">{ICONS.bell}</span>
            <span className="login-error-text">{errorMessage}</span>
          </div>
        )}

        {/* Already Logged In Card */}
        {isAuthenticated && user ? (
          <div className="login-session-box">
            <div className="login-session-avatar">
              {user.picture ? (
                <Image src={user.picture} alt={user.name} className="login-avatar-img" width={48} height={48} unoptimized />
              ) : (
                user.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="login-session-info">
              <div className="login-session-name">{user.name}</div>
              <div className="login-session-email">{user.email}</div>
              <div className="login-session-badge">{user.role || 'BMA Officer'}</div>
            </div>

            <div className="login-actions">
              <Link href={returnUrl} className="login-primary-btn">
                <span>ไปยังหน้าหลัก</span>
                {ICONS.chevronRight}
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="login-secondary-btn"
              >
                {L('navLogout')}
              </button>
            </div>
          </div>
        ) : (
          /* Sign in with Google Button */
          <div className="login-form-area">
            <button
              type="button"
              id="googleSignInBtn"
              className="google-sign-in-btn"
              disabled={isLoading}
              onClick={() => login(returnUrl, false)}
            >
              <span className="google-btn-icon">{ICONS.google}</span>
              <span className="google-btn-text">{L('loginWithGoogleBtn')}</span>
            </button>
          </div>
        )}

        {/* Back Link */}
        <div className="login-card-footer">
          <Link href="/" className="login-back-link">
            {ICONS.arrowLeft}
            <span>กลับหน้าหลัก (Home)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-container"><div className="login-card" style={{ textAlign: 'center', padding: '40px' }}>กำลังโหลด...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
