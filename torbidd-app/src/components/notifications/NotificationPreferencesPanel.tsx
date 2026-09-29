'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { ICONS } from '@/components/ui/Icons';
import { CATEGORY_LABELS, ALL_INTEREST_TAGS } from '@/lib/labels';
import { ProjectCategory } from '@/types/project';
import { NotificationPreferences } from '@/types/notification';

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
  const [interestTags, setInterestTags] = useState<string[]>(
    initialPreferences?.interestTags ?? ['Website', 'AI'],
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
    setNewOpportunity(initialPreferences.newOpportunity ?? true);
    setSavedUpdate(initialPreferences.savedUpdate ?? true);
    setDeadlineReminder(initialPreferences.deadlineReminder ?? true);
    setEmailNotif(initialPreferences.emailNotif ?? true);
    setDailyDigest(initialPreferences.dailyDigest ?? true);
    if (Array.isArray(initialPreferences.interestTags)) {
      setInterestTags(initialPreferences.interestTags);
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
      newOpportunity,
      savedUpdate,
      deadlineReminder,
      emailNotif,
      dailyDigest,
      interestTags,
      budgetMin: min,
      budgetMax: max,
      language,
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
      {/* Category Toggles Panel */}
      <div className="settings-card">
        <h3 className="settings-card-title">{L('prefCategoryTitle')}</h3>
        <p className="settings-card-desc">{L('prefCategorySub')}</p>

        {/* 1. New Opportunity Alerts */}
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

        {/* 2. Saved Procurement Updates */}
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

        {/* 3. Deadline Reminders */}
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

        <div className="notif-pref-divider" />

        {/* Outbound Email & Daily Digest */}
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

      {/* Budget Range Preferences */}
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

      {/* Interest Tags */}
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

        <div className="settings-save-btn">
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
