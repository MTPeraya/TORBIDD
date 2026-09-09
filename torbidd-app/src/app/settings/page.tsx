'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { ICONS } from '@/components/ui/Icons';

export default function ProfileSettingsPage() {
  const { L } = useLanguage();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null); // base64 data URL
  const [isSaving, setIsSaving] = useState(false);

  // Load saved profile from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('torbidd_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        setName(parsed.name ?? '');
        setOrg(parsed.org ?? '');
        setRole(parsed.role ?? '');
        setAvatar(parsed.avatar ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (max 2MB)
    if (!file.type.startsWith('image/')) {
      showToast('กรุณาเลือกไฟล์รูปภาพ', ICONS.bell);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('ไฟล์ต้องมีขนาดไม่เกิน 2MB', ICONS.bell);
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
    const payload = { name, org, role, avatar };
    localStorage.setItem('torbidd_profile', JSON.stringify(payload));
    // Notify same-tab listeners (storage event only fires in other tabs)
    window.dispatchEvent(new Event('torbidd_profile_updated'));

    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 400));
    setIsSaving(false);
    showToast(L('profileSaved'), ICONS.check);
  };

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'BM';

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">{L('profileTitle')}</h1>
        <p className="page-subtitle">{L('profileSub')}</p>
      </div>

      <div className="profile-settings-container">
        {/* Avatar section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-upload-wrapper" onClick={handleAvatarClick} title="เปลี่ยนรูปโปรไฟล์">
            {avatar ? (
              <img src={avatar} alt="Profile" className="profile-avatar-large profile-avatar-img" />
            ) : (
              <div className="profile-avatar-large">{initials}</div>
            )}
            <div className="profile-avatar-overlay">
              <span className="profile-avatar-overlay-icon">{ICONS.camera}</span>
              <span className="profile-avatar-overlay-text">เปลี่ยนรูป</span>
            </div>
            {avatar && (
              <button
                type="button"
                className="profile-avatar-remove-btn"
                onClick={handleRemoveAvatar}
                title="ลบรูปโปรไฟล์"
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
            <div className="profile-avatar-name">{name || 'BMA Officer'}</div>
            <div className="profile-avatar-org">{org || 'กรุงเทพมหานคร'}</div>
            <p className="profile-avatar-hint">คลิกที่รูปเพื่อเปลี่ยน · สูงสุด 2MB</p>
          </div>
        </div>

        {/* Form */}
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
