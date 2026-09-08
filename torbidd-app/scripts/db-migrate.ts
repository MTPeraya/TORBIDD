// =============================================================================
// scripts/db-migrate.ts — MongoDB Atlas Migration Runner
// =============================================================================
// Runs schema migrations idempotently, in order.
// Each migration is a named, one-time function stored in the `migrations`
// collection after it succeeds, so it is never re-run.
//
// Usage:
//   npm run db:migrate
//
// To add a new migration:
//   1. Create a function in the MIGRATIONS array below.
//   2. Give it a unique `id` string (date + description is conventional).
//   3. Implement the `up()` function — must be idempotent.
//
// Exit codes:
//   0 — all pending migrations ran successfully (or none were pending)
//   1 — a migration failed or connection error
// =============================================================================

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const ok   = (msg: string) => console.log(`  ${GREEN}✓${RESET} ${msg}`);
const err  = (msg: string) => console.error(`  ${RED}✗${RESET} ${msg}`);
const skip = (msg: string) => console.log(`  ${YELLOW}–${RESET} ${msg} (already applied)`);

// ── Migration interface ───────────────────────────────────────────────────────
interface Migration {
  /** Unique identifier. Convention: YYYY-MM-DD_description */
  id: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  up: (db: any) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ██  MIGRATIONS REGISTRY  ███████████████████████████████████████████████████
//
// Add new migrations at the END of this array. Never remove or reorder them.
// ─────────────────────────────────────────────────────────────────────────────
const MIGRATIONS: Migration[] = [
  // ── 001 ─────────────────────────────────────────────────────────────────
  {
    id: '2026-09-09_001_add-text-index-to-projects',
    description: 'Add MongoDB text index on project titles for full-text search',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: any) {
      const col = db.collection('projects');

      // Check if text index already exists to ensure idempotency
      const indexes = await col.indexes();
      const hasTextIndex = (indexes as Array<{ key?: Record<string, unknown> }>).some((idx) =>
        Object.values(idx.key ?? {}).includes('text'),
      );

      if (!hasTextIndex) {
        await col.createIndex(
          { 'title.th': 'text', 'title.en': 'text', 'description.th': 'text' },
          { name: 'projects_text_search', default_language: 'none' },
        );
      }
    },
  },

  // ── 002 ─────────────────────────────────────────────────────────────────
  {
    id: '2026-09-09_002_add-status-field-to-projects',
    description: 'Backfill missing "status" field on existing project documents',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: any) {
      // Add `status: "open"` to any document that doesn't already have the field
      await db.collection('projects').updateMany(
        { status: { $exists: false } },
        { $set: { status: 'open' } },
      );
    },
  },

  // ── Add future migrations above this line ────────────────────────────────
];

// ── Migration record stored in the DB ────────────────────────────────────────
interface MigrationRecord {
  id: string;
  appliedAt: Date;
}

// ── Runner ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const uri    = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'torbidd';

  if (!uri) {
    console.error(`\n${RED}✗ MONGODB_URI is not set.${RESET}`);
    console.error('  Copy torbidd-app/.env.example → .env.local and fill in your Atlas URI.\n');
    process.exit(1);
  }

  console.log(`\n${CYAN}━━━ TORBIDD — Database Migration Runner ━━━${RESET}`);
  console.log(`  DB      : ${YELLOW}${dbName}${RESET}`);
  console.log(`  Total   : ${MIGRATIONS.length} migration(s) registered\n`);

  // ── Connect ──────────────────────────────────────────────────────────────
  console.log('🔌 Connecting to Atlas...');
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  ok(`Connected to database: ${YELLOW}${dbName}${RESET}\n`);

  const db = mongoose.connection.db!;
  const migrationsCol = db.collection<MigrationRecord>('migrations');

  // Ensure an index on `id` for O(1) lookups
  await migrationsCol.createIndex({ id: 1 }, { unique: true });

  // Load already-applied migration IDs
  const applied = new Set(
    (await migrationsCol.find({}, { projection: { id: 1 } }).toArray()).map(
      (r) => r.id,
    ),
  );

  console.log('🔄 Running migrations...');

  let ran = 0;
  let failed = 0;

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      skip(migration.id);
      continue;
    }

    process.stdout.write(`  ⏳ ${migration.id} ... `);
    try {
      await migration.up(db);
      await migrationsCol.insertOne({ id: migration.id, appliedAt: new Date() });
      process.stdout.write(`${GREEN}done${RESET}\n`);
      ran++;
    } catch (e) {
      process.stdout.write(`${RED}FAILED${RESET}\n`);
      err(`  Error: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
      // Stop on first failure to avoid cascading issues
      break;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(48));
  if (failed > 0) {
    console.error(`\n${RED}✗ Migration FAILED — ${failed} error(s). See above.${RESET}\n`);
  } else if (ran === 0) {
    console.log(`\n${GREEN}✓ No pending migrations — database is up to date.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}✓ ${ran} migration(s) applied successfully.${RESET}\n`);
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(`\n${RED}✗ Uncaught error:${RESET}`, e);
  void mongoose.disconnect();
  process.exit(1);
});
