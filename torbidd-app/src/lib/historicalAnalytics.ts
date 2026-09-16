// =============================================================================
// lib/historicalAnalytics.ts - Pure Analytics & Statistical Engine
// =============================================================================

import { BilingualText, Department, Project, ProjectCategory } from '@/types/project';
import {
  AgencyComparisonMetrics,
  BudgetReasonablenessResult,
  CategoryBenchmarkStats,
  HistoricalProject,
  ReasonablenessClassification,
  ScopeCostEstimation,
  SimilarProcurementItem,
} from '@/types/historical';

// ─── 1. Statistical Calculations ─────────────────────────────────────────────

/**
 * Calculates statistical benchmark metrics (min, q1, median, mean, q3, max, stdDev, iqr)
 * for a specific category or the full historical dataset.
 */
export function calculateCategoryStats(
  category: ProjectCategory | 'All',
  data: HistoricalProject[],
): CategoryBenchmarkStats {
  const filtered = category === 'All' ? data : data.filter((d) => d.category === category);
  const budgets = filtered.map((d) => d.budget).sort((a, b) => a - b);
  const sampleCount = budgets.length;

  if (sampleCount === 0) {
    return {
      category,
      sampleCount: 0,
      min: 0,
      q1: 0,
      median: 0,
      mean: 0,
      q3: 0,
      max: 0,
      stdDev: 0,
      iqr: 0,
    };
  }

  const min = budgets[0];
  const max = budgets[sampleCount - 1];
  const sum = budgets.reduce((acc, b) => acc + b, 0);
  const mean = sum / sampleCount;

  // Helper for quantile calculation (linear interpolation)
  const getQuantile = (q: number): number => {
    const pos = (sampleCount - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (budgets[base + 1] !== undefined) {
      return budgets[base] + rest * (budgets[base + 1] - budgets[base]);
    }
    return budgets[base];
  };

  const q1 = getQuantile(0.25);
  const median = getQuantile(0.5);
  const q3 = getQuantile(0.75);
  const iqr = Math.max(0, q3 - q1);

  // Sample Standard Deviation
  const variance =
    sampleCount > 1
      ? budgets.reduce((acc, b) => acc + Math.pow(b - mean, 2), 0) / (sampleCount - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  return {
    category,
    sampleCount,
    min,
    q1,
    median,
    mean,
    q3,
    max,
    stdDev,
    iqr,
  };
}

// ─── 2. Announced Budget Reasonableness & Outlier Engine ───────────────────────

/**
 * Evaluates whether an announced or estimated budget is reasonable, a high outlier, or a low outlier
 * compared to historical government benchmarks in the same category.
 */
export function evaluateBudgetReasonableness(
  budget: number,
  category: ProjectCategory,
  data: HistoricalProject[],
): BudgetReasonablenessResult {
  const stats = calculateCategoryStats(category, data);

  if (stats.sampleCount === 0 || budget <= 0) {
    return {
      status: 'reasonable',
      budget,
      category,
      categoryStats: stats,
      ratioVsMedian: 1,
      ratioVsMean: 1,
      percentileRank: 50,
      zScore: 0,
      variancePercentage: 0,
      reasoning: {
        th: 'ไม่มีข้อมูลโครงการย้อนหลังเพียงพอสำหรับการประเมินค่าทางสถิติ',
        en: 'Insufficient historical procurement samples for statistical evaluation.',
      },
      recommendedBudgetRange: { min: budget * 0.8, max: budget * 1.2 },
    };
  }

  const ratioVsMedian = budget / stats.median;
  const ratioVsMean = budget / stats.mean;
  const variancePercentage = Math.round(((budget - stats.median) / stats.median) * 100);
  const zScore = stats.stdDev > 0 ? Number(((budget - stats.mean) / stats.stdDev).toFixed(2)) : 0;

  // Calculate Percentile Rank
  const categoryBudgets = data.filter((d) => d.category === category).map((d) => d.budget).sort((a, b) => a - b);
  const rankCount = categoryBudgets.filter((b) => b <= budget).length;
  const percentileRank = Math.round((rankCount / categoryBudgets.length) * 100);

  // Outlier determination rules:
  // 1. Ratio check: > 1.3x median is high outlier, < 0.7x median is low outlier
  // 2. Tukey IQR check: > Q3 + 1.5*IQR or < Q1 - 1.5*IQR
  let status: ReasonablenessClassification = 'reasonable';
  if (ratioVsMedian > 1.3 || (stats.iqr > 0 && budget > stats.q3 + 1.5 * stats.iqr)) {
    status = 'high_outlier';
  } else if (ratioVsMedian < 0.7 || (stats.iqr > 0 && budget < Math.max(0, stats.q1 - 1.5 * stats.iqr))) {
    status = 'low_outlier';
  }

  // Generate Analytical Reasoning
  let reasoningTh = '';
  let reasoningEn = '';

  if (status === 'high_outlier') {
    reasoningTh = `งบประมาณโครงการสูงกว่าค่ามัธยฐานในหมวดหมู่นี้ถึง ${Math.abs(variancePercentage)}% (Percentile ที่ ${percentileRank}) ถือเป็น High Outlier ที่มีมูลค่าสูงผิดปกติ อาจเกิดจากข้อกำหนดด้านสถาปัตยกรรมระบบขั้นสูง การเชื่อมโยงฐานข้อมูลข้ามหลายสำนัก หรือความต้องการฮาร์ดแวร์/คลาวด์ขนาดใหญ่ ควรตรวจสอบ TOR ว่ามีขอบเขตงานพิเศษที่ทำให้ต้นทุนสูงขึ้น`;
    reasoningEn = `The announced budget is ${Math.abs(variancePercentage)}% above the historical median for this category (${percentileRank}th percentile), classifying as a High Outlier. This premium typically reflects enterprise-grade multi-agency integrations, high-concurrency SLAs, or substantial cloud infrastructure allowances. Review the TOR for specialized technical scope drivers.`;
  } else if (status === 'low_outlier') {
    reasoningTh = `งบประมาณโครงการต่ำกว่าค่ามัธยฐานในหมวดหมู่นี้ถึง ${Math.abs(variancePercentage)}% (Percentile ที่ ${percentileRank}) ถือเป็น Low Outlier ซึ่งอาจมีความเสี่ยงต่องบประมาณไม่เพียงพอ (Under-budgeting) ผู้เสนอราคาควรพิจารณาความคุ้มค่าและต้นทุนทรัพยากรบุคลากรอย่างรัดกุมก่อนตัดสินใจยื่นข้อเสนอ`;
    reasoningEn = `The announced budget is ${Math.abs(variancePercentage)}% below the historical median for this category (${percentileRank}th percentile), classifying as a Low Outlier. This tight budget signals potential under-budgeting risk or a reduced-scope pilot. Bidders should strictly model personnel and delivery expenses prior to submission.`;
  } else {
    reasoningTh = `งบประมาณโครงการอยู่ในช่วงมาตรฐานที่สมเหตุสมผลตามสถิติจัดซื้อจัดจ้างภาครัฐ (ต่างจากค่ามัธยฐานเพียง ${Math.abs(variancePercentage)}%, Percentile ที่ ${percentileRank}) สอดคล้องกับงบประมาณเฉลี่ยของ กทม. เหมาะสมต่อการแข่งขันอย่างเป็นธรรม`;
    reasoningEn = `The announced budget aligns comfortably within historical benchmarks (variance of ${Math.abs(variancePercentage)}% vs median, ${percentileRank}th percentile). The pricing represents a balanced government software benchmark with sound competitive bidding feasibility.`;
  }

  return {
    status,
    budget,
    category,
    categoryStats: stats,
    ratioVsMedian,
    ratioVsMean,
    percentileRank,
    zScore,
    variancePercentage,
    reasoning: { th: reasoningTh, en: reasoningEn },
    recommendedBudgetRange: {
      min: Math.round(stats.q1),
      max: Math.round(stats.q3),
    },
  };
}

// ─── 3. Similarity Matching & Scope Pricing Estimator ─────────────────────────

/**
 * Tokenizes text into lowercase words for keyword similarity matching
 */
function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\u0E00-\u0E7F]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Finds similar historical software procurements based on:
 * - Category matching (35%)
 * - Title & scope keyword overlap (40%)
 * - Budget proximity (25%)
 */
export function findSimilarHistoricalProcurements(
  target: {
    title?: BilingualText | string;
    category?: ProjectCategory;
    budget?: number;
    description?: BilingualText | string;
  },
  data: HistoricalProject[],
  limit: number = 4,
): SimilarProcurementItem[] {
  const targetTitle = typeof target.title === 'string' ? target.title : (target.title?.th || '') + ' ' + (target.title?.en || '');
  const targetDesc = typeof target.description === 'string' ? target.description : (target.description?.th || '') + ' ' + (target.description?.en || '');
  const targetTokens = new Set([...extractTokens(targetTitle), ...extractTokens(targetDesc)]);

  const results: SimilarProcurementItem[] = data.map((item) => {
    // 1. Category Score (0 - 35)
    let categoryScore = 0;
    if (target.category && item.category === target.category) {
      categoryScore = 35;
    }

    // 2. Keyword Overlap (0 - 40)
    const itemText = `${item.title.th} ${item.title.en} ${item.description?.th || ''} ${item.description?.en || ''} ${(item.scope?.th || []).join(' ')} ${(item.scope?.en || []).join(' ')}`;
    const itemTokens = extractTokens(itemText);
    const matchedTokens = itemTokens.filter((t) => targetTokens.has(t));
    const uniqueMatched = Array.from(new Set(matchedTokens));

    const keywordScore = Math.min(40, uniqueMatched.length * 8);

    // 3. Budget Proximity (0 - 25)
    let budgetScore = 15; // default neutral
    let budgetRatio = 1;
    let budgetDifference = 0;
    if (target.budget && target.budget > 0) {
      budgetDifference = item.budget - target.budget;
      budgetRatio = item.budget / target.budget;
      const budgetDistance = Math.abs(item.budget - target.budget) / Math.max(item.budget, target.budget);
      budgetScore = Math.max(0, Math.round((1 - budgetDistance) * 25));
    }

    const similarityScore = Math.min(99, Math.max(20, categoryScore + keywordScore + budgetScore));

    return {
      project: item,
      similarityScore,
      matchedKeywords: uniqueMatched.slice(0, 5),
      budgetDifference,
      budgetRatio,
    };
  });

  return results.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, limit);
}

