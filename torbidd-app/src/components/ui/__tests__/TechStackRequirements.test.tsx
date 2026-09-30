import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechStackRequirements } from '../TechStackRequirements';
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

  const renderComponent = (props = defaultProps) => {
    return render(
      <LanguageProvider>
        <TechStackRequirements {...props} />
      </LanguageProvider>
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders normalized tech stack tags across categories', () => {
    renderComponent();

    // Verify canonical tag normalization
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByText('PDPA Compliance')).toBeInTheDocument();
  });

  it('filters tech tags when category button is clicked', () => {
    renderComponent();

    // Click on Frontend filter
    const frontendBtn = screen.getByRole('button', { name: /Frontend/i });
    fireEvent.click(frontendBtn);

    // React should still be present, PostgreSQL should not be visible in tags
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument();
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
});
