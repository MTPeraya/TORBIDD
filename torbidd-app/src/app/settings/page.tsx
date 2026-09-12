'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { ICONS } from '@/components/ui/Icons';

interface SavedProfile {
  userId?: string;
  email?: string;
  name?: string;
  org?: string;
  role?: string;
  avatar?: string | null;
}

function getSavedProfile(): SavedProfile {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const saved = localStorage.getItem('torbidd_profile');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return {};
}

export default function ProfileSettingsPage() {
  const { L } = useLanguage();
  const { showToast } = useToast();
  const { user: authUser, isAuthenticated, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialSaved = getSavedProfile();

  const [name, setName] = useState(() => initialSaved.name || '');
  const [org, setOrg] = useState(() => initialSaved.org || '');
  const [role, setRole] = useState(() => initialSaved.role || '');
  const [avatar, setAvatar] = useState<string | null>(() => initialSaved.avatar ?? null);
  const [isSaving, setIsSaving] = useState(false);

  // Adjust state during render when authUser becomes available/changes
  const [prevAuthId, setPrevAuthId] = useState<string | null>(null);

  if (authUser && prevAuthId !== authUser.id) {
    setPrevAuthId(authUser.id);
    const saved = getSavedProfile();
    const isMatchingUser = saved && (saved.userId === authUser.id || saved.email === authUser.email);

    setName(isMatchingUser && saved.name !== undefined && saved.name !== '' ? saved.name : (authUser.name || ''));
    setOrg(isMatchingUser && saved.org !== undefined && saved.org !== '' ? saved.org : (authUser.org || 'กรุงเทพมหานคร'));
    setRole(isMatchingUser && saved.role !== undefined && saved.role !== '' ? saved.role : (authUser.role || 'BMA Officer'));
    setAvatar(isMatchingUser && saved.avatar !== undefined ? saved.avatar : (authUser.picture || null));
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (max 2MB)
    if (!file.type.startsWith('image/')) {
      showToast(L('profileImageTypeError'), ICONS.bell);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast(L('profileImageSizeError'), ICONS.bell);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatar(result);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatar(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload: SavedProfile = {
      userId: authUser?.id,
      email: authUser?.email,
      name,
      org,
      role,
      avatar,
    };
    localStorage.setItem('torbidd_profile', JSON.stringify(payload));
    // Notify same-tab listeners (storage event only fires in other tabs)
    window.dispatchEvent(new Event('torbidd_profile_updated'));

    if (isAuthenticated) {
      await updateProfile({ name, org, role, avatar });
    }

    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSaving(false);
    showToast(L('profileSaved'), ICONS.check);
  };

  // Example Preview Data (matches Google data & live updates with form)
  const previewName = name || authUser?.name || 'BMA Officer';
  const previewOrg = org || authUser?.org || 'กรุงเทพมหานคร';
  const previewRole = role || authUser?.role || 'BMA Officer';
  const previewAvatar = avatar !== null && avatar !== undefined ? avatar : (authUser?.picture || null);

  const initials = previewName
    ? previewName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'BM';

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">{L('profileTitle')}</h1>
        <p className="page-subtitle">{L('profileSub')}</p>
      </div>

      <div className="profile-settings-container">
        {/* Sign in prompt for unauthenticated visitors */}
        {!isAuthenticated && (
          <div className="google-auth-prompt-card">
            <div className="google-prompt-icon">{ICONS.google}</div>
            <div className="google-prompt-info">
              <div className="google-prompt-title">{L('profileGooglePromptTitle')}</div>
              <div className="google-prompt-desc">{L('profileGooglePromptDesc')}</div>
            </div>
            <Link href="/login" className="google-prompt-btn">
              <span>{L('navLogin')}</span>
            </Link>
          </div>
        )}

        {/* Example Preview Card / Avatar section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-upload-wrapper" onClick={handleAvatarClick} title={L('profileAvatarTitle')}>
            {previewAvatar ? (
              <img src={previewAvatar} alt="Profile" className="profile-avatar-large profile-avatar-img" />
            ) : (
              <div className="profile-avatar-large">{initials}</div>
            )}
            <div className="profile-avatar-overlay">
              <span className="profile-avatar-overlay-icon">{ICONS.camera}</span>
              <span className="profile-avatar-overlay-text">{L('profileChangeAvatar')}</span>
            </div>
            {previewAvatar && (
              <button
                type="button"
                className="profile-avatar-remove-btn"
                onClick={handleRemoveAvatar}
                title={L('profileRemoveAvatar')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            id="avatarFileInput"
          />

          <div className="profile-avatar-info">
            <div className="profile-avatar-header-row">
              <div className="profile-avatar-name">{previewName}</div>
              {isAuthenticated && (
                <span className="profile-verified-badge" title="Google Account">
                  {ICONS.google}
                  <span>Google</span>
                </span>
              )}
            </div>
            <div className="profile-avatar-meta-row">
              <span className="profile-role-badge">{previewRole}</span>
              <span className="profile-avatar-org">{previewOrg}</span>
            </div>
            {isAuthenticated && authUser?.email && (
              <div className="profile-avatar-email">{authUser.email}</div>
            )}
            <p className="profile-avatar-hint">{L('profileAvatarHint')}</p>
          </div>
        </div>

        {/* Form Inputs matching Google Account */}
        <div className="profile-form">
          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="profileName">
              {ICONS.user}
              <span>{L('profileName')}</span>
            </label>
            <input
              id="profileName"
              type="text"
              className="profile-form-input"
              placeholder={L('profileNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="profileOrg">
              {ICONS.building}
              <span>{L('profileOrg')}</span>
            </label>
            <input
              id="profileOrg"
              type="text"
              className="profile-form-input"
              placeholder={L('profileOrgPlaceholder')}
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              autoComplete="organization"
            />
          </div>

          <div className="profile-form-group">
            <label className="profile-form-label" htmlFor="profileRole">
              {ICONS.dashboard}
              <span>{L('profileRole')}</span>
            </label>
            <input
              id="profileRole"
              type="text"
              className="profile-form-input"
              placeholder={L('profileRolePlaceholder')}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              autoComplete="organization-title"
            />
          </div>

          <div className="profile-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              id="saveProfileBtn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? ICONS.clock : ICONS.check}
              <span>{isSaving ? '...' : L('profileSave')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
