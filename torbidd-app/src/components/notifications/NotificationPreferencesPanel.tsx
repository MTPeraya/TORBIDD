'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { ICONS } from '@/components/ui/Icons';
import { CATEGORY_LABELS, ALL_INTEREST_TAGS } from '@/lib/labels';
import { ProjectCategory } from '@/types/project';
import { NotificationPreferences } from '@/types/notification';
import { NOTIFICATION_CONFIG } from '@/config/notification';

interface NotificationPreferencesPanelProps {
  initialPreferences?: NotificationPreferences;
  onPreferencesSaved?: (prefs: NotificationPreferences) => void;
}

export function NotificationPreferencesPanel({
  initialPreferences,
  onPreferencesSaved,
}: NotificationPreferencesPanelProps) {
  const { language, L } = useLanguage();
  const { showToast } = useToast();

  const [inAppNotif, setInAppNotif] = useState(
    initialPreferences?.inAppNotif ?? true,
  );
  const [newOpportunity, setNewOpportunity] = useState(
    initialPreferences?.newOpportunity ?? true,
  );
  const [savedUpdate, setSavedUpdate] = useState(
    initialPreferences?.savedUpdate ?? true,
  );
  const [deadlineReminder, setDeadlineReminder] = useState(
    initialPreferences?.deadlineReminder ?? true,
  );
  const [emailNotif, setEmailNotif] = useState(
    initialPreferences?.emailNotif ?? true,
  );
  const [dailyDigest, setDailyDigest] = useState(
    initialPreferences?.dailyDigest ?? true,
  );
  const [keywords, setKeywords] = useState<string[]>(
    initialPreferences?.keywords ?? [],
  );
  const [keywordInput, setKeywordInput] = useState('');
  const [interestTags, setInterestTags] = useState<string[]>(
    initialPreferences?.interestTags ?? ['Website', 'AI'],
  );
  const [agencies, setAgencies] = useState<string[]>(
    initialPreferences?.agencies ?? [],
  );
  const [notificationEmail, setNotificationEmail] = useState<string>(
    initialPreferences?.email ?? '',
  );
  const [budgetMin, setBudgetMin] = useState<string>(
    initialPreferences?.budgetMin !== null && initialPreferences?.budgetMin !== undefined
      ? String(initialPreferences.budgetMin)
      : '',
  );
  const [budgetMax, setBudgetMax] = useState<string>(
    initialPreferences?.budgetMax !== null && initialPreferences?.budgetMax !== undefined
      ? String(initialPreferences.budgetMax)
      : '',
  );
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Adjust state during render when initialPreferences loads/changes
  const [prevPrefs, setPrevPrefs] = useState<NotificationPreferences | undefined>(initialPreferences);

  if (initialPreferences && prevPrefs !== initialPreferences) {
    setPrevPrefs(initialPreferences);
    setInAppNotif(initialPreferences.inAppNotif ?? true);
    setNewOpportunity(initialPreferences.newOpportunity ?? true);
    setSavedUpdate(initialPreferences.savedUpdate ?? true);
    setDeadlineReminder(initialPreferences.deadlineReminder ?? true);
    setEmailNotif(initialPreferences.emailNotif ?? true);
    setDailyDigest(initialPreferences.dailyDigest ?? true);
    if (Array.isArray(initialPreferences.keywords)) {
      setKeywords(initialPreferences.keywords);
    }
    if (Array.isArray(initialPreferences.interestTags)) {
      setInterestTags(initialPreferences.interestTags);
    }
    if (Array.isArray(initialPreferences.agencies)) {
      setAgencies(initialPreferences.agencies);
    }
    if (initialPreferences.email !== undefined && initialPreferences.email !== null) {
      setNotificationEmail(initialPreferences.email);
    }
    if (initialPreferences.budgetMin !== null && initialPreferences.budgetMin !== undefined) {
      setBudgetMin(String(initialPreferences.budgetMin));
    }
    if (initialPreferences.budgetMax !== null && initialPreferences.budgetMax !== undefined) {
      setBudgetMax(String(initialPreferences.budgetMax));
    }
  }

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/-/g, '');
    setBudgetMin(val);
    validateRange(val, budgetMax);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/-/g, '');
    setBudgetMax(val);
    validateRange(budgetMin, val);
  };

  const validateRange = (min: string, max: string) => {
    if (min !== '' && max !== '' && Number(max) < Number(min)) {
      setHasError(true);
    } else {
      setHasError(false);
    }
  };

  const toggleTag = (tag: string) => {
    setInterestTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const toggleAgency = (agencyName: string) => {
    setAgencies((prev) => {
      if (prev.includes(agencyName)) {
        return prev.filter((a) => a !== agencyName);
      }
      return [...prev, agencyName];
    });
  };

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (!keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const getChannelSummary = () => {
    if (inAppNotif && emailNotif) return L('channelBoth');
    if (inAppNotif && !emailNotif) return L('channelInAppOnly');
    if (!inAppNotif && emailNotif) return L('channelEmailOnly');
    return L('channelNone');
  };

  const handleSave = async () => {
    const min = budgetMin !== '' ? Number(budgetMin) : null;
    const max = budgetMax !== '' ? Number(budgetMax) : null;

    if (min !== null && max !== null && max < min) {
      setHasError(true);
      showToast(L('budgetRangeError'), ICONS.alertTriangle, 'error');
      return;
    }

    setIsSaving(true);
    const payload: NotificationPreferences = {
      inAppNotif,
      newOpportunity,
      savedUpdate,
      deadlineReminder,
      emailNotif,
      dailyDigest,
      keywords,
      interestTags,
      agencies,
      budgetMin: min,
      budgetMax: max,
      language,
      email: notificationEmail.trim() || null,
    };

    // Cache locally
    try {
      localStorage.setItem('torbidd_settings', JSON.stringify(payload));
      localStorage.setItem('torbidd_notif_prefs', JSON.stringify(payload));
    } catch {}

    try {
      // Save to notification preferences API
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback to /api/settings if needed
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            newProjectAlert: newOpportunity,
            closingAlert: deadlineReminder,
          }),
        });
      }

      if (onPreferencesSaved) {
        onPreferencesSaved(payload);
      }
      showToast(L('settingsSaved'), ICONS.check);
    } catch {
      showToast(L('settingsSaved'), ICONS.check);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="notif-pref-container">
      {/* 1. Category Toggles Panel */}
      <div className="settings-card">
        <h3 className="settings-card-title">{L('prefCategoryTitle')}</h3>
        <p className="settings-card-desc">{L('prefCategorySub')}</p>

        {/* 1.1 New Opportunity Alerts */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">{L('prefNewOpps')}</div>
            <div className="toggle-sublabel">{L('prefNewOppsDesc')}</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggleNewOpportunity"
              checked={newOpportunity}
              onChange={(e) => setNewOpportunity(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* 1.2 Saved Procurement Updates */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">{L('prefSavedUpdates')}</div>
            <div className="toggle-sublabel">{L('prefSavedUpdatesDesc')}</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggleSavedUpdate"
              checked={savedUpdate}
              onChange={(e) => setSavedUpdate(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* 1.3 Deadline Reminders */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">{L('prefDeadlines')}</div>
            <div className="toggle-sublabel">{L('prefDeadlinesDesc')}</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggleDeadlineReminder"
              checked={deadlineReminder}
              onChange={(e) => setDeadlineReminder(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* 2. Notification Channels Selection (UC-6 Flow 4) */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="settings-card-title">{L('channelSelectionTitle')}</h3>
            <p className="settings-card-desc">{L('channelSelectionSub')}</p>
          </div>
          <span
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '12px',
              background: inAppNotif || emailNotif ? 'rgba(14, 165, 233, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: inAppNotif || emailNotif ? '#0284c7' : '#ef4444',
              fontWeight: 600,
            }}
          >
            {getChannelSummary()}
          </span>
        </div>

        {/* 2.1 In-App Notification Channel */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">{L('inAppNotif')}</div>
            <div className="toggle-sublabel">{L('inAppNotifDesc')}</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggleInAppNotif"
              checked={inAppNotif}
              onChange={(e) => setInAppNotif(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* 2.2 Email Notification Channel */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">{L('emailNotif')}</div>
            <div className="toggle-sublabel">{L('emailNotifDesc')}</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggleEmailNotif"
              checked={emailNotif}
              onChange={(e) => setEmailNotif(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* 2.3 Email Address Input if Email is Enabled */}
        {emailNotif && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
            <label htmlFor="inputNotifEmail" style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              {L('notifEmailTitle')}
            </label>
            <input
              type="email"
              id="inputNotifEmail"
              placeholder="example@bma.go.th"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            />
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>{L('notifEmailDesc')}</p>
          </div>
        )}

        <div className="notif-pref-divider" />

        {/* 2.4 Daily Digest */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">{L('dailyDigest')}</div>
            <div className="toggle-sublabel">{L('dailyDigestDesc')}</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              id="toggleDailyDigest"
              checked={dailyDigest}
              onChange={(e) => setDailyDigest(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* 3. Custom Keywords (UC-6 Matching Criteria) */}
      <div className="settings-card">
        <h3 className="settings-card-title">{L('keywordsTitle')}</h3>
        <p className="settings-card-desc">{L('keywordsDesc')}</p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            id="inputKeyword"
            placeholder={L('keywordPlaceholder')}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddKeyword();
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
            }}
          />
          <button
            type="button"
            id="addKeywordBtn"
            className="btn btn-secondary"
            onClick={handleAddKeyword}
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            + {L('addKeyword')}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {keywords.map((kw) => (
            <span
              key={kw}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '16px',
                background: '#e0f2fe',
                color: '#0369a1',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {kw}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(kw)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0369a1',
                  fontWeight: 700,
                  padding: 0,
                  fontSize: '14px',
                  lineHeight: 1,
                }}
                aria-label={`Remove ${kw}`}
              >
                ✕
              </button>
            </span>
          ))}
          {keywords.length === 0 && (
            <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
              {language === 'th' ? 'ยังไม่ได้ระบุคำค้นหาเฉพาะ (ระบบจะแจ้งเตือนตามหมวดหมู่)' : 'No custom keywords configured'}
            </span>
          )}
        </div>
      </div>

      {/* 4. Budget Range Preferences (UC-6 Matching Criteria) */}
      <div className="settings-card">
        <h3 className="settings-card-title">{L('budgetPref')}</h3>
        <p className="settings-card-desc">{L('budgetPrefDesc')}</p>

        <div className="budget-range-inputs">
          <input
            type="number"
            id="budgetMin"
            min="0"
            placeholder={L('budgetMin')}
            value={budgetMin}
            onChange={handleMinChange}
          />
          <span>—</span>
          <input
            type="number"
            id="budgetMax"
            min={budgetMin || '0'}
            placeholder={L('budgetMax')}
            value={budgetMax}
            onChange={handleMaxChange}
            className={hasError ? 'input-error' : ''}
          />
        </div>

        <div
          id="budgetRangeError"
          className={`budget-range-error ${hasError ? 'shake-anim' : ''}`}
          style={{ display: hasError ? 'flex' : 'none' }}
        >
          {ICONS.alertTriangle}
          <span>{L('budgetRangeError')}</span>
        </div>
      </div>

      {/* 5. Software Categories (UC-6 Matching Criteria) */}
      <div className="settings-card">
        <h3 className="settings-card-title">{L('interestTags')}</h3>
        <p className="settings-card-desc">{L('interestTagsDesc')}</p>

        <div className="interest-tags-grid">
          {ALL_INTEREST_TAGS.map((tag) => {
            const active = interestTags.includes(tag);
            const label =
              tag in CATEGORY_LABELS[language]
                ? CATEGORY_LABELS[language][tag as ProjectCategory]
                : tag === 'Cloud'
                ? language === 'th' ? 'ระบบ Cloud' : 'Cloud'
                : tag === 'Security'
                ? language === 'th' ? 'ความปลอดภัย' : 'Security'
                : tag;

            return (
              <button
                key={tag}
                type="button"
                className={`interest-tag ${active ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
                data-tag={tag}
              >
                {active ? '✓ ' : ''}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Issuing Agencies (UC-6 Matching Criteria) */}
      <div className="settings-card">
        <h3 className="settings-card-title">{L('agenciesTitle')}</h3>
        <p className="settings-card-desc">{L('agenciesDesc')}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {NOTIFICATION_CONFIG.AVAILABLE_AGENCIES.map((agency) => {
            const agencyName = language === 'th' ? agency.th : agency.en;
            const active = agencies.includes(agency.th) || agencies.includes(agency.en);

            return (
              <button
                key={agency.th}
                type="button"
                className={`interest-tag ${active ? 'active' : ''}`}
                onClick={() => toggleAgency(language === 'th' ? agency.th : agency.en)}
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                {active ? '✓ ' : ''}
                {agencyName}
              </button>
            );
          })}
        </div>

        <div className="settings-save-btn" style={{ marginTop: '24px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            id="saveNotifPrefBtn"
          >
            {ICONS.check}
            <span>{isSaving ? 'Saving...' : L('saveSettings')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
