// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - HISTORICAL PRICE ANALYSIS VIEW
// ==========================================================================

function renderHistorical() {
  const historicalData = getFilteredHistorical();
  const depts = [...new Set(HISTORICAL_DATA.map(d => d.department.th))];
  const years = [...new Set(HISTORICAL_DATA.map(d => d.year))].sort((a, b) => b - a);

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">${L('historicalTitle')}</h1>
        <p class="page-subtitle">${L('historicalSub')}</p>
      </div>

      <!-- Budget Comparison Chart -->
      <div class="chart-container">
        <div class="chart-header">
          <h2 class="chart-title">${L('budgetChart')}</h2>
          <div class="chart-filters">
            <select class="filter-select" id="histFilterCategory">
              <option value="">${L('allCategories')}</option>
              ${CATEGORIES.map(c => `<option value="${c}" ${state.historicalFilters.category === c ? 'selected' : ''}>${CATEGORY_LABELS[state.language][c]}</option>`).join('')}
            </select>
            <select class="filter-select" id="histFilterDept">
              <option value="">${L('allDepts')}</option>
              ${depts.map(d => `<option value="${d}" ${state.historicalFilters.department === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <select class="filter-select" id="histFilterYear">
              <option value="">${L('allYears')}</option>
              ${years.map(y => `<option value="${y}" ${state.historicalFilters.year == y ? 'selected' : ''}>${y + (state.language === 'th' ? 543 : 0)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="position:relative; height:300px; width:100%;">
          <canvas id="budgetChart"></canvas>
        </div>
      </div>

      <!-- Current Projects vs Historical Average -->
      <div class="chart-container">
        <h2 class="chart-title" style="margin-bottom:16px; border-bottom:1px solid var(--gray-200); padding-bottom:8px">
          ${state.language === 'th' ? 'โครงการปัจจุบันเปรียบเทียบราคากลางเฉลี่ย' : 'Current Projects vs Historical Average'}
        </h2>
        <div style="position:relative; height:280px; width:100%;">
          <canvas id="comparisonChart"></canvas>
        </div>
      </div>

      <!-- Historical Data Table -->
      <div class="chart-container">
        <h2 class="chart-title" style="margin-bottom:16px; border-bottom:1px solid var(--gray-200); padding-bottom:8px">
          ${state.language === 'th' ? 'ตารางข้อมูลย้อนหลัง' : 'Historical Data'}
        </h2>
        <div class="historical-table-wrapper">
          <table class="historical-table">
            <thead>
              <tr>
                <th>${L('projectName')}</th>
                <th>${L('department')}</th>
                <th>${L('category')}</th>
                <th>${L('year')}</th>
                <th>${L('budget')}</th>
                <th>${L('budgetAnalysis')}</th>
              </tr>
            </thead>
            <tbody>
              ${historicalData.map(d => {
                const catAvg = getCategoryAvg(d.category);
                const ratio = d.budget / catAvg;
                let outlierClass = 'normal';
                let outlierText = state.language === 'th' ? 'ปกติ' : 'Normal';
                if (ratio > 1.3) { outlierClass = 'high'; outlierText = state.language === 'th' ? 'สูงกว่าค่าเฉลี่ย' : 'Above Avg'; }
                if (ratio < 0.7) { outlierClass = 'low'; outlierText = state.language === 'th' ? 'ต่ำกว่าค่าเฉลี่ย' : 'Below Avg'; }
                return `
                  <tr>
                    <td style="font-weight:600; color:var(--gray-950)">${getLocalizedText(d.title)}</td>
                    <td>${getLocalizedText(d.department)}</td>
                    <td><span class="tag category">${CATEGORY_LABELS[state.language][d.category]}</span></td>
                    <td>${d.year + (state.language === 'th' ? 543 : 0)}</td>
                    <td style="font-weight:700; color:var(--gray-950)">${formatBudget(d.budget)}</td>
                    <td><span class="outlier-badge ${outlierClass}">${outlierText}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Global Disclaimer -->
        <span class="analysis-disclaimer" style="margin-top: 14px">
          ${state.language === 'th'
            ? 'การวิเคราะห์เปรียบเทียบงบประมาณย้อนหลังจัดทำขึ้นเพื่อให้ข้อมูลเบื้องต้นเท่านั้น ไม่ใช่การประเมินราคาอย่างเป็นทางการจากหน่วยงาน กทม.'
            : 'Historical comparisons are indicative and should not be interpreted as an official assessment of procurement fairness, pricing, or value.'}
        </span>
      </div>
    </div>
  `;
}

function getFilteredHistorical() {
  let data = [...HISTORICAL_DATA];
  if (state.historicalFilters.category) {
    data = data.filter(d => d.category === state.historicalFilters.category);
  }
  if (state.historicalFilters.department) {
    data = data.filter(d => d.department.th === state.historicalFilters.department);
  }
  if (state.historicalFilters.year) {
    data = data.filter(d => d.year === parseInt(state.historicalFilters.year));
  }
  return data;
}

function getCategoryAvg(category) {
  const items = HISTORICAL_DATA.filter(d => d.category === category);
  if (items.length === 0) return 0;
  return items.reduce((s, d) => s + d.budget, 0) / items.length;
}

function renderCharts() {
  if (state.charts.budget) {
    state.charts.budget.destroy();
    state.charts.budget = null;
  }
  if (state.charts.comparison) {
    state.charts.comparison.destroy();
    state.charts.comparison = null;
  }

  const historicalData = getFilteredHistorical();
  const isDark = state.theme === 'dark';

  // Chart 1: Historical budgets bar chart (TORBIDD color theme)
  const ctx1 = document.getElementById('budgetChart');
  if (ctx1) {
    state.charts.budget = new Chart(ctx1.getContext('2d'), {
      type: 'bar',
      data: {
        labels: historicalData.map(d => {
          const text = getLocalizedText(d.title);
          return text.length > 20 ? text.substring(0, 20) + '...' : text;
        }),
        datasets: [{
          label: state.language === 'th' ? 'งบประมาณ (ล้านบาท)' : 'Budget (M THB)',
          data: historicalData.map(d => d.budget / 1000000),
          backgroundColor: historicalData.map(d => {
            const avg = getCategoryAvg(d.category);
            const ratio = d.budget / avg;
            if (ratio > 1.3) return isDark ? 'rgba(248, 113, 113, 0.8)' : 'rgba(196, 69, 69, 0.8)'; // Red
            if (ratio < 0.7) return isDark ? 'rgba(75, 156, 203, 0.5)' : 'rgba(39, 115, 165, 0.5)'; // Accent Tint
            return isDark ? 'rgba(75, 156, 203, 0.8)' : 'rgba(39, 115, 165, 0.8)'; // Brand primary Blue
          }),
          borderColor: historicalData.map(d => {
            const avg = getCategoryAvg(d.category);
            const ratio = d.budget / avg;
            if (ratio > 1.3) return isDark ? 'rgb(248, 113, 113)' : 'rgb(196, 69, 69)';
            if (ratio < 0.7) return isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)';
            return isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)';
          }),
          borderWidth: 1.5,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(2)} M THB`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: state.language === 'th' ? 'ล้านบาท (M THB)' : 'Budget (M THB)',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d'
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 20,
              color: isDark ? '#94a3b8' : '#71808c'
            }
          }
        }
      }
    });
  }

  // Chart 2: Current vs historical average comparison chart
  const ctx2 = document.getElementById('comparisonChart');
  if (ctx2) {
    state.charts.comparison = new Chart(ctx2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: PROJECTS.map(p => {
          const text = getLocalizedText(p.title);
          return text.length > 20 ? text.substring(0, 20) + '...' : text;
        }),
        datasets: [
          {
            label: state.language === 'th' ? 'งบประมาณโครงการ' : 'Project Budget',
            data: PROJECTS.map(p => p.budget / 1000000),
            backgroundColor: isDark ? 'rgba(75, 156, 203, 0.85)' : 'rgba(39, 115, 165, 0.85)',
            borderColor: isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)',
            borderWidth: 1.5,
            borderRadius: 3,
          },
          {
            label: state.language === 'th' ? 'ค่าเฉลี่ยประเภทโครงการย้อนหลัง' : 'Historical Average',
            data: PROJECTS.map(p => p.historicalAvg / 1000000),
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(113, 128, 140, 0.6)',
            borderColor: isDark ? 'rgb(148, 163, 184)' : 'rgb(113, 128, 140)',
            borderWidth: 1.5,
            borderRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Noto Sans Thai, sans-serif', size: 12, weight: 'bold' },
              usePointStyle: true,
              pointStyle: 'rectRounded',
              color: isDark ? '#cbd5e1' : '#4b5965'
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} M THB`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: state.language === 'th' ? 'ล้านบาท (M THB)' : 'M THB',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d'
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 20,
              color: isDark ? '#94a3b8' : '#71808c'
            }
          }
        }
      }
    });
  }
}
