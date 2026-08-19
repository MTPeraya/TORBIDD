// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - HOME LANDING PAGE VIEW
// ==========================================================================

function renderHome() {
  const recentProjects = PROJECTS.slice(0, 4);
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budget, 0);
  const closingCount = PROJECTS.filter(p => isClosingSoon(p.deadline)).length;

  return `
    <div class="home-page" id="home-page">
      <!-- Main Master Hero Area (Floating on Gradient Background) -->
      <div class="home-hero-wrapper">
        <div class="hero-section">
          <div class="hero-orbs">
            <div class="hero-orb hero-orb-1"></div>
            <div class="hero-orb hero-orb-2"></div>
            <div class="hero-orb hero-orb-3"></div>
          </div>
          <div class="hero-content anim-fade-up">
            <div class="hero-brand-name">TORBIDD</div>
            <div>
              <span class="hero-badge">
                <span class="hero-badge-dot"></span>
                <span>${L('heroBadge')}</span>
              </span>
            </div>
            <h1 class="hero-title">${L('heroTitle')}</h1>
            <p class="hero-subtitle">${L('heroSubtitle')}</p>
            <form class="hero-search-bar" id="heroSearchForm">
              ${ICONS.search}
              <input type="text" id="heroSearchInput" placeholder="${L('searchPlaceholder')}">
              <button type="submit">${L('searchBtn')}</button>
            </form>
          </div>

          <!-- Floating Stats Chips -->
          <div class="hero-stats-row anim-fade-up anim-delay-1">
            <div class="hero-stat-chip" onclick="navigate('dashboard')">
              <span class="hero-stat-num">${PROJECTS.length}</span>
              <span class="hero-stat-label">${state.language === 'th' ? 'โอกาสที่เปิดรับ' : 'Active Opportunities'}</span>
            </div>
            <div class="hero-stat-chip" onclick="navigate('historical')">
              <span class="hero-stat-num">฿${(totalBudget / 1000000).toFixed(0)}M</span>
              <span class="hero-stat-label">${state.language === 'th' ? 'มูลค่ารวม' : 'Total Value'}</span>
            </div>
            <div class="hero-stat-chip accent" onclick="navigate('dashboard')">
              <span class="hero-stat-num">${closingCount}</span>
              <span class="hero-stat-label">${state.language === 'th' ? 'ใกล้ปิดรับ 7 วัน' : 'Closing in 7 days'}</span>
            </div>
          </div>

          <!-- Core Capabilities -->
          <div class="section-header hero-inner-divider anim-fade-up anim-delay-2">
            <div class="section-header-line"></div>
            <h2 class="section-header-title">${L('exploreTitle')}</h2>
            <div class="section-header-line"></div>
          </div>

          <div class="landing-grid anim-fade-up anim-delay-2">
            <div class="landing-card" onclick="navigate('dashboard')">
              <div class="landing-card-number">01</div>
              <div class="landing-card-icon">
                ${ICONS.file}
              </div>
              <h3 class="landing-card-title">${L('cap1Title')}</h3>
              <p class="landing-card-desc">${L('cap1Desc')}</p>
              <a class="landing-card-link">${L('cap1Link')}</a>
            </div>
            <div class="landing-card" onclick="navigate('detail', 1)">
              <div class="landing-card-number">02</div>
              <div class="landing-card-icon">
                ${ICONS.shield}
              </div>
              <h3 class="landing-card-title">${L('cap2Title')}</h3>
              <p class="landing-card-desc">${L('cap2Desc')}</p>
              <a class="landing-card-link">${L('cap2Link')}</a>
            </div>
            <div class="landing-card" onclick="navigate('historical')">
              <div class="landing-card-number">03</div>
              <div class="landing-card-icon">
                ${ICONS.chart}
              </div>
              <h3 class="landing-card-title">${L('cap3Title')}</h3>
              <p class="landing-card-desc">${L('cap3Desc')}</p>
              <a class="landing-card-link">${L('cap3Link')}</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Tenders Section (White Background) -->
      <div class="home-bottom-section">
        <div class="home-bottom-content">
          <div class="home-section-header anim-fade-up anim-delay-3">
            <h2 class="home-section-title">${L('recentOpps')}</h2>
            <a class="home-section-link" onclick="navigate('dashboard')">
              ${L('viewAll')} (${PROJECTS.length}) →
            </a>
          </div>

          <div class="recent-projects-list anim-fade-up anim-delay-3">
            ${recentProjects.map(p => renderProjectCard(p)).join('')}
          </div>

          <!-- Footer -->
          <div class="home-footer anim-fade-up anim-delay-3">
            <span class="analysis-disclaimer">
              ${state.language === 'th'
                ? 'ข้อมูลระบบนี้ได้มาจากการสกัดขอบเขตงานเอกสารราชการโดยใช้โมเดล AI กรุณาตรวจสอบเอกสาร TOR ต้นฉบับเพื่อความถูกต้องอย่างเป็นทางการ'
                : 'Disclaimer: System parameters are extracted from official documents using AI. Always cross-reference against the original TOR files for validation.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}
