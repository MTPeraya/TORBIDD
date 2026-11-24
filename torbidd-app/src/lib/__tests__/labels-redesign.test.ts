import { LABELS } from '../labels';

describe('Redesign Labels Dictionary', () => {
  const requiredKeys = [
    'liveShowcaseTitle',
    'liveShowcaseSubtitle',
    'tabFilterAll',
    'tabFilterClosingSoon',
    'tabFilterHighValue',
    'tabFilterAiData',
    'viewAllOpportunitiesBtn',
    'workflowTitle',
    'workflowSubtitle',
    'workflowStep1Title',
    'workflowStep1Desc',
    'workflowStep2Title',
    'workflowStep2Desc',
    'workflowStep3Title',
    'workflowStep3Desc',
    'histLastUpdatedBadge',
    'histGuidanceReasonable',
    'histGuidanceHigh',
    'histGuidanceLow',
    'kpiPillTotalSpend',
    'kpiPillMeanBenchmark',
    'kpiPillMaxAward',
    'kpiPillCorridor',
  ];

  it('contains all required keys in both TH and EN', () => {
    requiredKeys.forEach((key) => {
      expect((LABELS.th as Record<string, string>)[key]).toBeDefined();
      expect((LABELS.en as Record<string, string>)[key]).toBeDefined();
      expect((LABELS.th as Record<string, string>)[key].length).toBeGreaterThan(0);
      expect((LABELS.en as Record<string, string>)[key].length).toBeGreaterThan(0);
    });
  });
});
