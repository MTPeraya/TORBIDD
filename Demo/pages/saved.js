// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - SAVED OPPORTUNITIES VIEW
// ==========================================================================

function renderSaved() {
  const savedProjects = PROJECTS.filter(p => state.bookmarks.has(p.id));

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">${L('savedTitle')}</h1>
        <p class="page-subtitle">${L('savedSub')}</p>
      </div>

      ${savedProjects.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">
            ${ICONS.bookmark}
          </div>
          <h3>${L('noSaved')}</h3>
          <p>${L('noSavedDesc')}</p>
          <button class="btn btn-primary" onclick="navigate('dashboard')" style="margin-top:20px">
            ${ICONS.dashboard}
            <span>${state.language === 'th' ? 'ดูโอกาสทั้งหมด' : 'Browse Opportunities'}</span>
          </button>
        </div>
      ` : `
        <div class="projects-grid">
          ${savedProjects.map(p => renderProjectCard(p)).join('')}
        </div>
      `}
    </div>
  `;
}