/**
 * Estimates scope cost and work package breakdown based on similar historical projects
 */
export function estimateScopePrice(
  similarItems: SimilarProcurementItem[],
  fallbackBudget?: number,
): ScopeCostEstimation {
  const budgets = similarItems.map((s) => s.project.budget).sort((a, b) => a - b);
  const count = budgets.length;

  let min = fallbackBudget ? fallbackBudget * 0.8 : 5_000_000;
  let median = fallbackBudget || 12_000_000;
  let max = fallbackBudget ? fallbackBudget * 1.3 : 25_000_000;

  if (count > 0) {
    min = budgets[0];
    max = budgets[count - 1];
    median = count % 2 === 1 ? budgets[Math.floor(count / 2)] : (budgets[count / 2 - 1] + budgets[count / 2]) / 2;
  }

  // Reference government software work packages allocation
  const workPackages = [
    {
      name: {
        th: 'สถาปัตยกรรมระบบ ออกแบบ UI/UX และวิเคราะห์ความต้องการ',
        en: 'System Architecture, UI/UX Design & Requirements',
      },
      percentage: 15,
      estimatedAmount: Math.round(median * 0.15),
    },
    {
      name: {
        th: 'พัฒนาซอฟต์แวร์หลัก และเชื่อมต่อระบบฐานข้อมูล (Core Dev & API)',
        en: 'Core Development, Database & API Integration',
      },
      percentage: 45,
      estimatedAmount: Math.round(median * 0.45),
    },
    {
      name: {
        th: 'การทดสอบระบบ ความปลอดภัย และตรวจรับงาน (QA & Security Audit)',
        en: 'Quality Assurance, Security Audit & Acceptance Testing',
      },
      percentage: 20,
      estimatedAmount: Math.round(median * 0.20),
    },
    {
      name: {
        th: 'ติดตั้งระบบบน Cloud, ถ่ายทอดองค์ความรู้ และอบรมผู้ใช้งาน',
        en: 'Cloud Deployment, Training & Knowledge Transfer',
      },
      percentage: 20,
      estimatedAmount: Math.round(median * 0.20),
    },
  ];

  return {
    estimatedTotalMin: min,
    estimatedTotalMedian: median,
    estimatedTotalMax: max,
    similarProjectsCount: count,
    workPackages,
  };
}

