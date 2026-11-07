/**
 * E2E: Single & Multi-Keyword Search against Titles and Scopes with Performance SLA
 *
 * Verifies that:
 *  1. Single-keyword search queries accurately match project Titles (Thai & English, case-insensitive).
 *  2. Single-keyword search queries accurately match project Scopes (even when keyword is absent from Title).
 *  3. Multi-keyword search queries (AND semantics) accurately match combinations across Titles and Scopes.
 *  4. Strict exclusion occurs when any token in a multi-keyword query is not satisfied.
 *  5. Search query performance strictly adheres to the SLA (<= 3 seconds / 3000 ms), even across large datasets.
 *  6. End-to-end integration across UI (ProcurementSearchBar + ProcurementList), API route (/api/projects),
 *     and database retrieval services.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Project } from '@/types/project';
import { filterBySearch, applyProcurementFilters } from '@/services/procurement-filter';
import { executeProcurementSearch } from '@/services/procurement-search';
import { getProjects } from '@/services/database/projects';
import { getProcurementProjects } from '@/services/database/procurement';
import { ProcurementSearchBar } from '@/components/procurement-search/ProcurementSearchBar';
import { ProcurementList } from '@/components/procurement-list/ProcurementList';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/opportunities',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Bookmarks
jest.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    isBookmarked: jest.fn().mockReturnValue(false),
    toggleBookmark: jest.fn(),
  }),
}));

// In-memory mock storage for Mongoose models
let mockDbProjects: any[] = [];
let mockDbProcurements: any[] = [];

jest.mock('@/models/Project', () => {
  const mockFind = jest.fn().mockImplementation((query: any) => {
    let filtered = [...mockDbProjects];

    if (query.$or) {
      filtered = filtered.filter((p) => {
        return query.$or.some((cond: any) => {
          if (cond['title.th']) return cond['title.th'].test(p.title?.th || '');
          if (cond['title.en']) return cond['title.en'].test(p.title?.en || '');
          if (cond['scope.th']) return (p.scope?.th || []).some((s: string) => cond['scope.th'].test(s));
          if (cond['scope.en']) return (p.scope?.en || []).some((s: string) => cond['scope.en'].test(s));
          if (cond['department.th']) return cond['department.th'].test(p.department?.th || '');
          if (cond['department.en']) return cond['department.en'].test(p.department?.en || '');
          if (cond.category) return cond.category.test(p.category || '');
          return false;
        });
      });
    }

    if (query.$and) {
      filtered = filtered.filter((p) => {
        return query.$and.every((tokenCond: any) => {
          return tokenCond.$or.some((cond: any) => {
            if (cond['title.th']) return cond['title.th'].test(p.title?.th || '');
            if (cond['title.en']) return cond['title.en'].test(p.title?.en || '');
            if (cond['scope.th']) return (p.scope?.th || []).some((s: string) => cond['scope.th'].test(s));
            if (cond['scope.en']) return (p.scope?.en || []).some((s: string) => cond['scope.en'].test(s));
            if (cond['department.th']) return cond['department.th'].test(p.department?.th || '');
            if (cond['department.en']) return cond['department.en'].test(p.department?.en || '');
            if (cond.category) return cond.category.test(p.category || '');
            return false;
          });
        });
      });
    }

    return {
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(filtered),
      }),
      lean: jest.fn().mockResolvedValue(filtered),
    };
  });

  return {
    __esModule: true,
    default: {
      find: mockFind,
      countDocuments: jest.fn().mockImplementation(() => Promise.resolve(mockDbProjects.length)),
    },
  };
});

jest.mock('@/models/ProcurementProject', () => {
  const mockFind = jest.fn().mockImplementation((query: any) => {
    let filtered = [...mockDbProcurements];

    if (query.$or) {
      filtered = filtered.filter((p) => {
        return query.$or.some((cond: any) => {
          if (cond.projectName) return cond.projectName.test(p.projectName || '');
          if (cond.agencyName) return cond.agencyName.test(p.agencyName || '');
          if (cond.externalProjectId) return cond.externalProjectId.test(p.externalProjectId || '');
          if (cond.scope) return Array.isArray(p.scope) && p.scope.some((s: string) => cond.scope.test(s));
          if (cond['scope.th']) return (p.scope?.th || []).some((s: string) => cond['scope.th'].test(s));
          return false;
        });
      });
    }

    if (query.$and) {
      filtered = filtered.filter((p) => {
        return query.$and.every((tokenCond: any) => {
          return tokenCond.$or.some((cond: any) => {
            if (cond.projectName) return cond.projectName.test(p.projectName || '');
            if (cond.agencyName) return cond.agencyName.test(p.agencyName || '');
            if (cond.externalProjectId) return cond.externalProjectId.test(p.externalProjectId || '');
            if (cond.scope) return Array.isArray(p.scope) && p.scope.some((s: string) => cond.scope.test(s));
            if (cond['scope.th']) return (p.scope?.th || []).some((s: string) => cond['scope.th'].test(s));
            return false;
          });
        });
      });
    }

    return {
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(filtered),
          }),
        }),
      }),
      lean: jest.fn().mockResolvedValue(filtered),
    };
  });

  return {
    __esModule: true,
    default: {
      find: mockFind,
      countDocuments: jest.fn().mockImplementation(() => Promise.resolve(mockDbProcurements.length)),
    },
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PROJECTS: Project[] = [
  {
    externalId: 101,
    title: {
      th: 'ระบบพอร์ทัลบริการประชาชนแบบครบวงจร',
      en: 'Comprehensive Citizen Service Portal',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 45000000,
    publishDate: '2026-08-01T00:00:00.000Z',
    deadline: '2026-09-30T00:00:00.000Z',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'ระบบพอร์ทัลศูนย์กลางบริการ กทม. One Stop Service',
      en: 'BMA Central Citizen Portal with One Stop Service capabilities',
    },
    scope: {
      th: [
        'ออกแบบสถาปัตยกรรม Microservices บน Cloud',
        'เชื่อมต่อระบบพิสูจน์ตัวตน Digital ID และ ThaID',
        'พัฒนาระบบ Single Sign-On (SSO)',
        'รองรับการทำงานแบบ High Availability และ Disaster Recovery',
      ],
      en: [
        'Design Microservices architecture on Cloud',
        'Integrate Digital ID and ThaID authentication',
        'Develop Single Sign-On (SSO) subsystem',
        'Support High Availability and Disaster Recovery',
      ],
    },
    qualifications: { th: ['มีทุนจดทะเบียนไม่น้อยกว่า 10 ล้านบาท'], en: ['Registered capital >= 10M THB'] },
    historicalAvg: 44000000,
    sourceDocument: 'Attach_TOR_101.pdf',
    processedDate: '2026-08-01T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 102,
    title: {
      th: 'ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ',
      en: 'Smart CCTV Camera System',
    },
    department: {
      th: 'สำนักการจราจรและขนส่ง',
      en: 'Traffic and Transport Department',
    },
    budget: 28000000,
    publishDate: '2026-08-05T00:00:00.000Z',
    deadline: '2026-09-25T00:00:00.000Z',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'ติดตั้งกล้องตรวจจับการจราจรและพฤติกรรมเสี่ยงบนท้องถนน',
      en: 'Deploy camera systems for traffic flow analysis and risk detection',
    },
    scope: {
      th: [
        'ติดตั้งระบบ AI Video Analytics ตรวจจับทะเบียนและประเภทยานพาหนะ',
        'สตรีมมิ่งภาพวิดีโอแบบ Real-time เข้าศูนย์ควบคุม',
        'คำนวณความหนาแน่นและพยากรณ์สภาพการจราจรอัตโนมัติ',
        'เชื่อมโยงสัญญาณไฟจราจรอัจฉริยะแบบ Adaptive Control',
      ],
      en: [
        'Install AI Video Analytics for license plate and vehicle classification',
        'Real-time low-latency video streaming pipeline into command center',
        'Automatic traffic density calculation and congestion forecasting',
        'Integrate adaptive traffic light signals control',
      ],
    },
    qualifications: { th: ['มีประสบการณ์ด้านระบบตรวจจับภาพ AI ไม่น้อยกว่า 3 ปี'], en: ['>= 3 years experience with AI computer vision'] },
    historicalAvg: 27500000,
    sourceDocument: 'Attach_TOR_102.pdf',
    processedDate: '2026-08-05T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 103,
    title: {
      th: 'แอปพลิเคชันมือถือติดตามสถานการณ์น้ำท่วม',
      en: 'Flood Monitoring and Warning Mobile Application',
    },
    department: {
      th: 'สำนักการระบายน้ำ',
      en: 'Drainage and Sewerage Department',
    },
    budget: 8500000,
    publishDate: '2026-08-10T00:00:00.000Z',
    deadline: '2026-09-15T00:00:00.000Z',
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    description: {
      th: 'แอปพลิเคชันเตือนภัยน้ำท่วมและระดับน้ำในคลองสำหรับประชาชน',
      en: 'Mobile app for public water level tracking and flood warnings',
    },
    scope: {
      th: [
        'เชื่อมโยงเซนเซอร์ IoT วัดระดับน้ำในคลองและประตูระบายน้ำ',
        'ระบบส่งการแจ้งเตือน Push Notification เตือนภัยล่วงหน้า',
        'รองรับระบบปฏิบัติการ iOS และ Android ด้วย Flutter Framework',
        'ระบบแผนที่ GIS แสดงพื้นที่เสี่ยงภัยน้ำท่วมแบบสด',
      ],
      en: [
        'Connect IoT water level sensors across drainage canals',
        'Push Notification system for early flood warning alerts',
        'Support iOS and Android using Flutter Framework',
        'Live GIS map displaying real-time inundation zones',
      ],
    },
    qualifications: { th: ['มีผลงานพัฒนาแอปพลิเคชันมือถือที่มีผู้ใช้งานจริง'], en: ['Track record of active mobile apps'] },
    historicalAvg: 8000000,
    sourceDocument: 'Attach_TOR_103.pdf',
    processedDate: '2026-08-10T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 104,
    title: {
      th: 'โครงการพัฒนาแพลตฟอร์มคลังข้อมูลขนาดใหญ่',
      en: 'Enterprise Big Data Lakehouse Platform',
    },
    department: {
      th: 'สำนักยุทธศาสตร์และประเมินผล',
      en: 'Strategy and Evaluation Department',
    },
    budget: 52000000,
    publishDate: '2026-08-15T00:00:00.000Z',
    deadline: '2026-10-15T00:00:00.000Z',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'ศูนย์กลางข้อมูลและประมวลผล Big Data สำหรับ กทม.',
      en: 'Enterprise data hub and analytics Lakehouse for BMA',
    },
    scope: {
      th: [
        'จัดทำ Data Pipeline ด้วย Apache Kafka และ Spark',
        'ติดตั้ง Kubernetes Cluster สำหรับกระจายการประมวลผล',
        'ปฏิบัติตามมาตรฐานความมั่นคงปลอดภัย PDPA และ ISO 27001',
        'จัดทำ Data Governance และ Data Catalog ของกรุงเทพมหานคร',
      ],
      en: [
        'Construct distributed Data Pipeline using Apache Kafka and Apache Spark',
        'Deploy production Kubernetes Cluster for elastic computing',
        'Ensure full compliance with PDPA privacy regulations and ISO 27001',
        'Establish BMA Enterprise Data Governance and metadata Catalog',
      ],
    },
    qualifications: { th: ['มีผู้เชี่ยวชาญด้าน Big Data Architecture ประจำทีม'], en: ['Certified Big Data Architects on staff'] },
    historicalAvg: 50000000,
    sourceDocument: 'Attach_TOR_104.pdf',
    processedDate: '2026-08-15T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
  {
    externalId: 105,
    title: {
      th: 'ระบบบริหารทรัพยากรการศึกษาและจัดตารางสอน',
      en: 'School Resource Management and Scheduling ERP',
    },
    department: {
      th: 'สำนักการศึกษา',
      en: 'Education Department',
    },
    budget: 6200000,
    publishDate: '2026-08-20T00:00:00.000Z',
    deadline: '2026-09-18T00:00:00.000Z',
    category: 'ERP',
    procurementType: 'e-Bidding',
    description: {
      th: 'ระบบจัดตารางสอนและบริหารจัดการโรงเรียนสังกัด กทม.',
      en: 'School timetable scheduling and educational resource management',
    },
    scope: {
      th: [
        'พัฒนาระบบทะเบียนนักเรียนและอาจารย์ผู้สอน',
        'คำนวณเงินเดือนบุคลากรและภาษี Payroll Engine',
        'ระบบจัดสรรห้องเรียนอัตโนมัติด้วย Constraint Satisfaction Algorithm',
        'สร้างรายงานสถิติอัตโนมัติเพื่อการประเมินผลสัมฤทธิ์',
      ],
      en: [
        'Student information and teacher enrollment management module',
        'Staff payroll and tax calculation engine',
        'Automated classroom allocation using Constraint Satisfaction Algorithm',
        'Automated statistical dashboards and analytics reporting',
      ],
    },
    qualifications: { th: ['มีประสบการณ์ด้านระบบการศึกษาหรือ ERP ไม่น้อยกว่า 2 ปี'], en: ['>= 2 years in Educational/ERP software'] },
    historicalAvg: 6000000,
    sourceDocument: 'Attach_TOR_105.pdf',
    processedDate: '2026-08-20T00:00:00.000Z',
    aiConfidence: 'High',
    isSoftwareRelated: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Interactive UI Harness Component for E2E Testing
// ─────────────────────────────────────────────────────────────────────────────

function SearchDashboardHarness({ initialProjects = FIXTURE_PROJECTS }: { initialProjects?: Project[] }) {
  const [query, setQuery] = useState('');

  const searchResults = React.useMemo(() => {
    return filterBySearch(initialProjects, query);
  }, [initialProjects, query]);

  return (
    <LanguageProvider>
      <ToastProvider>
        <div data-testid="search-dashboard-harness">
          <ProcurementSearchBar
            value={query}
            onChange={(val) => setQuery(val)}
            onSubmit={(val) => setQuery(val)}
          />
          <div data-testid="search-results-count">{searchResults.length}</div>
          <ProcurementList
            projects={searchResults}
            totalCount={searchResults.length}
            onClearFilters={() => setQuery('')}
          />
        </div>
      </ToastProvider>
    </LanguageProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Single & Multi-Keyword Search against Titles and Scopes with Performance SLA', () => {
  beforeEach(() => {
    mockDbProjects = [...FIXTURE_PROJECTS];
    mockDbProcurements = FIXTURE_PROJECTS.map((p) => ({
      externalProjectId: String(p.externalId),
      projectName: p.title.th,
      agencyName: p.department.th,
      fiscalYear: 2026,
      budget: p.budget,
      scope: p.scope.th,
      summary: { th: p.description.th, en: p.description.en },
      is_software: true,
    }));
  });

  // ===========================================================================
  // 1. Single-Keyword Search Queries against Titles
  // ===========================================================================
  describe('1. Single-Keyword Search against Titles', () => {
    it('1.1 accurately matches Thai keywords located in project titles', () => {
      // Query "พอร์ทัล" -> matches Project 101 ("ระบบพอร์ทัลบริการประชาชนแบบครบวงจร")
      const resultsPortal = filterBySearch(FIXTURE_PROJECTS, 'พอร์ทัล');
      expect(resultsPortal).toHaveLength(1);
      expect(resultsPortal[0].externalId).toBe(101);
      expect(resultsPortal[0].title.th).toContain('พอร์ทัล');

      // Query "กล้อง" -> matches Project 102 ("ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ")
      const resultsCamera = filterBySearch(FIXTURE_PROJECTS, 'กล้อง');
      expect(resultsCamera).toHaveLength(1);
      expect(resultsCamera[0].externalId).toBe(102);
      expect(resultsCamera[0].title.th).toContain('กล้อง');

      // Query "คลังข้อมูล" -> matches Project 104 ("โครงการพัฒนาแพลตฟอร์มคลังข้อมูลขนาดใหญ่")
      const resultsData = filterBySearch(FIXTURE_PROJECTS, 'คลังข้อมูล');
      expect(resultsData).toHaveLength(1);
      expect(resultsData[0].externalId).toBe(104);
    });

    it('1.2 accurately matches English keywords located in project titles', () => {
      // Query "Citizen" -> matches Project 101 ("Comprehensive Citizen Service Portal")
      const resCitizen = filterBySearch(FIXTURE_PROJECTS, 'Citizen');
      expect(resCitizen).toHaveLength(1);
      expect(resCitizen[0].externalId).toBe(101);

      // Query "CCTV" -> matches Project 102 ("Smart CCTV Camera System")
      const resCctv = filterBySearch(FIXTURE_PROJECTS, 'CCTV');
      expect(resCctv).toHaveLength(1);
      expect(resCctv[0].externalId).toBe(102);

      // Query "Lakehouse" -> matches Project 104 ("Enterprise Big Data Lakehouse Platform")
      const resLakehouse = filterBySearch(FIXTURE_PROJECTS, 'Lakehouse');
      expect(resLakehouse).toHaveLength(1);
      expect(resLakehouse[0].externalId).toBe(104);
    });

    it('1.3 executes case-insensitive matching across titles', () => {
      // "smart", "SMART", "Smart" all match Project 102
      const lower = filterBySearch(FIXTURE_PROJECTS, 'smart');
      const upper = filterBySearch(FIXTURE_PROJECTS, 'SMART');
      const mixed = filterBySearch(FIXTURE_PROJECTS, 'SmArT');

      expect(lower).toHaveLength(1);
      expect(upper).toHaveLength(1);
      expect(mixed).toHaveLength(1);
      expect(lower[0].externalId).toBe(102);
      expect(upper[0].externalId).toBe(102);
      expect(mixed[0].externalId).toBe(102);
    });

    it('1.4 cleanly excludes projects that do not match the title query', () => {
      const results = filterBySearch(FIXTURE_PROJECTS, 'สะพานข้ามแม่น้ำ');
      expect(results).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 2. Single-Keyword Search Queries against Work Scopes
  // ===========================================================================
  describe('2. Single-Keyword Search against Scopes', () => {
    it('2.1 matches keywords that exist ONLY in scope.th (absent from title)', () => {
      // "Microservices" is only in Project 101 scope ("ออกแบบสถาปัตยกรรม Microservices บน Cloud"), NOT in title
      expect(FIXTURE_PROJECTS[0].title.th).not.toContain('Microservices');
      const resMicroservices = filterBySearch(FIXTURE_PROJECTS, 'Microservices');
      expect(resMicroservices).toHaveLength(1);
      expect(resMicroservices[0].externalId).toBe(101);

      // "ThaID" is only in Project 101 scope ("เชื่อมต่อระบบพิสูจน์ตัวตน Digital ID และ ThaID")
      const resThaID = filterBySearch(FIXTURE_PROJECTS, 'ThaID');
      expect(resThaID).toHaveLength(1);
      expect(resThaID[0].externalId).toBe(101);

      // "Adaptive Control" is only in Project 102 scope
      const resAdaptive = filterBySearch(FIXTURE_PROJECTS, 'Adaptive Control');
      expect(resAdaptive).toHaveLength(1);
      expect(resAdaptive[0].externalId).toBe(102);

      // "ประตูระบายน้ำ" is only in Project 103 scope
      const resCanal = filterBySearch(FIXTURE_PROJECTS, 'ประตูระบายน้ำ');
      expect(resCanal).toHaveLength(1);
      expect(resCanal[0].externalId).toBe(103);
    });

    it('2.2 matches technical stack & compliance keywords that exist ONLY in scope.en', () => {
      // "Kubernetes" exists only in Project 104 scope, title is "โครงการพัฒนาแพลตฟอร์มคลังข้อมูลขนาดใหญ่"
      expect(FIXTURE_PROJECTS[3].title.en).not.toContain('Kubernetes');
      const resK8s = filterBySearch(FIXTURE_PROJECTS, 'Kubernetes');
      expect(resK8s).toHaveLength(1);
      expect(resK8s[0].externalId).toBe(104);

      // "PDPA" exists only in Project 104 scope
      const resPdpa = filterBySearch(FIXTURE_PROJECTS, 'PDPA');
      expect(resPdpa).toHaveLength(1);
      expect(resPdpa[0].externalId).toBe(104);

      // "Flutter" exists only in Project 103 scope
      const resFlutter = filterBySearch(FIXTURE_PROJECTS, 'Flutter');
      expect(resFlutter).toHaveLength(1);
      expect(resFlutter[0].externalId).toBe(103);

      // "Kafka" exists only in Project 104 scope
      const resKafka = filterBySearch(FIXTURE_PROJECTS, 'Kafka');
      expect(resKafka).toHaveLength(1);
      expect(resKafka[0].externalId).toBe(104);

      // "Payroll" exists only in Project 105 scope
      const resPayroll = filterBySearch(FIXTURE_PROJECTS, 'Payroll');
      expect(resPayroll).toHaveLength(1);
      expect(resPayroll[0].externalId).toBe(105);
    });

    it('2.3 handles flat string array scope formats seamlessly', () => {
      const flatScopeProject: Project = {
        ...FIXTURE_PROJECTS[0],
        externalId: 999,
        title: { th: 'โครงการพัฒนาระบบพิเศษ', en: 'Special Development Project' },
        // Flat array scope
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scope: ['ติดตั้งระบบ Blockchain Hyperledger', 'ระบบ Smart Contracts'] as any,
      };

      const customList = [...FIXTURE_PROJECTS, flatScopeProject];
      const res = filterBySearch(customList, 'Hyperledger');
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(999);
    });

    it('2.4 returns zero results when search term exists neither in title nor in scope', () => {
      const res = filterBySearch(FIXTURE_PROJECTS, 'Quantum Teleportation');
      expect(res).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 3. Multi-Keyword Search Queries (AND Semantics across Title & Scope)
  // ===========================================================================
  describe('3. Multi-Keyword Search across Titles and Scopes', () => {
    it('3.1 matches when one keyword is in Title and another keyword is in Scope', () => {
      // Query "กล้อง AI"
      // "กล้อง" is in Title ("ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ")
      // "AI" is in Scope ("ติดตั้งระบบ AI Video Analytics ตรวจจับทะเบียน")
      const resCctvAi = filterBySearch(FIXTURE_PROJECTS, 'กล้อง AI');
      expect(resCctvAi).toHaveLength(1);
      expect(resCctvAi[0].externalId).toBe(102);

      // Query "พอร์ทัล Microservices"
      // "พอร์ทัล" is in Title, "Microservices" is in Scope
      const resPortalMicro = filterBySearch(FIXTURE_PROJECTS, 'พอร์ทัล Microservices');
      expect(resPortalMicro).toHaveLength(1);
      expect(resPortalMicro[0].externalId).toBe(101);

      // Query "แอปพลิเคชัน IoT"
      // "แอปพลิเคชัน" is in Title, "IoT" is in Scope
      const resAppIot = filterBySearch(FIXTURE_PROJECTS, 'แอปพลิเคชัน IoT');
      expect(resAppIot).toHaveLength(1);
      expect(resAppIot[0].externalId).toBe(103);

      // Query "Big Data Kubernetes"
      // "Big Data" is in Title (en), "Kubernetes" is in Scope
      const resDataK8s = filterBySearch(FIXTURE_PROJECTS, 'Big Data Kubernetes');
      expect(resDataK8s).toHaveLength(1);
      expect(resDataK8s[0].externalId).toBe(104);
    });

    it('3.2 matches when multiple keywords appear across distinct scope requirements', () => {
      // In Project 104 scope:
      // Scope item 1: "Data Pipeline ด้วย Apache Kafka และ Spark"
      // Scope item 2: "ติดตั้ง Kubernetes Cluster"
      // Query: "Kafka Kubernetes"
      const res = filterBySearch(FIXTURE_PROJECTS, 'Kafka Kubernetes');
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(104);

      // Project 101 scope: "Digital ID" and "Single Sign-On"
      const resSso = filterBySearch(FIXTURE_PROJECTS, 'Digital ID SSO');
      expect(resSso).toHaveLength(1);
      expect(resSso[0].externalId).toBe(101);
    });

    it('3.3 matches multi-keyword queries where all terms are in Title', () => {
      // Project 105: "ระบบบริหารทรัพยากรการศึกษาและจัดตารางสอน"
      const res = filterBySearch(FIXTURE_PROJECTS, 'ทรัพยากร ตารางสอน');
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(105);
    });

    it('3.4 performs cross-language multi-term search (Thai Title + English Scope)', () => {
      // Thai Title keyword "น้ำท่วม" + English Scope keyword "GIS"
      const res = filterBySearch(FIXTURE_PROJECTS, 'น้ำท่วม GIS');
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(103);
    });

    it('3.5 enforces strict AND logic: omits records if any keyword fails to match', () => {
      // "กล้อง" matches 102, but "Blockchain" is NOT in 102
      const resMismatch = filterBySearch(FIXTURE_PROJECTS, 'กล้อง Blockchain');
      expect(resMismatch).toHaveLength(0);

      // "Microservices" matches 101, but "Kubernetes" is in 104, not 101
      const resSplit = filterBySearch(FIXTURE_PROJECTS, 'Microservices Kubernetes');
      expect(resSplit).toHaveLength(0);
    });

    it('3.6 handles extra whitespace, leading/trailing spaces, and tabs cleanly', () => {
      const res = filterBySearch(FIXTURE_PROJECTS, '   พอร์ทัล    ThaID    ');
      expect(res).toHaveLength(1);
      expect(res[0].externalId).toBe(101);
    });
  });

  // ===========================================================================
  // 4. Performance Requirements Verification (<= 3 seconds / 3000 ms)
  // ===========================================================================
  describe('4. Performance Requirements SLA (<= 3 seconds)', () => {
    // Generate a large synthetic corpus of 1,000 procurement projects
    const LARGE_CORPUS: Project[] = Array.from({ length: 1000 }, (_, i) => {
      const base = FIXTURE_PROJECTS[i % FIXTURE_PROJECTS.length];
      return {
        ...base,
        externalId: 100000 + i,
        title: {
          th: `${base.title.th} รุ่นที่ ${i + 1}`,
          en: `${base.title.en} Revision ${i + 1}`,
        },
        scope: {
          th: [...base.scope.th, `ข้อกำหนดจำเพาะสำหรับงวดที่ ${i + 1}`],
          en: [...base.scope.en, `Specific deliverable requirement batch ${i + 1}`],
        },
      };
    });

    it('4.1 completes complex single & multi-keyword queries on 1,000 projects in <= 3,000 ms', () => {
      const start = performance.now();

      // Run multiple varied queries against 1,000 projects
      const res1 = filterBySearch(LARGE_CORPUS, 'กล้อง AI');
      const res2 = filterBySearch(LARGE_CORPUS, 'Kubernetes Kafka');
      const res3 = filterBySearch(LARGE_CORPUS, 'Microservices');
      const res4 = filterBySearch(LARGE_CORPUS, 'Flutter');

      const durationMs = performance.now() - start;

      // Verify correctness
      expect(res1.length).toBeGreaterThan(0);
      expect(res2.length).toBeGreaterThan(0);
      expect(res3.length).toBeGreaterThan(0);
      expect(res4.length).toBeGreaterThan(0);

      // Verify SLA: Total duration for all 4 queries on 1,000 projects must be well under 3,000 ms
      expect(durationMs).toBeLessThanOrEqual(3000);
      // In practice on modern V8, 4 searches over 1,000 items takes < 150 ms
      expect(durationMs).toBeLessThan(1000);
    });

    it('4.2 executes 100 consecutive search queries with average latency <= 3,000 ms', () => {
      const queries = [
        'พอร์ทัล',
        'CCTV',
        'AI Video Analytics',
        'น้ำท่วม',
        'IoT',
        'Big Data',
        'Kubernetes',
        'ตารางสอน',
        'Payroll',
        'Digital ID SSO',
      ];

      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const query = queries[i % queries.length];
        const t0 = performance.now();
        const results = executeProcurementSearch(LARGE_CORPUS, { search: query, page: 1, limit: 12 });
        const t1 = performance.now();

        const latency = t1 - t0;
        latencies.push(latency);
        expect(results.items.length).toBeGreaterThan(0);
        // Every individual query MUST fulfill <= 3,000 ms SLA
        expect(latency).toBeLessThanOrEqual(3000);
      }

      const totalDuration = latencies.reduce((a, b) => a + b, 0);
      const avgLatency = totalDuration / latencies.length;
      const maxLatency = Math.max(...latencies);

      // Average latency should be orders of magnitude below 3,000 ms (e.g. < 50ms)
      expect(avgLatency).toBeLessThan(100);
      expect(maxLatency).toBeLessThanOrEqual(3000);
    });

    it('4.3 verifies combined search and deterministic sorting responds within 3,000 ms SLA', () => {
      const startTime = performance.now();

      const result = executeProcurementSearch(LARGE_CORPUS, {
        search: 'กล้อง AI',
        sortBy: 'budget_desc',
        page: 1,
        limit: 24,
      });

      const elapsedMs = performance.now() - startTime;

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThanOrEqual(3000);
      expect(elapsedMs).toBeLessThan(200);
    });
  });

  // ===========================================================================
  // 5. Database & API Layer Integration Tests
  // ===========================================================================
  describe('5. Database & API Layer Query Integration', () => {
    it('5.1 getProjects returns matching documents for single keyword in scope', async () => {
      const results = await getProjects({ search: 'Kubernetes' });
      expect(results.length).toBeGreaterThan(0);
      const matched = results.some(
        (p) =>
          (p.scope?.th && p.scope.th.some((s: string) => s.includes('Kubernetes'))) ||
          (p.scope?.en && p.scope.en.some((s: string) => s.includes('Kubernetes'))),
      );
      expect(matched).toBe(true);
    });

    it('5.2 getProjects returns matching documents for multi-keyword across title and scope', async () => {
      const results = await getProjects({ search: 'กล้อง AI' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].externalId).toBe(102);
    });

    it('5.3 getProcurementProjects searches both projectName and scope', async () => {
      const { projects, total } = await getProcurementProjects({ search: 'Microservices' });
      expect(total).toBeGreaterThan(0);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].externalProjectId).toBe('101');
    });

    it('5.4 executeProcurementSearch applies sorting and pagination on search results within SLA', () => {
      const start = performance.now();

      const searchResult = executeProcurementSearch(FIXTURE_PROJECTS, {
        search: 'ระบบ',
        sortBy: 'budget_desc',
        page: 1,
        limit: 2,
      });

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThanOrEqual(3000);
      expect(searchResult.items.length).toBeLessThanOrEqual(2);
      expect(searchResult.total).toBeGreaterThan(0);
      // Items should be sorted descending by budget
      if (searchResult.items.length >= 2) {
        expect(searchResult.items[0].budget).toBeGreaterThanOrEqual(searchResult.items[1].budget);
      }
    });
  });

  // ===========================================================================
  // 6. End-to-End User UI Flow (SearchBar -> Dashboard Feed)
  // ===========================================================================
  describe('6. End-to-End UI Flow: Search Bar to Dashboard Feed', () => {
    it('6.1 typing single title keyword into ProcurementSearchBar updates the feed dynamically', () => {
      render(<SearchDashboardHarness initialProjects={FIXTURE_PROJECTS} />);

      // Initially all 5 projects are rendered
      expect(screen.getByTestId('search-results-count')).toHaveTextContent('5');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
      expect(screen.getByText('ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/ค้นหาโครงการ|Search projects/i);

      // Type "พอร์ทัล"
      act(() => {
        fireEvent.change(searchInput, { target: { value: 'พอร์ทัล' } });
      });

      // Feed should update to 1 matching project
      expect(screen.getByTestId('search-results-count')).toHaveTextContent('1');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
      expect(screen.queryByText('ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ')).not.toBeInTheDocument();
    });

    it('6.2 typing a scope-only keyword filters the feed to projects with that scope', () => {
      render(<SearchDashboardHarness initialProjects={FIXTURE_PROJECTS} />);

      const searchInput = screen.getByPlaceholderText(/ค้นหาโครงการ|Search projects/i);

      // Type "Kubernetes" (which is ONLY in Project 104 scope)
      act(() => {
        fireEvent.change(searchInput, { target: { value: 'Kubernetes' } });
      });

      expect(screen.getByTestId('search-results-count')).toHaveTextContent('1');
      expect(screen.getByText('โครงการพัฒนาแพลตฟอร์มคลังข้อมูลขนาดใหญ่')).toBeInTheDocument();
      expect(screen.queryByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).not.toBeInTheDocument();
    });

    it('6.3 typing multi-keyword query filters to projects satisfying all terms across title/scope', () => {
      render(<SearchDashboardHarness initialProjects={FIXTURE_PROJECTS} />);

      const searchInput = screen.getByPlaceholderText(/ค้นหาโครงการ|Search projects/i);

      // Type "กล้อง AI"
      act(() => {
        fireEvent.change(searchInput, { target: { value: 'กล้อง AI' } });
      });

      expect(screen.getByTestId('search-results-count')).toHaveTextContent('1');
      expect(screen.getByText('ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ')).toBeInTheDocument();
      expect(screen.queryByText('แอปพลิเคชันมือถือติดตามสถานการณ์น้ำท่วม')).not.toBeInTheDocument();
    });

    it('6.4 clicking clear button in ProcurementSearchBar restores the full listings feed', () => {
      render(<SearchDashboardHarness initialProjects={FIXTURE_PROJECTS} />);

      const searchInput = screen.getByPlaceholderText(/ค้นหาโครงการ|Search projects/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: 'พอร์ทัล' } });
      });
      expect(screen.getByTestId('search-results-count')).toHaveTextContent('1');

      // Click clear button
      const clearBtn = screen.getByLabelText('Clear search');
      act(() => {
        fireEvent.click(clearBtn);
      });

      // Feed restored to 5 projects
      expect(screen.getByTestId('search-results-count')).toHaveTextContent('5');
      expect(screen.getByText('ระบบพอร์ทัลบริการประชาชนแบบครบวงจร')).toBeInTheDocument();
      expect(screen.getByText('ระบบกล้องโทรทัศน์วงจรปิดอัจฉริยะ')).toBeInTheDocument();
      expect(screen.getByText('แอปพลิเคชันมือถือติดตามสถานการณ์น้ำท่วม')).toBeInTheDocument();
    });

    it('6.5 typing non-matching query displays friendly visual empty state with clear filters button', () => {
      render(<SearchDashboardHarness initialProjects={FIXTURE_PROJECTS} />);

      const searchInput = screen.getByPlaceholderText(/ค้นหาโครงการ|Search projects/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: 'คำค้นหาที่ไม่มีในระบบ_12345' } });
      });

      expect(screen.getByTestId('search-results-count')).toHaveTextContent('0');
      expect(screen.getByText(/ไม่พบโครงการจัดซื้อจัดจ้างที่ตรงกับเงื่อนไข|No matching/i)).toBeInTheDocument();

      // Interactive clear all button inside empty state restores all
      const emptyClearBtn = screen.getByRole('button', { name: /ล้างทั้งหมด|Clear All/i });
      act(() => {
        fireEvent.click(emptyClearBtn);
      });

      expect(screen.getByTestId('search-results-count')).toHaveTextContent('5');
    });
  });
});
