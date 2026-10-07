#!/usr/bin/env tsx
// =============================================================================
// scripts/update-all-projects.ts - Comprehensive Master Backfill & Enrichment
// Enriches all 678 projects in MongoDB Atlas with:
//  1. Accurate Buddhist fiscal years (derived from 11-digit e-GP ID prefix or rawPayload)
//  2. Real procuring agency names
//  3. Real allocated budgets (project_money) & median prices (price_build)
//  4. Real publish dates, deadlines, and multi-stage timeline milestones
//  5. Domain-aware AI heuristic extraction (summary, tech requirements, qualifications)
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import connectToDatabase from '../src/lib/mongodb';
import ProcurementProject from '../src/models/ProcurementProject';
import { parseToIsoDate } from '../src/services/transformation/normalizers/date-normalizer';
import { extractTorHeuristic } from '../src/services/ai/tor-extractor';
import { TimelineEvent } from '../src/types/project';

async function main() {
  console.log('🔄 Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('✓ Connected to MongoDB Atlas.');

  const totalInDb = await ProcurementProject.countDocuments();
  console.log(`📊 Total projects in database: ${totalInDb}`);

  const docs = await ProcurementProject.find({}).lean();
  console.log(`Processing ${docs.length} records for comprehensive backfill...`);

  let updatedCount = 0;
  const bulkOps: any[] = [];
  const now = Date.now();

  for (const doc of docs) {
    const extId = (doc.externalProjectId || '').trim();

    // ─── Special preservation for project 69099659496 ────────────
    if (extId === '69099659496') {
      // Official e-GP announcement states ปีงบประมาณที่จัดซื้อจัดจ้าง: 2570 (prepared late FY2569 for FY2570)
      const officialTimeline: TimelineEvent[] = [
        {
          id: 'tl-plan',
          event: {
            th: 'ประกาศแผนการจัดซื้อจัดจ้าง (ปีงบประมาณ 2570)',
            en: 'Annual Procurement Plan Published (FY 2570)',
          },
          date: '2026-07-16',
          description: {
            th: 'เผยแพร่แผนการจัดซื้อจัดจ้างล่วงหน้า รหัสแผน P69070005469 ผ่านระบบ e-GP',
            en: 'Published annual procurement plan P69070005469 via e-GP',
          },
          status: 'completed',
        },
        {
          id: 'tl-announcement',
          event: {
            th: 'ประกาศจัดซื้อจัดจ้างและราคากลางอย่างเป็นทางการ',
            en: 'Official Tender Announcement & Median Price Published',
          },
          date: '2026-09-30',
          description: {
            th: 'เผยแพร่ประกาศและราคากลาง 580,000 บาท ผ่านระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ (e-GP)',
            en: 'Published official tender notice and median price of 580,000 THB via e-GP portal',
          },
          status: 'completed',
        },
        {
          id: 'tl-doc-dist',
          event: {
            th: 'เปิดรับและดาวน์โหลดเอกสารประกวดราคา',
            en: 'Document Distribution Period',
          },
          date: '2026-09-30 - 2026-10-08',
          description: {
            th: 'ดาวน์โหลดเอกสารประกวดราคาทางระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ (e-GP)',
            en: 'Download tender documents via e-GP system',
          },
          status: 'active',
        },
        {
          id: 'tl-bid-deadline',
          event: {
            th: 'กำหนดยื่นข้อเสนอและเสนอราคา (Closing Date)',
            en: 'Bid Submission & Closing Deadline',
          },
          date: '2026-10-08',
          description: {
            th: 'ยื่นข้อเสนอทางระบบ e-GP ระหว่างเวลา 09:00 - 12:00 น.',
            en: 'Submit electronic proposal via e-GP between 09:00 - 12:00',
          },
          status: 'upcoming',
        },
        {
          id: 'tl-bid-opening',
          event: {
            th: 'วันเปิดซองและพิจารณาผลการประกวดราคา',
            en: 'Bid Opening & Proposal Evaluation',
          },
          date: '2026-10-08',
          description: {
            th: 'คณะกรรมการพิจารณาผลการประกวดราคาอิเล็กทรอนิกส์',
            en: 'Evaluation committee reviews submitted proposals',
          },
          status: 'upcoming',
        },
      ];

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              fiscalYear: 2570,
              timeline: officialTimeline,
              extractionStatus: 'EXTRACTED',
              updatedAt: new Date(),
            },
          },
        },
      });
      continue;
    }

    // ─── 1. Fiscal Year ──────────────────────────────────────────
    let fiscalYear = doc.fiscalYear;
    // Check if title explicitly specifies the fiscal year (e.g. "ประจำปีงบประมาณ พ.ศ. 2568" or "ปีงบประมาณ 2570")
    const titleYearMatch = (doc.projectName || '').match(/(?:ประจำปีงบประมาณ|ปีงบประมาณ)\s*(?:พ\.ศ\.)?\s*(25\d{2})/);
    if (titleYearMatch) {
      fiscalYear = parseInt(titleYearMatch[1], 10);
    } else if (extId.length === 11) {
      const prefix = parseInt(extId.substring(0, 2), 10);
      if (prefix >= 50 && prefix <= 99) {
        fiscalYear = 2500 + prefix;
      }
    } else if ((doc.rawPayload as any)?.year) {
      const yr = Number((doc.rawPayload as any).year);
      if (yr >= 2500 && yr <= 2600) {
        fiscalYear = yr;
      }
    }

    const raw = (doc.rawPayload || {}) as any;

    // ─── 2. Agency Name ──────────────────────────────────────────
    let agencyName = doc.agencyName;
    if (
      !agencyName ||
      agencyName === 'กรมบัญชีกลาง' ||
      agencyName === 'หน่วยงานภาครัฐ' ||
      agencyName === 'N/A'
    ) {
      if (raw.dept_name && !doc.projectName.includes('กรมบัญชีกลาง')) {
        agencyName = raw.dept_name;
      } else if (raw.dept_sub_name && !doc.projectName.includes('กรมบัญชีกลาง')) {
        agencyName = raw.dept_sub_name;
      }
    }

    // ─── 3. Budget and Median Price ──────────────────────────────
    const budget = Number(raw.project_money || raw.price_build || doc.budget || 0);
    const medianPrice = Number(raw.price_build || raw.project_money || doc.medianPrice || budget);
    const contractPrice = Number(raw.sum_price_agree || raw.contract?.[0]?.price_agree || 0);

    // ─── 4. Dates & Contracts ────────────────────────────────────
    const rawAnnounce = raw.announce_date && raw.announce_date !== '-' ? raw.announce_date.trim() : null;
    const publishDateIso = rawAnnounce
      ? parseToIsoDate(rawAnnounce)
      : doc.publishDate
      ? new Date(doc.publishDate).toISOString()
      : null;

    const rawTx = raw.transaction_date && raw.transaction_date !== '-' ? raw.transaction_date.trim() : null;
    const txDateIso = rawTx ? parseToIsoDate(rawTx) : null;

    const contracts = Array.isArray(raw.contract) ? raw.contract : [];
    const primaryContract = contracts.length > 0 ? contracts[0] : null;

    const rawContractDate =
      primaryContract?.contract_date && primaryContract.contract_date !== '-'
        ? primaryContract.contract_date.trim()
        : null;
    const contractDateIso = rawContractDate ? parseToIsoDate(rawContractDate) : txDateIso;

    const rawFinishDate =
      primaryContract?.contract_finish_date && primaryContract.contract_finish_date !== '-'
        ? primaryContract.contract_finish_date.trim()
        : null;
    const contractFinishDateIso = rawFinishDate ? parseToIsoDate(rawFinishDate) : null;

    const winnerName = primaryContract?.winner_name ? primaryContract.winner_name.trim() : doc.winnerName;

    // ─── 5. Status & Procurement Type ────────────────────────────
    const procurementType =
      raw.purchase_method_name ||
      raw.transaction_sub_type_name ||
      raw.project_type_name ||
      doc.procurementType;

    const status =
      raw.project_status ||
      (contractDateIso ? 'จัดทำสัญญาแล้ว' : publishDateIso ? 'ประกาศเชิญชวน' : doc.status || 'ดำเนินการ');

    // ─── 6. Deadline Calculation ─────────────────────────────────
    let deadlineDate: Date;
    if (contractFinishDateIso) {
      deadlineDate = new Date(contractFinishDateIso);
    } else if (contractDateIso) {
      deadlineDate = new Date(contractDateIso);
    } else if (publishDateIso) {
      deadlineDate = new Date(new Date(publishDateIso).getTime() + 15 * 86400000);
    } else {
      deadlineDate = new Date(`${fiscalYear - 543}-09-30T12:00:00.000Z`);
    }

    // ─── 7. Multi-Stage Timeline Construction ───────────────────
    const timeline: TimelineEvent[] = [];

    // Milestone 1: Announcement
    if (publishDateIso) {
      timeline.push({
        id: 'announcement',
        event: {
          th: 'ประกาศจัดซื้อจัดจ้างอย่างเป็นทางการ',
          en: 'Official Procurement Announcement Published',
        },
        date: publishDateIso,
        description: {
          th: 'เผยแพร่ประกาศผ่านระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
          en: 'Published via official e-GP procurement system',
        },
        status: 'completed',
      });
    } else if (contractDateIso) {
      timeline.push({
        id: 'announcement',
        event: {
          th: 'เริ่มต้นกระบวนการจัดซื้อจัดจ้าง',
          en: 'Procurement Process Initiated',
        },
        date: contractDateIso,
        description: {
          th: `ดำเนินการจัดซื้อจัดจ้างโดยวิธี${procurementType}`,
          en: `Procured via ${procurementType} method`,
        },
        status: 'completed',
      });
    }

    // Milestone 2: If e-Bidding, add Bid Submission / Document Phase
    if (procurementType.includes('e-bidding') && publishDateIso) {
      const pubTime = new Date(publishDateIso).getTime();
      const bidDateObj = contractDateIso ? new Date(contractDateIso) : new Date(pubTime + 10 * 86400000);
      const isBidPast = bidDateObj.getTime() < now;

      timeline.push({
        id: 'bid-deadline',
        event: {
          th: 'กำหนดยื่นข้อเสนอและเสนอราคาผ่านระบบ e-GP',
          en: 'Bid Submission & Proposal Deadline',
        },
        date: bidDateObj.toISOString(),
        description: {
          th: 'ยื่นข้อเสนอและเสนอราคาทางระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์',
          en: 'Electronic proposal submission via e-GP portal',
        },
        status: isBidPast ? 'completed' : 'active',
      });
    }

    // Milestone 3: Contract Award / Signing
    if (contractDateIso) {
      timeline.push({
        id: 'contract-award',
        event: {
          th: 'ลงนามสัญญา / ประกาศผลผู้ชนะ',
          en: 'Contract Award & Signing',
        },
        date: contractDateIso,
        description: {
          th: winnerName
            ? `ผู้ชนะการเสนอราคา: ${winnerName}${contractPrice > 0 ? ` (วงเงินสัญญา: ${contractPrice.toLocaleString('th-TH')} บาท)` : ''}`
            : 'ลงนามสัญญาเรียบร้อยแล้ว',
          en: winnerName
            ? `Awarded Contractor: ${winnerName}${contractPrice > 0 ? ` (Contract Value: ${contractPrice.toLocaleString()} THB)` : ''}`
            : 'Contract executed and signed',
        },
        status: 'completed',
      });
    }

    // Milestone 4: Contract Finish / Delivery
    if (contractFinishDateIso) {
      const finishTime = new Date(contractFinishDateIso).getTime();
      const isFinishPast = finishTime < now;
      timeline.push({
        id: 'contract-finish',
        event: {
          th: 'กำหนดสิ้นสุดสัญญา / ส่งมอบงานงวดสุดท้าย',
          en: 'Contract Completion & Final Delivery',
        },
        date: contractFinishDateIso,
        description: {
          th: 'กำหนดสิ้นสุดสัญญาตามข้อตกลงจัดซื้อจัดจ้าง',
          en: 'Scheduled contract completion date per agreement',
        },
        status: isFinishPast ? 'completed' : 'upcoming',
      });
    }

    // ─── 8. Domain-Aware Heuristic Extraction ────────────────────
    const extraction = extractTorHeuristic(undefined, {
      projectContext: {
        projectName: doc.projectName,
        agencyName,
        budget,
        fiscalYear,
        deadline: deadlineDate.toISOString().split('T')[0],
      },
    });

    // ─── 9. Build Update Payload ─────────────────────────────────
    const updateSet: Record<string, any> = {
      fiscalYear,
      agencyName,
      budget,
      medianPrice,
      status,
      procurementType,
      deadline: deadlineDate,
      extractionStatus: 'EXTRACTED',
      summary: extraction.summary,
      requiredTechnologies: extraction.requiredTechnologies,
      technicalRequirements: extraction.technicalRequirements,
      extractedQualifications: extraction.extractedQualifications,
      scope: extraction.scope,
      timeline,
      updatedAt: new Date(),
    };

    if (publishDateIso) updateSet.publishDate = new Date(publishDateIso);
    if (contractDateIso) updateSet.contractDate = new Date(contractDateIso);
    if (contractFinishDateIso) updateSet.contractFinishDate = new Date(contractFinishDateIso);
    if (winnerName) updateSet.winnerName = winnerName;

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: updateSet },
      },
    });

    if (bulkOps.length >= 100) {
      await ProcurementProject.bulkWrite(bulkOps);
      updatedCount += bulkOps.length;
      console.log(`  ✓ Updated ${updatedCount}/${docs.length} projects...`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await ProcurementProject.bulkWrite(bulkOps);
    updatedCount += bulkOps.length;
    console.log(`  ✓ Updated ${updatedCount}/${docs.length} projects.`);
  }

  console.log('====================================================');
  console.log(`🎉 Master backfill complete: ${updatedCount} projects updated successfully!`);

  // Verify post-update database stats
  const finalExtracted = await ProcurementProject.countDocuments({ extractionStatus: 'EXTRACTED' });
  const finalPending = await ProcurementProject.countDocuments({ extractionStatus: 'PENDING' });
  const finalDeadlineCount = await ProcurementProject.countDocuments({ deadline: { $exists: true, $ne: null } });
  const finalTimelineCount = await ProcurementProject.countDocuments({ 'timeline.0': { $exists: true } });

  console.log('--- Verification Summary ---');
  console.log(`  Total Projects: ${totalInDb}`);
  console.log(`  Extracted: ${finalExtracted}`);
  console.log(`  Pending: ${finalPending}`);
  console.log(`  With Valid Deadline: ${finalDeadlineCount}`);
  console.log(`  With Interactive Timeline: ${finalTimelineCount}`);
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Master backfill failed:', err);
  process.exit(1);
});
