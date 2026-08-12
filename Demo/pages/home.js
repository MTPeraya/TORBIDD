// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - HOME LANDING PAGE VIEW
// ==========================================================================

function renderHome() {
  const recentProjects = PROJECTS.slice(0, 2);

  return `
    <div class="page-content" id="home-page">
      <!-- Hero Portal Banner -->
      <div class="hero-section">
        <div class="hero-content">
          <span class="hero-badge">
            ${ICONS.shield}
            <span>${L('heroBadge')}</span>
          </span>
          <h1 class="hero-title">${L('heroTitle')}</h1>
          <p class="hero-subtitle">${L('heroSubtitle')}</p>
          <form class="hero-search-bar" id="heroSearchForm">
            <input type="text" id="heroSearchInput" placeholder="${L('searchPlaceholder')}">
            <button type="submit">${L('searchBtn')}</button>
          </form>
        </div>
      </div>

      <!-- Core Capabilities Segment -->
      <div class="page-header" style="margin-top: 10px; margin-bottom: 16px;">
        <h2 class="home-section-title">${L('exploreTitle')}</h2>
      </div>
      
      <div class="landing-grid">
        <div class="landing-card" onclick="navigate('dashboard')">
          <div class="landing-card-icon">
            ${ICONS.file}
          </div>
          <h3 class="landing-card-title">${L('cap1Title')}</h3>
          <p class="landing-card-desc">${L('cap1Desc')}</p>
          <a class="landing-card-link">${L('cap1Link')}</a>
        </div>
        <div class="landing-card" onclick="navigate('detail', 1)">
          <div class="landing-card-icon">
            ${ICONS.shield}
          </div>
          <h3 class="landing-card-title">${L('cap2Title')}</h3>
          <p class="landing-card-desc">${L('cap2Desc')}</p>
          <a class="landing-card-link">${L('cap2Link')}</a>
        </div>
        <div class="landing-card" onclick="navigate('historical')">
          <div class="landing-card-icon">
            ${ICONS.chart}
          </div>
          <h3 class="landing-card-title">${L('cap3Title')}</h3>
          <p class="landing-card-desc">${L('cap3Desc')}</p>
          <a class="landing-card-link">${L('cap3Link')}</a>
        </div>
      </div>

      <!-- Recent Tenders Segment -->
      <div class="home-section-header">
        <h2 class="home-section-title">${L('recentOpps')}</h2>
        <a class="home-section-link" onclick="navigate('dashboard')">${L('viewAll')} (${PROJECTS.length})</a>
      </div>

      <div class="recent-projects-list">
        ${recentProjects.map(p => renderProjectCard(p)).join('')}
      </div>

      <!-- Footer Disclaimer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--gray-200); text-align: center;">
        <span class="analysis-disclaimer" style="display:inline-block; max-width:800px;">
          ${state.language === 'th'
            ? 'ข้อมูลระบบนี้ได้มาจากการสกัดขอบเขตงานเอกสารราชการโดยใช้โมเดล AI กรุณาตรวจสอบเอกสาร TOR ต้นฉบับเพื่อความถูกต้องอย่างเป็นทางการ'
            : 'Disclaimer: System parameters are extracted from official documents using AI. Always cross-reference against the original TOR files for validation.'}
        </span>
      </div>
    </div>
  `;
}
