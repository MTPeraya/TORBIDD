#!/usr/bin/env ts-node
// =============================================================================
// scripts/enrich-db-from-govspending.ts - Enrich MongoDB Records with Real Data
// Fetches real announcement dates, transaction dates, winners, and timelines
// from opend.data.go.th and updates all documents in MongoDB Atlas.
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import connectToDatabase from '../src/lib/mongodb';
import ProcurementProject from '../src/models/ProcurementProject';
import { parseToIsoDate } from '../src/services/transformation/normalizers/date-normalizer';

async function main() {
  console.log('🔄 Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('✓ Connected to MongoDB Atlas.');

  const totalInDb = await ProcurementProject.countDocuments();
  console.log(`Current records in database: ${totalInDb}`);

  const apiKey = process.env.GOVSPENDING_API_KEY;
  if (!apiKey) {
    throw new Error('GOVSPENDING_API_KEY is not defined in environment');
  }

  // Fetch all software projects for year 2569 from GovSpending (which has 757 records)
  console.log('📡 Fetching accurate data from opend.data.go.th for year 2569...');
  const govRecords: any[] = [];

  for (const offset of [0, 500]) {
    const url = `https://opend.data.go.th/govspending/service/egp-contract?api-key=${apiKey}&year=2569&keyword=ซอฟต์แวร์&offset=${offset}&limit=500`;
    console.log(`  Fetching offset ${offset}...`);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn(`  Failed at offset ${offset}: HTTP ${res.status}`);
      continue;
    }
    const json = (await res.json()) as any;
    if (json.data && Array.isArray(json.data)) {
      govRecords.push(...json.data);
      console.log(`  Retrieved ${json.data.length} records.`);
    }
  }

  console.log(`Total GovSpending records retrieved: ${govRecords.length}`);

  // Create a lookup map by project_id
  const govMap = new Map<string, any>();
  for (const item of govRecords) {
    if (item.project_id) {
      govMap.set(item.project_id.trim(), item);
    }
  }

  // Update existing MongoDB records with real data
  const existingDocs = await ProcurementProject.find({}).lean();
  console.log(`Processing ${existingDocs.length} database records for enrichment...`);

  let updatedCount = 0;
  const bulkOps: any[] = [];

  for (const doc of existingDocs) {
    const extId = doc.externalProjectId?.trim();
    if (!extId) continue;

    const govItem = govMap.get(extId);

    // Determine correct fiscal year from 11-digit project ID prefix
    let fiscalYear = doc.fiscalYear;
    if (/^\d{11}$/.test(extId)) {
      const prefix = parseInt(extId.substring(0, 2), 10);
      if (prefix >= 60 && prefix <= 75) {
        fiscalYear = 2500 + prefix;
      }
    }

    const updateFields: Record<string, any> = {
      fiscalYear,
    };

    if (govItem) {
      // 1. Real announcement date
      const rawAnnounce = govItem.announce_date && govItem.announce_date !== '-' ? govItem.announce_date.trim() : null;
      const publishDateIso = rawAnnounce ? parseToIsoDate(rawAnnounce) : null;

      // 2. Real transaction / contract date
      const rawTx = govItem.transaction_date && govItem.transaction_date !== '-' ? govItem.transaction_date.trim() : null;
      const txDateIso = rawTx ? parseToIsoDate(rawTx) : null;

      // 3. Contracts
      const contracts = Array.isArray(govItem.contract) ? govItem.contract : [];
      const primaryContract = contracts.length > 0 ? contracts[0] : null;

      const rawContractDate = primaryContract?.contract_date && primaryContract.contract_date !== '-'
        ? primaryContract.contract_date.trim()
        : null;
      const contractDateIso = rawContractDate ? parseToIsoDate(rawContractDate) : txDateIso;

      const rawFinishDate = primaryContract?.contract_finish_date && primaryContract.contract_finish_date !== '-'
        ? primaryContract.contract_finish_date.trim()
        : null;
      const contractFinishDateIso = rawFinishDate ? parseToIsoDate(rawFinishDate) : null;

      const winnerName = primaryContract?.winner_name ? primaryContract.winner_name.trim() : undefined;

      // Real status
      const status = govItem.project_status || (govItem.sum_price_agree ? 'จัดทำสัญญาแล้ว' : 'ประกาศเชิญชวน');

      // Real procurement method
      const procurementType =
        govItem.purchase_method_name ||
        govItem.transaction_sub_type_name ||
        govItem.project_type_name ||
        doc.procurementType;

      // Real median price
      const medianPrice = govItem.price_build && govItem.price_build > 0 ? govItem.price_build : undefined;

      // Build real verified timeline milestones
      const timeline: any[] = [];

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
        updateFields.publishDate = new Date(publishDateIso);
      } else if (contractDateIso) {
        // If specific method (no public announcement), use contract date as publish date
        updateFields.publishDate = new Date(contractDateIso);
      }

      if (contractDateIso) {
        timeline.push({
          id: 'contract-award',
          event: {
            th: 'ลงนามสัญญา / ประกาศผลผู้ชนะ',
            en: 'Contract Award & Signing',
          },
          date: contractDateIso,
          description: {
            th: winnerName ? `ผู้ชนะการเสนอราคา: ${winnerName}` : 'ลงนามสัญญาเรียบร้อยแล้ว',
            en: winnerName ? `Contract Awardee: ${winnerName}` : 'Contract awarded and executed',
          },
          status: 'completed',
        });
        updateFields.contractDate = new Date(contractDateIso);
      }

      if (contractFinishDateIso) {
        const daysToFinish = (new Date(contractFinishDateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        timeline.push({
          id: 'contract-finish',
          event: {
            th: 'กำหนดสิ้นสุดสัญญา / ส่งมอบงานงวดสุดท้าย',
            en: 'Contract Completion & Final Delivery',
          },
          date: contractFinishDateIso,
          description: {
            th: 'กำหนดสิ้นสุดสัญญาตามข้อตกลงจัดซื้อจัดจ้าง',
            en: 'Scheduled contract completion date',
          },
          status: daysToFinish < 0 ? 'completed' : 'upcoming',
        });
        updateFields.contractFinishDate = new Date(contractFinishDateIso);
      }

      updateFields.status = status;
      updateFields.procurementType = procurementType;
      if (winnerName) updateFields.winnerName = winnerName;
      if (medianPrice) updateFields.medianPrice = medianPrice;
      if (timeline.length > 0) updateFields.timeline = timeline;
      updateFields.rawPayload = govItem;
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: updateFields },
      },
    });

    if (bulkOps.length >= 100) {
      await ProcurementProject.bulkWrite(bulkOps);
      updatedCount += bulkOps.length;
      console.log(`  Updated ${updatedCount} records...`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await ProcurementProject.bulkWrite(bulkOps);
    updatedCount += bulkOps.length;
    console.log(`  Updated ${updatedCount} records.`);
  }

  console.log('====================================================');
  console.log(`✓ Database enrichment complete: ${updatedCount} records updated with real data.`);
  
  // Sample 3 updated records to verify
  const samples = await ProcurementProject.find({ publishDate: { $exists: true } }).limit(3).lean();
  console.log('\n--- Sample Enriched Records in MongoDB ---');
  for (const s of samples) {
    console.log(`Project: ${s.externalProjectId} - ${s.projectName.substring(0, 35)}...`);
    console.log(`  Fiscal Year: ${s.fiscalYear}`);
    console.log(`  Publish Date: ${s.publishDate?.toISOString()}`);
    console.log(`  Status: ${s.status}`);
    console.log(`  Winner: ${s.winnerName || 'N/A'}`);
    console.log(`  Timeline Milestones: ${s.timeline?.length || 0}`);
  }
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Enrichment failed:', err);
  process.exit(1);
});
