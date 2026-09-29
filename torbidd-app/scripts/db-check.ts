// =============================================================================
// scripts/db-check.ts — MongoDB Atlas Health Check & Index Audit
// =============================================================================
// Connects to the Atlas cluster, verifies all required collections exist,
// documents counts, and that indexes are in place.
//
// Usage:
//   npm run db:check
//
// Exit codes:
//   0 — all checks passed
//   1 — connection failure or a required index is missing
// =============================================================================

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const ok  = (msg: string) => console.log(`  ${GREEN}✓${RESET} ${msg}`);
const err = (msg: string) => console.error(`  ${RED}✗${RESET} ${msg}`);
const info = (msg: string) => console.log(`  ${CYAN}ℹ${RESET} ${msg}`);

// ── Required collections + their expected indexes ────────────────────────────
interface CollectionCheck {
  name: string;
  requiredIndexes: string[];   // field names that must have an index
}

const REQUIRED_COLLECTIONS: CollectionCheck[] = [
  {
    name: 'projects',
    requiredIndexes: ['externalId', 'category', 'deadline', 'budget'],
  },
  {
    name: 'historicalprojects',
    requiredIndexes: ['category', 'year'],
  },
  {
    name: 'bookmarks',
    requiredIndexes: ['sessionId', 'projectId'],
  },
  {
    name: 'usersettings',
    requiredIndexes: ['sessionId'],
  },
];

async function main(): Promise<void> {
  const uri  = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'torbidd';

  if (!uri) {
    console.error(`\n${RED}✗ MONGODB_URI is not set.${RESET}`);
    console.error('  Copy torbidd-app/.env.example → .env.local and fill in your Atlas URI.\n');
    process.exit(1);
  }

  console.log(`\n${CYAN}━━━ TORBIDD — MongoDB Atlas Health Check ━━━${RESET}`);
  console.log(`  DB Name : ${YELLOW}${dbName}${RESET}`);
  console.log(`  URI     : ${YELLOW}${uri.replace(/:([^@]+)@/, ':***@')}${RESET}\n`);

  // ── Connect ──────────────────────────────────────────────────────────────
  console.log('🔌 Connecting to Atlas...');
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  ok(`Connected to database: ${YELLOW}${dbName}${RESET}`);

  const db = mongoose.connection.db!;
  let hasErrors = false;

  // ── List collections ─────────────────────────────────────────────────────
  console.log('\n📂 Collections:');
  const existingCollections = await db.listCollections().toArray();
  const existingNames = new Set(existingCollections.map((c) => c.name));

  for (const col of REQUIRED_COLLECTIONS) {
    if (existingNames.has(col.name)) {
      const count = await db.collection(col.name).countDocuments();
      ok(`${col.name} — ${YELLOW}${count}${RESET} document(s)`);
    } else {
      err(`${col.name} — collection NOT FOUND (run: npm run seed)`);
      hasErrors = true;
    }
  }

  // ── Audit indexes ─────────────────────────────────────────────────────────
  console.log('\n🗂️  Indexes:');
  for (const col of REQUIRED_COLLECTIONS) {
    if (!existingNames.has(col.name)) continue;

    const indexes = await db.collection(col.name).indexes();
    const indexedFields = new Set<string>();

    for (const idx of indexes) {
      Object.keys(idx.key ?? {}).forEach((field) => {
        indexedFields.add(field.replace(/^_/, '').split('.')[0]);
      });
    }

    info(`${col.name}: found ${indexes.length} index(es)`);

    for (const required of col.requiredIndexes) {
      if (indexedFields.has(required) || required === '_id') {
        ok(`  ${col.name}.${required}`);
      } else {
        err(`  ${col.name}.${required} — index MISSING`);
        hasErrors = true;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(48));
  if (hasErrors) {
    console.error(`\n${RED}✗ Health check FAILED — see errors above.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}✓ All checks passed — Atlas cluster is healthy!${RESET}\n`);
  }

  await mongoose.disconnect();
  process.exit(hasErrors ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(`\n${RED}✗ Uncaught error:${RESET}`, e);
  void mongoose.disconnect();
  process.exit(1);
});
