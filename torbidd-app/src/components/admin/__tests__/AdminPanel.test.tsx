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

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin_test_1', name: 'Admin User', email: 'admin@bma.go.th', role: 'admin' },
    isAuthenticated: true,
    isAdmin: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
  }),
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

  // ─── UC-4: Extract and Classify TOR Information Tests ───────────────────────

  it('displays UC-4 software status badges and filters by status', async () => {
    await renderAdminPage();
    const projectsTabBtn = screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i });
    await React.act(async () => {
      fireEvent.click(projectsTabBtn);
    });

    // Verify UC-4 table column header exists
    expect(screen.getByText(/สถานะ UC-4|UC-4 Status/i)).toBeInTheDocument();

    // Verify status filter exists
    const statusSelect = screen.getByDisplayValue(/ทุกสถานะ|All Status/i);
    expect(statusSelect).toBeInTheDocument();

    // Filter to Software Only
    await React.act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'Software' } });
    });

    // Should display software badges
    const swBadges = screen.getAllByText(/✓ ซอฟต์แวร์|✓ Software/i);
    expect(swBadges.length).toBeGreaterThan(0);
  });

  it('supports selecting projects and displaying the bulk action bar (UC-4)', async () => {
    await renderAdminPage();
    const projectsTabBtn = screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i });
    await React.act(async () => {
      fireEvent.click(projectsTabBtn);
    });

    // Initially bulk action bar should not be present
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();

    // Select all visible via header checkbox
    const selectAllCheckbox = screen.getByLabelText(/select all visible projects/i);
    await React.act(async () => {
      fireEvent.click(selectAllCheckbox);
    });

    // Bulk action bar should now appear
    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /จำแนกเป็นไม่ใช่ซอฟต์แวร์|Mark Non-Software/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /จำแนกเป็นด้านซอฟต์แวร์|Mark Software/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ลบรายการที่เลือก|Delete Selected/i })).toBeInTheDocument();

    // Deselect all
    const deselectBtn = screen.getByRole('button', { name: /ยกเลิกการเลือก|Deselect All/i });
    await React.act(async () => {
      fireEvent.click(deselectBtn);
    });

    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it('opens ConfirmNonSoftwareModal on row quick-action click (UC-4)', async () => {
    await renderAdminPage();
    const projectsTabBtn = screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i });
    await React.act(async () => {
      fireEvent.click(projectsTabBtn);
    });

    // Find quick-action non-software buttons
    const nonSwButtons = screen.getAllByTitle(/จำแนกเป็นไม่ใช่ซอฟต์แวร์|Classify as Non-Software/i);
    expect(nonSwButtons.length).toBeGreaterThan(0);

    // Click the first non-software quick action button
    await React.act(async () => {
      fireEvent.click(nonSwButtons[0]);
    });

    // ConfirmNonSoftwareModal should open
    expect(screen.getByText(/ยืนยันจำแนกเป็นไม่ใช่ซอฟต์แวร์ \(UC-4\)|Confirm Non-Software Classification \(UC-4\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ผลของการดำเนินการตาม UC-4|System Action per UC-4/i)).toBeInTheDocument();
    expect(screen.getByText(/นโยบายการจัดเก็บข้อมูล UC-4 A5|UC-4 A5 retention policy/i)).toBeInTheDocument();
  });

  it('opens ProjectFormModal in edit mode with UC-4 classification toggle', async () => {
    await renderAdminPage();
    const projectsTabBtn = screen.getByRole('button', { name: /จัดการโครงการ|Project Management/i });
    await React.act(async () => {
      fireEvent.click(projectsTabBtn);
    });

    // Click edit on the first project
    const editButtons = screen.getAllByTitle(/แก้ไขประกาศโครงการ|Edit Procurement Notice/i);
    expect(editButtons.length).toBeGreaterThan(0);

    await React.act(async () => {
      fireEvent.click(editButtons[0]);
    });

    // Modal dialog should open with UC-4 classification section
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/UC-4.*ซอฟต์แวร์|Software vs Non-Software/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ซอฟต์แวร์ \(Software\)|Software-Related/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ไม่ใช่ซอฟต์แวร์ \(Non-Software\)|Non-Software/i })).toBeInTheDocument();
  });
});


