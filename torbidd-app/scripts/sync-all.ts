#!/usr/bin/env ts-node
// =============================================================================
// scripts/sync-all.ts - Sync All Real Thai Government Procurement Records
// Fetches from opend.data.go.th, egp2.bangkok.go.th, and gprocurement.go.th,
// classifies each as software via UC-10, and saves all to MongoDB Atlas.
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import connectToDatabase from '../src/lib/mongodb';
import { IngestionService } from '../src/services/ingestion/ingestion.service';
import ProcurementProject from '../src/models/ProcurementProject';

async function main() {
  console.log('🔄 Starting Full Real Government Data Ingestion...');
  console.log('Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('✓ Connected to MongoDB Atlas successfully.');

  const beforeCount = await ProcurementProject.countDocuments();
  console.log(`Current records in database: ${beforeCount}`);

  const service = new IngestionService();

  console.log('📡 Calling Thai Government Data APIs (data.go.th, egp2.bangkok.go.th, gprocurement.go.th)...');
  console.log('Requesting up to 1000 real procurement records...');

  const result = await service.discoverFromAllSources({
    keyword: 'ซอฟต์แวร์',
    limit: 1000,
  });

  console.log('====================================================');
  console.log(`✓ Fetched Total: ${result.totalProjects} real projects`);
  console.log(`  - CKAN (data.go.th): ${result.bySource.CKAN_GOVSPENDING}`);
  console.log(`  - BMA (egp2.bangkok.go.th): ${result.bySource.BMA_EGP}`);
  console.log(`  - e-GP (gprocurement.go.th): ${result.bySource.NATIONAL_EGP}`);
  console.log(`✓ Upserted to MongoDB: ${result.upsertedCount} new records`);
  console.log(`✓ Updated existing: ${result.modifiedCount} records`);

  const afterCount = await ProcurementProject.countDocuments();
  console.log(`📊 Total real procurement records in database now: ${afterCount}`);
  console.log('====================================================');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