// ─── 4. Cross-Agency Aggregation Engine ────────────────────────────────────────

/**
 * Aggregates historical and current projects by BMA agency/department to provide
 * comparative metrics on total software spend, volume, and technology focus.
 */
export function aggregateAgencyMetrics(
  historicalData: HistoricalProject[],
  activeProjects: Project[] = [],
): AgencyComparisonMetrics[] {
  type DeptAggregate = {
    department: Department;
    budgets: number[];
    categories: Record<string, number>;
    projects: { title: BilingualText; budget: number; year: number }[];
  };

  const agencyMap = new Map<string, DeptAggregate>();

  // Helper to ingest an item
  const ingest = (
    dept: Department,
    budget: number,
    category: ProjectCategory,
    title: BilingualText,
    year: number,
  ) => {
    const key = dept.th || dept.en;
    if (!agencyMap.has(key)) {
      agencyMap.set(key, {
        department: dept,
        budgets: [],
        categories: { Website: 0, 'Mobile App': 0, AI: 0, Database: 0 },
        projects: [],
      });
    }

    const entry = agencyMap.get(key)!;
    entry.budgets.push(budget);
    entry.categories[category] = (entry.categories[category] || 0) + 1;
    entry.projects.push({ title, budget, year });
  };

  // Ingest historical
  historicalData.forEach((h) => {
    ingest(h.department, h.budget, h.category, h.title, h.year);
  });

  // Ingest active projects (converting publish date to year)
  activeProjects.forEach((p) => {
    const year = new Date(p.publishDate).getFullYear() || 2026;
    ingest(p.department, p.budget, p.category, p.title, year);
  });

  // Calculate metrics per agency
  const metrics: AgencyComparisonMetrics[] = [];

  agencyMap.forEach((entry, deptKey) => {
    const budgets = entry.budgets.sort((a, b) => a - b);
    const count = budgets.length;
    const totalBudget = budgets.reduce((sum, b) => sum + b, 0);
    const avgBudget = count > 0 ? Math.round(totalBudget / count) : 0;
    const medianBudget =
      count > 0
        ? count % 2 === 1
          ? budgets[Math.floor(count / 2)]
          : Math.round((budgets[count / 2 - 1] + budgets[count / 2]) / 2)
        : 0;
    const minBudget = budgets[0] || 0;
    const maxBudget = budgets[count - 1] || 0;

    // Find primary category
    let primaryCategory: ProjectCategory = 'Website';
    let maxCatCount = -1;
    (Object.keys(entry.categories) as ProjectCategory[]).forEach((cat) => {
      if (entry.categories[cat] > maxCatCount) {
        maxCatCount = entry.categories[cat];
        primaryCategory = cat;
      }
    });

    // Top project
    const topProject = entry.projects.reduce(
      (prev, curr) => (curr.budget > prev.budget ? curr : prev),
      entry.projects[0] || { title: { th: '', en: '' }, budget: 0, year: 2025 },
    );

    metrics.push({
      departmentKey: deptKey,
      department: entry.department,
      totalBudget,
      projectCount: count,
      avgBudget,
      medianBudget,
      maxBudget,
      minBudget,
      categories: entry.categories,
      primaryCategory,
      topProject,
    });
  });

  return metrics.sort((a, b) => b.totalBudget - a.totalBudget);
}
