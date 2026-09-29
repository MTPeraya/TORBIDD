'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  userType?: 'individual' | 'organization';
  userDetail?: string;
  indProjectCategory?: string;
  indBudgetScale?: string;
  indSpecsPreference?: string;
  orgEngineeringDomain?: string;
  orgContractScale?: string;
  orgSupportModel?: string;
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
  const [userType, setUserType] = useState<'individual' | 'organization'>(
    () => initialSaved.userType || 'individual'
  );
  const [userDetail, setUserDetail] = useState(() => initialSaved.userDetail || '');
  const [indProjectCategory, setIndProjectCategory] = useState(() => initialSaved.indProjectCategory || '');
  const [indBudgetScale, setIndBudgetScale] = useState(() => initialSaved.indBudgetScale || '');
  const [indSpecsPreference, setIndSpecsPreference] = useState(() => initialSaved.indSpecsPreference || '');
  const [orgEngineeringDomain, setOrgEngineeringDomain] = useState(() => initialSaved.orgEngineeringDomain || '');
  const [orgContractScale, setOrgContractScale] = useState(() => initialSaved.orgContractScale || '');
  const [orgSupportModel, setOrgSupportModel] = useState(() => initialSaved.orgSupportModel || '');
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
    if (isMatchingUser && saved.userType) setUserType(saved.userType);
    if (isMatchingUser && saved.userDetail !== undefined) setUserDetail(saved.userDetail);
    if (isMatchingUser) {
      if (saved.indProjectCategory !== undefined) setIndProjectCategory(saved.indProjectCategory);
      if (saved.indBudgetScale !== undefined) setIndBudgetScale(saved.indBudgetScale);
      if (saved.indSpecsPreference !== undefined) setIndSpecsPreference(saved.indSpecsPreference);
      if (saved.orgEngineeringDomain !== undefined) setOrgEngineeringDomain(saved.orgEngineeringDomain);
      if (saved.orgContractScale !== undefined) setOrgContractScale(saved.orgContractScale);
      if (saved.orgSupportModel !== undefined) setOrgSupportModel(saved.orgSupportModel);
    }
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
      userType,
      userDetail,
      indProjectCategory,
      indBudgetScale,
      indSpecsPreference,
      orgEngineeringDomain,
      orgContractScale,
      orgSupportModel,
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

  const indQ1Options = [
    { key: 'A', label: L('profileIndQ1OptA') },
    { key: 'B', label: L('profileIndQ1OptB') },
    { key: 'C', label: L('profileIndQ1OptC') },
    { key: 'D', label: L('profileIndQ1OptD') },
    { key: 'E', label: L('profileIndQ1OptE') },
    { key: 'F', label: L('profileIndQ1OptF') },
  ];

  const indQ2Options = [
    { key: 'A', label: L('profileIndQ2OptA') },
    { key: 'B', label: L('profileIndQ2OptB') },
    { key: 'C', label: L('profileIndQ2OptC') },
  ];

  const indQ3Options = [
    { key: 'A', label: L('profileIndQ3OptA') },
    { key: 'B', label: L('profileIndQ3OptB') },
    { key: 'C', label: L('profileIndQ3OptC') },
  ];

  const orgQ1Options = [
    { key: 'A', label: L('profileOrgQ1OptA') },
    { key: 'B', label: L('profileOrgQ1OptB') },
    { key: 'C', label: L('profileOrgQ1OptC') },
    { key: 'D', label: L('profileOrgQ1OptD') },
    { key: 'E', label: L('profileOrgQ1OptE') },
  ];

  const orgQ2Options = [
    { key: 'A', label: L('profileOrgQ2OptA') },
    { key: 'B', label: L('profileOrgQ2OptB') },
    { key: 'C', label: L('profileOrgQ2OptC') },
  ];

  const orgQ3Options = [
    { key: 'A', label: L('profileOrgQ3OptA') },
    { key: 'B', label: L('profileOrgQ3OptB') },
    { key: 'C', label: L('profileOrgQ3OptC') },
  ];

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
              <Image src={previewAvatar} alt="Profile" className="profile-avatar-large profile-avatar-img" width={80} height={80} unoptimized />
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
        </div>

        {/* User Type Card */}
        <div className="profile-usertype-card">
          <div className="profile-usertype-header">
            <div className="profile-usertype-title">{L('profileUserTypeTitle')}</div>
            <div className="profile-usertype-sub">{L('profileUserTypeSub')}</div>
          </div>

          <div className="profile-usertype-toggle">
            <button
              type="button"
              id="userTypeIndividualBtn"
              className={`profile-usertype-btn ${userType === 'individual' ? 'active' : ''}`}
              onClick={() => setUserType('individual')}
            >
              <span className="profile-usertype-btn-icon">{ICONS.user}</span>
              <span className="profile-usertype-btn-label">{L('profileUserTypeIndividual')}</span>
              <span className="profile-usertype-btn-desc">{L('profileUserTypeIndividualDesc')}</span>
            </button>

            <button
              type="button"
              id="userTypeOrgBtn"
              className={`profile-usertype-btn ${userType === 'organization' ? 'active' : ''}`}
              onClick={() => setUserType('organization')}
            >
              <span className="profile-usertype-btn-icon">{ICONS.building}</span>
              <span className="profile-usertype-btn-label">{L('profileUserTypeOrg')}</span>
              <span className="profile-usertype-btn-desc">{L('profileUserTypeOrgDesc')}</span>
            </button>
          </div>

          {/* Work Experience Section Header */}
          <div className="profile-usertype-divider" />
          <div className="profile-section-heading">
            <span className="profile-section-heading-icon">
              {userType === 'individual' ? ICONS.dashboard : ICONS.building}
            </span>
            <span className="profile-section-heading-text">
              {userType === 'individual' ? L('profileWorkExpLabel') : L('profileWorkExpSectionTitle')}
            </span>
          </div>

          {/* Questionnaire (placed after Work Experience section, before describe box) */}
          {userType === 'individual' ? (
            <div className="profile-questions-container">
              {/* Individual Question 1 */}
              <div className="profile-question-group">
                <div className="profile-question-title">{L('profileIndQ1Title')}</div>
                <div className="profile-options-list">
                  {indQ1Options.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      id={`indQ1Opt${opt.key}`}
                      className={`profile-option-card ${indProjectCategory === opt.key ? 'selected' : ''}`}
                      onClick={() => setIndProjectCategory(opt.key)}
                    >
                      <span className="profile-option-badge">{opt.key}</span>
                      <span className="profile-option-text">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Question 2 */}
              <div className="profile-question-group">
                <div className="profile-question-title">{L('profileIndQ2Title')}</div>
                <div className="profile-options-list">
                  {indQ2Options.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      id={`indQ2Opt${opt.key}`}
                      className={`profile-option-card ${indBudgetScale === opt.key ? 'selected' : ''}`}
                      onClick={() => setIndBudgetScale(opt.key)}
                    >
                      <span className="profile-option-badge">{opt.key}</span>
                      <span className="profile-option-text">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Question 3 */}
              <div className="profile-question-group">
                <div className="profile-question-title">{L('profileIndQ3Title')}</div>
                <div className="profile-options-list">
                  {indQ3Options.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      id={`indQ3Opt${opt.key}`}
                      className={`profile-option-card ${indSpecsPreference === opt.key ? 'selected' : ''}`}
                      onClick={() => setIndSpecsPreference(opt.key)}
                    >
                      <span className="profile-option-badge">{opt.key}</span>
                      <span className="profile-option-text">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-questions-container">
              {/* Organization Question 1 */}
              <div className="profile-question-group">
                <div className="profile-question-title">{L('profileOrgQ1Title')}</div>
                <div className="profile-options-list">
                  {orgQ1Options.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      id={`orgQ1Opt${opt.key}`}
                      className={`profile-option-card ${orgEngineeringDomain === opt.key ? 'selected' : ''}`}
                      onClick={() => setOrgEngineeringDomain(opt.key)}
                    >
                      <span className="profile-option-badge">{opt.key}</span>
                      <span className="profile-option-text">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Organization Question 2 */}
              <div className="profile-question-group">
                <div className="profile-question-title">{L('profileOrgQ2Title')}</div>
                <div className="profile-options-list">
                  {orgQ2Options.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      id={`orgQ2Opt${opt.key}`}
                      className={`profile-option-card ${orgContractScale === opt.key ? 'selected' : ''}`}
                      onClick={() => setOrgContractScale(opt.key)}
                    >
                      <span className="profile-option-badge">{opt.key}</span>
                      <span className="profile-option-text">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Organization Question 3 */}
              <div className="profile-question-group">
                <div className="profile-question-title">{L('profileOrgQ3Title')}</div>
                <div className="profile-options-list">
                  {orgQ3Options.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      id={`orgQ3Opt${opt.key}`}
                      className={`profile-option-card ${orgSupportModel === opt.key ? 'selected' : ''}`}
                      onClick={() => setOrgSupportModel(opt.key)}
                    >
                      <span className="profile-option-badge">{opt.key}</span>
                      <span className="profile-option-text">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Describe Box */}
          <div className="profile-usertype-detail">
            <label className="profile-form-label" htmlFor="profileUserDetail">
              <span className="profile-describe-label-text">
                {userType === 'individual' ? L('profileDescribeBoxLabel') : L('profileCompanyDescLabel')}
              </span>
            </label>
            <textarea
              id="profileUserDetail"
              className="profile-form-textarea"
              rows={4}
              placeholder={userType === 'individual' ? L('profileWorkExpPlaceholder') : L('profileCompanyDescPlaceholder')}
              value={userDetail}
              onChange={(e) => setUserDetail(e.target.value)}
            />
          </div>
        </div>

        {/* Page-level Save Action */}
        <div className="profile-page-actions">
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
  );
}
