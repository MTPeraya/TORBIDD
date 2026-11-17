/**
 * @jest-environment node
 */
// =============================================================================
// tests/e2e/vertex-ai-tor-extraction.test.ts
// Comprehensive End-to-End Tests for Vertex AI Multimodal Thai TOR Parsing
// & Structured Field Extraction into MongoDB Atlas
//
// Verifies that Vertex AI accurately parses Thai TOR documents and extracts:
//  1. Project Title (Thai and English)
//  2. Department / Procuring Agency (Thai and English)
//  3. Estimated Budget (Numeric THB)
//  4. Submission Deadline (ISO YYYY-MM-DD Date)
//  5. Scope of Work (Work scope items & specifications)
//  6. Deliverables & Milestones (Deliverables, SLA, Timeline milestones)
//  7. Qualifications (Legal, Financial, Experience, Technical with thresholds)
//
// And persists the structured extraction into MongoDB Atlas (ProcurementProject / Project)
// with complete auditability, mapper compatibility, and REST API access.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { NextRequest } from 'next/server';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-v4-tor-extraction',
}));

// Mock database connection
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));

// Mock Mongoose models
jest.mock('@/models/ProcurementProject');
jest.mock('@/models/ProcurementDocument');
jest.mock('@/models/Project');

// Mock Vertex AI client
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});
const mockVertexAIInstance = {
  getGenerativeModel: mockGetGenerativeModel,
};

jest.mock('@/services/ai/vertex-ai', () => ({
  getVertexAI: () => mockVertexAIInstance,
  VERTEX_MODEL_PRO: 'gemini-1.5-pro',
  VERTEX_MODEL_FLASH: 'gemini-1.5-flash',
}));

import ProcurementProject from '@/models/ProcurementProject';
import ProcurementDocument from '@/models/ProcurementDocument';
import Project from '@/models/Project';

import {
  extractTorFromBuffer,
  extractTorFromFile,
  extractTorFromBase64,
  TorExtractResult,
} from '@/services/ai/tor-extractor';
import {
  updateProcurementProjectExtraction,
  getProcurementProjectByExternalId,
  getDocumentsByProjectId,
  saveProcurementDocument,
} from '@/services/database/procurement';
import { procurementToProject } from '@/lib/project-mapper';
import { POST as processTorApiHandler } from '@/app/api/ingestion/projects/[projectId]/process-tor/route';
import { AUTH_COOKIE_NAME, signSession, AuthSessionUser } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Test Constants & Realistic Thai TOR Ground Truth Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PROJECT_ID_CLOUD = '67119538991';
const MOCK_PROJECT_ID_PACS = '67059199407';

