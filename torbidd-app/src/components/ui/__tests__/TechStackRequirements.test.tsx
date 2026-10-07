import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechStackRequirements, TechStackRequirementsProps } from '../TechStackRequirements';
import { LanguageProvider } from '@/contexts/LanguageContext';

describe('TechStackRequirements component', () => {
  const defaultProps = {
    projectId: 'test-project-123',
    rawTechnologies: ['Postgres DB', 'React.js', 'k8s', 'PDPA'],
    rawRequirements: {
      th: [
        'ระบบต้องรองรับ Concurrent Users 500 ผู้ใช้งานพร้อมกัน',
        'เข้ารหัสข้อมูลตามมาตรฐาน ISO/IEC 27001',
      ],
      en: [
        'System must support 500 concurrent users',
        'ISO/IEC 27001 data encryption compliant',
      ],
    },
  };

  const renderComponent = (props: Partial<TechStackRequirementsProps> = defaultProps) => {
    return render(
      <LanguageProvider>
        <TechStackRequirements projectId="test-project-123" {...props} />
      </LanguageProvider>
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders technical requirements checklist and progress readiness', () => {
    renderComponent();

    // Verify title and requirement texts
    expect(screen.getByText(/Technical Requirements Checklist|รายการตรวจสอบข้อกำหนดทางเทคนิค/i)).toBeInTheDocument();
    expect(screen.getByText(/ระบบต้องรองรับ Concurrent Users 500 ผู้ใช้งานพร้อมกัน/i)).toBeInTheDocument();
    expect(screen.getByText(/เข้ารหัสข้อมูลตามมาตรฐาน ISO\/IEC 27001/i)).toBeInTheDocument();
    expect(screen.getByText(/0%/i)).toBeInTheDocument();
  });

  it('renders technical requirements and toggles checklist status', () => {
    renderComponent();

    // Verify initial requirements checklist
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0]).not.toBeChecked();

    // Click to check the first requirement
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    // Click "Clear All"
    const clearBtn = screen.getByText(/ล้างค่า|Clear All/i);
    fireEvent.click(clearBtn);
    expect(checkboxes[0]).not.toBeChecked();

    // Click "Check All"
    const checkAllBtn = screen.getByText(/เลือกทั้งหมด|Check All/i);
    fireEvent.click(checkAllBtn);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('displays empty state when no requirements exist', () => {
    renderComponent({
      projectId: 'empty-project',
      rawRequirements: undefined,
    });

    expect(screen.getByText(/ยังไม่มีรายการตรวจสอบข้อกำหนดทางเทคนิค|No Technical Requirements Checklist Available/i)).toBeInTheDocument();
  });
});
