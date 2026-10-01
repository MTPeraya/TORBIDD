#!/usr/bin/env tsx
// =============================================================================
// scripts/reclassify-and-clean.ts
// 1. Re-classify all existing DB records with the improved keyword classifier
// 2. Delete non-software projects (is_software=false)
// 3. Re-sync all sources to fetch fresh software-only data
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import connectToDatabase from '../src/lib/mongodb';
import ProcurementProject from '../src/models/ProcurementProject';
import { classifyByKeywords } from '../src/services/ai/adapters/keyword-adapter';
import { IngestionService } from '../src/services/ingestion/ingestion.service';

async function main() {
  console.log('🔄 Starting re-classification and database cleanup...');
  await connectToDatabase();

  // ── Step 1: Re-classify all existing records ──────────────────────────────
  const before = await ProcurementProject.countDocuments();
  console.log(`\n📊 Current records: ${before}`);

  console.log('\n🔍 Step 1: Re-classify all records with improved keyword classifier...');
  const allDocs = await ProcurementProject.find().lean();
  let updated = 0;
  let markedNonSoftware = 0;

  const bulkOps = [];
  for (const doc of allDocs) {
    const result = classifyByKeywords(
      doc.projectName || '',
      doc.projectName || '',
    );

    // Update if classification, category, or reasoning changed
    if (
      result.isSoftwareRelated !== doc.is_software ||
      result.category !== doc.software_category ||
      result.reasoning !== doc.classification_reason
    ) {
      if (!result.isSoftwareRelated) markedNonSoftware++;
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              is_software: result.isSoftwareRelated,
              software_category: result.category,
              ai_confidence: result.confidence,
              classification_reason: result.reasoning,
              classified_by: 'rule' as const,
              classified_at: new Date(),
            },
          },
        },
      });
      updated++;
    }
  }

  if (bulkOps.length > 0) {
    await ProcurementProject.bulkWrite(bulkOps);
    console.log(`  ✓ Updated classification for ${updated} records`);
    console.log(`  ✓ Marked ${markedNonSoftware} new non-software records`);
  } else {
    console.log('  ✓ No classification changes needed');
  }

  // ── Step 2: Count and delete non-software records ─────────────────────────
  console.log('\n🗑️  Step 2: Removing non-software projects from database...');
  const nonSwCount = await ProcurementProject.countDocuments({ is_software: false });
  console.log(`  Found ${nonSwCount} non-software records to delete.`);

  if (nonSwCount > 0) {
    // Log what's being deleted
    const nonSwSample = await ProcurementProject.find({ is_software: false }).limit(20).lean();
    console.log('  Non-software projects being deleted:');
    for (const p of nonSwSample) {
      console.log(`    - [${p.source}] ${p.projectName.slice(0, 60)}`);
    }
    if (nonSwCount > 20) console.log(`    ... and ${nonSwCount - 20} more`);

    const deleteResult = await ProcurementProject.deleteMany({ is_software: false });
    console.log(`  ✓ Deleted ${deleteResult.deletedCount} non-software records.`);
  }

  const afterClean = await ProcurementProject.countDocuments();
  console.log(`\n📊 Records after cleanup: ${afterClean}`);

  // ── Step 3: Re-sync all sources (only software-related will be stored) ────
  console.log('\n📡 Step 3: Re-syncing all sources (only software projects will be stored)...');
  const service = new IngestionService();

  const result = await service.discoverFromAllSources({
    keyword: 'ซอฟต์แวร์',
    limit: 1000,
  });

  console.log('\n====================================================');
  console.log(`✓ Fetched from APIs: ${result.totalProjects + (result.projects.length)} projects`);
  console.log(`  - Software-only stored: ${result.totalProjects}`);
  console.log(`  - CKAN: ${result.bySource.CKAN_GOVSPENDING}`);
  console.log(`  - BMA:  ${result.bySource.BMA_EGP}`);
  console.log(`  - e-GP: ${result.bySource.NATIONAL_EGP}`);
  console.log(`  - New upserts: ${result.upsertedCount}`);
  console.log(`  - Updated:     ${result.modifiedCount}`);

  const finalCount = await ProcurementProject.countDocuments();
  const swTrue = await ProcurementProject.countDocuments({ is_software: true });
  const swFalse = await ProcurementProject.countDocuments({ is_software: false });
  const budgetZero = await ProcurementProject.countDocuments({ is_software: true, budget: 0 });

  console.log('\n====================================================');
  console.log(`📊 Final database state:`);
  console.log(`  Total records:          ${finalCount}`);
  console.log(`  is_software=true:       ${swTrue}`);
  console.log(`  is_software=false:      ${swFalse}  ← should be 0`);
  console.log(`  software with budget=0: ${budgetZero}`);

  // Sample output
  const samples = await ProcurementProject.find({ is_software: true, budget: { $gt: 0 } }).limit(5).lean();
  console.log('\n  Sample software records with budget:');
  for (const p of samples) {
    console.log(`    [${p.source}] ${p.projectName.slice(0, 55)} | ฿${p.budget?.toLocaleString()}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Reclassify failed:', err);
  process.exit(1);
});
