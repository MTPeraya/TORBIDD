import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminPage from '@/app/admin/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { INITIAL_PROJECTS } from '@/lib/initialData';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/admin',
}));

// Mock global fetch
beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const urlString = String(url);
    if (urlString.includes('/api/projects')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: INITIAL_PROJECTS, total: INITIAL_PROJECTS.length }),
      } as Response);
    }
    if (urlString.includes('/api/admin/stats')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              totalProjects: INITIAL_PROJECTS.length,
              totalBudget: 150000000,
              activeProjects: 6,
              aiEnrichedCount: 8,
              categoryCounts: { Website: 3, 'Mobile App': 2, AI: 2, Database: 1 },
              confidenceCounts: { High: 8, Medium: 0, Low: 0 },
              systemStatus: {
                database: 'Connected',
                aiService: 'Vertex AI Active',
                crawler: 'Idle',
                lastSync: new Date().toISOString(),
                uptimeSeconds: 3600,
                memoryUsageMb: 85,
              },
              auditLogs: [
                {
                  id: 'log-1',
                  action: 'CRAWLER_SYNC',
                  actor: 'System Cron',
                  details: 'Scraped BMA tenders successfully',
                  timestamp: new Date().toISOString(),
                  status: 'success',
                },
              ],
            },
          }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);
  }) as jest.Mock;
});

afterEach(() => {
  jest.clearAllMocks();
});

const renderAdminPage = async () => {
  let utils: ReturnType<typeof render>;
  await React.act(async () => {
    utils = render(
      <LanguageProvider>
        <AdminPage />
      </LanguageProvider>
    );
  });
  return utils!;
};

describe('AdminPage component', () => {
  it('renders admin console header and tabs', async () => {
    await renderAdminPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ภาพรวมระบบ|System Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i })).toBeInTheDocument();
  });

  it('switches between tabs on tab click', async () => {
    await renderAdminPage();

    // Switch to Projects tab
    const projectsTabBtn = screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i });
    await React.act(async () => {
      fireEvent.click(projectsTabBtn);
    });

    // Verify search input is displayed in Projects tab
    expect(screen.getByPlaceholderText(/ค้นหารหัส|Search by ID/i)).toBeInTheDocument();

    // Switch to Crawler tab
    const crawlerTabBtn = screen.getByRole('button', { name: /ซิงค์ข้อมูล e-GP|e-GP Crawler/i });
    await React.act(async () => {
      fireEvent.click(crawlerTabBtn);
    });

    expect(screen.getByText(/crawler-sync-daemon.log/i)).toBeInTheDocument();

    // Switch to Audit tab
    const auditTabBtn = screen.getByRole('button', { name: /ประวัติการทำงาน|Audit Logs/i });
    await React.act(async () => {
      fireEvent.click(auditTabBtn);
    });

    expect(screen.getByText(/CRAWLER_SYNC|ADMIN_ACCESS/i)).toBeInTheDocument();
  });

  it('filters project list by search term in projects tab', async () => {
    await renderAdminPage();
    const projectsTabBtn = screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i });
    await React.act(async () => {
      fireEvent.click(projectsTabBtn);
    });

    const searchInput = screen.getByPlaceholderText(/ค้นหารหัส|Search by ID/i);
    await React.act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Smart Portal' } });
    });

    // Should still show Smart Portal project row
    expect(screen.getByText(/Smart Portal/i)).toBeInTheDocument();
  });

  it('opens ProjectFormModal when clicking New Project button', async () => {
    await renderAdminPage();
    const createBtn = screen.getByRole('button', { name: /สร้างประกาศโครงการใหม่|New Procurement Notice/i });
    await React.act(async () => {
      fireEvent.click(createBtn);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/BMA Electronic Government Procurement/i)).toBeInTheDocument();
  });
});

