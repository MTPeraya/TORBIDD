import React, { Suspense } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectDetailPage from '../page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockDataCenterProject = {
  _id: '67059199407',
  externalId: 67059199407,
  title: {
    th: 'ประกวดราคาซื้อจัดซื้อระบบคอมพิวเตอร์พร้อมซอฟต์แวร์สำหรับศูนย์ข้อมูล (Data Center)',
    en: 'Procurement of Computer System & Software for Data Center',
  },
  department: {
    th: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน',
    en: 'Office of the Basic Education Commission',
  },
  budget: 77169600, // วงเงินงบประมาณ
  contractPrice: 76840000, // ราคามูลค่าที่จัดหาได้ / ราคาตกลงซื้อจ้าง
  procurementType: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
  publishDate: '2024-05-15T00:00:00.000Z',
  deadline: '2024-06-15T00:00:00.000Z',
  historicalAvg: 77169600,
  category: 'Database',
  description: { th: 'รายละเอียด', en: 'Description' },
  scope: { th: ['งานระบบ'], en: ['System work'] },
  qualifications: { th: ['คุณสมบัติ'], en: ['Qualifications'] },
  sourceDocument: 'TOR (Data center).pdf',
  processedDate: '2024-05-15T00:00:00.000Z',
  aiConfidence: 'High' as const,
};

describe('ProjectDetailPage - Approved Budget vs Contract Price (ราคามูลค่าที่จัดหาได้)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockDataCenterProject }),
      }),
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders both approved budget (77,169,600 บาท) and awarded contract price (76,840,000 บาท)', async () => {
    await act(async () => {
      render(
        <ToastProvider>
          <LanguageProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <ProjectDetailPage params={Promise.resolve({ id: '67059199407' })} />
            </Suspense>
          </LanguageProvider>
        </ToastProvider>,
      );
    });

    await waitFor(() => {
      // 1. Check approved budget label & value
      expect(screen.getByText(/วงเงินงบประมาณ|Approved Budget/i)).toBeInTheDocument();
      expect(screen.getByText('77,169,600 บาท')).toBeInTheDocument();

      // 2. Check awarded contract price label & value (renders in meta-grid and budget card)
      const contractPriceLabels = screen.getAllByText(/ราคามูลค่าที่จัดหาได้/i);
      expect(contractPriceLabels.length).toBeGreaterThanOrEqual(1);
      const contractPriceValues = screen.getAllByText('76,840,000 บาท');
      expect(contractPriceValues.length).toBeGreaterThanOrEqual(1);

      // 3. Check savings calculation in Budget Breakdown Card
      expect(screen.getByText(/ประหยัดงบประมาณรัฐ|Government Savings/i)).toBeInTheDocument();
      expect(screen.getByText(/329,600 บาท/i)).toBeInTheDocument();
    });
  });
});
