import React, { Suspense } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectDetailPage from '../page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { INITIAL_PROJECTS } from '@/lib/initialData';

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(INITIAL_PROJECTS[0]),
  })
) as jest.Mock;

describe('ProjectDetailPage - Clause Breakdown Pop-up Modal', () => {
  const renderPage = async () => {
    const validId = String(INITIAL_PROJECTS[0].externalId);
    let utils: ReturnType<typeof render> | undefined;
    await act(async () => {
      utils = render(
        <ToastProvider>
          <LanguageProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <ProjectDetailPage params={Promise.resolve({ id: validId })} />
            </Suspense>
          </LanguageProvider>
        </ToastProvider>
      );
    });
    return utils;
  };

  it('renders "มุมมองแยกข้อกำหนด" button and does not show modal initially', async () => {
    await renderPage();

    await waitFor(() => {
      const toggleBtn = screen.getByRole('button', { name: /มุมมองแยกข้อกำหนด|Clause Breakdown/i });
      expect(toggleBtn).toBeInTheDocument();
    });

    // The modal overlay should not be in document initially
    expect(screen.queryByRole('button', { name: /ปิดตัวอ่านเอกสาร|Close Viewer/i })).not.toBeInTheDocument();
  });

  it('opens TOR Clause Breakdown pop-up modal when button is clicked', async () => {
    await renderPage();

    const toggleBtn = await screen.findByRole('button', { name: /มุมมองแยกข้อกำหนด|Clause Breakdown/i });
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Modal close button should now appear
    const closeBtn = await screen.findByRole('button', { name: /ปิดตัวอ่านเอกสาร|Close Viewer/i });
    expect(closeBtn).toBeInTheDocument();

    // Non-official disclaimer notice should be displayed in the modal
    expect(screen.getByText(/เอกสารนี้ไม่ใช่เอกสารทางการ|Non-Official Document/i)).toBeInTheDocument();

    // Closing the modal
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(screen.queryByRole('button', { name: /ปิดตัวอ่านเอกสาร|Close Viewer/i })).not.toBeInTheDocument();
  });

  it('closes pop-up modal on Escape key press', async () => {
    await renderPage();

    const toggleBtn = await screen.findByRole('button', { name: /มุมมองแยกข้อกำหนด|Clause Breakdown/i });
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    expect(await screen.findByRole('button', { name: /ปิดตัวอ่านเอกสาร|Close Viewer/i })).toBeInTheDocument();

    // Press Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ปิดตัวอ่านเอกสาร|Close Viewer/i })).not.toBeInTheDocument();
    });
  });
});
