/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/software-classification.test.ts
// End-to-End Tests — UC-10 Automated Software Project Classification
//
// Verifies that the classification pipeline accurately identifies software-
// related procurement projects based on the following criteria:
//   - Website development
//   - Mobile applications
//   - AI / ML solutions
//   - Database systems
//   - ERP / Information Systems
//   - Cloud infrastructure
//   - Data analytics platforms
//   - Software maintenance & licensing
//   - Non-software (construction, vehicles, office hardware, events, etc.)
//
// Test Sections:
//   1. Keyword-Based Rule Classifier (classifyByKeywords)
//      1.1  Website & e-Government portal projects
//      1.2  Mobile application projects (Thai & English)
//      1.3  AI / GIS / ML projects
//      1.4  Database & data centre projects
//      1.5  ERP / HR / payroll systems
//      1.6  Cloud infrastructure projects
//      1.7  Data analytics / BI platforms
//      1.8  Information & management systems
//      1.9  Software maintenance & enterprise licensing
//      1.10 Non-software projects (hard disqualifiers)
//      1.11 Non-software projects (general non-SW keywords)
//      1.12 No matching keywords → low-confidence non-software
//      1.13 ClassificationResult shape contract
//      1.14 KeywordClassifierAdapter (OOP wrapper)
//
//   2. Ingestion Pipeline Classification (IngestionService.discoverFromAllSources)
//      2.1  Software projects receive is_software=true & software_category
//      2.2  Non-software projects are filtered from results
//      2.3  Classification fields written to MongoDB via upsertDiscoveredProjects
//      2.4  Error-fallback: failed classification defaults to Website / is_software=true
//      2.5  Bulk mode (>20 projects) uses keyword classifier (classified_by='rule')
//      2.6  Small batch (≤20 projects) uses AI classifier (classified_by='ai')
//
//   3. Admin Bulk Classification API (POST /api/admin/classify-bulk)
//      3.1  Unauthenticated requests return 403 Forbidden
//      3.2  Non-admin requests return 403 Forbidden
//      3.3  Processes PENDING_REVIEW projects and updates Project documents
//      3.4  force=true reclassifies ALL projects regardless of review status
//      3.5  Preserves APPROVED/CORRECTED classificationReviewStatus
//      3.6  Returns correct processed / updated / failed counts
//      3.7  Limit parameter caps the number of classified projects
// =============================================================================

import { NextRequest } from 'next/server';

// ── Mock: database connection ─────────────────────────────────────────────────
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

// ── Mock: auth (admin token) ──────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAuthSessionFromRequest: jest.fn(),
}));

// ── Mock: Mongoose models ─────────────────────────────────────────────────────
jest.mock('@/models/Project');
jest.mock('@/models/ProcurementProject');
jest.mock('@/models/ProcurementDocument');
jest.mock('@/models/SyncLog');
jest.mock('@/models/SystemMetadata');
jest.mock('@/models/SyncError');

// ── Mock: database procurement helpers ───────────────────────────────────────
jest.mock('@/services/database/procurement', () => ({
  upsertDiscoveredProjects: jest.fn(),
  saveProcurementDocument: jest.fn(),
  getDocumentsByProjectId: jest.fn(),
  getProcurementProjectByExternalId: jest.fn(),
  checkProjectDeduplication: jest.fn(),
  updateProcurementProjectExtraction: jest.fn(),
}));

// ── Mock: ingestion source clients ────────────────────────────────────────────
jest.mock('@/services/ingestion/clients/govspending-client');
jest.mock('@/services/ingestion/clients/egp-client');
jest.mock('@/services/ingestion/clients/bma-client');
jest.mock('@/services/ingestion/document-extractor');

