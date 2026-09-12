'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ICONS } from '@/components/ui/Icons';
import { CATEGORY_LABELS, ALL_INTEREST_TAGS } from '@/lib/labels';
import { ProjectCategory } from '@/types/project';

export default function NotificationsPage() {
  const router = useRouter();
  const { language, L } = useLanguage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [dailyDigest, setDailyDigest] = useState(true);
  const [closingAlert, setClosingAlert] = useState(true);
  const [newProjectAlert, setNewProjectAlert] = useState(false);
  const [interestTags, setInterestTags] = useState<string[]>(['Website', 'AI']);
  const [budgetMin, setBudgetMin] = useState<string>('');
  const [budgetMax, setBudgetMax] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Client-side auth guard (middleware is the primary guard)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?from=/notifications');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch saved settings from API or localStorage
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          const s = json.data;
          if (s.dailyDigest !== undefined) setDailyDigest(s.dailyDigest);
          if (s.closingAlert !== undefined) setClosingAlert(s.closingAlert);
          if (s.newProjectAlert !== undefined) setNewProjectAlert(s.newProjectAlert);
          if (Array.isArray(s.interestTags)) setInterestTags(s.interestTags);
          if (s.budgetMin !== null && s.budgetMin !== undefined) setBudgetMin(String(s.budgetMin));
          if (s.budgetMax !== null && s.budgetMax !== undefined) setBudgetMax(String(s.budgetMax));
        }
      })
      .catch(() => {
        // Fallback from localStorage
        const saved = localStorage.getItem('torbidd_settings');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setDailyDigest(parsed.dailyDigest ?? true);
            setClosingAlert(parsed.closingAlert ?? true);
            setNewProjectAlert(parsed.newProjectAlert ?? false);
            setInterestTags(parsed.interestTags ?? ['Website', 'AI']);
            setBudgetMin(parsed.budgetMin ? String(parsed.budgetMin) : '');
            setBudgetMax(parsed.budgetMax ? String(parsed.budgetMax) : '');
          } catch {}
        }
      });
  }, []);

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
    const payload = {
      dailyDigest,
      closingAlert,
      newProjectAlert,
      interestTags,
      budgetMin: min,
      budgetMax: max,
      language,
    };

    // Save locally
    localStorage.setItem('torbidd_settings', JSON.stringify(payload));

    // Save to API
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore network errors
    } finally {
      setIsSaving(false);
      showToast(L('settingsSaved'), ICONS.check);
    }
  };

  // Show nothing while auth is loading to avoid flicker
  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">{L('settingsTitle')}</h1>
        <p className="page-subtitle">{L('settingsSub')}</p>
      </div>

      <div className="settings-grid">
        {/* Email Notification Panel */}
        <div className="settings-card">
          <h3 className="settings-card-title">{L('emailNotif')}</h3>
          <p className="settings-card-desc">{L('emailNotifDesc')}</p>

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
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{L('closingAlert')}</div>
              <div className="toggle-sublabel">{L('closingAlertDesc')}</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="toggleClosingAlert"
                checked={closingAlert}
                onChange={(e) => setClosingAlert(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-label">{L('newProjectAlert')}</div>
              <div className="toggle-sublabel">{L('newProjectAlertDesc')}</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="toggleNewProject"
                checked={newProjectAlert}
                onChange={(e) => setNewProjectAlert(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Budget Range Selection */}
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

        {/* Industry/Interest Tags */}
        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
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
            >
              {ICONS.check}
              <span>{isSaving ? 'Saving...' : L('saveSettings')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
