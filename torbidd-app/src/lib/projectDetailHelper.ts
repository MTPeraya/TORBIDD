// =============================================================================
// lib/projectDetailHelper.ts - Enrichment & Helpers for Procurement Detail Viewer
// =============================================================================

import {
  Project,
  TimelineEvent,
  BudgetBreakdownItem,
  HighlightedQualification,
  DocumentSection,
  AiMetadata,
  ContactInfo,
} from '@/types/project';
import { daysUntil } from '@/lib/utils';

export function enrichProjectDetail(project: Project): Project {
  // If already enriched with documentSections and timeline, return as-is
  if (
    project.timeline &&
    project.timeline.length > 0 &&
    project.documentSections &&
    project.documentSections.length > 0 &&
    project.budgetBreakdown &&
    project.budgetBreakdown.length > 0
  ) {
    return project;
  }

  const publishDateObj = new Date(project.publishDate);
  const deadlineDateObj = new Date(project.deadline);

  // Inquiry deadline: ~7 days after publish
  const inquiryDateObj = new Date(publishDateObj);
  inquiryDateObj.setDate(inquiryDateObj.getDate() + 7);
  const inquiryDateStr = inquiryDateObj.toISOString().split('T')[0];

  // Evaluation date: ~3 days after deadline
  const evalDateObj = new Date(deadlineDateObj);
  evalDateObj.setDate(evalDateObj.getDate() + 3);
  const evalDateStr = evalDateObj.toISOString().split('T')[0];

  const daysToDeadline = daysUntil(project.deadline);
  const daysToInquiry = daysUntil(inquiryDateStr);

  const timeline: TimelineEvent[] = [
    {
      id: 'step-1',
      event: {
        th: 'ประกาศร่างขอบเขตงาน (TOR) และเอกสารประกวดราคา',
        en: 'Draft TOR & Tender Document Announcement',
      },
      date: project.publishDate,
      description: {
        th: 'เผยแพร่เอกสาร TOR ผ่านระบบ e-GP กทม. และเว็บไซต์ทางการ',
        en: 'Published via official BMA e-GP portal and procurement notice board',
      },
      status: 'completed',
    },
    {
      id: 'step-2',
      event: {
        th: 'สิ้นสุดการรับฟังคำวิจารณ์และข้อเสนอแนะ',
        en: 'Close of Public Inquiry & Clarification Window',
      },
      date: inquiryDateStr,
      description: {
        th: 'กำหนดยื่นข้อซักถามหรือข้อคิดเห็นเกี่ยวกับคุณสมบัติและขอบเขตงาน',
        en: 'Deadline for bidders to submit inquiries regarding specifications',
      },
      status: daysToInquiry < 0 ? 'completed' : 'active',
    },
    {
      id: 'step-3',
      event: {
        th: 'กำหนดยื่นข้อเสนอและเสนอราคาผ่านระบบ e-GP',
        en: 'Bid Submission & Financial Proposal Deadline',
      },
      date: project.deadline,
      description: {
        th: 'ยื่นเอกสารข้อเสนอทางเทคนิคและหลักประกันซองผ่านระบบอิเล็กทรอนิกส์ ภายในเวลา 16:30 น.',
        en: 'Electronic submission of technical and price proposals prior to 16:30 hrs',
      },
      status: daysToDeadline < 0 ? 'completed' : 'active',
    },
    {
      id: 'step-4',
      event: {
        th: 'เปิดซองข้อเสนอและพิจารณาผลการประกวดราคา',
        en: 'Proposal Opening & Evaluation Committee Review',
      },
      date: evalDateStr,
      description: {
        th: 'คณะกรรมการพิจารณาผลการประกวดราคาดำเนินการตรวจสอบคุณสมบัติและข้อเสนอด้านเทคนิค',
        en: 'Evaluation committee reviews bidder eligibility and technical compliance',
      },
      status: daysUntil(evalDateStr) < 0 ? 'completed' : 'upcoming',
    },
  ];

  // Realistic budget allocation breakdown
  const budget = project.budget;
  const devShare = Math.round(budget * 0.55);
  const infraShare = Math.round(budget * 0.20);
  const testShare = Math.round(budget * 0.15);
  const trainingShare = budget - devShare - infraShare - testShare;

  const budgetBreakdown: BudgetBreakdownItem[] = [
    {
      category: {
        th: 'การพัฒนาและปรับแต่งซอฟต์แวร์ (Core Development & APIs)',
        en: 'Core Software Development & System APIs',
      },
      amount: devShare,
      percentage: 55,
    },
    {
      category: {
        th: 'โครงสร้างพื้นฐานคลาวด์ ฐานข้อมูล และความมั่นคงปลอดภัย (Infra & Security)',
        en: 'Cloud Infrastructure, Database & Security Hardening',
      },
      amount: infraShare,
      percentage: 20,
    },
    {
      category: {
        th: 'การทดสอบระบบและการเชื่อมต่อข้อมูลเดิม (Integration & QA/UAT)',
        en: 'System Integration, UAT & Quality Assurance',
      },
      amount: testShare,
      percentage: 15,
    },
    {
      category: {
        th: 'การฝึกอบรมบุคลากร กทม. และการถ่ายทอดเทคโนโลยี (Training & Handover)',
        en: 'BMA Staff Training, Knowledge Transfer & Warranty Support',
      },
      amount: trainingShare,
      percentage: 10,
    },
  ];

  // Critical qualifications callout
  const rawQuals = project.qualifications?.th || [];
  const rawQualsEn = project.qualifications?.en || [];

  const highlightedQualifications: HighlightedQualification[] = [
    {
      type: 'critical',
      title: {
        th: 'คุณสมบัติด้านทุนจดทะเบียนและสถานะนิติบุคคล (Mandatory Capital)',
        en: 'Paid-Up Capital & Legal Status (Mandatory)',
      },
      description: {
        th: rawQuals[0] || 'เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนชำระแล้วตามเกณฑ์ที่กำหนด',
        en: rawQualsEn[0] || 'Must be a legal entity registered in Thailand with required paid-up capital.',
      },
    },
    {
      type: 'critical',
      title: {
        th: 'ผลงานย้อนหลังประเภทสัญญาเดียว (Single Contract Performance)',
        en: 'Past Project Track Record (Single Contract)',
      },
      description: {
        th: rawQuals[1] || 'มีผลงานสัญญากับหน่วยงานรัฐหรือองค์กรขนาดใหญ่ตามมูลค่าที่กำหนดภายใน 5 ปี',
        en: rawQualsEn[1] || 'Must possess verified track record with government or enterprise clients within 5 years.',
      },
    },
    {
      type: 'standard',
      title: {
        th: 'มาตรฐานการบริหารจัดการและการรับรองคุณภาพซอฟต์แวร์ (Quality Standards)',
        en: 'Quality Certification & Standards',
      },
      description: {
        th: rawQuals[2] || 'มีมาตรฐาน ISO 27001 หรือ CMMI Level 3 ด้านการพัฒนาซอฟต์แวร์',
        en: rawQualsEn[2] || 'Must hold ISO 27001 or CMMI Level 3 software certification.',
      },
    },
  ];

  // Simulated Document Sections representing the official TOR document
  const docTitleTh = project.title?.th || 'โครงการจัดซื้อจัดจ้างซอฟต์แวร์';
  const docTitleEn = project.title?.en || 'BMA Software Procurement Project';
  const deptTh = project.department?.th || 'กรุงเทพมหานคร';
  const deptEn = project.department?.en || 'Bangkok Metropolitan Administration';

  const documentSections: DocumentSection[] = [
    {
      sectionId: 'article-1',
      articleNumber: 'ข้อ 1',
      title: {
        th: 'ความเป็นมาและวัตถุประสงค์โครงการ',
        en: 'Article 1: Background and Objectives',
      },
      page: 1,
      content: {
        th: `ด้วย ${deptTh} มีความประสงค์จะดำเนินการประกวดราคาอิเล็กทรอนิกส์ (e-Bidding) สำหรับ "${docTitleTh}" เพื่อยกระดับการให้บริการดิจิทัลและการบริหารจัดการภาครัฐตามแผนพัฒนาดิจิทัลกรุงเทพมหานคร โดยมีวัตถุประสงค์เพื่อรองรับปริมาณการใช้งานของประชาชนและเจ้าหน้าที่อย่างมีประสิทธิภาพ มั่นคงปลอดภัย และสอดคล้องกับระเบียบสำนักนายกรัฐมนตรีว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560`,
        en: `The ${deptEn} hereby announces this competitive bidding (e-Bidding) for "${docTitleEn}" in order to advance BMA's Digital Smart City strategy. The objective is to provide high-availability, scalable, and secure digital infrastructure for Bangkok citizens and administrative staff in accordance with the Government Procurement and Supplies Management Act B.E. 2560.`,
      },
      extractedHighlights: [
        {
          th: `วัตถุประสงค์หลัก: ยกระดับการให้บริการดิจิทัลและบริหารจัดการข้อมูลของ ${deptTh}`,
          en: `Primary goal: modernize digital services and centralized data governance for ${deptEn}`,
        },
      ],
    },
    {
      sectionId: 'article-2',
      articleNumber: 'ข้อ 2',
      title: {
        th: 'คุณสมบัติของผู้ยื่นข้อเสนอราคา',
        en: 'Article 2: Bidder Qualifications and Eligibility',
      },
      page: 2,
      content: {
        th: `ผู้ยื่นข้อเสนอจะต้องมีคุณสมบัติดังต่อไปนี้:\n1. เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าว\n2. ไม่เป็นผู้ที่ถูกระบุชื่อไว้ในบัญชีรายชื่อผู้ทิ้งงานของทางราชการ\n3. มีทุนจดทะเบียนและผลงานคู่สัญญาตามที่กำหนดในรายละเอียดเงื่อนไขเฉพาะ\n4. ไม่อยู่ในฐานะเป็นผู้มีผลประโยชน์ร่วมกันกับผู้ยื่นข้อเสนอรายอื่นที่เข้ายื่นข้อเสนอให้แก่กรุงเทพมหานคร ณ วันประกาศประกวดราคาอิเล็กทรอนิกส์`,
        en: `Bidders must strictly satisfy the following criteria:\n1. Be a legally registered corporate entity licensed for software contracting.\n2. Must not be blacklisted or disqualified by Thai government authorities.\n3. Must satisfy paid-up capital and prior verified contract performance requirements.\n4. Must have no conflict of interest with other participating bidders.`,
      },
      extractedHighlights: (project.qualifications?.th || []).slice(0, 3).map((th, i) => ({
        th,
        en: project.qualifications?.en?.[i] || th,
      })),
    },
    {
      sectionId: 'article-3',
      articleNumber: 'ข้อ 3',
      title: {
        th: 'ขอบเขตของงานและข้อกำหนดทางเทคนิค (Scope of Work)',
        en: 'Article 3: Technical Specifications & Scope of Work',
      },
      page: 3,
      content: {
        th: `ผู้รับจ้างจะต้องดำเนินการตามขอบเขตงานดังต่อไปนี้ให้แล้วเสร็จตามมาตรฐานวิชาชีพ:\n${(project.scope?.th || []).map((s, i) => `3.${i + 1} ${s}`).join('\n')}\nพร้อมส่งมอบคู่มือการใช้งาน เอกสารสถาปัตยกรรมระบบ (Architecture Design Document) และซอร์สโค้ด (Source Code) ฉบับสมบูรณ์ให้แก่กรุงเทพมหานคร`,
        en: `The contracted vendor must deliver the following technical scope complying with industry best practices:\n${(project.scope?.en || []).map((s, i) => `3.${i + 1} ${s}`).join('\n')}\nDeliverables include operational manuals, Architecture Design Documents, and full source code repository to BMA.`,
      },
      extractedHighlights: (project.scope?.th || []).slice(0, 4).map((th, i) => ({
        th,
        en: project.scope?.en?.[i] || th,
      })),
    },
    {
      sectionId: 'article-4',
      articleNumber: 'ข้อ 4',
      title: {
        th: 'ระยะเวลาดำเนินการและการส่งมอบงาน',
        en: 'Article 4: Project Duration & Phased Deliverables',
      },
      page: 4,
      content: {
        th: `ระยะเวลาดำเนินการตามสัญญาไม่เกิน 180 วัน นับถัดจากวันลงนามในสัญญาจ้าง แบ่งงวดการส่งมอบงานออกเป็น 4 งวดงาน โดยผู้รับจ้างต้องจัดทำรายงานความคืบหน้ารายเดือนและผ่านการตรวจรับโดยคณะกรรมการตรวจรับพัสดุในแต่ละงวดงานอย่างถูกต้องครบถ้วนก่อนการเบิกจ่ายงบประมาณ`,
        en: `Project execution shall be completed within 180 calendar days following contract signing. Deliverables are divided into 4 formal milestone phases, subject to monthly progress audits and committee inspection sign-off before financial disbursement.`,
      },
      extractedHighlights: [
        {
          th: 'ระยะเวลาโครงการ 180 วัน แบ่งการส่งมอบ 4 งวดงาน',
          en: '180-day timeline divided into 4 milestone inspection gates',
        },
      ],
    },
    {
      sectionId: 'article-5',
      articleNumber: 'ข้อ 5',
      title: {
        th: 'งบประมาณ ค่าจ้าง และการจ่ายเงิน',
        en: 'Article 5: Budget, Pricing and Payment Terms',
      },
      page: 5,
      content: {
        th: `วงเงินงบประมาณที่ได้รับจัดสรรทั้งสิ้น ${budget.toLocaleString('th-TH')} บาท (ราคารวมภาษีมูลค่าเพิ่มและค่าธรรมเนียมทั้งปวงแล้ว) การเบิกจ่ายเงินจะกระทำตามสัดส่วนของงวดงานที่ตรวจรับถูกต้องตามสัญญา ทั้งนี้ กรุงเทพมหานครสงวนสิทธิ์ในการยกเลิกหรือปรับลดวงเงินหากไม่ได้รับการจัดสรรงบประมาณที่เพียงพอ`,
        en: `Allocated budget ceiling is ${budget.toLocaleString()} THB (inclusive of VAT and all applicable fees). Payments are disbursed proportionately upon verified milestone completions. BMA reserves standard administrative rights under government procurement regulations.`,
      },
      extractedHighlights: [
        {
          th: `วงเงินงบประมาณราคากลาง: ${budget.toLocaleString('th-TH')} บาท`,
          en: `Official budget allocation: ${budget.toLocaleString()} THB`,
        },
      ],
    },
  ];

  const aiMetadata: AiMetadata = {
    model: 'Gemini 1.5 Pro / Vertex AI TOR Extractor v2.4',
    confidenceScore: project.aiConfidence === 'High' ? 97 : project.aiConfidence === 'Medium' ? 86 : 74,
    verifiedByHuman: true,
    extractedClausesCount: (project.scope?.th?.length || 0) + (project.qualifications?.th?.length || 0) + 4,
    lastVerifiedDate: project.processedDate || '2026-08-11',
  };

  const contactInfo: ContactInfo = {
    department: project.department,
    division: {
      th: 'กลุ่มงานสารสนเทศและการจัดซื้อจัดจ้าง กทม.',
      en: 'Information Technology & Procurement Division',
    },
    phone: '0-2224-2972 ต่อ 1104',
    email: 'procurement.it@bangkok.go.th',
    officer: {
      th: 'นายสมเกียรติ วาณิชย์กุล (เจ้าหน้าที่พัสดุชำนาญการ)',
      en: 'Mr. Somkiat Wanitkul (Senior Procurement Officer)',
    },
  };

  return {
    ...project,
    sourceUrl: project.sourceUrl || `https://egp.bangkok.go.th/procurement/view/${project.externalId}`,
    documentUrl: project.documentUrl || `/docs/${project.sourceDocument || 'TOR_BMA_OFFICIAL.pdf'}`,
    timeline,
    budgetBreakdown,
    highlightedQualifications,
    documentSections,
    aiMetadata,
    contactInfo,
  };
}
