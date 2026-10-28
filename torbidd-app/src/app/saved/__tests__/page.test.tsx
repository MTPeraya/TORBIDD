import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SavedPage from '../page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { setStoredBookmarks } from '@/hooks/useBookmarks';

// Mock useRouter
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user_1', name: 'Test User', email: 'test@example.com', role: 'user' },
    isAuthenticated: true,
    isAdmin: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
  }),
}));

const mockProjects = [
  {
    _id: 'proj_1',
    externalId: 101,
    title: { th: 'โครงการพัฒนาระบบ AI การแพทย์', en: 'Medical AI Project' },
    department: { th: 'สำนักการแพทย์', en: 'Medical Department' },
    budget: 5000000,
    deadline: '2026-12-31T00:00:00.000Z',
    category: 'AI',
    publishDate: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'proj_2',
    externalId: 102,
    title: { th: 'ระบบคลาวด์กลาง กทม.', en: 'BMA Central Cloud' },
    department: { th: 'สำนักยุทธศาสตร์', en: 'Strategy Department' },
    budget: 12000000,
    deadline: '2026-11-30T00:00:00.000Z',
    category: 'Cloud',
    publishDate: '2026-02-01T00:00:00.000Z',
  },
];

describe('SavedPage Component', () => {
  beforeEach(() => {
    act(() => {
      localStorage.clear();
      setStoredBookmarks(new Set());
    });
    mockPush.mockClear();
    mockReplace.mockClear();

    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockProjects, total: 2 }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as jest.Mock;
  });

  afterEach(() => {
    act(() => {
      localStorage.clear();
      setStoredBookmarks(new Set());
    });
    jest.restoreAllMocks();
  });

  it('renders empty state when there are no saved items', async () => {
    render(
      <ToastProvider>
        <LanguageProvider>
          <SavedPage />
        </LanguageProvider>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีรายการที่บันทึก|No Saved/i)).toBeInTheDocument();
    });
  });

  it('displays bookmarked opportunities when an opportunity is bookmarked', async () => {
    act(() => {
      setStoredBookmarks(new Set([101]));
    });

    render(
      <ToastProvider>
        <LanguageProvider>
          <SavedPage />
        </LanguageProvider>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/โครงการพัฒนาระบบ AI การแพทย์|Medical AI Project/i)).toBeInTheDocument();
    });

    // Project 102 should NOT be in the saved list
    expect(screen.queryByText(/ระบบคลาวด์กลาง กทม\.|BMA Central Cloud/i)).not.toBeInTheDocument();
  });

  it('updates display reactively when a bookmark is removed from the card', async () => {
    act(() => {
      setStoredBookmarks(new Set([101]));
    });

    render(
      <ToastProvider>
        <LanguageProvider>
          <SavedPage />
        </LanguageProvider>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/โครงการพัฒนาระบบ AI การแพทย์|Medical AI Project/i)).toBeInTheDocument();
    });

    // Find and click the bookmark button on the card to remove it
    const bookmarkBtn = screen.getByRole('button', { name: /บันทึกแล้ว|Saved/i });
    act(() => {
      fireEvent.click(bookmarkBtn);
    });

    // Now empty state should appear
    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีรายการที่บันทึก|No Saved/i)).toBeInTheDocument();
    });
  });

  it('clears all bookmarked items when Clear All button is clicked', async () => {
    act(() => {
      setStoredBookmarks(new Set([101, 102]));
    });

    render(
      <ToastProvider>
        <LanguageProvider>
          <SavedPage />
        </LanguageProvider>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/โครงการพัฒนาระบบ AI การแพทย์|Medical AI Project/i)).toBeInTheDocument();
      expect(screen.getByText(/ระบบคลาวด์กลาง กทม\.|BMA Central Cloud/i)).toBeInTheDocument();
    });

    // Click the clear all bookmarks button in header
    const clearBtn = screen.getAllByRole('button', { name: /ล้างรายการบันทึก|Clear Saved Items/i })[0];
    act(() => {
      fireEvent.click(clearBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีรายการที่บันทึก|No Saved/i)).toBeInTheDocument();
    });
  });

  it('fetches missing bookmarked opportunity by id if not in main project list', async () => {
    const extraProject = {
      _id: 'extra_999',
      externalId: 999,
      title: { th: 'โครงการพิเศษที่ค้นพบเดี่ยว', en: 'Standalone Discovered Project' },
      department: { th: 'สำนักการศึกษา', en: 'Education Department' },
      budget: 8000000,
      deadline: '2026-10-30T00:00:00.000Z',
      category: 'Website',
      publishDate: '2026-03-01T00:00:00.000Z',
    };

    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/projects/999')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: extraProject }),
        });
      }
      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockProjects, total: 2 }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as jest.Mock;

    act(() => {
      setStoredBookmarks(new Set([999]));
    });

    render(
      <ToastProvider>
        <LanguageProvider>
          <SavedPage />
        </LanguageProvider>
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/โครงการพิเศษที่ค้นพบเดี่ยว|Standalone Discovered Project/i)).toBeInTheDocument();
    });
  });
});
