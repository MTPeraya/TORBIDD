// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - OPPORTUNITIES DASHBOARD VIEW
// ==========================================================================

function renderDashboard() {
  const projects = getFilteredProjects();
  const closingCount = PROJECTS.filter(p => isClosingSoon(p.deadline)).length;
  const newCount = PROJECTS.filter(p => isNew(p.publishDate)).length;
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budget, 0);

  const depts = [...new Set(PROJECTS.map(p => p.department.th))];

  return `
    <div class="page-content" id="dashboard-page">
      <div class="page-header">
        <h1 class="page-title">${L('dashboardTitle')}</h1>
        <p class="page-subtitle">${L('dashboardSub')}</p>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('totalOpps')}</span>
            <div class="stat-card-icon blue">${ICONS.target}</div>
          </div>
          <div class="stat-card-value">${PROJECTS.length}</div>
          <div class="stat-card-change positive">+${newCount} ${state.language === 'th' ? 'รายการใหม่สัปดาห์นี้' : 'new this week'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('closingSoon')}</span>
            <div class="stat-card-icon amber">${ICONS.clock}</div>
          </div>
          <div class="stat-card-value">${closingCount}</div>
          <div class="stat-card-change neutral">${state.language === 'th' ? 'ภายใน 7 วัน' : 'within 7 days'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('newPublished')}</span>
            <div class="stat-card-icon green">${ICONS.star}</div>
          </div>
          <div class="stat-card-value">${newCount}</div>
          <div class="stat-card-change positive">${state.language === 'th' ? 'ใน 3 วันที่ผ่านมา' : 'in the past 3 days'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('totalBudget')}</span>
            <div class="stat-card-icon teal">${ICONS.dollarSign}</div>
          </div>
          <div class="stat-card-value">${formatBudget(totalBudget)}</div>
          <div class="stat-card-change neutral">${PROJECTS.length} ${state.language === 'th' ? 'โครงการ' : 'projects'}</div>
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          ${ICONS.search}
          <input type="text" class="search-input" id="searchInput" placeholder="${L('searchPlaceholder')}" value="${state.searchQuery}">
        </div>
        <select class="filter-select" id="filterDept">
          <option value="">${L('allDepts')}</option>
          ${depts.map(d => `<option value="${d}" ${state.filters.department === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="filterCategory">
          <option value="">${L('allCategories')}</option>
          ${CATEGORIES.map(c => `<option value="${c}" ${state.filters.category === c ? 'selected' : ''}>${CATEGORY_LABELS[state.language][c]}</option>`).join('')}
        </select>
        <select class="filter-select" id="filterBudget">
          <option value="">${L('allBudgets')}</option>
          <option value="under5m" ${state.filters.budget === 'under5m' ? 'selected' : ''}>${L('under5m')}</option>
          <option value="5to10" ${state.filters.budget === '5to10' ? 'selected' : ''}>${L('range5to10')}</option>
          <option value="10to20" ${state.filters.budget === '10to20' ? 'selected' : ''}>${L('range10to20')}</option>
          <option value="above20m" ${state.filters.budget === 'above20m' ? 'selected' : ''}>${L('above20m')}</option>
        </select>
        <select class="filter-select" id="filterDeadline">
          <option value="">${L('allDeadlines')}</option>
          <option value="within7" ${state.filters.deadline === 'within7' ? 'selected' : ''}>${L('within7days')}</option>
          <option value="within30" ${state.filters.deadline === 'within30' ? 'selected' : ''}>${L('within30days')}</option>
          <option value="moreThan30" ${state.filters.deadline === 'moreThan30' ? 'selected' : ''}>${L('moreThan30')}</option>
        </select>
      </div>

      ${projects.length === 0 ? `
        <div class="no-results">
          ${ICONS.search}
          <h3>${L('noResults')}</h3>
          <p>${L('noResultsDesc')}</p>
        </div>
      ` : `
        <div class="projects-grid">
          ${projects.map(p => renderProjectCard(p)).join('')}
        </div>
      `}
    </div>
  `;
}

function renderProjectCard(project) {
  const isBookmarked = state.bookmarks.has(project.id);
  const closing = isClosingSoon(project.deadline);
  const isNewItem = isNew(project.publishDate);
  const days = daysUntil(project.deadline);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[state.language][project.category];

  // Dot Status tags
  let statusTagClass = 'tag open-dot';
  let statusText = state.language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';
  if (closing) {
    statusTagClass = 'tag closing-soon-dot';
    statusText = state.language === 'th' ? '● ใกล้ปิดรับ' : '● Closing Soon';
  } else if (days < 0) {
    statusTagClass = 'tag closed-dot';
    statusText = state.language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
  }

  return `
    <div class="project-card" onclick="navigate('detail', ${project.id})">
      <div>
        <div class="project-card-header">
          <div class="project-card-tags">
            <span class="tag software">${L('softwareProject')}</span>
            <span class="tag category ${catClass}">${catLabel}</span>
            <span class="${statusTagClass}">${statusText}</span>
          </div>
          <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark(${project.id}, event)">
            ${isBookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
          </button>
        </div>
        <div class="ai-tag-label">AI classification · Confidence: High</div>
        <h3 class="project-card-title" style="margin-top: 6px">${getLocalizedText(project.title)}</h3>
        <div class="project-card-dept">
          ${ICONS.building}
          ${getLocalizedText(project.department)}
        </div>
      </div>
      <div>
        <div class="project-card-meta">
          <div class="meta-item">
            <span class="meta-label">${L('budget')}</span>
            <span class="meta-value budget">${formatBudget(project.budget)}</span>
            <span style="font-size:10px; color:var(--gray-500)">AI extracted</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${L('deadline')}</span>
            <span class="meta-value ${closing ? 'deadline-soon' : ''}">${formatDate(project.deadline)}${closing ? ` (${days}${state.language === 'th' ? ' วัน' : 'd'})` : ''}</span>
            <span style="font-size:10px; color:var(--gray-500)">AI extracted</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${L('publishDate')}</span>
            <span class="meta-value">${formatDate(project.publishDate)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${L('procurementType')}</span>
            <span class="meta-value">${project.procurementType}</span>
          </div>
        </div>
        <div class="source-label">
          Source: ${project.sourceDocument || 'BMA TOR'} • Updated: 11 Aug 2026
        </div>
      </div>
    </div>
  `;
}

function getFilteredProjects() {
  let projects = [...PROJECTS];

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    projects = projects.filter(p => 
      getLocalizedText(p.title).toLowerCase().includes(q) ||
      getLocalizedText(p.department).toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (state.filters.department) {
    projects = projects.filter(p => p.department.th === state.filters.department);
  }

  if (state.filters.category) {
    projects = projects.filter(p => p.category === state.filters.category);
  }

  if (state.filters.budget) {
    projects = projects.filter(p => {
      switch (state.filters.budget) {
        case 'under5m': return p.budget < 5000000;
        case '5to10': return p.budget >= 5000000 && p.budget <= 10000000;
        case '10to20': return p.budget >= 10000000 && p.budget <= 20000000;
        case 'above20m': return p.budget > 20000000;
        default: return true;
      }
    });
  }

  if (state.filters.deadline) {
    projects = projects.filter(p => {
      const d = daysUntil(p.deadline);
      switch (state.filters.deadline) {
        case 'within7': return d >= 0 && d <= 7;
        case 'within30': return d >= 0 && d <= 30;
        case 'moreThan30': return d > 30;
        default: return true;
      }
    });
  }

  return projects;
}

// Debounce rendering logic for search
let renderTimer;
function debounceRenderCards() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const projects = getFilteredProjects();
    const grid = document.querySelector('.projects-grid');
    const noResults = document.querySelector('.no-results');
    if (grid) {
      if (projects.length === 0) {
        grid.style.display = 'none';
        if (!noResults) {
          grid.insertAdjacentHTML('afterend', `
            <div class="no-results">
              ${ICONS.search}
              <h3>${L('noResults')}</h3>
              <p>${L('noResultsDesc')}</p>
            </div>
          `);
        }
      } else {
        grid.style.display = '';
        grid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
        if (noResults) noResults.remove();
      }
    }
  }, 180);
}