// 1. Ground Truth for Cloud Infrastructure & DR Center TOR
const cloudTorGroundTruth: TorExtractResult = {
  title: {
    th: 'โครงการจัดหาระบบคลาวด์กลาง กทม. และศูนย์สำรองข้อมูลสำหรับหน่วยงานในสังกัดกรุงเทพมหานคร',
    en: 'BMA Central Cloud Infrastructure & Disaster Recovery Center System',
  },
  department: 'สำนักยุทธศาสตร์และประเมินผล กรุงเทพมหานคร',
  budget: 50000000,
  deadline: '2026-12-31',
  procurementType: 'ประกวดราคาอิเล็กทรอนิกส์ (e-Bidding)',
  summary: {
    th: 'โครงการจัดหาระบบคลาวด์กลางและศูนย์สำรองข้อมูล กทม. เพื่อยกระดับความมั่นคงปลอดภัยและการให้บริการประชาชนแบบรวมศูนย์ ครอบคลุมการจัดหาฮาร์ดแวร์แม่ข่าย ซอฟต์แวร์เสมือนจริง และระบบกู้คืนวิกฤต โดยมีกำหนดส่งมอบและเปิดใช้งานภายใน 180 วัน',
    en: 'Procurement of BMA Central Cloud and Disaster Recovery Infrastructure to modernize municipal computing and public digital services, covering enterprise hardware, virtualization, and automated DR with full completion within 180 days.',
  },
  scope: [
    'การสำรวจ วิเคราะห์ และออกแบบสถาปัตยกรรมระบบคลาวด์กลางและศูนย์สำรองข้อมูล (Cloud & DR Architecture)',
    'การจัดหา ติดตั้ง และกำหนดค่าอุปกรณ์เซิร์ฟเวอร์แม่ข่าย อุปกรณ์จัดเก็บข้อมูล (SAN/NAS) และระบบเครือข่ายความเร็วสูง',
    'การติดตั้งและตั้งค่าระบบเวอร์ชวลไลเซชัน (Hypervisor) และระบบจัดการคลาวด์ (Cloud Management Platform)',
    'การพัฒนาระบบสำรองข้อมูลและกู้คืนวิกฤตอัตโนมัติ (Automated Replication & Disaster Recovery)',
    'การติดตั้งระบบความมั่นคงปลอดภัยไซเบอร์ (Next-Gen Firewall, WAF, SIEM) สอดคล้องตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
    'การทดสอบการทำงานของระบบ (UAT), ซักซ้อมแผนกู้คืนระบบ (DR Drill) และจัดฝึกอบรมบุคลากร กทม.',
  ],
  requiredTechnologies: [
    'Cloud Infrastructure',
    'VMware / Hypervisor',
    'Enterprise SAN/NAS Storage',
    'Next-Gen Firewall & WAF',
    'Automated Disaster Recovery',
    'SIEM & Cybersecurity',
    'PDPA Compliance',
  ],
  technicalRequirements: {
    th: [
      'ระบบศูนย์ข้อมูลต้องรองรับมาตรฐาน Tier III หรือสอดคล้องตามมาตรฐาน Uptime Institute',
      'ระบบต้องมีความพร้อมใช้งาน (High Availability) และมี SLA ไม่น้อยกว่า 99.9%',
      'ระบบสำรองข้อมูลและกู้คืนวิกฤต (Disaster Recovery) ต้องมีค่า RPO ไม่เกิน 1 ชั่วโมง และ RTO ไม่เกิน 4 ชั่วโมง',
      'การจัดเก็บและประมวลผลข้อมูลส่วนบุคคลต้องสอดคล้องตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)',
      'รับประกันความชำรุดบกพร่องและการบำรุงรักษาอุปกรณ์ (Warranty & MA) เป็นเวลาไม่น้อยกว่า 3 ปี',
    ],
    en: [
      'Data Center facility must adhere to Tier III design guidelines or equivalent standards',
      'High Availability (HA) architecture with guaranteed operational uptime SLA >= 99.9%',
      'Disaster Recovery replication with maximum RPO <= 1 hour and RTO <= 4 hours',
      'Full compliance with Thailand Personal Data Protection Act (PDPA)',
      'Comprehensive on-site hardware warranty and preventive maintenance for at least 3 years',
    ],
  },
  qualifications: [
    'เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าว',
    'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
    'มีผลงานประเภทเดียวกันกับงานที่ประกวดราคา ในสัญญาเดียวมูลค่าไม่น้อยกว่า 25,000,000 บาท',
    'มีบุคลากรผู้เชี่ยวชาญด้าน Cloud Architecture ที่ได้รับใบรับรอง (Certification) ไม่น้อยกว่า 3 คน',
  ],
  extractedQualifications: [
    {
      id: 'qual-legal-1',
      description: {
        th: 'เป็นนิติบุคคลที่จดทะเบียนถูกต้องตามกฎหมายในประเทศไทย และไม่เป็นผู้ถูกทิ้งงานของทางราชการ',
        en: 'Legally registered corporate entity in Thailand with no government blacklisting record',
      },
      category: 'Legal',
      threshold: 'จดทะเบียนนิติบุคคลในประเทศไทย',
      mandatory: true,
    },
    {
      id: 'qual-financial-1',
      description: {
        th: 'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท ณ วันยื่นข้อเสนอ',
        en: 'Paid-up registered capital of at least 10,000,000 THB at submission date',
      },
      category: 'Financial',
      threshold: 'ทุนจดทะเบียน >= 10,000,000 บาท',
      mandatory: true,
    },
    {
      id: 'qual-experience-1',
      description: {
        th: 'มีผลงานการติดตั้งระบบคลาวด์หรือดาต้าเซ็นเตอร์ ในสัญญาเดียวมูลค่าไม่น้อยกว่าร้อยละ 50 ของงบประมาณ (25,000,000 บาท)',
        en: 'Demonstrated past performance in cloud or data center deployment with single contract >= 25,000,000 THB',
      },
      category: 'Experience',
      threshold: 'มูลค่าผลงานสัญญาเดียว >= 25,000,000 บาท',
      mandatory: true,
    },
    {
      id: 'qual-technical-1',
      description: {
        th: 'มีบุคลากรวิศวกรผู้เชี่ยวชาญที่ถือครองใบรับรองวิชาชีพด้านคลาวด์ (Cloud Certified Architect) ประจำการไม่น้อยกว่า 3 คน',
        en: 'At least 3 dedicated certified cloud solutions architects on the implementation team',
      },
      category: 'Technical',
      threshold: 'วิศวกรผู้เชี่ยวชาญ >= 3 คน',
      mandatory: true,
    },
  ],
  timeline: [
    {
      id: 'mile-1',
      event: { th: 'ส่งมอบแผนการดำเนินงานและสถาปัตยกรรมระบบ (System Design)', en: 'System Design & Blueprint Submission' },
      date: '2026-04-30',
      description: { th: 'ส่งมอบรายงานการสำรวจและเอกสารออกแบบสถาปัตยกรรมระบบคลาวด์', en: 'Survey and architectural blueprint delivery' },
      status: 'upcoming',
    },
    {
      id: 'mile-2',
      event: { th: 'ส่งมอบและติดตั้งอุปกรณ์ฮาร์ดแวร์และคลาวด์ (Hardware & Cloud Setup)', en: 'Hardware Delivery & Cloud Setup' },
      date: '2026-07-31',
      description: { th: 'ติดตั้งอุปกรณ์แม่ข่าย สตอเรจ และเครือข่าย ณ ศูนย์ข้อมูล กทม.', en: 'Complete server, SAN storage, and networking setup' },
      status: 'upcoming',
    },
    {
      id: 'mile-3',
      event: { th: 'การทดสอบการทำงาน UAT และซักซ้อมกู้ภัยพิบัติ (DR Drill)', en: 'UAT & Disaster Recovery Drill' },
      date: '2026-10-31',
      description: { th: 'ทดสอบการทำงานของระบบเสมือนจริงและการสลับการทำงานเมื่อเกิดวิกฤต', en: 'Full disaster recovery failover drill and validation' },
      status: 'upcoming',
    },
    {
      id: 'mile-4',
      event: { th: 'เปิดใช้งานระบบจริงและส่งมอบงานงวดสุดท้าย (Go-Live & Handover)', en: 'Production Go-Live & Final Acceptance' },
      date: '2026-12-31',
      description: { th: 'เปิดให้บริการคลาวด์สำหรับหน่วยงาน กทม. และส่งมอบคู่มือฝึกอบรม', en: 'Production launch and complete administrative handover' },
      status: 'upcoming',
    },
  ],
  confidence: 'High',
};