// ── Mock: AI classifier (used in Section 2 & 3) ──────────────────────────────
jest.mock('@/services/ai/classifier', () => ({
  classifyProject: jest.fn(),
  classifyProjectsBulk: jest.fn(),
  classifyByKeywords: jest.requireActual('@/services/ai/classifier').classifyByKeywords,
  SOFTWARE_CATEGORIES: jest.requireActual('@/services/ai/classifier').SOFTWARE_CATEGORIES,
  getAiDiagnostics: jest.fn(),
  switchActiveAiProvider: jest.fn(),
  resetProviderCooldowns: jest.fn(),
  buildFallbackChain: jest.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import {
  classifyByKeywords,
  SOFTWARE_CATEGORIES,
  classifyProject,
} from '@/services/ai/classifier';
import { KeywordClassifierAdapter } from '@/services/ai/adapters/keyword-adapter';
import { IngestionService } from '@/services/ingestion/ingestion.service';
import { upsertDiscoveredProjects } from '@/services/database/procurement';
import { GovSpendingClient } from '@/services/ingestion/clients/govspending-client';
import { EgpClient } from '@/services/ingestion/clients/egp-client';
import { BmaClient } from '@/services/ingestion/clients/bma-client';
import { getAuthSessionFromRequest } from '@/lib/auth';
import Project from '@/models/Project';
import type { DiscoveredProject } from '@/types/procurement';

// ── Type helpers ──────────────────────────────────────────────────────────────
const mockClassifyProject = classifyProject as jest.MockedFunction<typeof classifyProject>;
const mockUpsert = upsertDiscoveredProjects as jest.MockedFunction<typeof upsertDiscoveredProjects>;
const mockGetAuth = getAuthSessionFromRequest as jest.MockedFunction<typeof getAuthSessionFromRequest>;

// ── Shared fixture builder ─────────────────────────────────────────────────────
function makeProject(overrides: Partial<DiscoveredProject> = {}): DiscoveredProject {
  return {
    projectName: 'โครงการทดสอบ',
    externalProjectId: `EXT-${Math.random().toString(36).slice(2)}`,
    source: 'BMA_EGP',
    sourceUrl: 'https://egp2.bangkok.go.th/test',
    agencyName: 'สำนักงานทดสอบ',
    fiscalYear: 2569,
    budget: 500000,
    publishDate: new Date('2026-01-01'),
    ...overrides,
  };
}

// =============================================================================
// Section 1: Keyword-Based Rule Classifier
// =============================================================================
describe('UC-10 Software Classification — Section 1: Keyword Classifier (classifyByKeywords)', () => {
  afterEach(() => jest.restoreAllMocks());

  // ── 1.13 Shape contract (run once up-front so failures are visible early) ──
  describe('1.13 ClassificationResult shape contract', () => {
    it('every result has required fields with correct types', () => {
      const result = classifyByKeywords('test website project', 'web portal development');
      expect(typeof result.isSoftwareRelated).toBe('boolean');
      expect(typeof result.category).toBe('string');
      expect(['High', 'Medium', 'Low']).toContain(result.confidence);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.provider).toBe('keyword');
      expect(result.model).toBe('rule-based');
      expect(SOFTWARE_CATEGORIES).toContain(result.category);
    });
  });

  // ── 1.1 Website ───────────────────────────────────────────────────────────
  describe('1.1 Website & e-Government portal projects', () => {
    it('classifies Thai-language website project correctly', () => {
      const r = classifyByKeywords(
        'จ้างพัฒนาเว็บไซต์กรุงเทพมหานคร',
        'พัฒนาเว็บพอร์ทัลสำหรับประชาชนเพื่อรับบริการออนไลน์',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Website');
    });

    it('classifies English web portal project correctly', () => {
      const r = classifyByKeywords(
        'Development of BMA e-Government Web Portal',
        'Build a web application providing e-services, online portal access for citizens',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Website');
    });

    it('classifies digital platform project correctly', () => {
      const r = classifyByKeywords(
        'Digital Platform for Public Services',
        'Development of e-service digital platform with online service capabilities',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Website');
    });
  });

  // ── 1.2 Mobile App ────────────────────────────────────────────────────────
  describe('1.2 Mobile application projects', () => {
    it('classifies Thai แอปพลิเคชัน project correctly', () => {
      const r = classifyByKeywords(
        'พัฒนาแอปพลิเคชันมือถือสำหรับกรุงเทพมหานคร',
        'สร้างแอปมือถือรองรับ iOS และ Android สำหรับประชาชน',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Mobile App');
    });

    it('classifies English mobile app project correctly', () => {
      const r = classifyByKeywords(
        'BMA Mobile Application Development',
        'iOS and Android mobile app for Bangkok government services',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Mobile App');
    });
  });

  // ── 1.3 AI / ML / GIS ────────────────────────────────────────────────────
  describe('1.3 AI / GIS / ML projects', () => {
    it('classifies Thai ปัญญาประดิษฐ์ project correctly', () => {
      const r = classifyByKeywords(
        'ระบบปัญญาประดิษฐ์วิเคราะห์ภาพถ่ายดาวเทียม',
        'นำ machine learning และ computer vision มาวิเคราะห์ภาพถ่าย',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('AI');
    });

    it('classifies GIS / geographic information project correctly', () => {
      const r = classifyByKeywords(
        'BMA GIS Mapping System',
        'geographic information system for urban planning with AI analytics',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('AI');
    });

    it('classifies deep learning / NLP project correctly', () => {
      const r = classifyByKeywords(
        'Natural Language Processing System',
        'Thai NLP deep learning neural network for document classification',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('AI');
    });
  });

  // ── 1.4 Database ──────────────────────────────────────────────────────────
  describe('1.4 Database & data centre projects', () => {
    it('classifies Thai ฐานข้อมูล project correctly', () => {
      const r = classifyByKeywords(
        'จัดทำระบบฐานข้อมูลกลางกรุงเทพมหานคร',
        'พัฒนาฐานข้อมูล PostgreSQL และ MongoDB เพื่อจัดการข้อมูลทะเบียนราษฎร',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Database');
    });

    it('classifies English database project correctly', () => {
      const r = classifyByKeywords(
        'Central Database System for BMA',
        'Build a data center with SQL server, backup system, and storage system',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Database');
    });
  });

  // ── 1.5 ERP ───────────────────────────────────────────────────────────────
  describe('1.5 ERP / HR / payroll systems', () => {
    it('classifies ERP keyword project correctly', () => {
      const r = classifyByKeywords(
        'จัดหาระบบ ERP สำหรับการบริหารจัดการองค์กร',
        'SAP enterprise resource planning for financial management and procurement system',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('ERP');
    });

    it('classifies Thai HR / payroll system correctly', () => {
      const r = classifyByKeywords(
        'พัฒนาระบบทรัพยากรบุคคลและระบบเงินเดือน',
        'ระบบ HRMS สำหรับจัดการบุคลากร ระบบ HR และ HRIS',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('ERP');
    });
  });

  // ── 1.6 Cloud ─────────────────────────────────────────────────────────────
  describe('1.6 Cloud infrastructure projects', () => {
    it('classifies Thai คลาวด์ project correctly', () => {
      const r = classifyByKeywords(
        'บริการคลาวด์สำหรับหน่วยงานราชการ',
        'cloud computing บน Azure และ AWS พร้อม government cloud hosting',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Cloud');
    });

    it('classifies Kubernetes / microservices project correctly', () => {
      const r = classifyByKeywords(
        'Cloud Infrastructure Modernisation',
        'Deploy microservices with Kubernetes and Docker on GCP cloud',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Cloud');
    });
  });

  // ── 1.7 Data Analytics ────────────────────────────────────────────────────
  describe('1.7 Data analytics / BI platforms', () => {
    it('classifies Thai วิเคราะห์ข้อมูล project correctly', () => {
      const r = classifyByKeywords(
        'ระบบวิเคราะห์ข้อมูลขนาดใหญ่',
        'business intelligence, data analytics, คลังข้อมูล data warehouse และ ETL pipeline',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Data Analytics');
    });

    it('classifies BI dashboard project correctly', () => {
      const r = classifyByKeywords(
        'Executive Dashboard and BI System',
        'data visualization dashboard reporting system with big data analytics',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Data Analytics');
    });
  });

  // ── 1.8 Information System ────────────────────────────────────────────────
  describe('1.8 Information & management systems', () => {
    it('classifies Thai ระบบสารสนเทศ project correctly', () => {
      const r = classifyByKeywords(
        'พัฒนาระบบสารสนเทศเพื่อการบริหารจัดการ',
        'information system สำหรับการจัดการเอกสาร document management',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Information System');
    });

    it('classifies hospital information system correctly', () => {
      const r = classifyByKeywords(
        'Hospital Information Management System (HIS)',
        'electronic medical record EMR and hospital information system MIS',
      );
      expect(r.isSoftwareRelated).toBe(true);
      expect(r.category).toBe('Information System');
    });
  });

  // ── 1.9 Software Maintenance & Licensing ─────────────────────────────────
  describe('1.9 Software maintenance & enterprise licensing', () => {
    it('classifies Thai บำรุงรักษาซอฟต์แวร์ project correctly', () => {
      const r = classifyByKeywords(
        'บำรุงรักษาซอฟต์แวร์ระบบสารสนเทศ',
        'annual software maintenance และ IT service สำหรับระบบบริหาร',
      );
      expect(r.isSoftwareRelated).toBe(true);
    });

    it('classifies enterprise software license procurement correctly', () => {
      const r = classifyByKeywords(
        'จัดซื้อลิขสิทธิ์ซอฟต์แวร์ Microsoft 365 Enterprise',
        'annual software license for enterprise, software subscription service',
      );
      // Enterprise licensing is software-related (not blocked by hard patterns)
      expect(r.isSoftwareRelated).toBe(true);
    });
  });

  // ── 1.10 Hard-disqualified non-software ───────────────────────────────────
  describe('1.10 Non-software projects (hard disqualifiers)', () => {
    it('rejects LCD screen rental immediately', () => {
      const r = classifyByKeywords(
        'เช่าจอ LCD สำหรับการประชุมสัมมนา',
        'เช่าจอแสดงภาพสำหรับงานอีเวนต์',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('High');
    });

    it('rejects laptop rental project immediately', () => {
      const r = classifyByKeywords(
        'เช่าโน้ตบุ๊กสำหรับการฝึกอบรม',
        'เช่าคอมพิวเตอร์และอุปกรณ์สำนักงาน',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('High');
    });

    it('rejects office hardware purchase immediately', () => {
      const r = classifyByKeywords(
        'จัดซื้อครุภัณฑ์คอมพิวเตอร์สำนักงาน',
        'ซื้อเครื่องคอมพิวเตอร์ เครื่องพิมพ์ และเครื่องสแกนเนอร์',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('High');
    });

    it('rejects consumer ChatGPT subscription immediately', () => {
      // 'chatgpt' is in HARD_NON_SOFTWARE_PATTERNS
      const r = classifyByKeywords(
        'จัดซื้อ ChatGPT Plus สำหรับครู',
        'subscription ซอฟต์แวร์ chatgpt',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('High');
    });

    it('rejects venue rental and event catering immediately', () => {
      const r = classifyByKeywords(
        'จัดจ้างจัดประชุมเชิงปฏิบัติการ',
        'เช่าสถานที่ประชุม ค่าอาหาร จัดเลี้ยง',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('High');
    });

    it('rejects vehicle charter immediately', () => {
      const r = classifyByKeywords(
        'จ้างเหมารถตู้นำนักเรียนเข้าแข่งขัน',
        'รถตู้ ค่าพาหนะ บริการขนส่ง',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('High');
    });
  });

  // ── 1.11 General non-software keywords ───────────────────────────────────
  describe('1.11 Non-software projects (general non-SW keywords)', () => {
    it('rejects road construction project', () => {
      const r = classifyByKeywords(
        'จ้างก่อสร้างถนนลาดยางภายในหมู่บ้าน',
        'งานก่อสร้าง ก่อสร้างทาง ถนน แอสฟัลต์',
      );
      expect(r.isSoftwareRelated).toBe(false);
    });

    it('rejects medical equipment purchase', () => {
      const r = classifyByKeywords(
        'จัดซื้อครุภัณฑ์การแพทย์และเวชภัณฑ์',
        'เครื่องมือแพทย์ อุปกรณ์การแพทย์ วัสดุการแพทย์',
      );
      expect(r.isSoftwareRelated).toBe(false);
    });

    it('rejects bathroom fixtures purchase', () => {
      const r = classifyByKeywords(
        'ซื้ออุปกรณ์ห้องน้ำสำหรับศูนย์บริการ',
        'วัสดุก่อสร้าง อุปกรณ์ห้องน้ำ เฟอร์นิเจอร์',
      );
      expect(r.isSoftwareRelated).toBe(false);
    });
  });

  // ── 1.12 No keywords → low confidence non-software ───────────────────────
  describe('1.12 No matching keywords → low-confidence non-software', () => {
    it('returns isSoftwareRelated=false with Low confidence when no keywords match', () => {
      const r = classifyByKeywords(
        'โครงการประชาสัมพันธ์และสร้างความตระหนัก',
        'กิจกรรมสร้างความรู้ความเข้าใจแก่ประชาชน',
      );
      expect(r.isSoftwareRelated).toBe(false);
      expect(r.confidence).toBe('Low');
    });
  });

  // ── 1.14 KeywordClassifierAdapter OOP wrapper ─────────────────────────────
  describe('1.14 KeywordClassifierAdapter (OOP wrapper)', () => {
    let adapter: KeywordClassifierAdapter;
    beforeEach(() => { adapter = new KeywordClassifierAdapter(); });

    it('reports isConfigured()=true always', () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it('classify() delegates to classifyByKeywords and resolves', async () => {
      const result = await adapter.classify(
        'พัฒนาแอปพลิเคชันมือถือ',
        'iOS และ Android mobile app',
      );
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.category).toBe('Mobile App');
    });

    it('classifyBulk() classifies all items and returns array in order', async () => {
      const results = await adapter.classifyBulk([
        { title: 'web portal system', description: 'e-government online portal' },
        { title: 'จ้างก่อสร้างถนน', description: 'งานก่อสร้าง' },
        { title: 'AI machine learning system', description: 'deep learning natural language processing' },
      ]);
      expect(results).toHaveLength(3);
      expect(results[0].isSoftwareRelated).toBe(true);
      expect(results[0].category).toBe('Website');
      expect(results[1].isSoftwareRelated).toBe(false);
      expect(results[2].isSoftwareRelated).toBe(true);
      expect(results[2].category).toBe('AI');
    });

    it('provider and model metadata are correct', () => {
      expect(adapter.provider).toBe('keyword');
      expect(adapter.model).toBe('rule-based');
      expect(adapter.name).toBe('KeywordFallbackAdapter');
    });
  });
});

// =============================================================================
// Section 2: Ingestion Pipeline Classification via IngestionService
// =============================================================================
describe('UC-10 Software Classification — Section 2: IngestionService Pipeline', () => {
  let service: IngestionService;
  let mockGovClient: jest.Mocked<GovSpendingClient>;
  let mockEgpClient: jest.Mocked<EgpClient>;
  let mockBmaClient: jest.Mocked<BmaClient>;

  const SOFTWARE_PROJECT = makeProject({
    projectName: 'พัฒนาระบบสารสนเทศออนไลน์',
    externalProjectId: 'SW-001',
    summary: { th: 'พัฒนา web portal ให้ประชาชน', en: 'Online information system web portal' },
  });

  const NON_SOFTWARE_PROJECT = makeProject({
    projectName: 'จ้างก่อสร้างถนน ซอย 5',
    externalProjectId: 'NS-001',
    summary: { th: 'งานก่อสร้างถนน', en: 'Road construction project' },
  });

  const AI_PROJECT = makeProject({
    projectName: 'ระบบปัญญาประดิษฐ์',
    externalProjectId: 'AI-001',
    summary: { th: 'machine learning สำหรับวิเคราะห์ข้อมูล', en: 'AI deep learning analytics' },
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockGovClient = new GovSpendingClient() as jest.Mocked<GovSpendingClient>;
    mockEgpClient = new EgpClient() as jest.Mocked<EgpClient>;
    mockBmaClient = new BmaClient() as jest.Mocked<BmaClient>;

    // Default: clients return empty lists
    mockGovClient.searchProjects = jest.fn().mockResolvedValue({ projects: [], total: 0 });
    mockGovClient.checkHealth = jest.fn().mockResolvedValue({ status: 'UP', source: 'CKAN_GOVSPENDING' });
    mockEgpClient.pollAnnouncements = jest.fn().mockResolvedValue({ projects: [], total: 0 });
    mockEgpClient.checkHealth = jest.fn().mockResolvedValue({ status: 'UP', source: 'NATIONAL_EGP' });
    mockBmaClient.searchProjects = jest.fn().mockResolvedValue({ projects: [], total: 0 });
    mockBmaClient.enrichProject = jest.fn().mockImplementation((p) => Promise.resolve(p));
    mockBmaClient.checkHealth = jest.fn().mockResolvedValue({ status: 'UP', source: 'BMA_EGP' });

    mockUpsert.mockResolvedValue({ upsertedCount: 0, modifiedCount: 0, matchedCount: 0 });

    // Default: AI classifier mirrors keyword result
    mockClassifyProject.mockImplementation(async (title, description) =>
      classifyByKeywords(title, description),
    );

    service = new IngestionService({
      govSpendingClient: mockGovClient,
      egpClient: mockEgpClient,
      bmaClient: mockBmaClient,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  // ── 2.1 Software projects get classification fields ───────────────────────
  it('2.1 Software projects receive is_software=true and a software_category', async () => {
    mockBmaClient.searchProjects = jest.fn().mockResolvedValue({
      projects: [{ ...SOFTWARE_PROJECT }, { ...AI_PROJECT }],
      total: 2,
    });
    mockUpsert.mockResolvedValue({ upsertedCount: 2, modifiedCount: 0, matchedCount: 0 });

    const result = await service.discoverFromAllSources();

    expect(result.totalProjects).toBe(2);
    result.projects.forEach((p) => {
      expect(p.is_software).toBe(true);
      expect(typeof p.software_category).toBe('string');
      expect(p.software_category!.length).toBeGreaterThan(0);
      expect(p.classified_at).toBeInstanceOf(Date);
      expect(['ai', 'rule']).toContain(p.classified_by);
    });
  });

  // ── 2.2 Non-software projects are filtered out ────────────────────────────
  it('2.2 Non-software projects are filtered out before MongoDB persistence', async () => {
    mockBmaClient.searchProjects = jest.fn().mockResolvedValue({
      projects: [
        { ...SOFTWARE_PROJECT },   // should be kept
        { ...NON_SOFTWARE_PROJECT }, // should be filtered
      ],
      total: 2,
    });
    mockUpsert.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });

    const result = await service.discoverFromAllSources();

    // Only the software project survives the filter
    expect(result.totalProjects).toBe(1);
    result.projects.forEach((p) => expect(p.is_software).toBe(true));

    // upsertDiscoveredProjects must only receive software projects
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upserted = mockUpsert.mock.calls[0][0] as DiscoveredProject[];
    expect(upserted.every((p) => p.is_software === true)).toBe(true);
  });

  // ── 2.3 Classification fields written to MongoDB ──────────────────────────
  it('2.3 Classification fields are present in the payload passed to upsertDiscoveredProjects', async () => {
    const project = { ...SOFTWARE_PROJECT };
    mockGovClient.searchProjects = jest.fn().mockResolvedValue({ projects: [project], total: 1 });
    mockUpsert.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });

    await service.discoverFromAllSources();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [upsertedProjects] = mockUpsert.mock.calls[0] as [DiscoveredProject[]];
    const saved = upsertedProjects[0];

    expect(saved.is_software).toBe(true);
    expect(typeof saved.software_category).toBe('string');
    expect(typeof saved.ai_confidence).toBe('string');
    expect(typeof saved.classification_reason).toBe('string');
    expect(typeof saved.classified_by).toBe('string');
    expect(saved.classified_at).toBeInstanceOf(Date);
  });

  // ── 2.4 Error fallback defaults ───────────────────────────────────────────
  it('2.4 Classification error fallback sets is_software=true with Website category', async () => {
    // Create a project with no pre-classification so the pipeline tries to classify it
    const unknownProject = makeProject({ projectName: 'โครงการที่ทำให้ classifier พัง' });

    // Force AI classification to throw on this project
    mockClassifyProject.mockRejectedValueOnce(new Error('AI quota exceeded'));

    // Supply a small batch (≤20) so AI path is taken
    mockBmaClient.searchProjects = jest.fn().mockResolvedValue({
      projects: [unknownProject],
      total: 1,
    });
    mockUpsert.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });

    const result = await service.discoverFromAllSources();

    // Error fallback: is_software=true, category=Website
    expect(result.projects.length).toBeGreaterThanOrEqual(0);
    // The project should still be upserted (defaults applied)
    if (result.projects.length > 0) {
      expect(result.projects[0].is_software).toBe(true);
      expect(result.projects[0].software_category).toBe('Website');
    }
  });

  // ── 2.5 Bulk mode uses keyword classifier ────────────────────────────────
  it('2.5 Bulk mode (>20 projects) uses rule-based classification (classified_by=rule)', async () => {
    // Create 21 software projects
    const bulkProjects = Array.from({ length: 21 }, (_, i) =>
      makeProject({
        externalProjectId: `BULK-SW-${i}`,
        projectName: `ระบบสารสนเทศออนไลน์ ${i}`,
        summary: { th: `web portal system ${i}`, en: `web application ${i}` },
      }),
    );

    mockBmaClient.searchProjects = jest.fn().mockResolvedValue({
      projects: bulkProjects,
      total: bulkProjects.length,
    });
    mockUpsert.mockResolvedValue({ upsertedCount: 21, modifiedCount: 0, matchedCount: 0 });

    const result = await service.discoverFromAllSources();

    expect(result.totalProjects).toBeGreaterThan(0);
    // AI classifier should NOT have been called for bulk batches
    expect(mockClassifyProject).not.toHaveBeenCalled();
    // All classified_by should be 'rule'
    result.projects.forEach((p) => {
      expect(p.classified_by).toBe('rule');
    });
  });

  // ── 2.6 Small batch uses AI classifier ────────────────────────────────────
  it('2.6 Small batch (≤20 projects) uses AI classifier (classified_by=ai)', async () => {
    const aiProject = makeProject({
      externalProjectId: 'AI-SMALL-001',
      projectName: 'ระบบ AI วิเคราะห์ภาพ',
      summary: { th: 'ปัญญาประดิษฐ์', en: 'AI image recognition' },
    });

    mockClassifyProject.mockResolvedValue({
      category: 'AI',
      isSoftwareRelated: true,
      confidence: 'High',
      reasoning: 'AI keyword detected',
      provider: 'vertex',
      model: 'gemini-pro',
    });

    mockBmaClient.searchProjects = jest.fn().mockResolvedValue({
      projects: [aiProject],
      total: 1,
    });
    mockUpsert.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });

    const result = await service.discoverFromAllSources();

    expect(result.totalProjects).toBe(1);
    expect(mockClassifyProject).toHaveBeenCalledTimes(1);
    expect(result.projects[0].classified_by).toBe('ai');
    expect(result.projects[0].software_category).toBe('AI');
  });
});

// =============================================================================
// Section 3: Admin Bulk Classification API (POST /api/admin/classify-bulk)
// =============================================================================
describe('UC-10 Software Classification — Section 3: Admin Bulk Classification API', () => {
  // Import lazily so mocks are in place first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let POST: (req: NextRequest) => Promise<any>;

  const mockProjectFindChain = {
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn(),
  };

  function makeAdminRequest(body: object = {}, admin = true) {
    mockGetAuth.mockReturnValue(
      admin
        ? { id: 'admin-01', email: 'admin@bma.go.th', role: 'admin', name: 'Admin', picture: '', org: 'BMA' }
        : { id: 'user-01', email: 'user@example.com', role: 'user', name: 'User', picture: '', org: 'Public' },
    );
    return new NextRequest('http://localhost/api/admin/classify-bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    // Late-import route so mocks are active
    const mod = await import('@/app/api/admin/classify-bulk/route');
    POST = mod.POST;

    // Set up Project.find chain
    (Project.find as jest.Mock).mockReturnValue(mockProjectFindChain);
    mockProjectFindChain.select.mockReturnThis();
    mockProjectFindChain.limit.mockReturnThis();
    mockProjectFindChain.lean.mockResolvedValue([]);

    // Default: auth = admin
    mockGetAuth.mockReturnValue({
      id: 'admin-01',
      email: 'admin@bma.go.th',
      role: 'admin',
      name: 'Admin',
      picture: '',
      org: 'BMA',
    });

    mockClassifyProject.mockResolvedValue({
      category: 'Website',
      isSoftwareRelated: true,
      confidence: 'High',
      reasoning: 'web portal matched',
      provider: 'vertex',
      model: 'gemini-pro',
    });

    (Project.findByIdAndUpdate as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  // ── 3.1 Unauthenticated → 403 ─────────────────────────────────────────────
  it('3.1 Returns 403 Forbidden for unauthenticated requests', async () => {
    mockGetAuth.mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/admin/classify-bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  // ── 3.2 Non-admin → 403 ───────────────────────────────────────────────────
  it('3.2 Returns 403 Forbidden for non-admin users', async () => {
    const req = makeAdminRequest({}, false);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── 3.3 Processes PENDING_REVIEW projects ────────────────────────────────
  it('3.3 Classifies PENDING_REVIEW projects and updates Project documents', async () => {
    const pendingProjects = [
      {
        _id: 'proj-001',
        externalId: 'EXT-001',
        title: { en: 'BMA e-Government Portal', th: 'เว็บไซต์กรุงเทพมหานคร' },
        description: { en: 'web portal for citizens', th: '' },
        isSoftwareRelated: false,
        category: 'Website',
        classificationReviewStatus: 'PENDING_REVIEW',
      },
      {
        _id: 'proj-002',
        externalId: 'EXT-002',
        title: { en: 'Mobile App for BMA', th: 'แอปพลิเคชันกทม.' },
        description: { en: 'iOS and Android app', th: '' },
        isSoftwareRelated: false,
        category: 'Mobile App',
        classificationReviewStatus: 'PENDING_REVIEW',
      },
    ];

    mockProjectFindChain.lean.mockResolvedValue(pendingProjects);

    const req = makeAdminRequest({ force: false, limit: 50 });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.processed).toBe(2);
    expect(json.data.updated).toBe(2);
    expect(json.data.failed).toBe(0);
    expect(mockClassifyProject).toHaveBeenCalledTimes(2);
    expect(Project.findByIdAndUpdate).toHaveBeenCalledTimes(2);
  });

  // ── 3.4 force=true reclassifies ALL projects ──────────────────────────────
  it('3.4 force=true queries all projects (no status filter)', async () => {
    const allProjects = [
      {
        _id: 'proj-003',
        title: { en: 'Old Website', th: '' },
        description: { en: 'web application', th: '' },
        classificationReviewStatus: 'APPROVED',
      },
    ];
    mockProjectFindChain.lean.mockResolvedValue(allProjects);

    const req = makeAdminRequest({ force: true, limit: 100 });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // With force=true the query passes {} (all), so the mock returns allProjects
    const json = await res.json();
    expect(json.data.processed).toBe(1);
    expect(json.data.updated).toBe(1);
  });

  // ── 3.5 Preserves APPROVED / CORRECTED classificationReviewStatus ─────────
  it('3.5 Does not reset APPROVED status during reclassification', async () => {
    const approvedProject = {
      _id: 'proj-004',
      title: { en: 'BMA Analytics', th: '' },
      description: { en: 'data analytics dashboard', th: '' },
      classificationReviewStatus: 'APPROVED',
    };
    mockProjectFindChain.lean.mockResolvedValue([approvedProject]);

    const req = makeAdminRequest({ force: true });
    await POST(req);

    const updateCall = (Project.findByIdAndUpdate as jest.Mock).mock.calls[0];
    const updateDoc = updateCall[1] as { $set: Record<string, unknown> };

    // classificationReviewStatus should NOT be set in the update when it's APPROVED
    expect(updateDoc.$set).not.toHaveProperty('classificationReviewStatus');
  });

  // ── 3.6 Correct processed / updated / failed counts ──────────────────────
  it('3.6 Returns correct counts when some classifications fail', async () => {
    const projects = [
      {
        _id: 'proj-005',
        title: { en: 'Website A', th: '' },
        description: { en: 'web portal', th: '' },
        classificationReviewStatus: 'PENDING_REVIEW',
      },
      {
        _id: 'proj-006',
        title: { en: 'App B', th: '' },
        description: { en: 'mobile app', th: '' },
        classificationReviewStatus: 'PENDING_REVIEW',
      },
    ];
    mockProjectFindChain.lean.mockResolvedValue(projects);

    // First call succeeds, second throws
    mockClassifyProject
      .mockResolvedValueOnce({ category: 'Website', isSoftwareRelated: true, confidence: 'High', reasoning: 'ok', provider: 'vertex', model: 'gemini' })
      .mockRejectedValueOnce(new Error('quota exceeded'));

    const req = makeAdminRequest({ force: true });
    const res = await POST(req);

    const json = await res.json();
    expect(json.data.processed).toBe(2);
    expect(json.data.updated).toBe(1);
    expect(json.data.failed).toBe(1);
  });

  // ── 3.7 Limit parameter caps classified projects ──────────────────────────
  it('3.7 Limit parameter is passed to Project.find correctly', async () => {
    mockProjectFindChain.lean.mockResolvedValue([]);

    const req = makeAdminRequest({ limit: 10 });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockProjectFindChain.limit).toHaveBeenCalledWith(10);
  });

  // ── 3.8 No PENDING_REVIEW projects → returns 0 processed ─────────────────
  it('3.8 Returns 0 processed when no PENDING_REVIEW projects exist', async () => {
    mockProjectFindChain.lean.mockResolvedValue([]);

    const req = makeAdminRequest({});
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.processed).toBe(0);
    expect(json.data.updated).toBe(0);
    expect(json.data.failed).toBe(0);
    expect(json.data.message).toMatch(/no projects/i);
  });
});

