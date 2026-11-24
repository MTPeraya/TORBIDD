import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectInspectorDrawer } from '../ProjectInspectorDrawer';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Project } from '@/types/project';

const mockProject: Project = {
  externalId: 101,
  title: { th: 'ระบบบริการดิจิทัล กทม.', en: 'BMA Digital Portal' },
  department: { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy Dept' },
  category: 'Website',
  budget: 12000000,
  deadline: '2026-12-31T23:59:59.000Z',
  procurementType: 'e-bidding',
  isSoftwareRelated: true,
  aiConfidence: 'High',
  requiredTechnologies: ['React', 'Next.js', 'PostgreSQL'],
  scope: {
    th: ['พัฒนาระบบเว็บพอร์ทัลเพื่อการให้บริการประชาชน'],
    en: ['Web portal development'],
  },
  fiscalYear: 2569,
  description: { th: 'รายละเอียด', en: 'Description' },
  qualifications: { th: [], en: [] },
  historicalAvg: 12000000,
  sourceDocument: 'doc.pdf',
  processedDate: '2026-08-01',
  publishDate: '2026-08-01',
};

describe('ProjectInspectorDrawer', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={false}
          onClose={jest.fn()}
          onSaveQuickEdit={jest.fn()}
          onConfirmSoftware={jest.fn()}
          onRequestNonSoftwareModal={jest.fn()}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders project metadata, AI tags, and inline fields when open', () => {
    render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={true}
          onClose={jest.fn()}
          onSaveQuickEdit={jest.fn()}
          onConfirmSoftware={jest.fn()}
          onRequestNonSoftwareModal={jest.fn()}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );
    expect(screen.getByText(/101/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /ระบบบริการดิจิทัล กทม./ })).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
  });

  it('triggers onSaveQuickEdit with updated title and budget', async () => {
    const handleSave = jest.fn().mockResolvedValue(undefined);
    render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={true}
          onClose={jest.fn()}
          onSaveQuickEdit={handleSave}
          onConfirmSoftware={jest.fn()}
          onRequestNonSoftwareModal={jest.fn()}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );

    const titleInput = screen.getByLabelText(/ชื่อโครงการ \(ไทย\)|Project Title \(TH\)/i);
    fireEvent.change(titleInput, { target: { value: 'ระบบบริการดิจิทัล กทม. ฉบับแก้ไข' } });

    const saveBtn = screen.getByRole('button', { name: /บันทึกข้อมูลด่วน|Save Quick Edits/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(101, expect.objectContaining({
        title: expect.objectContaining({ th: 'ระบบบริการดิจิทัล กทม. ฉบับแก้ไข' }),
      }));
    });
  });

  it('triggers onConfirmSoftware and onRequestNonSoftwareModal', () => {
    const handleConfirmSoftware = jest.fn();
    const handleRequestNonSoftwareModal = jest.fn();

    render(
      <LanguageProvider>
        <ProjectInspectorDrawer
          project={mockProject}
          isOpen={true}
          onClose={jest.fn()}
          onSaveQuickEdit={jest.fn()}
          onConfirmSoftware={handleConfirmSoftware}
          onRequestNonSoftwareModal={handleRequestNonSoftwareModal}
          onOpenFullEditModal={jest.fn()}
        />
      </LanguageProvider>
    );

    const confirmBtn = screen.getByRole('button', { name: /ยืนยันเป็นซอฟต์แวร์|Confirm Software/i });
    fireEvent.click(confirmBtn);
    expect(handleConfirmSoftware).toHaveBeenCalledWith(mockProject);

    const nonSwBtn = screen.getByRole('button', { name: /ไม่ใช่ซอฟต์แวร์|Non-Software/i });
    fireEvent.click(nonSwBtn);
    expect(handleRequestNonSoftwareModal).toHaveBeenCalledWith(mockProject);
  });
});
