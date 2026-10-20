#!/usr/bin/env ts-node
// =============================================================================
// scripts/sync-bma.ts - Extract Real BMA e-Procurement (egp2.bangkok.go.th) Data
// Connects to Bangkok e-GP public API, retrieves projects, announcements,
// TOR document links, and signed contracts, then saves to MongoDB Atlas.
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import connectToDatabase from '../src/lib/mongodb';
import { BmaClient, BMA_ANNOUNCE_TYPES } from '../src/services/ingestion/clients/bma-client';
import { upsertDiscoveredProjects } from '../src/services/database/procurement';
import { classifyByKeywords } from '../src/services/ai/classifier';
import ProcurementProject from '../src/models/ProcurementProject';
import { DiscoveredProject } from '../src/types/procurement';

const IT_SEARCH_KEYWORDS = ['ซอฟต์แวร์', 'ระบบ', 'คอมพิวเตอร์', 'สารสนเทศ', 'โปรแกรม'];

async function main() {
  console.log('🏛️ =====================================================');
  console.log('🏛️ Starting BMA e-Procurement (egp2.bangkok.go.th) Extraction');
  console.log('🏛️ =====================================================\n');

  console.log('Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('✓ Connected to MongoDB Atlas successfully.');

  const beforeCount = await ProcurementProject.countDocuments();
  console.log(`Current records in database: ${beforeCount}`);

  const client = new BmaClient();

  // 1. Health check
  console.log('\n📡 Checking connectivity to egp2.bangkok.go.th...');
  const health = await client.checkHealth();
  console.log(`   Health Status: ${health.status} (${health.latencyMs}ms)`);
  if (health.status !== 'UP') {
    console.warn('⚠️ Warning: egp2.bangkok.go.th health check did not return UP status.');
  }

  // 2. Discover projects across announcement stages and keywords
  const discoveredMap = new Map<string, DiscoveredProject>();

  console.log('\n🔍 Discovering projects from Bangkok e-GP REST API...');

  const stagesToQuery = [
    { name: 'ประกาศเชิญชวน (Tender Invitations)', typeId: BMA_ANNOUNCE_TYPES.INVITATION.id },
    { name: 'ร่างขอบเขตของงาน TOR (Drafts)', typeId: BMA_ANNOUNCE_TYPES.TOR_DRAFT.id },
    { name: 'ประกาศผู้ชนะ (Award Notices)', typeId: BMA_ANNOUNCE_TYPES.AWARD.id },
  ];

  for (const stage of stagesToQuery) {
    console.log(`\n📋 Querying Stage: ${stage.name}`);
    for (const kw of IT_SEARCH_KEYWORDS) {
      process.stdout.write(`   Searching keyword "${kw}"... `);
      try {
        const res = await client.searchProjects({
          keyword: kw,
          announceTypeId: stage.typeId,
          limit: 50,
          page: 1,
        });

        let added = 0;
        for (const proj of res.projects) {
          if (!discoveredMap.has(proj.externalProjectId)) {
            discoveredMap.set(proj.externalProjectId, proj);
            added++;
          }
        }
        console.log(`found ${res.total} total (added ${added} new unique)`);
      } catch (err) {
        console.log(`failed: ${(err as Error).message}`);
      }
    }
  }

  const allDiscovered = Array.from(discoveredMap.values());
  console.log(`\n✓ Total unique BMA projects collected: ${allDiscovered.length}`);

  if (allDiscovered.length === 0) {
    console.log('No projects discovered. Exiting.');
    process.exit(0);
  }

  // 3. Classify each project with UC-10 Software Classifier first
  console.log('\n🤖 Classifying projects (software vs non-software)...');
  const candidateSoftwareProjects: DiscoveredProject[] = [];

  for (const proj of allDiscovered) {
    const classification = classifyByKeywords(proj.projectName, proj.projectName);
    proj.is_software = classification.isSoftwareRelated;
    proj.software_category = classification.category;
    proj.ai_confidence = classification.confidence;
    proj.classification_reason = classification.reasoning;
    proj.classified_by = 'rule';
    proj.classified_at = new Date();

    if (proj.is_software) {
      candidateSoftwareProjects.push(proj);
    }
  }

  console.log(`✓ Classified: ${candidateSoftwareProjects.length} software projects identified`);
  console.log(`  Filtered out: ${allDiscovered.length - candidateSoftwareProjects.length} non-software tenders (civil works, cleaning, etc.)`);

  // 4. Enrich software projects with TOR documents, details, and contracts
  console.log(`\n📑 Enriching ${candidateSoftwareProjects.length} software projects with TOR documents and contracts...`);
  const enrichedSoftwareProjects: DiscoveredProject[] = [];

  const BATCH_SIZE = 8;
  for (let i = 0; i < candidateSoftwareProjects.length; i += BATCH_SIZE) {
    const chunk = candidateSoftwareProjects.slice(i, i + BATCH_SIZE);
    const enrichedChunk = await Promise.all(
      chunk.map((p) => client.enrichProject(p)),
    );
    enrichedSoftwareProjects.push(...enrichedChunk);
    process.stdout.write(`\r   Enriched ${Math.min(i + BATCH_SIZE, candidateSoftwareProjects.length)} / ${candidateSoftwareProjects.length} projects...`);
  }
  console.log(' Done.');

  // Count projects with TOR files and awarded contracts
  const withTorCount = enrichedSoftwareProjects.filter((p) => p.torStatus === 'AVAILABLE').length;
  const withWinnerCount = enrichedSoftwareProjects.filter((p) => Boolean(p.winnerName)).length;

  console.log(`  - Projects with downloadable TOR documents: ${withTorCount}`);
  console.log(`  - Projects with awarded contracts/winners:   ${withWinnerCount}`);

  // 5. Upsert to MongoDB Atlas
  console.log('\n💾 Upserting software projects to MongoDB Atlas...');
  const upsertStats = await upsertDiscoveredProjects(enrichedSoftwareProjects);

  const afterCount = await ProcurementProject.countDocuments();

  console.log('\n====================================================');
  console.log('🎉 BMA e-Procurement Extraction Summary:');
  console.log(`  ✓ Unique BMA Projects Scraped: ${allDiscovered.length}`);
  console.log(`  ✓ Software Tenders Matched:   ${candidateSoftwareProjects.length}`);
  console.log(`  ✓ With TOR Documents:        ${withTorCount}`);
  console.log(`  ✓ With Awarded Winners:      ${withWinnerCount}`);
  console.log(`  ✓ Upserted to MongoDB:       ${upsertStats.upsertedCount} new records`);
  console.log(`  ✓ Updated Existing:          ${upsertStats.modifiedCount} records`);
  console.log(`  📊 Total records in DB now:   ${afterCount} (was ${beforeCount})`);
  console.log('====================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ BMA extraction failed:', err);
  process.exit(1);
});
