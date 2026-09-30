import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EligibilityChecklist } from '../EligibilityChecklist';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ExtractedQualificationItem } from '@/types/project';

describe('EligibilityChecklist component', () => {
  const mockQualifications: ExtractedQualificationItem[] = [
    {
      id: 'qual-1',
      description: { th: 'เป็นนิติบุคคลจดทะเบียนในไทย', en: 'Registered Thai juristic entity' },
      category: 'Legal',
      threshold: 'จดทะเบียนนิติบุคคล >= 2 ปี',
      mandatory: true,
    },
    {
      id: 'qual-2',
      description: { th: 'มีผลงานสัญญาเดียว 8 ล้านบาท', en: 'Single contract 8M THB' },
      category: 'Experience',
      threshold: 'สัญญาเดียว >= 8,000,000 บาท',
      mandatory: true,
    },
    {
      id: 'qual-3',
      description: { th: 'มีมาตรฐาน ISO/IEC 29110 หรือ CMMI Level 3', en: 'ISO/IEC 29110 standard' },
      category: 'Technical',
      threshold: 'ISO/IEC 29110 หรือ CMMI Level 3+',
      mandatory: false,
    },
  ];

  const defaultProps = {
    qualifications: mockQualifications.map((q) => q.description.th),
    structuredQualifications: mockQualifications,
    checkedIndices: [0],
    onToggle: jest.fn(),
    onSelectAll: jest.fn(),
    onClearAll: jest.fn(),
    budget: 10000000, // 10M budget; 8M experience clause is 80% > 50% => restrictive!
  };

  const renderComponent = (props = defaultProps) => {
    return render(
      <LanguageProvider>
        <EligibilityChecklist {...props} />
      </LanguageProvider>
    );
  };

  it('renders vendor eligibility checklist with criteria badges', () => {
    renderComponent();

    // Check title / badge
    expect(screen.getByText(/Vendor Eligibility & Checklist/i)).toBeInTheDocument();

    // Check criteria badge
    expect(screen.getByText(/min_past_project_value: 8M THB/i)).toBeInTheDocument();
  });

  it('highlights mandatory vs optional qualifications', () => {
    renderComponent();

    // Mandatory tag
    expect(screen.getAllByText(/Mandatory/i).length).toBeGreaterThan(0);

    // Optional tag
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });

  it('flags restrictive/high-risk clause when single contract exceeds 50% budget', () => {
    renderComponent();

    // Warning banner should be rendered
    expect(screen.getByText(/ตรวจพบ 1 ข้อกำหนดที่อาจเข้าข่ายล็อคสเปก/i)).toBeInTheDocument();

    // High risk tag
    expect(screen.getByText(/เสี่ยงล็อคสเปก \(High Risk\)/i)).toBeInTheDocument();

    // Legal reference
    expect(screen.getAllByText(/ว 214/i).length).toBeGreaterThanOrEqual(1);
  });

  it('filters items when filter tabs are clicked', () => {
    renderComponent();

    // Click on Optional tab
    const optionalTab = screen.getByRole('button', { name: /เกณฑ์เสริม/i });
    fireEvent.click(optionalTab);

    // Optional item should remain visible
    expect(screen.getByText('มีมาตรฐาน ISO/IEC 29110 หรือ CMMI Level 3')).toBeInTheDocument();
    // Mandatory items should be filtered out
    expect(screen.queryByText('เป็นนิติบุคคลจดทะเบียนในไทย')).not.toBeInTheDocument();
  });

  it('calls onToggle when a checklist item is clicked', () => {
    const onToggleMock = jest.fn();
    renderComponent({ ...defaultProps, onToggle: onToggleMock });

    const items = screen.getAllByRole('checkbox');
    fireEvent.click(items[1]);

    expect(onToggleMock).toHaveBeenCalledWith(1);
  });
});
