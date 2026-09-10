import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProjectCarousel } from '../ProjectCarousel';
import { INITIAL_PROJECTS } from '@/lib/initialData';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const renderCarousel = (projects = INITIAL_PROJECTS.slice(0, 8)) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1200,
  });
  return render(
    <ToastProvider>
      <LanguageProvider>
        <ProjectCarousel projects={projects} />
      </LanguageProvider>
    </ToastProvider>
  );
};

describe('ProjectCarousel component', () => {
  it('renders carousel with initial page indicator', () => {
    renderCarousel();
    // With 8 projects and 2 per page, should be 4 pages
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });

  it('navigates to next slide on Next button click', () => {
    renderCarousel();
    const nextBtn = screen.getByRole('button', { name: /Next Slide|หน้าถัดไป/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText(/2 \/ 4/)).toBeInTheDocument();
  });

  it('navigates to previous slide on Previous button click', () => {
    renderCarousel();
    const prevBtn = screen.getByRole('button', { name: /Previous Slide|หน้าที่แล้ว/i });
    // First page clicking prev loops to last page (4)
    fireEvent.click(prevBtn);
    expect(screen.getByText(/4 \/ 4/)).toBeInTheDocument();
  });

  it('navigates to specific page when clicking pagination dot', () => {
    renderCarousel();
    const dot3 = screen.getByRole('tab', { name: /Page 3|หน้า 3/i });
    fireEvent.click(dot3);
    expect(screen.getByText(/3 \/ 4/)).toBeInTheDocument();
  });

  it('renders empty state when projects array is empty', () => {
    renderCarousel([]);
    expect(
      screen.getByText(/ไม่มีรายการประกาศในขณะนี้|No opportunities available/i)
    ).toBeInTheDocument();
  });
});
