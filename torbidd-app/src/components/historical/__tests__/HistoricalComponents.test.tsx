import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BudgetReasonablenessChecker } from '../BudgetReasonablenessChecker';
import { SimilarProcurementEstimator } from '../SimilarProcurementEstimator';
import { AgencyComparisonView } from '../AgencyComparisonView';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { INITIAL_HISTORICAL, INITIAL_PROJECTS } from '@/lib/initialData';
import { aggregateAgencyMetrics } from '@/lib/historicalAnalytics';

// Mock Chart.js
jest.mock('chart.js/auto', () => {
  return jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
  }));
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Array(4) })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => []),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <LanguageProvider>{ui}</LanguageProvider>
    </ThemeProvider>,
  );
};

describe('Historical Price Dashboard Components', () => {
  describe('BudgetReasonablenessChecker (User Story 1)', () => {
    it('renders and evaluates announced project budget reasonableness', () => {
      renderWithProviders(
        <BudgetReasonablenessChecker
          projects={INITIAL_PROJECTS}
          historicalData={INITIAL_HISTORICAL}
        />,
      );

      // Check title exists
      expect(screen.getByText(/Outlier & Reasonableness Checker/i)).toBeInTheDocument();
      // Check project name is displayed
      expect(screen.getByText(INITIAL_PROJECTS[0].title.th)).toBeInTheDocument();

      // Switch to custom input mode
      const customTabBtn = screen.getByText(/กรอกงบประมาณเอง/i);
      fireEvent.click(customTabBtn);

      // Verify custom inputs appear
      const customBudgetInput = screen.getByLabelText(/งบประมาณที่ต้องการประเมิน/i);
      expect(customBudgetInput).toBeInTheDocument();

      // Change custom budget to high outlier
      fireEvent.change(customBudgetInput, { target: { value: '80000000' } });
      expect(screen.getAllByText(/High Outlier/i).length).toBeGreaterThan(0);
    });
  });

  describe('SimilarProcurementEstimator (User Story 2)', () => {
    it('renders similar procurements and opens scope inspector modal', () => {
      renderWithProviders(
        <SimilarProcurementEstimator
          projects={INITIAL_PROJECTS}
          historicalData={INITIAL_HISTORICAL}
        />,
      );

      // Check title
      expect(screen.getByText(/ค้นหาโครงการย้อนหลังที่คล้ายคลึง/i)).toBeInTheDocument();

      // Check expected pricing box is rendered
      expect(screen.getByText(/ประมาณการช่วงราคาและต้นทุนตามโครงสร้างงาน/i)).toBeInTheDocument();

      // Inspect first similar project modal
      const inspectButtons = screen.getAllByText(/ดูรายละเอียดโครงการย้อนหลังฉบับเต็ม/i);
      fireEvent.click(inspectButtons[0]);

      // Verify modal opened with close button
      expect(screen.getByText('✕')).toBeInTheDocument();
      expect(screen.getByText(/ปิดหน้าต่าง/i)).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByText('✕'));
      expect(screen.queryByText(/ปิดหน้าต่าง/i)).not.toBeInTheDocument();
    });
  });

  describe('AgencyComparisonView (User Story 3)', () => {
    it('renders agency comparison charts, comparator, and table', () => {
      const metrics = aggregateAgencyMetrics(INITIAL_HISTORICAL, INITIAL_PROJECTS);
      renderWithProviders(<AgencyComparisonView agencyMetrics={metrics} />);

      // Check title
      expect(screen.getByText(/Cross-Agency Comparison/i)).toBeInTheDocument();

      // Check comparator is rendered
      expect(screen.getByText(/Side-by-Side/i)).toBeInTheDocument();
      expect(screen.getByText('VS')).toBeInTheDocument();

      // Check table is rendered with headers
      expect(screen.getByText(/ตารางสรุปข้อมูลการจัดซื้อจัดจ้างรายหน่วยงาน/i)).toBeInTheDocument();
      expect(screen.getAllByText(/งบประมาณรวมทั้งหมด/i).length).toBeGreaterThan(0);
    });
  });
});
