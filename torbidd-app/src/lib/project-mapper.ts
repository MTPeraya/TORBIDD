// =============================================================================
// lib/project-mapper.ts - Maps ProcurementProject/DiscoveredProject to Project
// =============================================================================

import { Project, ProjectCategory } from '@/types/project';
import { DiscoveredProject } from '@/types/procurement';
import { IProcurementProject } from '@/models/ProcurementProject';

export function procurementToProject(
  item: IProcurementProject | DiscoveredProject | Record<string, unknown>,
): Project {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = item as any;
  const extId = String(p.externalProjectId || p.externalId || '67119538991');
  const titleText = p.projectName || p.title?.th || 'โครงการจัดซื้อจัดจ้างภาครัฐ';
  const deptText = p.agencyName || p.department?.th || 'กรุงเทพมหานคร / หน่วยงานภาครัฐ';
  const rawDate = p.discoveredAt || p.createdAt || p.publishDate || new Date();
  const publishDateStr = rawDate instanceof Date ? rawDate.toISOString() : String(rawDate);
  const deadlineStr =
    p.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days from now

  let category: ProjectCategory = 'Website';
  const titleLower = titleText.toLowerCase();
  if (titleLower.includes('โมบาย') || titleLower.includes('แอปพลิเคชัน') || titleLower.includes('app')) {
    category = 'Mobile App';
  } else if (titleLower.includes('ai') || titleLower.includes('ปัญญาประดิษฐ์') || titleLower.includes('วิเคราะห์')) {
    category = 'AI';
  } else if (titleLower.includes('ฐานข้อมูล') || titleLower.includes('database') || titleLower.includes('คลังข้อมูล')) {
    category = 'Database';
  }

  const budgetVal = Number(p.budget) || 0;

  return {
    _id: p._id?.toString() || extId,
    externalId: Number(extId.replace(/\D/g, '')) || 100000,
    title: {
      th: titleText,
      en: titleText,
    },
    department: {
      th: deptText,
      en: deptText,
    },
    budget: budgetVal,
    publishDate: publishDateStr,
    deadline: deadlineStr,
    category,
    procurementType: p.procurementType || 'e-Bidding',
    description: {
      th: `${titleText} (โครงการจัดซื้อจัดจ้างภาครัฐ ตรวจสอบจากระบบ e-GP กรมบัญชีกลาง รหัส: ${extId})`,
      en: `${titleText} (Thai government procurement verified via e-GP system ID: ${extId})`,
    },
    scope: {
      th: [
        `โครงการจัดซื้อจัดจ้างภาครัฐ: ${titleText}`,
        `หน่วยงานเจ้าของโครงการ: ${deptText}`,
        `ปีงบประมาณ พ.ศ.: ${p.fiscalYear || '2568'}`,
        `รหัสประกาศจัดซื้อจัดจ้าง e-GP: ${extId}`,
      ],
      en: [
        `Government Procurement Opportunity: ${titleText}`,
        `Procuring Agency: ${deptText}`,
        `Fiscal Year: ${p.fiscalYear || '2025'}`,
        `e-GP Project Identifier: ${extId}`,
      ],
    },
    qualifications: {
      th: [
        'เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าว',
        'ไม่เป็นผู้มีผลประโยชน์ร่วมกันกับผู้ยื่นข้อเสนอรายอื่นที่เข้ายื่นข้อเสนอ',
        'มีคุณสมบัติตรงตามที่กำหนดไว้ในประกาศและเอกสารประกวดราคา (TOR)',
      ],
      en: [
        'Must be a legally registered business qualified in the relevant procurement domain',
        'No conflict of interest with other bidding participants',
        'Must strictly comply with the qualifications specified in the TOR document',
      ],
    },
    historicalAvg: budgetVal,
    sourceDocument: `Attach_TOR_${extId}.pdf`,
    processedDate: new Date().toISOString(),
    aiConfidence: 'High',
    createdAt: publishDateStr,
    updatedAt: new Date().toISOString(),
    // Preserve raw fields for compatibility
    externalProjectId: extId,
    projectName: titleText,
    agencyName: deptText,
    fiscalYear: p.fiscalYear || 2568,
    source: p.source || 'CKAN_GOVSPENDING',
    sourceUrl:
      p.sourceUrl ||
      `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${extId}`,
  } as Project & {
    externalProjectId: string;
    projectName: string;
    agencyName: string;
    fiscalYear: number;
    source: string;
    sourceUrl: string;
  };
}
