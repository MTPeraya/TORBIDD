import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from '../Sidebar';
import { LanguageProvider } from '@/contexts/LanguageContext';

const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin1', name: 'Admin', role: 'admin' },
    isAuthenticated: true,
    isAdmin: true,
  }),
}));

describe('Sidebar Component', () => {
  const onToggle = jest.fn();

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/opportunities');
    onToggle.mockClear();
  });

  it('renders correctly in expanded state', () => {
    const { container } = render(
      <LanguageProvider>
        <Sidebar collapsed={false} onToggle={onToggle} bookmarkCount={3} />
      </LanguageProvider>
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('sidebar');
    expect(aside).not.toHaveClass('sidebar-collapsed');

    // Brand and toggle button
    const toggleBtn = screen.getByRole('button', { name: /ย่อแถบข้าง|Collapse sidebar/i });
    expect(toggleBtn).toBeInTheDocument();

    // Nav labels should be visible
    expect(screen.getByText(/หน้าหลัก|Home/i)).toBeInTheDocument();
    expect(screen.getByText(/โอกาสการจัดซื้อ|Opportunities/i)).toBeInTheDocument();
    expect(screen.getByText(/วิเคราะห์ราคาย้อนหลัง|Price Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/รายการที่บันทึก|Saved Items/i)).toBeInTheDocument();
    expect(screen.getByText(/ADMIN/i)).toBeInTheDocument();

    // Bookmark count badge
    expect(screen.getByText('3')).toBeInTheDocument();

    // Active link
    const opportunitiesLink = screen.getByRole('link', { name: /โอกาสการจัดซื้อ|Opportunities/i });
    expect(opportunitiesLink).toHaveClass('active');
  });

  it('renders correctly in collapsed state with tooltips and proper structure', () => {
    const { container } = render(
      <LanguageProvider>
        <Sidebar collapsed={true} onToggle={onToggle} bookmarkCount={5} />
      </LanguageProvider>
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('sidebar');
    expect(aside).toHaveClass('sidebar-collapsed');

    // Toggle button should show expand action
    const toggleBtn = screen.getByRole('button', { name: /ขยายแถบข้าง|Expand sidebar/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('data-tooltip');

    // Links must have data-tooltip attribute for hover tooltips
    const links = container.querySelectorAll('.sidebar-link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('data-tooltip');
    });

    // Bookmark badge is still present (styled as icon-corner badge in CSS)
    expect(screen.getByText('5')).toBeInTheDocument();

    // ADMIN badge must NOT be present in collapsed state
    expect(screen.queryByText(/ADMIN/i)).not.toBeInTheDocument();

    // Clicking toggle button calls onToggle
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('highlights the active route correctly', () => {
    mockUsePathname.mockReturnValue('/saved');

    render(
      <LanguageProvider>
        <Sidebar collapsed={true} onToggle={onToggle} bookmarkCount={2} />
      </LanguageProvider>
    );

    const savedLink = screen.getByRole('link', { name: /รายการที่บันทึก|Saved Items/i });
    expect(savedLink).toHaveClass('active');

    const homeLink = screen.getByRole('link', { name: /หน้าหลัก|Home/i });
    expect(homeLink).not.toHaveClass('active');
  });
});
