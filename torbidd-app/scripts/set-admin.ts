#!/usr/bin/env tsx
// =============================================================================
// scripts/set-admin.ts - Grant Admin Role to User
// Usage:
//   npx tsx scripts/set-admin.ts [email]
// Example:
//   npx tsx scripts/set-admin.ts peraya.l@ku.th
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import connectToDatabase from '../src/lib/mongodb';
import User from '../src/models/User';

async function main() {
  const targetEmail = process.argv[2]?.trim().toLowerCase();

  await connectToDatabase();

  if (targetEmail) {
    console.log(`Setting admin role for email: ${targetEmail}...`);
    const res = await User.updateOne(
      { email: { $regex: new RegExp(`^${targetEmail}$`, 'i') } },
      { $set: { role: 'admin' } },
    );

    if (res.matchedCount === 0) {
      console.warn(`⚠️ No user found with email "${targetEmail}". Upserting a record...`);
      await User.updateOne(
        { email: targetEmail },
        {
          $set: {
            email: targetEmail,
            role: 'admin',
            name: targetEmail.split('@')[0],
            org: 'Administrator',
          },
        },
        { upsert: true },
      );
    }
    console.log(`✓ User ${targetEmail} is now an admin!`);
  } else {
    console.log('No specific email provided. Promoting all existing users to admin...');
    const res = await User.updateMany({}, { $set: { role: 'admin' } });
    console.log(`✓ Updated ${res.modifiedCount} user(s) to admin role.`);
  }

  const allUsers = await User.find().lean();
  console.log('\n📋 Current Users in Database:');
  for (const u of allUsers) {
    console.log(`  - [${u.role}] ${u.email} (${u.name})`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to set admin:', err);
  process.exit(1);
});
