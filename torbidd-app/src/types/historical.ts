// =============================================================================
// Types: Historical Project
// =============================================================================

import { BilingualText, Department, ProjectCategory } from './project';

export interface HistoricalProject {
  _id?: string;
  title: BilingualText;
  department: Department;
  year: number;
  category: ProjectCategory;
  budget: number;
  description?: BilingualText;
  scope?: { th: string[]; en: string[] };
  procurementType?: string;
  awardedVendor?: BilingualText;
  createdAt?: string;
}

export interface HistoricalFilters {
  category?: ProjectCategory;
  department?: string;
  year?: number;
  search?: string;
}

export interface CategoryBenchmarkStats {
  category: ProjectCategory | 'All';
  sampleCount: number;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
  stdDev: number;
  iqr: number;
}

export type ReasonablenessClassification = 'reasonable' | 'high_outlier' | 'low_outlier';

export interface BudgetReasonablenessResult {
  status: ReasonablenessClassification;
  budget: number;
  category: ProjectCategory;
  categoryStats: CategoryBenchmarkStats;
  ratioVsMedian: number;
  ratioVsMean: number;
  percentileRank: number;
  zScore: number;
  variancePercentage: number;
  reasoning: BilingualText;
  recommendedBudgetRange: {
    min: number;
    max: number;
  };
}

export interface AgencyComparisonMetrics {
  departmentKey: string;
  department: Department;
  totalBudget: number;
  projectCount: number;
  avgBudget: number;
  medianBudget: number;
  maxBudget: number;
  minBudget: number;
  categories: Record<string, number>;
  primaryCategory: ProjectCategory;
  topProject: {
    title: BilingualText;
    budget: number;
    year: number;
  };
}

export interface SimilarProcurementItem {
  project: HistoricalProject;
  similarityScore: number; // 0 - 100%
  matchedKeywords: string[];
  budgetDifference: number;
  budgetRatio: number;
}

export interface ScopeCostEstimation {
  estimatedTotalMin: number;
  estimatedTotalMedian: number;
  estimatedTotalMax: number;
  similarProjectsCount: number;
  workPackages: {
    name: BilingualText;
    percentage: number;
    estimatedAmount: number;
  }[];
}

