// =============================================================================
// scripts/translate-projects.ts
// Batch translation enrichment script to translate all Thai project fields
// (titles, departments, descriptions, summaries) to English and persist them
// to MongoDB (both Project and ProcurementProject collections).
//
// Usage: npx tsx scripts/translate-projects.ts
// =============================================================================

import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Project from '../src/models/Project';
import ProcurementProject from '../src/models/ProcurementProject';
import { translateDepartment, translateProjectTitle } from '../src/services/translation/dictionary';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/torbidd';
const MONGODB_DB = process.env.MONGODB_DB || 'torbidd';

async function main() {
  console.log('🌐 [Translate Projects] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  console.log('✅ Connected to MongoDB.');

  let totalProjectsUpdated = 0;
  let totalProcurementUpdated = 0;

  // ── 1. Enrich Project Collection ───────────────────────────────────────────
  console.log('\n📦 Checking Project collection for missing/incomplete English translations...');
  const projects = await Project.find({});
  console.log(`Found ${projects.length} Project documents.`);

  for (const proj of projects) {
    let modified = false;

    // Title
    const titleTh = proj.title?.th || '';
    const titleEn = proj.title?.en || '';
    if (titleTh && (!titleEn || titleEn === titleTh || /^[\u0E00-\u0E7F]/.test(titleEn))) {
      const translated = translateProjectTitle(titleTh);
      proj.title = { th: titleTh, en: translated };
      modified = true;
    }

    // Department
    const deptTh = proj.department?.th || '';
    const deptEn = proj.department?.en || '';
    if (deptTh && (!deptEn || deptEn === deptTh || /^[\u0E00-\u0E7F]/.test(deptEn))) {
      const translated = translateDepartment(deptTh);
      proj.department = { th: deptTh, en: translated };
      modified = true;
    }

    // Description
    const descTh = proj.description?.th || '';
    const descEn = proj.description?.en || '';
    if (descTh && (!descEn || descEn === descTh || /^[\u0E00-\u0E7F]/.test(descEn))) {
      const translated = proj.title?.en || translateProjectTitle(descTh);
      proj.description = { th: descTh, en: translated };
      modified = true;
    }

    // Summary (if present)
    if (proj.summary?.th) {
      const sumTh = proj.summary.th;
      const sumEn = proj.summary.en;
      if (!sumEn || sumEn === sumTh || /^[\u0E00-\u0E7F]/.test(sumEn)) {
        proj.summary = { th: sumTh, en: proj.title?.en || translateProjectTitle(sumTh) };
        modified = true;
      }
    }

    if (modified) {
      await proj.save();
      totalProjectsUpdated++;
    }
  }

  console.log(`✅ Updated ${totalProjectsUpdated} Project documents.`);

  // ── 2. Enrich ProcurementProject Collection ───────────────────────────────
  console.log('\n📦 Checking ProcurementProject collection for missing English translations...');
  const procurementProjects = await ProcurementProject.find({});
  console.log(`Found ${procurementProjects.length} ProcurementProject documents.`);

  for (const p of procurementProjects) {
    let modified = false;

    // projectNameEn
    if (!p.projectNameEn || p.projectNameEn.trim() === '' || /^[\u0E00-\u0E7F]/.test(p.projectNameEn)) {
      p.projectNameEn = translateProjectTitle(p.projectName);
      modified = true;
    }

    // agencyNameEn
    if (!p.agencyNameEn || p.agencyNameEn.trim() === '' || /^[\u0E00-\u0E7F]/.test(p.agencyNameEn)) {
      p.agencyNameEn = translateDepartment(p.agencyName);
      modified = true;
    }

    // summary.en
    if (p.summary?.th && (!p.summary.en || p.summary.en.trim() === '' || /^[\u0E00-\u0E7F]/.test(p.summary.en))) {
      p.summary = {
        th: p.summary.th,
        en: p.projectNameEn || translateProjectTitle(p.summary.th),
      };
      modified = true;
    }

    if (modified) {
      await p.save();
      totalProcurementUpdated++;
    }
  }

  console.log(`✅ Updated ${totalProcurementUpdated} ProcurementProject documents.`);
  console.log('\n🎉 Translation enrichment complete!');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Error running translation enrichment:', err);
  process.exit(1);
});