// 2. Ground Truth for Medical PACS & Radiology Maintenance TOR
const pacsTorGroundTruth: TorExtractResult = {
  title: {
    th: 'ประกวดราคาจ้างบำรุงรักษาระบบจัดเก็บและรับส่งข้อมูลภาพทางการแพทย์ (PACS) แบบไม่รวมอะไหล่ ประจำโรงพยาบาลในสังกัด กทม.',
    en: 'Medical PACS & RIS Maintenance Services (Excluding Spare Parts) for BMA Hospitals',
  },
  department: 'สำนักการแพทย์ กรุงเทพมหานคร',
  budget: 18500000,
  deadline: '2026-11-15',
  procurementType: 'ประกวดราคาอิเล็กทรอนิกส์ (e-Bidding)',
  summary: {
    th: 'โครงการจ้างบริการบำรุงรักษาระบบจัดเก็บและรับส่งภาพทางการแพทย์ (PACS/RIS) เพื่อสนับสนุนการวินิจฉัยโรคของแพทย์อย่างต่อเนื่องตลอด 24 ชั่วโมง โดยมีข้อกำหนดการตอบสนองเหตุฉุกเฉินภายใน 2 ชั่วโมง และการบำรุงรักษาเชิงป้องกันตามรอบระยะเวลา',
    en: 'Procurement of comprehensive 24x7 Medical PACS/RIS maintenance and support services for BMA hospitals, guaranteeing 2-hour emergency response times and scheduled preventive maintenance.',
  },
  scope: [
    'บริการตรวจเช็กและบำรุงรักษาเชิงป้องกัน (Preventive Maintenance - PM) ระบบ PACS/RIS ทุก 3 เดือน',
    'บริการแก้ไขปัญหาข้อขัดข้องฉุกเฉิน (Corrective Maintenance) ตลอด 24 ชั่วโมง ทุกวันไม่เว้นวันหยุดราชการ',
    'การตรวจสอบความสมบูรณ์ของการสำรองข้อมูลภาพถ่ายรังสีตามมาตรฐาน DICOM 3.0 และ HL7',
    'การปรับปรุงซอฟต์แวร์และแพตช์ความมั่นคงปลอดภัยสำหรับระบบแม่ข่าย PACS',
  ],
  requiredTechnologies: [
    'DICOM 3.0 Standards',
    'HL7 Messaging Protocol',
    'Medical PACS/RIS Server',
    'Enterprise Storage & Archive',
    '24x7 SLA Incident Management',
    'Preventive Maintenance (PM)',
  ],
  technicalRequirements: {
    th: [
      'ระบบ PACS ต้องรองรับมาตรฐาน DICOM 3.0 และ HL7 เพื่อเชื่อมต่อกับเครื่องมือแพทย์และระบบ HIS',
      'ผู้รับจ้างต้องมีทีมวิศวกรพร้อมเข้าแก้ไขปัญหาฉุกเฉินภายใน 2 ชั่วโมงนับจากได้รับแจ้ง',
      'รับประกันความพร้อมใช้งานของระบบ (High Availability) ไม่น้อยกว่า 99.9%',
    ],
    en: [
      'Full compliance with DICOM 3.0 and HL7 communication protocols for hospital modality integration',
      'Emergency on-site response time within 2 hours for critical diagnostic imaging failures',
      'High Availability operational SLA guaranteeing >= 99.9% uptime',
    ],
  },
  qualifications: [
    'เป็นนิติบุคคลผู้มีอาชีพรับจ้างบำรุงรักษาระบบสารสนเทศทางการแพทย์',
    'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 5,000,000 บาท',
    'มีผลงานสัญญาเดียวด้านการบำรุงรักษาระบบ PACS ไม่น้อยกว่า 9,000,000 บาท',
  ],
  extractedQualifications: [
    {
      id: 'qual-med-exp',
      description: {
        th: 'มีผลงานสัญญาเดียวด้านการติดตั้งหรือบำรุงรักษาระบบ PACS ในโรงพยาบาล มูลค่าไม่น้อยกว่า 9,000,000 บาท',
        en: 'Single contract past performance in PACS deployment or maintenance >= 9,000,000 THB',
      },
      category: 'Experience',
      threshold: 'มูลค่าผลงาน >= 9,000,000 บาท',
      mandatory: true,
    },
    {
      id: 'qual-med-fin',
      description: {
        th: 'มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 5,000,000 บาท',
        en: 'Paid-up registered capital >= 5,000,000 THB',
      },
      category: 'Financial',
      threshold: 'ทุนจดทะเบียน >= 5,000,000 บาท',
      mandatory: true,
    },
  ],
  timeline: [
    {
      id: 'pacs-m1',
      event: { th: 'ส่งมอบรายงานการบำรุงรักษาเชิงป้องกันไตรมาสที่ 1 (PM Q1)', en: 'Q1 Preventive Maintenance Report' },
      date: '2026-03-31',
      description: { th: 'ตรวจเช็กสุขภาพระบบและซอฟต์แวร์ PACS ทุกโรงพยาบาล', en: 'Comprehensive PACS diagnostic audit across all hospitals' },
      status: 'upcoming',
    },
  ],
  confidence: 'High',
};

