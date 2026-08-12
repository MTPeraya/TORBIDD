// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - PROJECT DETAIL VIEW
// ==========================================================================

function renderDetail() {
  const project = PROJECTS.find(p => p.id === state.selectedProjectId);
  if (!project) return '<div class="page-content"><p>Project not found</p></div>';

  const isBookmarked = state.bookmarks.has(project.id);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[state.language][project.category];
  const closing = isClosingSoon(project.deadline);
  const isNewItem = isNew(project.publishDate);
  const days = daysUntil(project.deadline);
  const budgetStatus = getBudgetStatus(project.budget, project.historicalAvg);
  
  // Budget bar scaling calculation
  const maxVal = Math.max(project.budget, project.historicalAvg);
  const budgetPct = Math.round((project.budget / maxVal) * 100);
  const avgPct = Math.round((project.historicalAvg / maxVal) * 100);

  const statusLabel = budgetStatus === 'above' ? L('aboveAvg') : budgetStatus === 'below' ? L('belowAvg') : L('withinRange');
  const statusIcon = budgetStatus === 'above' ? ICONS.trendUp : budgetStatus === 'below' ? ICONS.trendDown : ICONS.check;

  // Qualifications list and checklist logic
  const quals = getLocalizedText(project.qualifications);
  const checkedIndices = state.eligibilityChecks[project.id] || [];
  const checkedCount = checkedIndices.length;
  const totalCount = quals.length;
  const matchPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  
  let matchStatusText = '';
  let matchStatusClass = '';
  if (matchPct === 100) {
    matchStatusText = state.language === 'th' ? 'ผ่านเกณฑ์ (Go)' : 'Eligible (Go)';
    matchStatusClass = 'green';
  } else if (matchPct >= 60) {
    matchStatusText = state.language === 'th' ? 'ต้องพิจารณาเพิ่มเติม (Review)' : 'Needs Review';
    matchStatusClass = 'amber';
  } else {
    matchStatusText = state.language === 'th' ? 'คุณสมบัติไม่ครบ (No-Go)' : 'Ineligible (No-Go)';
    matchStatusClass = 'red';
  }

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
    <div class="page-content">
      <button class="detail-back-btn" onclick="navigate('dashboard')">
        ${ICONS.arrowLeft}
        ${L('backToList')}
      </button>

      <div class="detail-grid">
        <div class="detail-main">
          <!-- Hero Card -->
          <div class="detail-card detail-hero">
            <div class="detail-hero-tags">
              <span class="tag software">${L('softwareProject')}</span>
              <span class="tag category ${catClass}">${catLabel}</span>
              <span class="${statusTagClass}">${statusText}</span>
            </div>
            <h1 class="detail-hero-title">${getLocalizedText(project.title)}</h1>
            <div class="detail-hero-dept">
              ${ICONS.building}
              ${getLocalizedText(project.department)}
            </div>
            <div class="detail-meta-grid">
              <div class="detail-meta-item">
                <div class="meta-label">${L('budget')}</div>
                <div class="meta-value budget" style="font-weight: 700">${formatBudgetFull(project.budget)}</div>
                <span class="ai-extract-label">Extracted from TOR document</span>
              </div>
              <div class="detail-meta-item">
                <div class="meta-label">${L('procurementType')}</div>
                <div class="meta-value" style="font-weight: 700">${project.procurementType}</div>
                <span class="ai-extract-label">AI extracted</span>
              </div>
              <div class="detail-meta-item">
                <div class="meta-label">${L('publishDate')}</div>
                <div class="meta-value" style="font-weight: 700">${formatDate(project.publishDate)}</div>
                <span class="ai-extract-label">AI extracted</span>
              </div>
              <div class="detail-meta-item">
                <div class="meta-label">${L('deadline')}</div>
                <div class="meta-value ${closing ? 'deadline-soon' : ''}" style="font-weight: 700">${formatDate(project.deadline)}</div>
                <span class="ai-extract-label">AI extracted</span>
              </div>
            </div>
            <div class="detail-hero-actions">
              <button class="btn btn-primary" onclick="alert('${state.language === 'th' ? 'ลิงก์ไปยังเอกสาร TOR กทม. (ต้นฉบับ)' : 'Redirecting to original BMA TOR document (mockup link)'}')">
                ${ICONS.externalLink}
                ${L('downloadTOR')}
              </button>
              <button class="btn btn-bookmark ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark(${project.id})">
                ${isBookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
                <span>${isBookmarked ? L('saved') : L('saveBookmark')}</span>
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="detail-card">
            <h2 class="detail-card-title">
              ${ICONS.file}
              <span>${L('projectDesc')}</span>
            </h2>
            <p class="description-text">${getLocalizedText(project.description)}</p>
          </div>

          <!-- Scope of Work -->
          <div class="detail-card">
            <h2 class="detail-card-title">
              ${ICONS.target}
              <span>${L('scopeOfWork')}</span>
            </h2>
            <ul class="scope-list">
              ${getLocalizedText(project.scope).map(item => `
                <li class="scope-item">
                  <span class="scope-bullet">●</span>
                  <span>${item}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Qualifications (Interactive Bidder Eligibility Checklist) -->
          <div class="detail-card qualifications-card">
            <div class="qualifications-badge">
              ${ICONS.shield}
              <span>${L('bidderQualifications')}</span>
            </div>
            <p style="font-size: 13px; color: var(--gray-700); margin-bottom: 16px; font-weight: 500;">
              ${state.language === 'th' 
                ? '💡 เครื่องมือตรวจสอบคุณสมบัติของผู้เสนอราคา: ทำเครื่องหมายคุณสมบัติที่บริษัทของคุณมี เพื่อประเมินความพร้อมเสนอราคา' 
                : '💡 Bidder Eligibility Checklist: Check the qualifications your organization matches to evaluate proposal compatibility.'}
            </p>

            <div class="eligibility-checklist">
              ${quals.map((q, idx) => {
                const isChecked = checkedIndices.includes(idx);
                return `
                  <div class="checklist-item ${isChecked ? 'checked' : ''}" onclick="toggleEligibilityCheck(${project.id}, ${idx})">
                    <div class="checklist-checkbox">
                      ${ICONS.check}
                    </div>
                    <div class="checklist-text">${q}</div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Gauge Panel -->
            <div class="gauge-wrapper">
              <div class="gauge-header-text">
                ${state.language === 'th' ? 'สรุปอัตราความสอดคล้องทางธุรกิจ (Go / No-Go)' : 'Go / No-Go Eligibility Analysis'}
              </div>
              <div class="gauge-container">
                <div class="gauge-fill ${matchPct === 100 ? 'high' : matchPct >= 60 ? 'mid' : ''}" style="width: ${matchPct}%"></div>
              </div>
              <div class="gauge-status-row">
                <div class="gauge-score">${matchPct}%</div>
                <div class="gauge-badge ${matchStatusClass}">${matchStatusText}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="detail-sidebar-col">
          <!-- Budget Comparison -->
          <div class="detail-card budget-comparison">
            <h2 class="detail-card-title">
              ${ICONS.chart}
              <span>${L('budgetComparison')}</span>
            </h2>
            <div class="budget-comparison-indicator ${budgetStatus}">
              ${statusIcon}
              <span>${statusLabel}</span>
            </div>
            <div class="budget-bar-chart">
              <div class="budget-bar-row">
                <div class="budget-bar-label">${L('currentProject')}</div>
                <div class="budget-bar-track">
                  <div class="budget-bar-fill current" style="width:${budgetPct}%">${formatBudget(project.budget)}</div>
                </div>
              </div>
              <div class="budget-bar-row">
                <div class="budget-bar-label">${L('historicalAvg')}</div>
                <div class="budget-bar-track">
                  <div class="budget-bar-fill avg" style="width:${avgPct}%">${formatBudget(project.historicalAvg)}</div>
                </div>
              </div>
            </div>
            
            <!-- Analysis Disclaimer -->
            <span class="analysis-disclaimer">
              ${state.language === 'th'
                ? 'การวิเคราะห์เปรียบเทียบงบประมาณย้อนหลังจัดทำขึ้นเพื่อให้ข้อมูลเบื้องต้นเท่านั้น ไม่ใช่การประเมินราคาอย่างเป็นทางการจากหน่วยงาน กทม.'
                : 'Historical comparisons are indicative and should not be interpreted as an official assessment of procurement fairness, pricing, or value.'}
            </span>
            
            <div style="margin-top:16px; text-align:center">
              <button class="btn btn-secondary" onclick="navigate('historical')" style="width:100%; justify-content: center;">
                ${ICONS.chart}
                <span>${state.language === 'th' ? 'ดูข้อมูลเปรียบเทียบราคา' : 'View Price Comparisons'}</span>
              </button>
            </div>
          </div>

          <!-- Quick Info -->
          <div class="detail-card">
            <h2 class="detail-card-title">
              ${ICONS.info}
              <span>${state.language === 'th' ? 'แหล่งที่มา & ความโปร่งใส' : 'Source & Transparency'}</span>
            </h2>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-200);">
                <span style="font-size:12px;color:var(--gray-500)">Source Document</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--gray-900)">${project.sourceDocument || 'BMA TOR PDF'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-200);">
                <span style="font-size:12px;color:var(--gray-500)">Last Extracted</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--gray-900)">${project.processedDate || '2026-08-11'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-200);">
                <span style="font-size:12px;color:var(--gray-500)">Extraction Status</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--success)">✓ Verified</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;">
                <span style="font-size:12px;color:var(--gray-500)">AI Confidence</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--primary-700)">High</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function toggleEligibilityCheck(projectId, index) {
  if (!state.eligibilityChecks[projectId]) {
    state.eligibilityChecks[projectId] = [];
  }
  const checks = state.eligibilityChecks[projectId];
  const idx = checks.indexOf(index);
  if (idx > -1) {
    checks.splice(idx, 1);
  } else {
    checks.push(index);
  }
  render();
}
