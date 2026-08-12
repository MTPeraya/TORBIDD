// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - NOTIFICATIONS CONFIGURATION
// ==========================================================================

function renderNotifications() {
  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">${L('settingsTitle')}</h1>
        <p class="page-subtitle">${L('settingsSub')}</p>
      </div>

      <div class="settings-grid">
        <!-- Email Notification Panel -->
        <div class="settings-card">
          <h3 class="settings-card-title">${L('emailNotif')}</h3>
          <p class="settings-card-desc">${L('emailNotifDesc')}</p>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">${L('dailyDigest')}</div>
              <div class="toggle-sublabel">${L('dailyDigestDesc')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggleDailyDigest" ${state.settings.dailyDigest ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">${L('closingAlert')}</div>
              <div class="toggle-sublabel">${L('closingAlertDesc')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggleClosingAlert" ${state.settings.closingAlert ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">${L('newProjectAlert')}</div>
              <div class="toggle-sublabel">${L('newProjectAlertDesc')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggleNewProject" ${state.settings.newProjectAlert ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Budget Range Selection -->
        <div class="settings-card">
          <h3 class="settings-card-title">${L('budgetPref')}</h3>
          <p class="settings-card-desc">${L('budgetPrefDesc')}</p>
          <div class="budget-range-inputs">
            <input type="number" id="budgetMin" placeholder="${L('budgetMin')}" value="${state.settings.budgetMin}">
            <span>—</span>
            <input type="number" id="budgetMax" placeholder="${L('budgetMax')}" value="${state.settings.budgetMax}">
          </div>
        </div>

        <!-- Industry/Interest Tags -->
        <div class="settings-card" style="grid-column: 1 / -1;">
          <h3 class="settings-card-title">${L('interestTags')}</h3>
          <p class="settings-card-desc">${L('interestTagsDesc')}</p>
          <div class="interest-tags-grid">
            ${CATEGORIES.map(c => `
              <button class="interest-tag ${state.settings.interestTags.includes(c) ? 'active' : ''}" data-tag="${c}">
                ${state.settings.interestTags.includes(c) ? '✓ ' : ''}${CATEGORY_LABELS[state.language][c]}
              </button>
            `).join('')}
            <button class="interest-tag ${state.settings.interestTags.includes('Cloud') ? 'active' : ''}" data-tag="Cloud">
              ${state.settings.interestTags.includes('Cloud') ? '✓ ' : ''}${state.language === 'th' ? 'ระบบ Cloud' : 'Cloud'}
            </button>
            <button class="interest-tag ${state.settings.interestTags.includes('Security') ? 'active' : ''}" data-tag="Security">
              ${state.settings.interestTags.includes('Security') ? '✓ ' : ''}${state.language === 'th' ? 'ความปลอดภัย' : 'Security'}
            </button>
            <button class="interest-tag ${state.settings.interestTags.includes('IoT') ? 'active' : ''}" data-tag="IoT">
              ${state.settings.interestTags.includes('IoT') ? '✓ ' : ''}IoT
            </button>
            <button class="interest-tag ${state.settings.interestTags.includes('Blockchain') ? 'active' : ''}" data-tag="Blockchain">
              ${state.settings.interestTags.includes('Blockchain') ? '✓ ' : ''}Blockchain
            </button>
          </div>
          <div class="settings-save-btn">
            <button class="btn btn-primary" onclick="saveSettings()">
              ${ICONS.check}
              <span>${L('saveSettings')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function saveSettings() {
  showToast(L('settingsSaved'), ICONS.check);
}