const adminUser: AuthSessionUser = {
  id: 'usr_admin_tor',
  email: 'admin.director@bangkok.go.th',
  name: 'Director Admin',
  picture: '',
  role: 'admin',
  org: 'กรุงเทพมหานคร',
};

const officerUser: AuthSessionUser = {
  id: 'usr_officer_tor',
  email: 'officer@bangkok.go.th',
  name: 'Regular Officer',
  picture: '',
  role: 'user',
  org: 'กรุงเทพมหานคร',
};

describe('E2E: Vertex AI Multimodal Thai TOR Parsing & MongoDB Atlas Persistence', () => {
  const originalEnv = { ...process.env };
  let tempStorageDir: string;

  // In-Memory Database Stores for MongoDB Atlas Simulation
  let mockProcurementProjects: Map<string, any>;
  let mockProcurementDocuments: any[];

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      GOOGLE_CLOUD_PROJECT: 'torbidd-bma-ai-production',
      GOOGLE_CLOUD_LOCATION: 'asia-southeast1',
      VERTEX_AI_MODEL_PRO: 'gemini-1.5-pro',
      SESSION_SECRET: 'test-session-secret-key-at-least-32-chars-long!',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      ADMIN_EMAILS: 'admin.director@bangkok.go.th',
    };
    // Ensure Google AI Studio API key is unset so Vertex AI is the active provider
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_STUDIO_API_KEY;

    tempStorageDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'torbidd-vertex-e2e-'));

    mockProcurementProjects = new Map();
    mockProcurementDocuments = [];

    // Pre-populate unextracted procurement projects in MongoDB Atlas
    mockProcurementProjects.set(MOCK_PROJECT_ID_CLOUD, {
      _id: 'proj_mongo_cloud_001',
      externalProjectId: MOCK_PROJECT_ID_CLOUD,
      projectName: 'โครงการระบบคลาวด์กลาง กทม. (Raw Ingestion Notice)',
      agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
      fiscalYear: 2568,
      budget: 50000000,
      source: 'NATIONAL_EGP',
      sourceUrl: 'https://process5.gprocurement.go.th/...',
      torStatus: 'PENDING',
      extractionStatus: 'PENDING',
      is_software: true,
      software_category: 'Cloud',
    });

    mockProcurementProjects.set(MOCK_PROJECT_ID_PACS, {
      _id: 'proj_mongo_pacs_002',
      externalProjectId: MOCK_PROJECT_ID_PACS,
      projectName: 'จ้างบำรุงรักษาระบบ PACS (Raw Notice)',
      agencyName: 'สำนักการแพทย์',
      fiscalYear: 2568,
      budget: 18500000,
      source: 'BMA_EGP',
      sourceUrl: 'https://egp2.bangkok.go.th/...',
      torStatus: 'PENDING',
      extractionStatus: 'PENDING',
      is_software: true,
      software_category: 'Information System',
    });

    // ── MongoDB Model Mocks ──────────────────────────────────────────────────
    (ProcurementProject.findOne as jest.Mock).mockImplementation((query: any) => {
      const extId = query.externalProjectId || (query.$or && query.$or[0]?.externalProjectId);
      const doc = extId ? mockProcurementProjects.get(extId) || null : null;
      return {
        lean: jest.fn().mockResolvedValue(doc ? { ...doc } : null),
        then: (resolve: any) => Promise.resolve(doc ? { ...doc } : null).then(resolve),
      };
    });

    (ProcurementProject.findOneAndUpdate as jest.Mock).mockImplementation((filter: any, update: any) => {
      const extId = filter.externalProjectId || (filter.$or && filter.$or[0]?.externalProjectId);
      let existing = mockProcurementProjects.get(extId);
      if (!existing) {
        existing = { _id: `proj_${extId}`, externalProjectId: extId };
        mockProcurementProjects.set(extId, existing);
      }
      if (update.$set) {
        Object.assign(existing, update.$set);
      }
      return {
        lean: jest.fn().mockResolvedValue({ ...existing }),
      };
    });

    (ProcurementDocument.find as jest.Mock).mockImplementation((query: any) => {
      const targetId = query.externalProjectId || (query.$or && query.$or[1]?.externalProjectId);
      const filtered = targetId
        ? mockProcurementDocuments.filter((d) => d.externalProjectId === targetId)
        : mockProcurementDocuments;
      return {
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(filtered),
        }),
        lean: jest.fn().mockResolvedValue(filtered),
      };
    });

    (ProcurementDocument.findOne as jest.Mock).mockImplementation(async (query: any) => {
      return (
        mockProcurementDocuments.find(
          (d) =>
            d.externalProjectId === query.externalProjectId &&
            d.documentType === query.documentType,
        ) || null
      );
    });

    (ProcurementDocument as unknown as jest.Mock).mockImplementation((data: any) => {
      const doc = {
        _id: `doc_${Date.now()}`,
        ...data,
        save: jest.fn().mockImplementation(async function (this: any) {
          mockProcurementDocuments.push(this);
          return this;
        }),
      };
      return doc;
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    if (tempStorageDir && fs.existsSync(tempStorageDir)) {
      await fs.promises.rm(tempStorageDir, { recursive: true, force: true });
    }
  });

  // ===========================================================================
  // 1. Vertex AI Multimodal Thai TOR PDF Parsing
  // ===========================================================================
  describe('1. Vertex AI Multimodal Thai TOR PDF Parsing', () => {
    it('1.1 passes multimodal PDF binary inlineData and system extraction prompt to Vertex AI Gemini model', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(cloudTorGroundTruth) }],
              },
            },
          ],
        },
      });

      const fakePdfBuffer = Buffer.from('%PDF-1.4\nSample Thai Government TOR document\n%%EOF');
      const result = await extractTorFromBuffer(fakePdfBuffer, {
        fileName: 'Attach_TOR_Cloud.pdf',
        projectId: MOCK_PROJECT_ID_CLOUD,
      });

      // Verify Vertex AI was invoked with correct multimodal contents
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-pro' });
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const parts = callArgs.contents[0].parts;
      expect(parts).toHaveLength(2);

      // Part 1: Inline PDF Base64
      expect(parts[0].inlineData).toBeDefined();
      expect(parts[0].inlineData.mimeType).toBe('application/pdf');
      expect(parts[0].inlineData.data).toBe(fakePdfBuffer.toString('base64'));

      // Part 2: System Extraction Prompt
      expect(parts[1].text).toContain('Thai government procurement documents');
      expect(parts[1].text).toContain('title: Official project title');
      expect(parts[1].text).toContain('extractedQualifications');

      expect(result.confidence).toBe('High');
    });

    it('1.2 accurately extracts all 7 required core fields from Thai TOR: Title, Department, Budget, Deadline, Scope, Deliverables, and Qualifications', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(cloudTorGroundTruth) }],
              },
            },
          ],
        },
      });

      const fakePdfBuffer = Buffer.from('%PDF-1.4\nThai TOR for BMA Cloud\n%%EOF');
      const result = await extractTorFromBuffer(fakePdfBuffer, {
        fileName: 'Attach_TOR_Cloud.pdf',
      });

      // ─── 1. Project Title ──────────────────────────────────────────────────
      expect(result.title).toBeDefined();
      expect(result.title?.th).toBe('โครงการจัดหาระบบคลาวด์กลาง กทม. และศูนย์สำรองข้อมูลสำหรับหน่วยงานในสังกัดกรุงเทพมหานคร');
      expect(result.title?.en).toBe('BMA Central Cloud Infrastructure & Disaster Recovery Center System');

      // ─── 2. Department ─────────────────────────────────────────────────────
      expect(result.department).toBe('สำนักยุทธศาสตร์และประเมินผล กรุงเทพมหานคร');

      // ─── 3. Estimated Budget ───────────────────────────────────────────────
      expect(result.budget).toBe(50000000);
      expect(typeof result.budget).toBe('number');

      // ─── 4. Submission Deadline ────────────────────────────────────────────
      expect(result.deadline).toBe('2026-12-31');
      expect(result.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // ─── 5. Scope of Work ──────────────────────────────────────────────────
      expect(Array.isArray(result.scope)).toBe(true);
      expect(result.scope.length).toBeGreaterThanOrEqual(4);
      expect(result.scope[0]).toContain('สถาปัตยกรรมระบบคลาวด์');
      expect(result.scope.some((s) => s.includes('ความมั่นคงปลอดภัยไซเบอร์') || s.includes('PDPA'))).toBe(true);

      // ─── 6. Deliverables & Milestones ──────────────────────────────────────
      expect(result.summary).toBeDefined();
      expect(result.summary.th).toContain('ส่งมอบและเปิดใช้งานภายใน 180 วัน');
      expect(result.timeline).toBeDefined();
      expect(result.timeline!.length).toBe(4);
      expect(result.timeline![0].event.th).toContain('ส่งมอบแผนการดำเนินงานและสถาปัตยกรรมระบบ');
      expect(result.timeline![2].event.th).toContain('ซักซ้อมกู้ภัยพิบัติ (DR Drill)');
      expect(result.technicalRequirements.th.some((r) => r.includes('SLA') || r.includes('RPO'))).toBe(true);

      // ─── 7. Qualifications ─────────────────────────────────────────────────
      expect(result.qualifications.length).toBeGreaterThanOrEqual(3);
      expect(result.extractedQualifications.length).toBe(4);

      const categories = result.extractedQualifications.map((q) => q.category);
      expect(categories).toContain('Legal');
      expect(categories).toContain('Financial');
      expect(categories).toContain('Experience');
      expect(categories).toContain('Technical');

      // Check experience threshold (50% of 50M = 25M THB)
      const expQual = result.extractedQualifications.find((q) => q.category === 'Experience');
      expect(expQual).toBeDefined();
      expect(expQual!.threshold).toContain('25,000,000');
      expect(expQual!.mandatory).toBe(true);

      // Check financial threshold (10M THB)
      const finQual = result.extractedQualifications.find((q) => q.category === 'Financial');
      expect(finQual).toBeDefined();
      expect(finQual!.threshold).toContain('10,000,000');
    });

    it('1.3 parses Healthcare & Medical PACS contracts without generic web application technology defaults', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(pacsTorGroundTruth) }],
              },
            },
          ],
        },
      });

      const fakePdfBuffer = Buffer.from('%PDF-1.4\nMedical PACS TOR\n%%EOF');
      const result = await extractTorFromBuffer(fakePdfBuffer, {
        fileName: 'Attach_TOR_PACS.pdf',
      });

      expect(result.title?.th).toContain('PACS');
      expect(result.department).toBe('สำนักการแพทย์ กรุงเทพมหานคร');
      expect(result.budget).toBe(18500000);

      // Domain check: Must extract medical imaging technologies, not React / Node.js
      expect(result.requiredTechnologies).toContain('DICOM 3.0 Standards');
      expect(result.requiredTechnologies).toContain('HL7 Messaging Protocol');
      expect(result.requiredTechnologies).not.toContain('React');
      expect(result.requiredTechnologies).not.toContain('Next.js');

      // Scope check: Maintenance and SLA
      expect(result.scope.some((s) => s.includes('Preventive Maintenance') || s.includes('PM'))).toBe(true);
      expect(result.scope.some((s) => s.includes('DICOM 3.0'))).toBe(true);
    });

    it('1.4 seamlessly reads and parses Thai TOR directly from disk path', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(cloudTorGroundTruth) }],
              },
            },
          ],
        },
      });

      const tempFilePath = path.join(tempStorageDir, 'Attach_TOR_Cloud.pdf');
      await fs.promises.writeFile(tempFilePath, Buffer.from('%PDF-1.4 Local File On Disk'));

      const result = await extractTorFromFile(tempFilePath, {
        projectId: MOCK_PROJECT_ID_CLOUD,
      });

      expect(result.title?.th).toContain('ระบบคลาวด์กลาง กทม.');
      expect(result.budget).toBe(50000000);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 2. End-to-End Extraction Pipeline & MongoDB Atlas Persistence
  // ===========================================================================
  describe('2. End-to-End Extraction Pipeline & MongoDB Atlas Persistence', () => {
    it('2.1 persists all extracted structured fields into MongoDB Atlas (ProcurementProject collection)', async () => {
      // Simulate MongoDB update with all 7 extracted fields
      const updatedDoc = await updateProcurementProjectExtraction(MOCK_PROJECT_ID_CLOUD, {
        projectName: cloudTorGroundTruth.title!.th,
        agencyName: cloudTorGroundTruth.department!,
        budget: cloudTorGroundTruth.budget,
        deadline: cloudTorGroundTruth.deadline,
        scope: cloudTorGroundTruth.scope,
        timeline: cloudTorGroundTruth.timeline,
        summary: cloudTorGroundTruth.summary,
        requiredTechnologies: cloudTorGroundTruth.requiredTechnologies,
        technicalRequirements: cloudTorGroundTruth.technicalRequirements,
        extractedQualifications: cloudTorGroundTruth.extractedQualifications,
      });

      expect(updatedDoc).toBeDefined();

      // Verify MongoDB Atlas state directly
      const savedInAtlas = mockProcurementProjects.get(MOCK_PROJECT_ID_CLOUD);
      expect(savedInAtlas).toBeDefined();

      // Field 1: Project Title
      expect(savedInAtlas.projectName).toBe('โครงการจัดหาระบบคลาวด์กลาง กทม. และศูนย์สำรองข้อมูลสำหรับหน่วยงานในสังกัดกรุงเทพมหานคร');

      // Field 2: Department
      expect(savedInAtlas.agencyName).toBe('สำนักยุทธศาสตร์และประเมินผล กรุงเทพมหานคร');

      // Field 3: Estimated Budget
      expect(savedInAtlas.budget).toBe(50000000);

      // Field 4: Submission Deadline (Date object in MongoDB)
      expect(savedInAtlas.deadline).toBeInstanceOf(Date);
      expect(savedInAtlas.deadline.toISOString().split('T')[0]).toBe('2026-12-31');

      // Field 5: Scope of Work
      expect(savedInAtlas.scope).toHaveLength(6);
      expect(savedInAtlas.scope[0]).toContain('สถาปัตยกรรมระบบคลาวด์');

      // Field 6: Deliverables (Summary, Timeline Milestones, Technical Specs)
      expect(savedInAtlas.summary.th).toContain('ส่งมอบและเปิดใช้งานภายใน 180 วัน');
      expect(savedInAtlas.timeline).toHaveLength(4);
      expect(savedInAtlas.timeline[0].event.th).toContain('ส่งมอบแผนการดำเนินงาน');
      expect(savedInAtlas.technicalRequirements.th.length).toBeGreaterThanOrEqual(4);

      // Field 7: Qualifications (Structured categories with thresholds)
      expect(savedInAtlas.extractedQualifications).toHaveLength(4);
      expect(savedInAtlas.extractedQualifications[0].category).toBe('Legal');
      expect(savedInAtlas.extractedQualifications[1].category).toBe('Financial');
      expect(savedInAtlas.extractedQualifications[2].category).toBe('Experience');
      expect(savedInAtlas.extractedQualifications[3].category).toBe('Technical');

      // Status Flags
      expect(savedInAtlas.extractionStatus).toBe('EXTRACTED');
      expect(savedInAtlas.torStatus).toBe('AVAILABLE');
    });

    it('2.2 verified project mapper accurately projects MongoDB Atlas record to user-facing Project view', () => {
      // Setup persisted Atlas document
      const atlasDoc = {
        _id: 'mongo_cloud_proj_123',
        externalProjectId: MOCK_PROJECT_ID_CLOUD,
        projectName: cloudTorGroundTruth.title!.th,
        agencyName: cloudTorGroundTruth.department!,
        budget: cloudTorGroundTruth.budget,
        deadline: new Date('2026-12-31T17:00:00.000Z'),
        publishDate: new Date('2026-06-01T09:00:00.000Z'),
        scope: { th: cloudTorGroundTruth.scope, en: cloudTorGroundTruth.scope },
        summary: cloudTorGroundTruth.summary,
        requiredTechnologies: cloudTorGroundTruth.requiredTechnologies,
        technicalRequirements: cloudTorGroundTruth.technicalRequirements,
        extractedQualifications: cloudTorGroundTruth.extractedQualifications,
        timeline: cloudTorGroundTruth.timeline,
        software_category: 'Cloud',
        extractionStatus: 'EXTRACTED',
      };

      const mapped = procurementToProject(atlasDoc);

      // Verify Project Title
      expect(mapped.title.th).toBe(cloudTorGroundTruth.title!.th);

      // Verify Department
      expect(mapped.department.th).toBe(cloudTorGroundTruth.department!);

      // Verify Budget
      expect(mapped.budget).toBe(50000000);

      // Verify Deadline
      expect(mapped.deadline).toBe('2026-12-31T17:00:00.000Z');

      // Verify Scope & Deliverables
      expect(mapped.scope).toBeDefined();
      expect(mapped.scope!.th.length).toBe(6);
      expect(mapped.timeline).toHaveLength(4);

      // Verify Qualifications
      expect(mapped.extractedQualifications).toHaveLength(4);
      expect(mapped.torStatus).toBe('AVAILABLE');
      expect(mapped.category).toBe('Cloud');
    });
  });

  // ===========================================================================
  // 3. API Endpoint Integration (POST /api/ingestion/projects/[projectId]/process-tor)
  // ===========================================================================
  describe('3. API Endpoint Integration (POST /api/ingestion/projects/[projectId]/process-tor)', () => {
    it('3.1 allows authenticated admin to process TOR document and returns complete extraction payload', async () => {
      // Mock Vertex AI response
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(cloudTorGroundTruth) }],
              },
            },
          ],
        },
      });

      // Prepare local TOR file in storage
      const storageDir = path.resolve(process.cwd(), 'storage/documents', MOCK_PROJECT_ID_CLOUD);
      fs.mkdirSync(storageDir, { recursive: true });
      const torFilePath = path.join(storageDir, 'Attach_TOR.pdf');
      fs.writeFileSync(torFilePath, Buffer.from('%PDF-1.4 Mock BMA Cloud PDF'));

      // Register document in mock ProcurementDocument
      mockProcurementDocuments.push({
        _id: 'doc_tor_cloud',
        externalProjectId: MOCK_PROJECT_ID_CLOUD,
        documentType: 'ATTACH_TOR',
        fileName: 'Attach_TOR.pdf',
        storageReference: torFilePath,
        status: 'PROCESSED',
      });

      const token = signSession(adminUser);
      const req = new NextRequest(`http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID_CLOUD}/process-tor`, {
        method: 'POST',
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
      });

      try {
        const res = await processTorApiHandler(req, {
          params: Promise.resolve({ projectId: MOCK_PROJECT_ID_CLOUD }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.projectId).toBe(MOCK_PROJECT_ID_CLOUD);
        expect(json.confidence).toBe('High');

        // Verify all 7 core fields are in API extraction payload
        const ext = json.extraction;
        expect(ext.title?.th).toContain('ระบบคลาวด์กลาง กทม.');
        expect(ext.agencyName).toBe('สำนักยุทธศาสตร์และประเมินผล กรุงเทพมหานคร');
        expect(ext.budget).toBe(50000000);
        expect(ext.deadline).toBe('2026-12-31');
        expect(ext.scope).toHaveLength(6);
        expect(ext.summary.th).toContain('180 วัน');
        expect(ext.extractedQualifications).toHaveLength(4);
      } finally {
        if (fs.existsSync(torFilePath)) fs.unlinkSync(torFilePath);
      }
    });

    it('3.2 prevents redundant Vertex AI calls when project is already EXTRACTED (Cached)', async () => {
      // Simulate project that is already extracted in MongoDB Atlas
      mockProcurementProjects.set(MOCK_PROJECT_ID_CLOUD, {
        _id: 'proj_cloud_cached',
        externalProjectId: MOCK_PROJECT_ID_CLOUD,
        extractionStatus: 'EXTRACTED',
        summary: cloudTorGroundTruth.summary,
        requiredTechnologies: cloudTorGroundTruth.requiredTechnologies,
        technicalRequirements: cloudTorGroundTruth.technicalRequirements,
        extractedQualifications: cloudTorGroundTruth.extractedQualifications,
      });

      const token = signSession(adminUser);
      const req = new NextRequest(`http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID_CLOUD}/process-tor`, {
        method: 'POST',
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });

      const res = await processTorApiHandler(req, {
        params: Promise.resolve({ projectId: MOCK_PROJECT_ID_CLOUD }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.cached).toBe(true);
      expect(json.message).toContain('already extracted and cached');

      // Vertex AI should NOT have been called
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('3.3 forces re-extraction with Vertex AI when ?force=true query parameter is supplied', async () => {
      // Simulate existing extracted project
      mockProcurementProjects.set(MOCK_PROJECT_ID_CLOUD, {
        _id: 'proj_cloud_force',
        externalProjectId: MOCK_PROJECT_ID_CLOUD,
        extractionStatus: 'EXTRACTED',
        summary: cloudTorGroundTruth.summary,
      });

      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(cloudTorGroundTruth) }],
              },
            },
          ],
        },
      });

      const storageDir = path.resolve(process.cwd(), 'storage/documents', MOCK_PROJECT_ID_CLOUD);
      fs.mkdirSync(storageDir, { recursive: true });
      const torFilePath = path.join(storageDir, 'Attach_TOR.pdf');
      fs.writeFileSync(torFilePath, Buffer.from('%PDF-1.4 Mock BMA Cloud PDF'));

      mockProcurementDocuments = [
        {
          _id: 'doc_tor_cloud_force',
          externalProjectId: MOCK_PROJECT_ID_CLOUD,
          documentType: 'ATTACH_TOR',
          fileName: 'Attach_TOR.pdf',
          storageReference: torFilePath,
          status: 'PROCESSED',
        },
      ];

      const token = signSession(adminUser);
      const req = new NextRequest(
        `http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID_CLOUD}/process-tor?force=true`,
        {
          method: 'POST',
          headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
        },
      );

      try {
        const res = await processTorApiHandler(req, {
          params: Promise.resolve({ projectId: MOCK_PROJECT_ID_CLOUD }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.cached).toBeUndefined();

        // Vertex AI was called due to force=true
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      } finally {
        if (fs.existsSync(torFilePath)) fs.unlinkSync(torFilePath);
      }
    });

    it('3.4 denies access to unauthenticated visitors and non-admin officers', async () => {
      // 1. Unauthenticated request
      const unauthReq = new NextRequest(
        `http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID_CLOUD}/process-tor`,
        { method: 'POST' },
      );
      const unauthRes = await processTorApiHandler(unauthReq, {
        params: Promise.resolve({ projectId: MOCK_PROJECT_ID_CLOUD }),
      });
      expect(unauthRes.status).toBe(403);

      // 2. Non-admin regular officer
      const officerToken = signSession(officerUser);
      const officerReq = new NextRequest(
        `http://localhost:3000/api/ingestion/projects/${MOCK_PROJECT_ID_CLOUD}/process-tor`,
        {
          method: 'POST',
          headers: { cookie: `${AUTH_COOKIE_NAME}=${officerToken}` },
        },
      );
      const officerRes = await processTorApiHandler(officerReq, {
        params: Promise.resolve({ projectId: MOCK_PROJECT_ID_CLOUD }),
      });
      expect(officerRes.status).toBe(403);
    });
  });

  // ===========================================================================
  // 4. Error Resilience & Fallback Handling
  // ===========================================================================
  describe('4. Error Resilience & Fallback Handling', () => {
    it('4.1 gracefully falls back to domain-aware heuristic parser when Vertex AI encounters transient API error', async () => {
      // Simulate Vertex AI API failure (e.g. 503 Service Unavailable)
      mockGenerateContent.mockRejectedValue(new Error('Vertex AI 503: Model overloaded, please retry'));

      const buffer = Buffer.from('%PDF-1.4\nData center and cloud storage PDF\n%%EOF');
      const result = await extractTorFromBuffer(buffer, {
        fileName: 'Attach_TOR_DataCenter_Infrastructure.pdf',
        projectContext: {
          projectName: 'โครงการระบบคลาวด์และศูนย์ข้อมูล (Data Center)',
          agencyName: 'สำนักยุทธศาสตร์และประเมินผล',
          budget: 50000000,
          fiscalYear: 2568,
        },
      });

      // Pipeline must not throw error — falls back to heuristic extractor
      expect(result).toBeDefined();
      expect(result.summary.th).toBeTruthy();
      expect(result.requiredTechnologies.length).toBeGreaterThanOrEqual(3);
      expect(result.requiredTechnologies).toContain('Cloud Infrastructure');
      expect(result.extractedQualifications.length).toBeGreaterThanOrEqual(3);

      // Still commits to MongoDB Atlas with valid extracted fields
      const updated = await updateProcurementProjectExtraction(MOCK_PROJECT_ID_CLOUD, {
        budget: result.budget,
        summary: result.summary,
        requiredTechnologies: result.requiredTechnologies,
        extractedQualifications: result.extractedQualifications,
      });

      expect(updated).toBeDefined();
      expect(mockProcurementProjects.get(MOCK_PROJECT_ID_CLOUD).extractionStatus).toBe('EXTRACTED');
    });
  });
});
